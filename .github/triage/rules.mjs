export const REJECTION_REASONS = new Set(['form', 'contact', 'duplicate'])

const URL_PATTERN = /https?:\/\/\S+/gi
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE_PATTERN = /(?<!\d)(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s.-]?\d{4}(?!\d)/
const CPF_PATTERN = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/

export function hasPersonalData(body) {
  const text = (body ?? '').replace(URL_PATTERN, ' ')
  return [EMAIL_PATTERN, PHONE_PATTERN, CPF_PATTERN].some((pattern) => pattern.test(text))
}

export function decideVerdict(reasons) {
  const distinctReasons = [...new Set(reasons)]
  const rejectionReasons = distinctReasons.filter((reason) => REJECTION_REASONS.has(reason))
  if (rejectionReasons.length) return { verdict: 'reject', reasons: rejectionReasons }
  if (distinctReasons.length) return { verdict: 'review', reasons: distinctReasons }
  return { verdict: 'verified', reasons: [] }
}
