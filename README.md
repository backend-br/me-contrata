<!--suppress HtmlDeprecatedAttribute -->

<p align="center">
  <img src="https://avatars3.githubusercontent.com/u/30732658?v=4&s=200.jpg" alt="BackEndBR" width="230" />
</p>

<div id='hire-me'></div>

# Me Contrata

Nesse espaço, a pessoa em busca de uma nova oportunidade no mercado, ou em busca de recolocação, irá cadastrar
uma nova issue com as informações necessárias para que empresas em busca de profissionais com o seu perfil possa entrar
em contato.

<div id='register'></div>

## Como se cadastrar?

Abra uma [issue](https://github.com/backend-br/me-contrata/issues/new/choose) com o formulário **Meu perfil**. A issue é
pública: não coloque telefone, e-mail ou documentos, porque o contato acontece pelos links do perfil.

Todo perfil novo passa por uma triagem automática, sem uso de IA:

- Os labels de nível, regime, modelo de trabalho e tecnologias saem do formulário e seguem a
  [taxonomia compartilhada](https://github.com/backend-br/.github/blob/main/taxonomy.json) com o
  [backend-br/vagas](https://github.com/backend-br/vagas).
- Perfis aprovados recebem o label `verificado`. Perfis com telefone, e-mail ou documento no texto recebem `em-triagem`
  e são revisados por uma pessoa mantenedora.
- Perfis sem o formulário completo, com links de contato inválidos ou de quem já tem outro perfil aberto são fechados
  com um comentário explicando o motivo; basta editar a issue para ela ser reavaliada.
- Um título que ainda é o do modelo vira `Nome completo - Cargo` com os dados do formulário.
- Comentários de outras pessoas ficam ocultos, para proteger o perfil de spam. Para falar com a pessoa, use os links do
  perfil.
- Perfis sem atualização por 60 dias são fechados. Para manter o perfil aberto, edite a issue ou faça um comentário.

## Divulgação

Quem marcar a opção de divulgação no formulário recebe o label `divulgar-perfil`, desde que o perfil esteja `verificado`.
O perfil passa a aparecer em [backend-br.github.io/talentos](https://backend-br.github.io/talentos/) e no comentário de
perfis compatíveis das vagas verificadas do [backend-br/vagas](https://github.com/backend-br/vagas). Ninguém é
mencionado. Para sair, desmarque a opção editando a issue.

Para mantenedores: revise os perfis em
[`label:em-triagem`](https://github.com/backend-br/me-contrata/issues?q=is%3Aissue+is%3Aopen+label%3Aem-triagem). Para
que a triagem nunca mais altere uma issue, adicione `revisado`. As regras ficam em `.github/triage/config.json`.

<div id='license'></div>

## Licença

Licenciado sob [MIT](LICENSE).

<div id='contributing'></div>

## Contribuindo

Siga as [diretrizes de contribuição](CONTRIBUTING.md) para contribuir com o projeto.
