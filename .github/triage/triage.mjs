import { appendFileSync, readFileSync } from 'node:fs'
import { isPlaceholderTitle, parseForm, titleFromForm } from './form.mjs'
import { githubRequest, listOpenIssues, useOctokit } from './github.mjs'
import { labelChanges } from './labels.mjs'
import { COMMENT_MARKER, buildComment } from './messages.mjs'
import { decideVerdict, hasPersonalData } from './rules.mjs'
import { loadTaxonomy } from './taxonomy.mjs'

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)))
const PAGE_SIZE = 100

let taxonomy = null

export async function evaluate(issue, githubLookups) {
  const form = parseForm(issue.body)
  const reasons = [...form.problems]
  if (hasPersonalData(issue.body)) reasons.push('personal_data')
  const duplicateOf = await githubLookups.olderOpenProfile()
  if (duplicateOf) reasons.push('duplicate')
  return { form, duplicateOf, ...decideVerdict(reasons) }
}

function labelNamesOf(issue) {
  return issue.labels.map((label) => label.name)
}

function triageLabelNames() {
  const { verified, review, rejected } = config.labels
  return [verified, review, rejected]
}

function skipReason(issue, action) {
  const labelNames = labelNamesOf(issue)
  const wasNeverTriaged = !triageLabelNames().some((name) => labelNames.includes(name))
  if (issue.pull_request) return 'pull request'
  if (labelNames.includes(config.labels.override)) return 'maintainer override label'
  if (config.skipAssociations.includes(issue.author_association)) return 'posted by a maintainer'
  if (new Date(issue.created_at) < new Date(config.formsSince)) return 'created before the profile form'
  if (action === 'edited' && wasNeverTriaged) return 'edited issue that was never triaged'
  return null
}

function githubLookupsFor(issue, repo) {
  return {
    olderOpenProfile: async () => {
      const authorIssues = await githubRequest(
        'GET',
        `/repos/${repo}/issues?creator=${encodeURIComponent(issue.user.login)}&state=open&per_page=${PAGE_SIZE}`,
      )
      const older = authorIssues
        .filter((authorIssue) => !authorIssue.pull_request && authorIssue.number < issue.number)
        .map((authorIssue) => authorIssue.number)
      return older.length ? Math.min(...older) : null
    },
  }
}

async function applyTitle(issue, issuePath, result) {
  const title = result.form.isForm ? titleFromForm(result.form.fields) : ''
  if (title && isPlaceholderTitle(issue.title)) await githubRequest('PATCH', issuePath, { title })
}

async function applyLabels(issue, issuePath, result) {
  const { remove, add } = labelChanges({ issue, result, taxonomy, labels: config.labels })
  for (const name of remove) await githubRequest('DELETE', `${issuePath}/labels/${encodeURIComponent(name)}`)
  if (add.length) await githubRequest('POST', `${issuePath}/labels`, { labels: add })
}

async function upsertTriageComment(repo, issuePath, result) {
  const comments = await githubRequest('GET', `${issuePath}/comments?per_page=${PAGE_SIZE}`)
  const previousComment = comments.find(
    (comment) => comment.user.type === 'Bot' && comment.body.startsWith(COMMENT_MARKER),
  )
  const body = buildComment(result, repo)
  if (previousComment && previousComment.body !== body)
    await githubRequest('PATCH', `/repos/${repo}/issues/comments/${previousComment.id}`, { body })
  else if (!previousComment && result.verdict !== 'verified')
    await githubRequest('POST', `${issuePath}/comments`, { body })
}

async function applyState(issue, issuePath, result) {
  const wasRejectedByTriage = labelNamesOf(issue).includes(config.labels.rejected)
  if (result.verdict === 'reject' && issue.state === 'open') {
    await githubRequest('PATCH', issuePath, { state: 'closed', state_reason: 'not_planned' })
  } else if (result.verdict !== 'reject' && issue.state === 'closed' && wasRejectedByTriage) {
    await githubRequest('PATCH', issuePath, { state: 'open' })
  }
}

function formatLogLine(issue, { verdict, reasons }) {
  return reasons.length ? `#${issue.number}: ${verdict} (${reasons.join(', ')})` : `#${issue.number}: ${verdict}`
}

async function triageIssue(issue, repo, isDryRun) {
  const result = await evaluate(issue, githubLookupsFor(issue, repo))
  console.log(formatLogLine(issue, result))
  if (isDryRun) return result
  const issuePath = `/repos/${repo}/issues/${issue.number}`
  await applyTitle(issue, issuePath, result)
  await applyLabels(issue, issuePath, result)
  await upsertTriageComment(repo, issuePath, result)
  await applyState(issue, issuePath, result)
  return result
}

function writeJobSummary(rows, repo, isDryRun) {
  const issueLink = (issue) => `[#${issue.number}](https://github.com/${repo}/issues/${issue.number})`
  const lines = [
    `### Profile triage${isDryRun ? ' (dry run, nothing changed)' : ''}`,
    '',
    '| Issue | Verdict | Reasons | Shared |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      ({ issue, verdict, reasons, form }) =>
        `| ${issueLink(issue)} | ${verdict} | ${reasons.join(', ')} | ${form?.wantsSharing ? 'yes' : 'no'} |`,
    ),
  ]
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`)
}

async function triageRows(issues, repo, action, isDryRun) {
  const rows = []
  for (const issue of issues) {
    const reason = skipReason(issue, action)
    if (reason) {
      const skippedRow = { issue, verdict: 'skipped', reasons: [reason] }
      console.log(formatLogLine(issue, skippedRow))
      rows.push(skippedRow)
      continue
    }
    rows.push({ issue, ...(await triageIssue(issue, repo, isDryRun)) })
  }
  return rows
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH))
  const repo = process.env.GITHUB_REPOSITORY
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch')
    return writeJobSummary(await triageRows([event.issue], repo, event.action, false), repo, false)
  const { inputs } = event
  const isDryRun = inputs['dry-run'] !== 'false' && inputs['dry-run'] !== false
  if (isDryRun) console.log('Dry run: titles, labels, comments and states will not change.')
  const issues = inputs.issue
    ? [await githubRequest('GET', `/repos/${repo}/issues/${Number(inputs.issue)}`)]
    : await listOpenIssues(repo)
  writeJobSummary(await triageRows(issues, repo, 'manual', isDryRun), repo, isDryRun)
}

export function run({ github }) {
  useOctokit(github)
  taxonomy = loadTaxonomy()
  return main()
}
