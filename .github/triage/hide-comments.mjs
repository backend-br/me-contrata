import { readFileSync } from 'node:fs'
import { githubGraphql, useOctokit } from './github.mjs'

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url)))
const MINIMIZE_COMMENT = `
  mutation ($id: ID!) {
    minimizeComment(input: { subjectId: $id, classifier: OFF_TOPIC }) {
      minimizedComment {
        isMinimized
      }
    }
  }
`

export function shouldHide({ issue, comment }) {
  if (issue.pull_request) return false
  if (comment.user.type === 'Bot') return false
  if (comment.user.login === issue.user.login) return false
  return !config.skipAssociations.includes(comment.author_association)
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH))
  if (!shouldHide(event)) return console.log(`Comment ${event.comment.id} stays visible.`)
  await githubGraphql(MINIMIZE_COMMENT, { id: event.comment.node_id })
  console.log(`Comment ${event.comment.id} by ${event.comment.user.login} was hidden.`)
}

export function run({ github }) {
  useOctokit(github)
  return main()
}
