# Quinta leva: pendências, central de notificações, cópia de segurança e planilhas

Primeira leva do [ROTEIRO.md](ROTEIRO.md). O usuário disse "vai" em 13/11/2026.

Itens: corrigir pendências atuais; central de notificações (o sino); cópia de segurança do banco com baixar e restaurar; importar e exportar planilhas. Entra também um agendador simples de tarefas (a cópia diária e a limpeza de avisos dependem dele).

**Mudança em relação ao roteiro (decisão do main):** o armazenamento de arquivos passa para o início da leva 6, onde nascem os primeiros usos reais (materiais e tarefas); construí-lo agora, sem nada que o use, deixaria as regras de acesso sem como testar.

Padrões definidos pelo main (sem perguntar): cópia automática diária às 3h, guardando as 7 mais recentes; avisos apagados depois de 60 dias; planilhas em CSV com ponto e vírgula e UTF-8 (abre direto no Excel em português).

O schema (`server/prisma/schema.prisma`) **já foi alterado pelo main** e o Prisma Client já foi gerado: modelo `Notificacao` e os campos `backupAutomatico`, `backupHora`, `backupManter` em `ConfiguracaoPlataforma`. Ninguém edita o schema.

Regras gerais (iguais às das levas anteriores): módulos do servidor em `server/src/modules/<modulo>/routes.ts` (`export default router`, `export const publico` para rotas sem login), com `asyncHandler`, `HttpError`, `validar`, `idParam`, `permitir` e `prisma`; erros `{ erro: string }`; cliente com `api` de `client/src/lib/api.ts`, componentes de `client/src/ui/index.tsx`, cores só por variáveis, classes com prefixo do módulo, nada estoura em 360 px, temas claro e escuro. Verificação: `npx tsc --noEmit` no lado em que mexeu. Não rode `npm install`, `vite build` nem Docker. Em todo comando do BUS, passe o nome da sala `sistema_escolar`.

---

## Contrato A: agendador (`server/src/lib/agendador.ts`)

```ts
// Registra uma tarefa que roda uma vez por dia na hora dada (0 a 23, relógio do servidor).
// `hora` pode ser função (lida a cada verificação, para valer a configuração atual); devolver null = desligada.
export function registrarTarefaDiaria(nome: string, hora: number | (() => Promise<number | null>), tarefa: () => Promise<void>): void;
// Registra uma tarefa que roda a cada `minutos`.
export function registrarTarefaPeriodica(nome: string, minutos: number, tarefa: () => Promise<void>): void;
// Liga o relógio (verifica a cada minuto). Chamado uma vez em server.ts, depois de criar o app.
export function iniciarAgendador(): void;
```

- Os módulos registram suas tarefas ao serem carregados (no topo do `routes.ts`).
- A tarefa diária roda no máximo uma vez por dia e por nome; se o servidor estava desligado na hora, roda na primeira verificação depois dela, no mesmo dia. Guarda a data da última execução em memória e num arquivo JSON em `process.env.DIRETORIO_DADOS ?? '/dados'` (`agendador.json`; se não conseguir gravar, segue só em memória).
- Uma tarefa nunca roda duas vezes ao mesmo tempo; erro de uma tarefa é registrado no console e não derruba nada; temporizadores com `.unref()`.

## Contrato B: notificações

### `server/src/lib/notificacoes.ts`

```ts
export type TipoNotificacao = 'COMUNICADO' | 'SUPORTE' | 'FORUM' | 'NOTA' | 'FINANCEIRO' | 'MEDALHA' | 'BIBLIOTECA' | 'SISTEMA';

export interface NovaNotificacao {
  tipo: TipoNotificacao;
  titulo: string;        // até 120 caracteres (cortar)
  texto?: string;        // até 300 caracteres (cortar)
  link?: string;         // caminho dentro do portal, sem prefixo: "/comunicados", "/forum/p/12", "/boletim"...
  chave?: string;        // se já existir aviso com a mesma chave para o usuário, não cria outro
}

// Cria o aviso para cada usuário (sem repetir ids). Nunca lança e não espera: uso "dispare e siga".
export function notificar(usuarioIds: number[], aviso: NovaNotificacao): void;
```

- Grava com `createMany({ skipDuplicates: true })` em lotes de 500.
- Registra uma tarefa periódica de limpeza (a cada 720 minutos) que apaga avisos com mais de 60 dias.

### Rotas (`server/src/modules/notificacoes/routes.ts`, todos os perfis, sempre só os avisos do próprio usuário)

```ts
interface NotificacaoDTO { id: number; tipo: TipoNotificacao; titulo: string; texto: string; link: string | null; criadaEm: string; lida: boolean }
```

| Rota | Resposta |
|---|---|
| `GET /notificacoes?limite=&antesDe=` | `{ itens: NotificacaoDTO[]; haMais: boolean; naoLidas: number }`, do mais novo para o mais antigo; `limite` 1 a 50 (padrão 20); `antesDe` = id |
| `GET /notificacoes/nao-lidas` | `{ total: number }` |
| `POST /notificacoes/:id/lida` | `204` (aviso de outra pessoa: `404`) |
| `POST /notificacoes/lidas` | marca todas as minhas como lidas, `204` |
| `DELETE /notificacoes/:id` | `204` (de outra pessoa: `404`) |

`GET /notificacoes` e `GET /notificacoes/nao-lidas` ficam fora do registro automático de atividades (são consultadas a cada 30 s).

### Onde os avisos nascem (sempre depois de gravar, sem atrasar nem derrubar a resposta)

| Evento | Quem recebe | Aviso |
|---|---|---|
| Comunicado publicado | o público do comunicado, menos o autor (mesma lista do e-mail) | COMUNICADO, título do comunicado, link `/comunicados` |
| Mensagem nova em chamado | da equipe: o autor do chamado; do autor: o responsável (se houver) | SUPORTE, "Nova resposta no chamado: {assunto}"; link `/atendimento` para quem atende e sem link para o autor (ele abre pelo menu do usuário) |
| Comentário numa publicação do fórum | o autor da publicação (se não for quem comentou) e, em resposta, o autor do comentário pai | FORUM, "{nome} comentou em: {título}", link `/forum/p/{id}` |
| Nota lançada ou alterada no diário | o aluno | NOTA, "Nota lançada em {disciplina}", link `/boletim`, `chave` `nota:{avaliacaoId}:{alunoId}:{aaaa-mm-dd}` (uma por dia) |
| Fechamento do diário (situação final) | cada aluno da turma | NOTA, "Resultado final em {disciplina}: {situação}", link `/boletim` |
| Mensalidades geradas | cada aluno | FINANCEIRO, "Nova mensalidade de {competência}", link `/financeiro`, `chave` `mensalidade:{id}` |
| Pagamento registrado | o aluno | FINANCEIRO, "Pagamento confirmado: {competência}", link `/financeiro` |
| Medalha manual concedida | quem recebeu | MEDALHA, "Você recebeu a medalha {título}", link `/perfil` |
| Empréstimo registrado na biblioteca | quem pegou o livro | BIBLIOTECA, "Empréstimo registrado: {título}, devolução até {data}", link `/biblioteca` |

O chat não gera aviso no sino (ele já tem o próprio contador).

## Contrato C: cópia de segurança (`server/src/modules/backups/routes.ts`, só ADMIN)

Arquivos em `process.env.DIRETORIO_BACKUPS ?? '/dados/backups'` (volume `dados_backups`). Nome: `escola-AAAAMMDD-HHMMSS-<origem>.sql.gz`, origem `auto`, `manual`, `enviado` ou `pre-restauracao`. Todo nome recebido pela API é validado por `^escola-\d{8}-\d{6}-(auto|manual|enviado|pre-restauracao)\.sql\.gz$` antes de tocar no disco (nunca aceitar barra, `..` ou outro formato).

Ferramentas: `pg_dump` e `psql` da **mesma versão principal do servidor (16)**, chamados com `spawn` e argumentos em lista, com a conexão vinda de `DATABASE_URL` (passada pela variável de ambiente `PGPASSWORD` e pelos argumentos de host, porta, usuário e banco; nunca a senha na linha de comando nem em mensagem de erro).

```ts
interface BackupDTO { nome: string; tamanho: number; criadoEm: string; origem: 'auto' | 'manual' | 'enviado' | 'pre-restauracao' }
interface ConfigBackupDTO { backupAutomatico: boolean; backupHora: number; backupManter: number; ultimoAutomatico: string | null; ferramentasOk: boolean }
```

| Rota | O que faz |
|---|---|
| `GET /backups` | `{ config: ConfigBackupDTO; itens: BackupDTO[]; emAndamento: string | null }` (itens do mais novo para o mais antigo; `emAndamento` = "copia" ou "restauracao" enquanto roda) |
| `PUT /backups/configuracao` | `{ backupAutomatico, backupHora (0 a 23), backupManter (1 a 60) }` → `ConfigBackupDTO` |
| `POST /backups` | cria uma cópia manual agora e espera terminar: `201 BackupDTO`; `409` se já houver cópia ou restauração em andamento |
| `GET /backups/:nome` | baixa o arquivo (`Content-Disposition: attachment`, `application/gzip`) |
| `POST /backups/enviar` | corpo bruto do arquivo `.sql.gz` (até 200 MB, `express.raw` só nesta rota, `Content-Type: application/gzip`); confere a assinatura gzip (bytes `1f 8b`); grava como `enviado`: `201 BackupDTO` |
| `DELETE /backups/:nome` | `204` |
| `POST /backups/:nome/restaurar` | corpo `{ confirmacao: 'RESTAURAR' }` (senão `400`). Faz antes uma cópia `pre-restauracao`; depois restaura numa única transação (`psql -v ON_ERROR_STOP=1 --single-transaction`). `200 { restaurado: true; copiaAnterior: string }` ou `500 { erro }` com o banco intacto (a transação desfaz). `409` se houver operação em andamento |

- A cópia usa `pg_dump --no-owner --no-privileges --clean --if-exists` comprimida com gzip (do Node, `zlib`), gravada primeiro com sufixo `.parcial` e renomeada no fim.
- Cópia automática: `registrarTarefaDiaria('backup', hora da configuração ou null se desligada, ...)`; depois de criar, apaga as automáticas mais antigas além de `backupManter`. As manuais, enviadas e de pré-restauração não são apagadas sozinhas, mas o total é limitado a 40 arquivos (a rota de criar ou enviar responde `400` pedindo para apagar antigas).
- Registro de atividades manual (sem conteúdo): "Criou uma cópia de segurança", "Baixou uma cópia de segurança", "Enviou uma cópia de segurança", "Apagou uma cópia de segurança", "Restaurou o banco a partir de uma cópia". As rotas de `/backups` ficam fora do registro automático.
- A restauração troca **todos** os dados, inclusive usuários e senhas: o cliente avisa e pede a palavra de confirmação.
- `ferramentasOk`: `pg_dump --version` responde e é da versão 16.

Infra desta parte: `server/Dockerfile` instala `postgresql-client-16` (repositório oficial do PostgreSQL para Debian, com a chave em `/usr/share/keyrings`); `docker-compose.yml` ganha o volume `dados_backups:/dados/backups` e `dados_api:/dados` na `api` (o segundo para o `agendador.json`); `client/nginx.conf` ganha um `location /api/backups/` com `client_max_body_size 210m`, `proxy_request_buffering off` e tempos limite de 600 s (repita os cabeçalhos de proxy do `location /api/`).

## Contrato D: pendências

1. **E-mail sem diferenciar maiúsculas**: login, "esqueci minha senha" e a checagem de e-mail já usado passam a comparar sem diferenciar maiúsculas de minúsculas (`mode: 'insensitive'`), e todo e-mail novo ou alterado é gravado aparado e em minúsculas.
2. **Nome e ícone do aplicativo instalado**: rotas públicas novas no módulo `plataforma`:
   - `GET /plataforma/manifesto` → manifesto do PWA (`application/manifest+json`, `Cache-Control: no-cache`) com `name` = nome da plataforma, `short_name` = nome cortado em 12 caracteres, `theme_color` = cor primária, `start_url: "/"`, `display: "standalone"`, `background_color: "#ffffff"` e ícones apontando para `/api/plataforma/logo` (192 e 512, `purpose: "any"`) quando houver logo própria, ou para `/logo-simbolo.png` e `/logo-simbolo-192.png` quando não houver.
   - `GET /plataforma/logo` → a logo: data URL decodificada e servida com o tipo certo (`Cache-Control: public, max-age=300`); endereço http(s): `302` para ele; sem logo: `302` para `/logo-simbolo.png`.
   - `client/index.html`: `<link rel="manifest" href="/api/plataforma/manifesto">`.
3. Conferência das telas do chat e de senha no celular: é do main, no teste final.

## Contrato E: base do cliente

- `client/src/lib/csv.ts`:

```ts
export function gerarCsv(cabecalho: string[], linhas: string[][]): string;      // separador ";", aspas quando preciso, CRLF, BOM UTF-8 no início
export function baixarTexto(nomeArquivo: string, conteudo: string, tipo?: string): void; // cria um Blob e dispara o download
export function lerCsv(texto: string): string[][];                               // aceita ";" ou "," (detecta pela primeira linha), aspas, quebras de linha dentro de aspas, BOM; ignora linhas vazias
```

- `Tabela` (em `client/src/ui/index.tsx`) ganha a prop opcional `exportar?: string` (nome do arquivo, sem extensão). Com ela, aparece acima da tabela, à direita, um botão discreto "Exportar" (ícone `documento`) que gera um CSV das linhas **exibidas**, lendo o texto das células da tabela renderizada (`textContent` normalizado, sem a coluna de ações), com o título das colunas no cabeçalho, e baixa `{nome}-{aaaa-mm-dd}.csv`. Funciona também no celular (a tabela larga continua no DOM, só escondida).
- `client/src/lib/api.ts` ganha:

```ts
api.baixar(caminho: string, nomeArquivo: string): Promise<void>;                 // GET autenticado, salva o corpo como arquivo
api.enviarArquivo<T>(caminho: string, arquivo: Blob, tipo: string): Promise<T>;  // POST com o corpo bruto e o Content-Type dado
```

- **Central de notificações** (`client/src/layout/Notificacoes.tsx`, reescrito; a `Layout` continua usando `<Notificacoes raiz={raizPortal} />`): contador de não lidas no sino (`GET /notificacoes/nao-lidas` a cada 30 s, pausa com a aba oculta, atualiza ao voltar o foco); ao abrir, painel com os 20 avisos mais recentes (`GET /notificacoes`), cada um com ícone por tipo, título, texto, tempo relativo e ponto de não lido; clicar marca como lido e navega para `${raiz}${link}` quando houver link; "Marcar todas como lidas"; "Carregar mais"; estado vazio "Nenhum aviso por aqui."; fecha com Esc e clique fora; no celular o painel ocupa a largura da tela. Avisos de comunicado deixam de vir de `/comunicados` (o contador do sino passa a ser o das notificações).

---

## Partes

| Parte | Gerador | Arquivos (só estes) |
|---|---|---|
| Q1: agendador e notificações no servidor | g15 | `server/src/lib/agendador.ts`, `server/src/lib/notificacoes.ts`, `server/src/modules/notificacoes/routes.ts` (novos), `server/src/server.ts`, `server/src/app.ts` (só a exclusão do log) |
| Q2: avisos nos módulos e e-mail do login | g16 | `server/src/modules/comunicados/routes.ts`, `suporte/routes.ts`, `forum/routes.ts`, `diario/routes.ts`, `financeiro/routes.ts`, `conquistas/routes.ts`, `biblioteca/routes.ts`, `auth/routes.ts` |
| Q3: cópia de segurança, manifesto e infra | g08 | `server/src/modules/backups/routes.ts` (novo), `server/src/modules/plataforma/routes.ts`, `server/Dockerfile`, `docker-compose.yml`, `client/nginx.conf`, `client/index.html` |
| Q4: importação e e-mail nos cadastros | g17 | `server/src/modules/cadastros/routes.ts`, `server/src/modules/cadastros/importacao.ts` (novo) |
| Q5: base do cliente | g18 | `client/src/lib/csv.ts` (novo), `client/src/lib/api.ts`, `client/src/ui/index.tsx`, `client/src/ui/estilo.css`, `client/src/layout/Notificacoes.tsx`, `client/src/layout/casca.css`, `client/src/ui/icones.tsx` (se precisar de ícone) |
| Q6: aba "Cópia de segurança" | g19 | `client/src/modules/configuracoes/Backup.tsx` (novo), `Configuracoes.tsx`, `tipos.ts`, `configuracoes.css` |
| Q7: importar planilha e exportar nas listas | g06 | `client/src/modules/cadastros/ImportarPlanilha.tsx` (novo), `alunos.tsx`, `professores.tsx`, `usuarios.tsx`, `tipos.ts`, `fichas.css`; e só a prop `exportar` nas tabelas de `client/src/modules/academico/{cursos,periodos,turmas}.tsx`, `matriculas/index.tsx`, `financeiro/index.tsx`, `biblioteca/index.tsx`, `logs/LogSistema.tsx` |

Depois de aprovadas: dados de demonstração (alguns avisos) e documentação.

### Q1 (g15)

Implemente os contratos A e B (a lib e as rotas; os avisos nos módulos são do g16). `server.ts` chama `iniciarAgendador()` depois de `criarApp()`. Publique uma nota na sala assim que `lib/notificacoes.ts` e `lib/agendador.ts` estiverem gravados (g16 e g08 dependem das assinaturas).

### Q2 (g16)

1. Acrescente as chamadas a `notificar` da tabela "Onde os avisos nascem", cada uma logo depois da gravação correspondente, sem mudar respostas nem regras. Leia cada rota para achar o ponto certo e os dados (ids de usuário dos alunos vêm de `aluno.usuarioId`). Em comunicados e suporte, reaproveite as listas de destinatários que os avisos por e-mail já montam.
2. `auth/routes.ts`: item 1 do Contrato D para o login e para `POST /auth/esqueci-senha` (busca por e-mail sem diferenciar maiúsculas; `findUnique` vira `findFirst` com `mode: 'insensitive'`; a chave do limite de tentativas já usa minúsculas).
3. Programe contra `notificar` do contrato; se o typecheck reclamar que `lib/notificacoes.ts` ainda não existe, espere a nota do g15.

### Q3 (g08)

Implemente o Contrato C e o item 2 do Contrato D, mais a infra. Cuidados: nunca montar comando em texto; validar o nome do arquivo antes de qualquer acesso ao disco; `emAndamento` como trava em memória; fluxos de leitura e escrita com tratamento de erro e limpeza do arquivo `.parcial`; a restauração não pode deixar o banco pela metade (transação única). Use `registrarTarefaDiaria` do Contrato A (do g15). No `Dockerfile`, mantenha o que já existe e só acrescente a instalação do cliente do PostgreSQL 16.

### Q4 (g17)

1. `POST /alunos/importar` e `POST /professores/importar` (mesmos perfis que hoje criam aluno e professor). Corpo: `{ linhas: Record<string, string>[]; simular: boolean; senhaInicial?: string }` (até 500 linhas; `senhaInicial` com 8 caracteres ou mais, obrigatória quando `simular` é falso). Resposta: `{ total: number; validas: number; criadas: number; resultados: { linha: number; situacao: 'OK' | 'ERRO' | 'CRIADA'; erros: string[]; nome: string; email: string }[] }`.
2. Colunas (nomes exatos do cabeçalho, sem diferenciar maiúsculas e acentos): alunos: `nome`, `email`, `cpf`, `telefone`, `nascimento` (dd/mm/aaaa ou aaaa-mm-dd), `endereco`, `responsavel_nome`, `responsavel_email`, `responsavel_telefone`; professores: `nome`, `email`, `cpf`, `telefone`, `titulacao` (os valores do enum, aceitando também os rótulos em português), `area`. Obrigatórias: as mesmas que o cadastro individual exige (leia os schemas zod atuais e reaproveite as validações). O RA do aluno e o registro do professor são gerados como no cadastro individual.
3. Valida todas as linhas (e-mail repetido dentro do arquivo ou já cadastrado, formato, campos obrigatórios). Com `simular: true` não grava nada. Com `simular: false` só grava se **todas** as linhas forem válidas (senão `400` com o relatório), numa única transação; cada usuário criado recebe o e-mail de boas-vindas pelo mesmo caminho do cadastro individual.
4. `GET /alunos/importar/modelo` e `GET /professores/importar/modelo` → `{ colunas: string[]; exemplo: string[] }`.
5. Item 1 do Contrato D nos cadastros: e-mail aparado e em minúsculas ao criar e ao editar, e `garantirEmailLivre` sem diferenciar maiúsculas.
6. Registro de atividades: a importação aparece como "Importou {n} alunos por planilha" (ou professores), sem os dados.

### Q5 (g18)

Implemente o Contrato E. Publique uma nota na sala assim que `csv.ts`, `api.ts` e a prop `exportar` estiverem gravados (g19 e g06 dependem).

### Q6 (g19)

Aba **Cópia de segurança** na tela de configurações (depois de "E-mail" e antes de "Atualização"):

1. Cartão "Cópia automática": chave ligada/desligada, hora (0 a 23) e quantas guardar; "Salvar"; texto com a data da última cópia automática. Aviso quando `ferramentasOk` for falso.
2. Botão "Criar cópia agora" (mostra "Criando..." enquanto espera) e "Enviar arquivo de cópia" (escolhe um `.sql.gz`, envia com `api.enviarArquivo`, mostra o progresso como "Enviando...").
3. Lista das cópias: data, origem em `Selo` (Automática, Manual, Enviada, Antes de restaurar), tamanho legível e menu de ações: "Baixar" (`api.baixar`), "Restaurar" e "Apagar" (com confirmação).
4. Restaurar: `Modal` com aviso forte ("Isto substitui todos os dados atuais, inclusive usuários e senhas, pelos dados desta cópia. Uma cópia do estado atual é feita antes."), campo para digitar `RESTAURAR` e botão habilitado só com a palavra certa. Depois do sucesso: aviso de que é preciso entrar de novo, e botão "Ir para o login" (limpa a sessão local).
5. Nota fixa: "As cópias contêm todos os dados do sistema. Guarde os arquivos baixados em lugar seguro."

### Q7 (g06)

1. `ImportarPlanilha.tsx`: componente em `Modal` usado por Alunos e Professores (botão "Importar planilha" na barra de ferramentas, só para quem pode criar): baixar o modelo (monta o CSV com `gerarCsv` a partir de `GET .../importar/modelo`), escolher o arquivo `.csv`, ler com `lerCsv`, mostrar a prévia (tabela com as primeiras linhas e a contagem), "Conferir" (`simular: true`) mostrando linha a linha o que está certo e os erros, campo "Senha inicial" (8 caracteres ou mais, com a explicação de que cada pessoa recebe o e-mail para criar a própria senha quando o envio de e-mail está ligado) e "Importar" (habilitado só sem erros). No fim: quantos foram criados e recarrega a lista.
2. Prop `exportar` nas tabelas das telas listadas (nome do arquivo em minúsculas, por exemplo `alunos`, `turmas`, `mensalidades`). Não mude mais nada nessas telas.

### Q8 (g01): avisos de demonstração

Arquivo (só este): `server/prisma/seed-demo.ts`. No fim de `carregarDemonstracao`, sem alterar o que existe: cerca de 12 registros de `Notificacao` nas últimas 48 horas para Marina, Lucas, a professora Ana e a secretaria, cobrindo os tipos COMUNICADO, NOTA, FINANCEIRO, FORUM, SUPORTE, MEDALHA e BIBLIOTECA, com títulos no padrão da tabela "Onde os avisos nascem", links válidos para o portal de cada um e metade já lida (`lidaEm`). Datas determinísticas, sem `chave`. `cd server && npx tsc --noEmit`.

### Q9 (g04): documentação da quinta leva

Arquivos (só estes): `README.md`, `INSTALAR.md`, `SECURITY.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `CHANGELOG.md`, `.env.example` (só conferir o comentário de `FUSO_HORARIO`). A partir do código real:

1. `docs/API.md`: módulos **notificações** e **cópia de segurança** (todas as rotas, formatos e códigos), rotas de importação de alunos e professores (colunas, obrigatórias, formato da resposta, limite de 500 linhas), `GET /plataforma/manifesto` e `GET /plataforma/logo`; nota de que o e-mail é comparado sem diferenciar maiúsculas.
2. `docs/ARQUITETURA.md`: "Agendador de tarefas", "Central de notificações" (onde os avisos nascem), "Cópia de segurança" (pg_dump e psql 16 na imagem da API, volumes `dados_backups` e `dados_api`, restauração em transação única com cópia anterior) e "Planilhas" (exportação feita no navegador a partir da tabela exibida; importação validada no servidor, tudo ou nada); entidade `Notificacao` no modelo; variável `FUSO_HORARIO`.
3. `SECURITY.md`: as cópias contêm todos os dados (inclusive senhas em hash e a senha do e-mail cifrada) e ficam num volume do Docker; só o administrador cria, baixa, envia e restaura; nomes de arquivo validados; restauração exige palavra de confirmação e troca todos os dados; planilha exportada neutraliza fórmulas; a importação define uma senha inicial igual para todos do lote (orientar a troca).
4. `README.md`: recursos novos (central de notificações, cópia de segurança, importar e exportar planilhas) e uma subseção curta "Cópia de segurança" (onde fica, automática diária, como baixar e restaurar, recomendação de guardar cópias fora do computador); `FUSO_HORARIO` na tabela de variáveis.
5. `INSTALAR.md`: perguntas "Como faço uma cópia de segurança?" e "Como passo o sistema para outro computador?" (baixar a cópia, instalar no outro, enviar o arquivo e restaurar).
6. `CHANGELOG.md`: itens em 1.0.0, sem cabeçalho repetido.
7. Sem e-mail pessoal, caminho local, segredo nem promessa de CI.
