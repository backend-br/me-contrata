import { profileLabelsFromForm } from './form.mjs'
import { taxonomyLabelNames } from './taxonomy.mjs'

export function labelChanges({ issue, result, taxonomy, labels }) {
  const { verified, review, rejected, optIn } = labels
  const verdictLabel = { verified, review, reject: rejected }[result.verdict]
  const current = issue.labels.map((label) => label.name)
  const isRejected = result.verdict === 'reject'
  const wanted = [
    verdictLabel,
    ...(isRejected ? [] : profileLabelsFromForm(result.form.fields, taxonomy)),
    ...(result.verdict === 'verified' && result.form.wantsSharing ? [optIn] : []),
  ]
  const managed = new Set([...taxonomyLabelNames(taxonomy), verified, review, rejected, optIn])
  return {
    remove: current.filter((name) => managed.has(name) && !wanted.includes(name)),
    add: wanted.filter((name) => !current.includes(name)),
  }
}
