import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { FIELD_LABELS, isPlaceholderTitle, parseForm, profileLabelsFromForm, titleFromForm } from '../form.mjs'
import { shouldHide } from '../hide-comments.mjs'
import { labelChanges } from '../labels.mjs'
import { COMMENT_MARKER, buildComment } from '../messages.mjs'
import { hasPersonalData } from '../rules.mjs'
import { loadTaxonomy } from '../taxonomy.mjs'
import { evaluate } from '../triage.mjs'
import { taxonomy } from './taxonomy.fixture.mjs'

const LABELS = {
  verified: 'verificado',
  review: 'em-triagem',
  rejected: 'triagem-recusada',
  override: 'revisado',
  optIn: 'divulgar-perfil',
}

function profileBody(overrides = {}) {
  const fields = {
    [FIELD_LABELS.name]: 'Maria Silva',
    [FIELD_LABELS.role]: 'Desenvolvedora Back-end',
    [FIELD_LABELS.about]: 'Seis anos com APIs de pagamentos.',
    [FIELD_LABELS.experience]: '_No response_',
    [FIELD_LABELS.level]: 'Sênior',
    [FIELD_LABELS.contract]: 'CLT, PJ',
    [FIELD_LABELS.workModel]: 'Remoto, Híbrido',
    [FIELD_LABELS.location]: 'Belo Horizonte - MG',
    [FIELD_LABELS.stack]: 'Go, PostgreSQL',
    [FIELD_LABELS.linkedin]: 'https://www.linkedin.com/in/maria-silva',
    [FIELD_LABELS.github]: 'https://github.com/maria',
    [FIELD_LABELS.portfolio]: '_No response_',
    [FIELD_LABELS.sharing]: '- [X] Autorizo divulgar meu perfil.',
    [FIELD_LABELS.confirmations]: '- [X] Entendo que esta issue é pública.\n- [X] Este é o meu único perfil aberto.',
    ...overrides,
  }
  return Object.entries(fields)
    .map(([heading, value]) => `### ${heading}\n\n${value}`)
    .join('\n\n')
}

const noOlderProfile = { olderOpenProfile: async () => null }

function issueWith(body, labels = []) {
  return { number: 20, title: 'Nome completo - Cargo', body, labels: labels.map((name) => ({ name })) }
}

function dropdownOptions(id) {
  const lines = readFileSync(new URL('../../ISSUE_TEMPLATE/profile.yml', import.meta.url), 'utf8').split('\n')
  const start = lines.findIndex((line) => line.trim() === `id: ${id}`)
  const options = []
  let isInOptions = false
  for (const line of lines.slice(start + 1)) {
    if (/^\s+- type:/.test(line)) break
    if (line.trim() === 'options:') isInOptions = true
    else if (isInOptions && /^\s+- /.test(line))
      options.push(
        line
          .trim()
          .slice(2)
          .replace(/^"(.*)"$/, '$1'),
      )
    else if (isInOptions) isInOptions = false
  }
  return options
}

test('a complete profile is verified and labeled from the form', async () => {
  const issue = issueWith(profileBody())

  const result = await evaluate(issue, noOlderProfile)

  assert.equal(result.verdict, 'verified')
  assert.equal(result.form.wantsSharing, true)
  assert.deepEqual(profileLabelsFromForm(result.form.fields, taxonomy), [
    'Sênior',
    'CLT',
    'PJ',
    'Remoto',
    'Híbrido',
    'Go',
    'PostgreSQL',
  ])
})

test('the placeholder title is replaced by the name and the role', () => {
  const { fields } = parseForm(profileBody())

  assert.equal(isPlaceholderTitle('Nome completo - Cargo'), true)
  assert.equal(isPlaceholderTitle('Coloque seu nome completo aqui'), true)
  assert.equal(isPlaceholderTitle('Maria Silva - Back-end'), false)
  assert.equal(titleFromForm(fields), 'Maria Silva - Desenvolvedora Back-end')
})

test('a body without the form, missing fields or unchecked confirmations is rejected', async () => {
  const withoutForm = await evaluate(issueWith('## Nome completo\n\nMaria'), noOlderProfile)
  const withoutStack = await evaluate(issueWith(profileBody({ [FIELD_LABELS.stack]: '_No response_' })), noOlderProfile)
  const unchecked = await evaluate(
    issueWith(profileBody({ [FIELD_LABELS.confirmations]: '- [ ] Entendo.\n- [X] Único.' })),
    noOlderProfile,
  )

  assert.deepEqual(withoutForm.reasons, ['form'])
  assert.deepEqual(withoutStack.reasons, ['form'])
  assert.deepEqual(unchecked.reasons, ['form'])
})

test('contact links must be profile links', async () => {
  const result = await evaluate(
    issueWith(profileBody({ [FIELD_LABELS.linkedin]: 'linkedin.com/maria' })),
    noOlderProfile,
  )

  assert.equal(result.verdict, 'reject')
  assert.deepEqual(result.reasons, ['contact'])
})

test('a second open profile of the same person is rejected', async () => {
  const result = await evaluate(issueWith(profileBody()), { olderOpenProfile: async () => 12 })

  assert.deepEqual(result.reasons, ['duplicate'])
  assert.match(buildComment(result, 'backend-br/me-contrata'), /o #12\. Edite aquele perfil/)
})

test('personal data sends the profile to review', async () => {
  const result = await evaluate(
    issueWith(profileBody({ [FIELD_LABELS.about]: 'Me chame no (31) 99876-5432.' })),
    noOlderProfile,
  )

  assert.equal(result.verdict, 'review')
  assert.deepEqual(result.reasons, ['personal_data'])
})

test('finds phones, e-mails and CPFs, but not the numbers of links and dates', () => {
  assert.equal(hasPersonalData('maria@email.com'), true)
  assert.equal(hasPersonalData('+55 31 99876-5432'), true)
  assert.equal(hasPersonalData('123.456.789-09'), true)
  assert.equal(hasPersonalData('https://www.linkedin.com/in/maria-12345678901'), false)
  assert.equal(hasPersonalData('De 2019 a 2023, 6 anos com Go.'), false)
})

test('only verified profiles that opted in get the sharing label', () => {
  const issue = issueWith(profileBody(), ['em-triagem', 'Pleno', 'Python', 'Stale'])
  const verified = { verdict: 'verified', form: parseForm(profileBody()) }
  const review = { verdict: 'review', form: parseForm(profileBody()) }

  const forVerified = labelChanges({ issue, result: verified, taxonomy, labels: LABELS })
  const forReview = labelChanges({ issue, result: review, taxonomy, labels: LABELS })

  assert.deepEqual(forVerified.remove, ['em-triagem', 'Pleno', 'Python'])
  assert.deepEqual(forVerified.add, [
    'verificado',
    'Sênior',
    'CLT',
    'PJ',
    'Remoto',
    'Híbrido',
    'Go',
    'PostgreSQL',
    'divulgar-perfil',
  ])
  assert.ok(!forReview.add.includes('divulgar-perfil'))
})

test('unchecking the sharing box removes the sharing label', () => {
  const body = profileBody({ [FIELD_LABELS.sharing]: '- [ ] Autorizo divulgar meu perfil.' })
  const issue = issueWith(body, ['verificado', 'divulgar-perfil'])

  const changes = labelChanges({
    issue,
    result: { verdict: 'verified', form: parseForm(body) },
    taxonomy,
    labels: LABELS,
  })

  assert.deepEqual(changes.remove, ['divulgar-perfil'])
})

test('comments by others are hidden, but not those of the author, maintainers and bots', () => {
  const issue = { user: { login: 'maria' } }
  const comment = (login, association = 'NONE', type = 'User') => ({
    user: { login, type },
    author_association: association,
  })

  assert.equal(shouldHide({ issue, comment: comment('spammer') }), true)
  assert.equal(shouldHide({ issue, comment: comment('maria') }), false)
  assert.equal(shouldHide({ issue, comment: comment('mantenedora', 'MEMBER') }), false)
  assert.equal(shouldHide({ issue, comment: comment('github-actions[bot]', 'NONE', 'Bot') }), false)
  assert.equal(shouldHide({ issue: { ...issue, pull_request: {} }, comment: comment('spammer') }), false)
})

test('the triage comment starts with its marker', () => {
  const body = buildComment({ verdict: 'reject', reasons: ['form'] }, 'backend-br/me-contrata')

  assert.ok(body.startsWith(COMMENT_MARKER))
  assert.match(body, /issues\/new\/choose/)
})

test('the options of the form are the shared taxonomy', { skip: !process.env.TAXONOMY_FILE }, () => {
  const shared = loadTaxonomy()
  const names = (facet) => shared[facet].map((entry) => entry.name)

  assert.deepEqual(dropdownOptions('level'), names('levels'))
  assert.deepEqual(dropdownOptions('contract'), names('contracts'))
  assert.deepEqual(dropdownOptions('work-model'), names('workModels'))
  assert.deepEqual(dropdownOptions('stack'), names('stacks'))
})
