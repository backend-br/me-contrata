import { readFileSync } from 'node:fs'

export const FACETS = ['levels', 'contracts', 'workModels', 'stacks']

export function loadTaxonomy(file = process.env.TAXONOMY_FILE) {
  if (!file) throw new Error('TAXONOMY_FILE is not set.')
  return JSON.parse(readFileSync(file))
}

function termsOf(entry) {
  return [entry.name, ...entry.aliases]
}

export function canonicalName(taxonomy, facet, value) {
  const key = (value ?? '').trim().toLowerCase()
  if (!key) return null
  return taxonomy[facet].find((entry) => termsOf(entry).some((term) => term.toLowerCase() === key))?.name ?? null
}

export function canonicalNames(taxonomy, facet, text) {
  const names = (text ?? '').split(',').map((value) => canonicalName(taxonomy, facet, value))
  return [...new Set(names.filter(Boolean))]
}

export function taxonomyLabelNames(taxonomy) {
  return new Set(FACETS.flatMap((facet) => taxonomy[facet].map((entry) => entry.name)))
}
