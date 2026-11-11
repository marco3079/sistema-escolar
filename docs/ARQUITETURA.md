# Arquitetura

Este documento descreve como o sistema escolar é montado por dentro: os contêineres, a forma como a API e o site carregam seus módulos, a autenticação, as telas e o modelo de dados.

## Visão geral dos contêineres

O Docker Compose sobe três contêineres:

| Contêiner | Imagem ou build | Função | Porta |
|---|---|---|---|
| `db` | `postgres:16-alpine` | Banco de dados PostgreSQL | `127.0.0.1:5432` (só no computador) |
| `api` | build de `server/` | API HTTP (Node 20, Express 4, Prisma 5) | `127.0.0.1:API_PORT` (padrão 3090), só no computador |
| `web` | build de `client/` | Site estático servido pelo nginx | `WEB_PORT` (padrão 8090) |

O nginx do contêiner `web` entrega os arquivos do site e encaminha as requisições de `/api/` para o contêiner `api`. Por isso, o navegador só precisa falar com uma porta do site.

```mermaid
flowchart LR
  nav["Navegador"] -->|"porta 8090"| web["web (nginx)"]
  web -->|"/api/"| api["api (Express e Prisma)"]
  api -->|"SQL"| db[("PostgreSQL 16")]
```

O banco de dados e a porta direta da API são publicados somente em `127.0.0.1`, ou seja, só o próprio computador os acessa. O site (`WEB_PORT`) é publicado em todas as interfaces, por isso pode ser aberto pela rede local (no celular, por exemplo), e também encaminha `/api`.

## Estrutura de pastas

```
server/
  prisma/schema.prisma           modelo de dados (fonte da verdade)
  prisma/seed.ts                 cria a conta de administrador na primeira subida
  prisma/seed-demo.ts            dados de demonstração (opcionais)
  src/server.ts                  sobe o servidor HTTP
  src/app.ts                     monta os middlewares e carrega os módulos
  src/lib/                       código compartilhado (erros, autenticação, regras)
  src/modules/<modulo>/routes.ts rotas de cada módulo
client/
  src/main.tsx, src/App.tsx      ponto de entrada e tabela de rotas
  src/lib/                       API, autenticação, tipos, rotas e busca de dados
  src/ui/                        componentes visuais e estilo.css
  src/layout/                    casca do app (barra lateral, topo, menu), painel e login
  src/modules/<modulo>/index.tsx telas de cada módulo
```

## Como a API carrega os módulos

O arquivo `server/src/app.ts` percorre as pastas de `server/src/modules/` em ordem alfabética. Cada pasta que tem um `routes.ts` é carregada. As regras são:

- Um módulo pode exportar `publico`, um roteador sem autenticação. Hoje, o módulo `auth` usa isso para o login, o teste de saúde e a senha por e-mail, e o módulo `plataforma` para `GET /api/plataforma`.
- O `default` do módulo é um roteador do Express montado em `/api` com o middleware `autenticar`, que exige o token JWT.
- As rotas fixas (por exemplo, `/turmas/minhas`) são declaradas antes das rotas com parâmetro (`/turmas/:id`), para não haver conflito.
- Rotas que não existem recebem `404` com `{ "erro": "Rota não encontrada" }`.

Erros passam por um tratador único, que responde:

- `HttpError` (usado pelo código das rotas): o status e a mensagem definidos na hora do erro.
- Violação de chave única do Prisma: `409`.
- Registro não encontrado no Prisma: `404`.
- JSON mal formado: `400`.
- Qualquer outro erro: `500` com `{ "erro": "Erro interno" }`, e o detalhe vai só para o log do servidor.

Os blocos de código compartilhados ficam em `server/src/lib/`:

- `erros.ts`: `HttpError`, `asyncHandler`, `idParam` e `validar` (com validação por zod).
- `auth.ts`: `autenticar`, `permitir(...perfis)` e a geração do token.
- `regras.ts`: frequência mínima, média mínima por nível e a situação final da inscrição.
- `prisma.ts`: o cliente do Prisma, único para todo o servidor.

## Autenticação e perfis

- O login (`POST /api/auth/login`) recebe e-mail e senha, confere o hash da senha com bcrypt e devolve um JWT e os dados do usuário.
- As rotas protegidas esperam o cabeçalho `Authorization: Bearer <token>`.
- O token carrega o id do usuário, o perfil, o id do aluno e o id do professor (quando houver). Assim, as rotas sabem quem está logado sem consultar a tabela de usuários a cada passo. O token vale por 12 horas.
- O login tem limite de tentativas: 10 falhas em 10 minutos para o mesmo endereço de IP e e-mail fazem as próximas tentativas receberem `429` até a janela passar.
- `permitir(...)` responde `403` quando o perfil do usuário não está na lista da rota.

Há cinco perfis:

| Perfil | Portal | Resumo |
|---|---|---|
| `ADMIN` | Administrativo | Acesso total, inclusive usuários, reabertura de turmas e o log de atividades. |
| `TI` | Administrativo | Mesmo acesso do `ADMIN`. No servidor, o `TI` é tratado como `ADMIN` nas permissões. O perfil real continua no token e aparece no log e no menu do usuário. |
| `SECRETARIA` | Administrativo | Cadastros, matrículas, financeiro e comunicados. Não gerencia usuários. |
| `PROFESSOR` | Professor | Suas turmas, diário, notas, frequência, orientações. |
| `ALUNO` | Aluno | Seus dados, matrícula, boletim, histórico, financeiro e biblioteca. |

Algumas rotas aplicam regras além do perfil, dentro do código. Exemplos: um professor só lança notas nas turmas dele, e um aluno só vê as próprias matrículas.

## Log de atividades

O servidor registra a atividade dos usuários em uma tabela própria (`LogAtividade`), que é consultada pelas telas Atividades e Log do sistema, só para ADMIN e TI.

- Um middleware em `server/src/app.ts` registra toda requisição autenticada sob `/api` ao terminar a resposta, sem atrasá-la. Ficam de fora `/api/saude`, tudo sob `/api/logs`, `/api/auth/login` (que tem registro próprio), as requisições `OPTIONS` e as quatro consultas de tempo real do chat (`/api/chat/sincronizar`, `/api/chat/nao-lidas`, `/api/chat/conversas/:id/digitando` e `/api/chat/conversas/:id/lida`).
- Entradas e saídas são registradas: `LOGIN` no sucesso, `FALHA_LOGIN` quando a senha ou o e-mail não batem, e `SAIDA` quando o usuário sai (`POST /api/auth/sair`).
- Telas abertas: o site envia `POST /api/logs/tela` a cada troca de tela. Se o mesmo usuário abrir o mesmo caminho em menos de 5 segundos, não é gravado de novo.
- Consultas repetidas: uma consulta (`CONSULTA`) do mesmo usuário no mesmo caminho, em menos de 90 segundos, não é gravada de novo. Assim, telas que se atualizam sozinhas não enchem o log.
- Cada registro guarda: data e hora, usuário, nome e perfil, tipo, módulo, descrição em português, método, caminho (sem query string), status HTTP, duração, IP e navegador (o cabeçalho `user-agent`, cortado em 200 caracteres).
- Não são guardados: corpo de requisição, senhas e tokens.
- Retenção: os registros com mais de 90 dias são apagados ao subir o servidor e a cada 24 horas.
- O painel de atividades atualiza sozinho: o site consulta o log a cada 5 segundos. Não há conexão permanente com o servidor.

## Perfil, medalhas e níveis

- Cada usuário tem um perfil com foto (`Usuario.foto`), nível e pontos. Os pontos são a soma das medalhas conquistadas.
- Medalhas automáticas são calculadas na hora, a partir dos dados do sistema (matrículas, frequência, notas, pagamentos, empréstimos, projetos, aulas, publicações no fórum). Não são gravadas, então sempre refletem o estado atual.
- Medalhas manuais são concedidas por administrador, secretaria ou professor (um professor só premia aluno da própria turma) e ficam gravadas na tabela `MedalhaConcedida`. Só quem concedeu, ou um administrador, pode removê-las.
- Os níveis de 1 a 5 seguem faixas de pontos: Iniciante, Dedicado, Destaque, Exemplar e Lendário.
- O perfil público (usado pelo fórum) mostra nome, perfil, foto, curso, titulação, nível e as medalhas conquistadas. Não mostra e-mail, CPF nem telefone.

As regras e a tabela das medalhas estão em `API.md`, na seção "Perfil, medalhas e níveis".

## Suporte (chamados)

- Os usuários abrem chamados por categoria: técnico, secretaria, financeiro ou acadêmico. A categoria define quem atende.
- Em `ACADEMICO`, o chamado é ligado a uma turma, e o professor dessa turma atende junto com administradores e TI.
- O chamado tem assunto, prioridade (baixa, normal ou alta), mensagens de texto com imagem anexa opcional, e um responsável, que é quem assumiu o atendimento.
- Fluxo de status: o chamado começa em `ABERTO`. Quando a equipe responde, passa a `EM_ATENDIMENTO`, ou a `AGUARDANDO_USUARIO` se pediu informação. Quando o autor responde, volta para `ABERTO`. A equipe pode marcar `RESOLVIDO`. Só o autor encerra (`FECHADO`), com uma avaliação de 1 a 5 opcional, ou reabre a partir de `RESOLVIDO` ou `FECHADO`.
- Um chamado encerrado não aceita novas mensagens.
- As listas mostram se há mensagem não lida para quem abriu e para a equipe.

## Fórum

- O fórum é organizado em comunidades, com um identificador (slug) gerado a partir do nome.
- Publicações podem receber voto para cima ou para baixo. O total de pontos é a soma dos votos e é recalculado a cada voto.
- Comentários formam uma árvore: cada comentário pode responder a outro da mesma publicação. A API devolve a lista plana com o campo `paiId`, e o site monta a árvore.
- A ordenação "Em alta" combina pontos e idade da publicação, para que o conteúdo recente e votado apareça primeiro. As outras opções são "Novas" e "Mais votadas".
- Moderação: administradores (inclusive TI) e secretaria podem fixar, fechar e remover publicações e comentários. O professor modera só as próprias publicações. Remover marca o conteúdo como removido, sem apagar o registro.

## Como o cliente monta as telas

- Cada módulo do cliente é a pasta `client/src/modules/<modulo>/`, com um `index.tsx` que exporta a lista `rotas`.
- Cada item da lista descreve uma tela: caminho, rótulo do menu, ícone, perfis que podem ver a tela, o componente da tela e a ordem no menu. Telas de detalhe ficam fora do menu.
- O `App.tsx` junta as listas de todos os módulos com `import.meta.glob`. Assim, criar uma pasta de módulo com o `index.tsx` basta para a tela entrar no sistema.
- O menu mostra só as telas do perfil logado. A barra lateral agrupa as telas em seções (por exemplo, Pessoas, Acadêmico, Ensino, Gestão, Agenda e Conta), definidas em `client/src/layout/grupos.ts`.
- Se um usuário abre uma tela de outro perfil, ele é redirecionado para o início do próprio portal.
- Chamadas à API passam por `client/src/lib/api.ts`, que prefixa `/api`, envia o token e transforma a mensagem `erro` em exceção. Em resposta `401`, o usuário é desconectado.
- A busca de dados das telas usa o hook `useDados`, que refaz a consulta quando o caminho muda.

Os componentes compartilhados (`Pagina`, `Tabela`, `Campo`, `Modal`, `Aviso` e outros) ficam em `client/src/ui/index.tsx`. Em celular, as tabelas viram cartões.

## Temas e variáveis de CSS

- O tema claro é o padrão. O tema escuro entra sozinho quando o aparelho está em modo escuro (`prefers-color-scheme`).
- Todas as cores, raios e sombras vêm de variáveis definidas em `client/src/ui/estilo.css`. Nenhum outro arquivo define cor fixa.
- As variáveis principais são `--cor-fundo`, `--cor-superficie`, `--cor-superficie-2`, `--cor-texto`, `--cor-texto-suave`, `--cor-borda`, `--cor-primaria`, `--cor-primaria-escura`, `--gradiente-primario`, `--cor-roxo`, `--cor-verde`, `--cor-laranja`, `--cor-perigo`, `--cor-sucesso`, `--cor-aviso`, `--cor-info`, `--raio`, `--raio-pequeno`, `--sombra` e `--sombra-primaria`.
- Cada variável tem um valor para o tema claro e outro para o escuro.

## Configurações da plataforma e identidade visual

- Nome, slogan, logo e cores ficam numa única linha da tabela `ConfiguracaoPlataforma` (id 1). A linha é criada na primeira leitura, com os valores padrão.
- A tela de configurações (menu Sistema, perfil ADMIN e TI) grava a identidade por `PUT /api/configuracoes/identidade`. Qualquer pessoa, antes do login, lê `GET /api/plataforma`, que devolve só o necessário para a tela de entrada: nome, slogan, logo, cores e se a recuperação de senha por e-mail está disponível.
- A leitura da configuração no servidor usa um cache de 30 segundos. Ao gravar, o cache é limpo na hora.
- A logo é uma data URL (JPEG, PNG ou WebP) ou um endereço `http(s)`. `null` volta à logo padrão do sistema.
- O site aplica as cores como variáveis CSS no elemento raiz do documento (`--cor-primaria`, `--cor-primaria-escura`, `--gradiente-primario` e as demais que dependem da primária). Com as cores padrão, nada é aplicado e valem as cores do tema. O nome também vai para o título da aba e a logo para o ícone do navegador.

## E-mail (SMTP, fila e histórico)

- O envio usa SMTP, pela biblioteca `nodemailer`. Servidor, porta, conexão segura, usuário, senha e remetente vêm da configuração gravada pela tela.
- Há dois caminhos. `enviarEmailAgora` espera o resultado e lança erro se falhar; é o usado pelo teste de envio. `enfileirarEmail` põe a mensagem na fila e volta na hora; é o usado pelos avisos (recuperação de senha, boas-vindas, comunicados e respostas do suporte), que nunca atrasam nem derrubam a resposta da rota.
- Antes de enfileirar, a fila confere se o envio está ligado e se o tipo de aviso está marcado. O teste ignora essas chaves e só exige o servidor configurado.
- A fila envia um e-mail por vez, com 300 ms entre um envio e o seguinte. Ela aceita até 500 mensagens pendentes; o excedente é registrado como falha ("Fila cheia"). A fila fica na memória do servidor: mensagens pendentes se perdem se o servidor reiniciar.
- Cada envio, com sucesso ou falha, grava uma linha em `EmailEnviado` (destinatário, assunto, tipo, situação, erro e data). O corpo do e-mail não é gravado. A tela mostra os 30 registros mais recentes.
- O e-mail tem versão HTML (cabeçalho com o nome da plataforma na cor primária, título, parágrafos, botão e rodapé) e versão texto. O texto enviado pela tela é escapado antes de virar HTML.
- Erros do servidor de e-mail são cortados em 300 caracteres e têm a senha removida antes de ir para a resposta e para o histórico. Cada etapa da conexão tem limite de 15 segundos.
- A senha do servidor fica cifrada no banco (veja `SECURITY.md`).

## Senha por e-mail

- Tabela `TokenSenha`. O token tem 32 bytes aleatórios, em hexadecimal. Ele só aparece no link enviado; o banco guarda apenas o SHA-256, e a busca é feita pelo hash.
- Dois tipos: `RECUPERACAO`, válido por 1 hora, e `BOAS_VINDAS`, válido por 7 dias, enviado no cadastro de uma conta nova para a pessoa criar a própria senha. Criar um novo token de recuperação invalida os anteriores da mesma conta.
- Ao usar o link, a troca da senha e a marcação do token como usado acontecem numa única transação. Só marca como usado se o token ainda estiver livre, o que evita uso duplo em pedidos simultâneos. Depois, os outros tokens da conta são invalidados.
- O pedido de recuperação responde igual, exista ou não a conta. O envio roda em segundo plano, separado da resposta.
- Os limites de pedidos ficam na memória, como o limite de login. Os pedidos são contados por IP e por IP com e-mail.

## Chat (consulta periódica, presença e tiques em memória)

- O chat não usa WebSocket. Com uma conversa aberta, o site consulta `GET /api/chat/sincronizar` a cada 2 segundos; sem conversa aberta, a cada 5 segundos. A aba oculta pausa a consulta. Assim, o chat funciona com o nginx e o Docker que já existem, sem configuração extra.
- `GET /api/chat/sincronizar` aceita `desde` e devolve só o que mudou. O `agora` devolvido vem recuado 2 segundos, para não perder uma mensagem gravada no mesmo instante. O cliente elimina repetidas pelo `id`.
- Três tabelas guardam o chat: `ChatConversa` (individual ou grupo; a individual tem uma chave única "menorId:maiorId", que impede duas conversas para o mesmo par), `ChatParticipante` (administrador do grupo, entrada, saída e as datas da última entrega e da última leitura de cada pessoa) e `ChatMensagem` (texto, imagem, resposta citada, aviso de sistema e data de apagada).
- Ficam só na memória do servidor, em `server/src/modules/chat/estado.ts`: a presença (online quem sincronizou ou consultou as não lidas nos últimos 20 segundos), quem está digitando (5 segundos por aviso) e o limite de 30 envios por minuto por pessoa. Esses mapas são limpos a cada minuto, para não crescerem sem limite. Ao reiniciar o servidor, todos aparecem offline e o limite de envio recomeça.
- Os tiques são calculados na leitura: cada mensagem minha ganha o menor estado entre os outros participantes ativos, pelas datas de entrega e leitura guardadas em `ChatParticipante`.
- As não lidas de todas as conversas saem numa consulta agregada, e a lista de conversas traz a última mensagem de cada uma numa única consulta. Não há uma consulta por conversa.
- Quem entra num grupo, ou volta depois de sair, só vê o que foi enviado a partir da data de entrada.

## Modelo de dados

O modelo completo está em `server/prisma/schema.prisma`. Ele é organizado nas áreas abaixo (só os nomes principais):

- **Pessoas**: `Usuario` (conta de acesso), `Aluno` e `Professor` (dados de cada pessoa, ligados ao usuário).
- **Estrutura acadêmica**: `Curso`, `Disciplina` (com pré-requisitos), `PeriodoLetivo` e `Turma` (uma disciplina, em um período, com um professor).
- **Matrícula**: `Matricula` (aluno em um curso) e `Inscricao` (matrícula em uma turma).
- **Notas e frequência**: `Avaliacao`, `Nota`, `Aula` e `Presenca`.
- **Pós-graduação**: `ProjetoPesquisa`, `Banca` e `BancaMembro`.
- **Financeiro**: `Mensalidade` e `Bolsa`. É controle interno, sem cobrança nem integração de pagamento.
- **Biblioteca**: `Livro` e `Emprestimo`.
- **Agenda**: `HorarioAula` e `EventoCalendario`.
- **Comunicados**: `Comunicado` e `ComunicadoLeitura`, que registra quem leu.
- **Log de atividades**: `LogAtividade`, um registro por ação, sem chave estrangeira para o usuário (veja a seção "Log de atividades").
- **Perfil e medalhas**: `MedalhaConcedida`, só as medalhas manuais (veja a seção "Perfil, medalhas e níveis").
- **Suporte**: `Chamado` e `ChamadoMensagem`.
- **Fórum**: `ForumComunidade`, `ForumPublicacao`, `ForumComentario` e `ForumVoto`.
- **Plataforma**: `ConfiguracaoPlataforma`, uma linha com a identidade visual e as configurações de e-mail (veja a seção "Configurações da plataforma e identidade visual").
- **E-mail**: `EmailEnviado`, o histórico de envios, sem o corpo do e-mail.
- **Senha por e-mail**: `TokenSenha`, guardado só como hash.
- **Chat**: `ChatConversa`, `ChatParticipante` e `ChatMensagem`.

Os relacionamentos principais estão no diagrama abaixo. Os campos ficam de fora para manter o diagrama legível.

```mermaid
erDiagram
  Usuario ||--o| Aluno : "é"
  Usuario ||--o| Professor : "é"
  Usuario ||--o{ Emprestimo : "retira"
  Usuario ||--o{ Comunicado : "escreve"
  Aluno ||--o{ Matricula : "tem"
  Curso ||--o{ Disciplina : "contém"
  Curso ||--o{ Matricula : "recebe"
  Disciplina }o--o{ Disciplina : "pré-requisito de"
  Disciplina ||--o{ Turma : "é ofertada em"
  PeriodoLetivo ||--o{ Turma : "agrupa"
  Professor ||--o{ Turma : "leciona"
  Turma ||--o{ Inscricao : "recebe"
  Turma ||--o{ Avaliacao : "tem"
  Turma ||--o{ Aula : "tem"
  Turma ||--o{ HorarioAula : "tem"
  Matricula ||--o{ Inscricao : "faz"
  Matricula ||--o{ Mensalidade : "gera"
  Matricula ||--o{ Bolsa : "recebe"
  Matricula ||--o| ProjetoPesquisa : "desenvolve"
  Inscricao ||--o{ Nota : "recebe"
  Avaliacao ||--o{ Nota : "registra"
  Aula ||--o{ Presenca : "registra"
  ProjetoPesquisa ||--o{ Banca : "tem"
  Banca ||--o{ BancaMembro : "tem"
  Livro ||--o{ Emprestimo : "é emprestado em"
  Comunicado ||--o{ ComunicadoLeitura : "é lido em"
  Usuario |o..o{ LogAtividade : "aparece em"
  Usuario |o..o{ MedalhaConcedida : "recebe e concede"
  Usuario |o..o{ Chamado : "abre e atende"
  Turma |o..o{ Chamado : "é tema de"
  Chamado ||--o{ ChamadoMensagem : "tem"
  Usuario |o..o{ ChamadoMensagem : "escreve"
  ForumComunidade ||--o{ ForumPublicacao : "reúne"
  Usuario |o..o{ ForumPublicacao : "escreve"
  ForumPublicacao ||--o{ ForumComentario : "recebe"
  Usuario |o..o{ ForumComentario : "escreve"
  ForumComentario |o..o{ ForumComentario : "responde a"
  ForumPublicacao |o--o{ ForumVoto : "recebe"
  ForumComentario |o--o{ ForumVoto : "recebe"
  Usuario |o..o{ ForumVoto : "vota"
  Usuario |o..o{ TokenSenha : "recebe"
  ChatConversa ||--o{ ChatParticipante : "tem"
  ChatConversa ||--o{ ChatMensagem : "tem"
  Usuario |o..o{ ChatParticipante : "participa"
  Usuario |o..o{ ChatMensagem : "escreve"
  ChatMensagem |o..o{ ChatMensagem : "cita"
  ConfiguracaoPlataforma {
    int id
  }
  EmailEnviado {
    int id
  }
```

As linhas pontilhadas (`..`) são relações lógicas: o schema guarda só o número do usuário, da turma ou do comentário pai, sem chave estrangeira. Assim, o registro continua existindo mesmo se a outra ponta for excluída. As linhas contínuas são relações com chave estrangeira. `ForumVoto` tem um campo para a publicação e outro para o comentário, e cada voto preenche só um deles.

`LogAtividade` não tem chave estrangeira: o registro continua existindo mesmo se o usuário for excluído, por isso a ligação com `Usuario` é só lógica (linha pontilhada).

## Regras de negócio principais

As regras ficam em `server/src/lib/regras.ts` e nos módulos de rotas.

- **Regimes**: no regime seriado (fundamental, médio e técnico), o aluno cursa todas as disciplinas da série, e as turmas da mesma classe têm o mesmo grupo. No regime por créditos (graduação e pós), o aluno se inscreve disciplina a disciplina.
- **Nota final**: média ponderada das notas lançadas, pelo peso de cada avaliação. Cada nota é convertida para a escala de 0 a 10 antes da média, e o resultado é arredondado para uma casa decimal. Sem nenhuma nota, a nota final fica vazia.
- **Frequência**: percentual de presenças sobre o total de aulas registradas com presença, arredondado para uma casa decimal. Sem aula registrada, a frequência fica vazia.
- **Aprovação**: a frequência mínima é de 75%. A média mínima é 6 para os níveis fundamental, médio, técnico e graduação, e 7 para especialização, mestrado e doutorado. Quem tem frequência abaixo de 75% é reprovado por falta, independentemente da nota. Quem tem frequência suficiente, mas média abaixo do mínimo, é reprovado por nota.
- **Pré-requisitos e vagas**: uma inscrição só é aceita se os pré-requisitos da disciplina já estiverem aprovados e se a turma tiver vaga. Matrícula trancada ou cancelada não aceita inscrição.
- **Pós-graduação**: em mestrado e doutorado, a banca de defesa só pode ser criada quando o projeto já estiver `QUALIFICADO`. O resultado gravado em uma banca muda o status do projeto: qualificação aprovada (com ou sem ressalvas) leva a `QUALIFICADO`, defesa aprovada leva a `APROVADO` e defesa reprovada leva a `REPROVADO`.
- **Mensalidades**: uma mensalidade em aberto com vencimento anterior a hoje passa a `ATRASADA`. Ao gerar mensalidades, o desconto usa o percentual da bolsa ativa de maior percentual da matrícula.

## Documentos relacionados

- [API.md](API.md): lista de endpoints, com permissões e formatos.
- [CONTRIBUTING.md](../CONTRIBUTING.md): como preparar o ambiente e contribuir.
- [SECURITY.md](../SECURITY.md): como relatar vulnerabilidades e medidas existentes.
