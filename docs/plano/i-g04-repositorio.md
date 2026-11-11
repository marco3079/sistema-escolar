# Mini-plano g04: repositório profissional

## Objetivo

Dar ao repositório público a documentação e os arquivos de apoio que se espera de um projeto profissional. O README é do g03; você cuida de todo o resto.

Leia antes: `docs/plano/instalacao.md`, `docs/plano/CONTRATOS.md` (fonte para a documentação da API e da arquitetura), `docs/plano/redesenho.md` (seção "Contrato de API"), `server/prisma/schema.prisma`, `docker-compose.yml`, `server/package.json`, `client/package.json` e a lista de pastas `server/src/modules/` e `client/src/modules/`.

## Arquivos que você pode criar (e só estes)

- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md`
- `.editorconfig`
- `.gitattributes`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/melhoria.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/ARQUITETURA.md`
- `docs/API.md`
- `docs/README.md`

**Não crie nada em `.github/workflows/`** (a credencial usada para enviar ao GitHub não tem permissão para arquivos de workflow; o envio inteiro seria recusado). Não edite `README.md`, `AGENTS.md`, `INSTALAR.md`, nada em `docs/plano/`, `server/` ou `client/`.

## Regras gerais

Tudo em português do Brasil, direto, sem enfeite e sem promessas que o projeto não cumpre. Nada de e-mail pessoal, nome de pessoa ou dado local: o contato é sempre pelo GitHub (`https://github.com/marco3079/sistema-escolar`). Nenhuma senha ou segredo.

## Passos

1. **`CONTRIBUTING.md`**: como relatar um defeito e sugerir melhoria (issues); como preparar o ambiente (`bash instalar.sh --demo` ou `instalar.ps1 -Demo` para subir com dados fictícios; desenvolvimento sem Docker conforme o README); estrutura do código (um módulo por pasta em `server/src/modules/<modulo>/routes.ts` e `client/src/modules/<modulo>/index.tsx`, carregados sozinhos); convenções (TypeScript estrito, nomes de domínio e rotas em português, sem dependência nova sem necessidade, cores só por variáveis de CSS de `client/src/ui/estilo.css`, erros da API como `{ erro }`); verificação obrigatória antes de abrir um pull request (`npx tsc --noEmit` em `server` e em `client`, `npx vite build` em `client`); mensagens de commit curtas, no imperativo, em português; fluxo de pull request (branch a partir de `main`, descrição do que mudou e de como foi testado, prints quando mexer em tela).
2. **`SECURITY.md`**: versões com suporte (a `main`); como relatar uma vulnerabilidade em particular (aba "Security" do repositório no GitHub, opção "Report a vulnerability"; não abrir issue pública); o que incluir no relato; e um resumo das medidas já existentes: senhas com bcrypt, login por JWT, permissões por perfil em cada rota, banco publicado só em `127.0.0.1`, segredos gerados pelo instalador num `.env` fora do Git, e a recomendação de pôr HTTPS (proxy reverso) na frente antes de expor o sistema à internet.
3. **`CODE_OF_CONDUCT.md`**: texto curto e próprio (não copie um código de conduta de terceiros): respeito, foco técnico, sem assédio nem discriminação, e como relatar um problema de conduta (aos mantenedores, pelo GitHub).
4. **`CHANGELOG.md`**: formato "Keep a Changelog", em português, com uma seção `## [Não lançado]` e uma `## [1.0.0] - 2026-11-10` listando, em "Adicionado": os três portais e os módulos; o redesenho da interface (painel com indicadores e gráfico, busca, avisos, temas claro e escuro); logo, ícones e ilustrações próprios; instalador e guia para assistentes de IA; ficha do aluno e do professor. Em "Alterado": o banco passa a nascer só com o administrador, com dados de demonstração opcionais.
5. **`.editorconfig`**: `root = true`; para todos os arquivos, `charset = utf-8`, `end_of_line = lf`, `insert_final_newline = true`, `indent_style = space`, `indent_size = 2`, `trim_trailing_whitespace = true`; para `*.md`, `trim_trailing_whitespace = false`; para `*.ps1`, `end_of_line = crlf`.
6. **`.gitattributes`**: `* text=auto eol=lf`; `*.sh text eol=lf`; `*.ps1 text eol=crlf`; `*.png binary`; `*.jpg binary`; `*.svg text eol=lf`.
7. **Modelos do GitHub**:
   - `bug.yml` (formulário): nome "Relatar um defeito", rótulo `bug`; campos: o que aconteceu, o que era esperado, passos para reproduzir, portal (lista: Administrativo, Professor, Aluno, Instalação), navegador ou sistema, prints ou logs. Um aviso no topo: não cole senhas nem o conteúdo do `.env`.
   - `melhoria.yml`: nome "Sugerir uma melhoria", rótulo `enhancement`; campos: qual problema resolve, como você imagina a solução, alternativas.
   - `config.yml`: `blank_issues_enabled: false` e um link de contato para a página de segurança do repositório, para vulnerabilidades.
   - `PULL_REQUEST_TEMPLATE.md`: o que mudou, por quê, como foi testado, lista de conferência (typecheck do servidor e do cliente, build do cliente, testado no celular quando for tela, sem segredos no diff, documentação atualizada).
8. **`docs/ARQUITETURA.md`**: visão dos três contêineres (banco, API, site com nginx fazendo proxy de `/api`), um diagrama em Mermaid (`flowchart LR`: navegador, nginx, API, PostgreSQL); como a API carrega os módulos; autenticação e perfis; como o cliente registra telas e monta o menu; o modelo de dados resumido por área (pessoas, estrutura acadêmica, matrícula, notas e frequência, pós-graduação, financeiro, biblioteca, agenda, comunicados), com um diagrama Mermaid `erDiagram` das entidades principais e suas relações (só nomes de entidades e relações, sem listar todos os campos); regras de negócio principais (regime seriado e por créditos, cálculo de nota final e frequência, aprovação com 75% e média 6 ou 7, pré-requisitos e vagas, bancas e status do projeto); temas e variáveis de CSS.
9. **`docs/API.md`**: referência da API para quem vai integrar: convenções (prefixo `/api`, JWT no cabeçalho `Authorization`, formato de erro, códigos HTTP), como autenticar (com um exemplo `curl` de login usando um e-mail e uma senha de exemplo genéricos, `voce@exemplo.com` e `SUA_SENHA`), e as tabelas de endpoints por módulo, copiadas da seção 5 de `docs/plano/CONTRATOS.md`, acrescidas de `GET /painel/resumo` e `GET /busca` (de `docs/plano/redesenho.md`) e de `GET /alunos/:id/ficha` e `GET /professores/:id/ficha` (formato em `docs/plano/i-g05-fichas-api.md`). Confira cada endpoint contra o código real em `server/src/modules/*/routes.ts`: se o código divergir do contrato, documente o que o código faz.
10. **`docs/README.md`**: índice da pasta `docs/`: `ARQUITETURA.md`, `API.md`, `imagens/` (prints) e `plano/` (registro de como o projeto foi planejado e dividido, mantido como histórico).

## Critérios de aceite

- Os 13 arquivos existem nos caminhos exatos; os `.yml` são YAML válido; os blocos Mermaid têm sintaxe válida.
- Nenhum arquivo em `.github/workflows/`.
- Nenhum e-mail pessoal, senha ou segredo; nenhuma promessa falsa (por exemplo, não diga que há testes automatizados ou integração contínua).
- `docs/API.md` não lista endpoint que não existe no código.

## Verificação

Leia de volta cada arquivo criado. Valide os YAML com `node -e` (por exemplo, conferindo indentação e chaves obrigatórias `name`, `description`, `body`) ou com `npx --yes js-yaml <arquivo>` se houver rede. Publique o resultado real.
