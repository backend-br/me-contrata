export const COMMENT_MARKER = '<!-- profile-triage -->'

const TEXT = {
  reject: 'Este perfil foi fechado automaticamente pela triagem.',
  review: 'Este perfil está em triagem e será revisado por uma pessoa mantenedora. Enquanto isso, ele não é divulgado.',
  verified: 'Este perfil foi revisado e aprovado pela triagem.',
  fix: (repo) =>
    `Edite a issue corrigindo os pontos abaixo e ela será reavaliada automaticamente. Para um perfil novo, use o [formulário](https://github.com/${repo}/issues/new/choose).`,
  mistake: 'Se achar que foi um engano, comente aqui.',
  reasons: {
    form: 'O formulário não foi usado ou está incompleto (campos obrigatórios ou confirmações desmarcadas).',
    contact:
      'O LinkedIn precisa ser o link do perfil (https://www.linkedin.com/in/...). O GitHub, se informado, precisa ser o link do perfil (https://github.com/usuario).',
    duplicate: (number) => `Você já tem um perfil aberto, o #${number}. Edite aquele perfil em vez de abrir outro.`,
    personal_data:
      'O texto parece ter telefone, e-mail ou documento. Como a issue é pública, remova esses dados e deixe o contato pelos links do perfil.',
  },
}

export function buildComment({ verdict, reasons, duplicateOf }, repo) {
  const lines = [COMMENT_MARKER, '', TEXT[verdict]]
  if (verdict === 'reject') lines.push('', TEXT.fix(repo))
  if (verdict !== 'verified') {
    lines.push('')
    for (const reason of reasons) {
      const reasonText = TEXT.reasons[reason]
      lines.push(`- ${typeof reasonText === 'function' ? reasonText(duplicateOf) : reasonText}`)
    }
  }
  if (verdict === 'reject') lines.push('', TEXT.mistake)
  return lines.join('\n')
}
