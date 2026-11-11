# Plano: banco limpo, instalação fácil, repositório profissional e fichas

## Pedidos

1. "Deixa só a conta de administrador e limpa todo o banco, dá o commit e push, e coloca de uma pessoa conseguir instalar de uma forma fácil usando a IA, baixando todas as dependências."
2. "Coloca prints com dados exemplos no README.md."
3. "Deixa o repositório bem profissional."
4. "Cria um botão dropdown com várias opções [no fim de cada linha da lista] e quando clicar no aluno abre um popup com a ficha do aluno, tipo um mini dashboard sobre aquele aluno mostrando tudo sobre ele, e faz a mesma coisa nos professores."

## Decisões do main

- O sistema passa a nascer **vazio**, só com a conta de administrador. Os dados de demonstração deixam de ser carregados por padrão, mas continuam no repositório como opção (`SEED_DEMO=true`): o teste de ponta a ponta da API e os prints do README dependem deles.
- A senha do administrador **não fica no repositório**. O instalador gera uma senha aleatória e a grava no arquivo `.env` (que não vai para o Git). Sem instalador, o servidor gera uma e a imprime uma única vez no log.
- O administrador ganha a tela "Meu perfil" para trocar a própria senha (hoje só professor e aluno têm).
- Instalação em um comando: `instalar.ps1` (Windows) e `instalar.sh` (Linux e macOS). O script confere o Docker, oferece instalar o que faltar, cria o `.env` com segredos aleatórios, sobe os contêineres (o Docker baixa todas as dependências), espera o sistema responder e mostra o endereço e o acesso do administrador.
- "Usando a IA": o arquivo `AGENTS.md` na raiz traz instruções passo a passo escritas para um assistente de IA (Claude Code, Cursor, Copilot e similares) instalar o sistema para a pessoa, e o `INSTALAR.md` traz o texto pronto para a pessoa colar no assistente.
- Integração contínua (GitHub Actions) fica de fora: a credencial usada para enviar ao GitHub não tem permissão para arquivos de workflow.
- Prints do README: capturados pelo main numa instalação temporária com os dados de demonstração (fictícios), salvos em `docs/imagens/`.

## Contrato entre as partes

### Variáveis de ambiente (arquivo `.env` na raiz, lido pelo Docker Compose)

| Variável | Padrão | Uso |
|---|---|---|
| `POSTGRES_PASSWORD` | `escola` | senha do banco |
| `JWT_SECRET` | `troque-este-segredo-de-exemplo` | assinatura dos logins |
| `ADMIN_NOME` | `Administrador` | nome da conta inicial |
| `ADMIN_EMAIL` | `admin@escola.local` | e-mail da conta inicial |
| `ADMIN_SENHA` | vazio | senha da conta inicial; vazio = o servidor gera uma e imprime no log |
| `SEED_DEMO` | `false` | `true` carrega os dados de demonstração (só para teste) |
| `WEB_PORT` | `8090` | porta do site |
| `API_PORT` | `3090` | porta da API |
| `DB_PORT` | `5432` | porta do banco, publicada só em `127.0.0.1` |

### Comportamento do seed (`server/prisma/seed.ts`, dono: g01)

Roda em toda subida do contêiner da API.

1. Se **não existe nenhum usuário**: cria o administrador (`perfil: ADMIN`, ativo) com `ADMIN_NOME`, `ADMIN_EMAIL` e `ADMIN_SENHA`. Se `ADMIN_SENHA` estiver vazia ou tiver menos de 8 caracteres, gera uma senha aleatória de 16 caracteres. Imprime exatamente este bloco (a linha "Senha gerada" só aparece quando a senha foi gerada pelo servidor; senha vinda de `ADMIN_SENHA` nunca é impressa):
   ```
   ==== ADMINISTRADOR CRIADO ====
   E-mail: <email>
   Senha gerada: <senha>
   Troque a senha em "Meu perfil" depois do primeiro acesso.
   ==============================
   ```
2. Se já existe usuário: imprime `Banco já possui dados, seed ignorado.` e não altera nada.
3. Se `SEED_DEMO=true` **e** o banco estava vazio no passo 1: depois de criar o administrador, carrega os dados de demonstração (`server/prisma/seed-demo.ts`).

### Dados de demonstração (`server/prisma/seed-demo.ts`, dono: g01)

É o seed atual, movido de arquivo, exportando `export async function carregarDemonstracao(prisma: PrismaClient): Promise<void>`. Mantém todos os usuários e dados de hoje (inclusive `admin@escola.demo` e a senha `demo1234`), porque o teste de ponta a ponta usa esses acessos. Não verifica mais se o banco está vazio (quem decide é o `seed.ts`).

Com `SEED_DEMO=true`, o banco fica com o administrador de `ADMIN_EMAIL` **e** os usuários de demonstração.

### Prints do README (arquivos feitos pelo main, referenciados pelo g03)

| Arquivo | Conteúdo |
|---|---|
| `docs/imagens/painel-claro.png` | Tela inicial do administrativo, tema claro |
| `docs/imagens/painel-escuro.png` | Tela inicial do administrativo, tema escuro |
| `docs/imagens/alunos.png` | Lista de alunos |
| `docs/imagens/ficha-aluno.png` | Ficha do aluno (mini painel) |
| `docs/imagens/diario.png` | Diário do professor |
| `docs/imagens/boletim-celular.png` | Boletim do aluno em tamanho de celular |
| `docs/imagens/login.png` | Tela de login |

## Partes

| Agente | Mini-plano | Arquivos |
|---|---|---|
| `g01` | [i-g01-seed-admin.md](i-g01-seed-admin.md) | `server/prisma/seed.ts`, `server/prisma/seed-demo.ts`, `server/.env.example` |
| `g02` | [i-g02-perfil-admin.md](i-g02-perfil-admin.md) | `client/src/modules/cadastros/index.tsx`, `client/src/layout/MenuUsuario.tsx` |
| `g03` | [i-g03-instalador.md](i-g03-instalador.md) | `instalar.ps1`, `instalar.sh`, `AGENTS.md`, `INSTALAR.md`, `README.md`, `docker-compose.yml`, `.env.example` |
| `g04` | [i-g04-repositorio.md](i-g04-repositorio.md) | `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `.editorconfig`, `.gitattributes`, modelos em `.github/`, `docs/ARQUITETURA.md`, `docs/API.md`, `docs/README.md` |
| `g05` | [i-g05-fichas-api.md](i-g05-fichas-api.md) | `server/src/modules/fichas/routes.ts` |
| `g06` | [i-g06-fichas-tela.md](i-g06-fichas-tela.md) | menu de ações e fichas em `client/src/modules/cadastros/` |

Depois: revisor em cada entrega. O main testa a instalação limpa com o script nesta máquina (banco apagado, só o administrador, login e telas vazias funcionando), sobe uma segunda instalação temporária com `SEED_DEMO=true` em outras portas para rodar o teste de ponta a ponta e capturar os prints, e envia ao GitHub.

## Andamento

| Parte | Estado |
|---|---|
| Mini-planos | feito |
| Entregas | não iniciadas |
| Teste, prints e envio | não iniciado |
