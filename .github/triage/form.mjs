import { canonicalNames } from './taxonomy.mjs'

export const FIELD_LABELS = {
  name: 'Nome completo',
  role: 'Cargo',
  about: 'Apresentação',
  experience: 'Experiência',
  level: 'Nível',
  contract: 'Regimes de contratação',
  workModel: 'Modelos de trabalho',
  location: 'Localização',
  stack: 'Tecnologias',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfólio',
  sharing: 'Divulgação',
  confirmations: 'Confirmações',
}

const REQUIRED_FIELDS = ['name', 'role', 'about', 'level', 'contract', 'workModel', 'location', 'stack', 'linkedin']
const LINKEDIN_PATTERN = /^https:\/\/(www\.)?linkedin\.com\/in\/[\w%-]+\/?$/i
const GITHUB_PATTERN = /^https:\/\/github\.com\/[a-z\d](?:[a-z\d-]{0,38})\/?$/i
const TITLE_PLACEHOLDERS = ['nome completo - cargo', 'coloque seu nome completo aqui']

function valuesByHeading(body) {
  const valueByHeading = {}
  for (const section of (body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/^###\s+/m)
    .slice(1)) {
    const headingEnd = section.indexOf('\n')
    const heading = (headingEnd === -1 ? section : section.slice(0, headingEnd)).trim()
    const value = headingEnd === -1 ? '' : section.slice(headingEnd + 1).trim()
    valueByHeading[heading] = value === '_No response_' ? '' : value
  }
  return valueByHeading
}

function isChecked(text) {
  return /^- \[[xX]\] /m.test(text ?? '')
}

function hasAllChecked(text) {
  return isChecked(text) && !/^- \[ \] /m.test(text)
}

export function parseForm(body) {
  const valueByHeading = valuesByHeading(body)
  const fields = {}
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    if (label in valueByHeading) fields[field] = valueByHeading[label]
  }
  if (Object.keys(fields).length < REQUIRED_FIELDS.length / 2) return { isForm: false, fields: {}, problems: ['form'] }
  const problems = []
  const isComplete = REQUIRED_FIELDS.every((field) => fields[field]) && hasAllChecked(fields.confirmations)
  if (!isComplete) problems.push('form')
  const hasValidContact =
    LINKEDIN_PATTERN.test(fields.linkedin ?? '') && (!fields.github || GITHUB_PATTERN.test(fields.github))
  if (fields.linkedin && !hasValidContact) problems.push('contact')
  return { isForm: true, fields, problems, wantsSharing: isChecked(fields.sharing) }
}

export function profileLabelsFromForm(fields, taxonomy) {
  return [
    ...canonicalNames(taxonomy, 'levels', fields.level),
    ...canonicalNames(taxonomy, 'contracts', fields.contract),
    ...canonicalNames(taxonomy, 'workModels', fields.workModel),
    ...canonicalNames(taxonomy, 'stacks', fields.stack),
  ]
}

export function isPlaceholderTitle(title) {
  const key = (title ?? '').trim().toLowerCase()
  return !key || TITLE_PLACEHOLDERS.includes(key)
}

export function titleFromForm(fields) {
  return [fields.name, fields.role]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' - ')
}
