# Referência da API

Esta referência é para quem vai integrar com o sistema escolar ou consultar a API durante o desenvolvimento. Os endpoints aqui foram conferidos com as rotas do código em `server/src/modules/*/routes.ts`.

## Convenções

- **Endereço base**: `http://localhost:3090/api` com as portas padrão (`API_PORT=3090`). A porta direta da API (3090) é publicada só em `127.0.0.1`, ou seja, só o próprio computador a acessa. A porta do site (8090, `WEB_PORT`) é publicada em todas as interfaces e encaminha `/api` para a API; por isso `http://localhost:8090/api` funciona e também responde a outros aparelhos da rede local.
- **Formato**: corpo e resposta em JSON (`Content-Type: application/json`).
- **Autenticação**: cabeçalho `Authorization: Bearer <token>`. Todas as rotas exigem login, exceto `GET /api/saude` e `POST /api/auth/login`.
- **Datas**: string ISO 8601 (por exemplo, `2026-03-02T00:00:00.000Z`).
- **Dinheiro**: número em reais (por exemplo, `1250.5`).
- **IDs**: inteiros. Um `:id` que não seja número devolve `400`.
- **Listas**: devolvem um array JSON simples, sem paginação. Os filtros vão na query string (`?busca=...`). A exceção é o log de atividades, que devolve `{ itens, haMais }`.
- **Tamanho do corpo**: até 1 MB por requisição. Capas de livro em data URL cabem nesse limite.
- **Criação**: devolve `201` com o registro criado.
- **Exclusão**: devolve `204` sem corpo. Em alguns casos, a exclusão só marca o registro como inativo (veja a tabela de cada módulo).

### Erros

Todo erro tem o formato:

```json
{ "erro": "mensagem em português", "detalhes": "opcional" }
```

| Status | Quando |
|---|---|
| `400` | Dados inválidos, `:id` não numérico ou JSON mal formado. |
| `401` | Sem login, token inválido ou expirado (`{ "erro": "Não autenticado" }`), ou login inválido. |
| `403` | Usuário logado sem permissão para a rota (`{ "erro": "Sem permissão" }`). |
| `404` | Registro ou rota não encontrada. |
| `409` | Conflito de regra de negócio, por exemplo, e-mail ou código repetido, ou inscrição sem vaga. |
| `413` | Corpo da requisição maior que 1 MB (`{ "erro": "Corpo da requisição grande demais" }`). |
| `429` | Muitas tentativas de login (`{ "erro": "Muitas tentativas. Aguarde alguns minutos." }`). Veja "Limite de tentativas de login". |
| `500` | Erro interno. O detalhe fica só no log do servidor. |

### Imagens

Imagens são enviadas como data URL (texto em base64) no próprio JSON. Valem as mesmas regras em todos os lugares:

| Uso | Formatos aceitos | Limite | Endereço `http(s)` |
|---|---|---|---|
| Foto de perfil (`PUT /perfil/foto`) | `data:image/jpeg`, `data:image/png` ou `data:image/webp` | 200.000 caracteres | Aceito, até 500 caracteres |
| Capa de livro (`capa` em `/livros`) | o mesmo | 200.000 caracteres | Aceito, até 500 caracteres |
| Anexo de chamado (`anexo` em `/chamados`) | o mesmo | 200.000 caracteres | Não aceito |
| Imagem de publicação (`imagem` em `/forum/publicacoes`) | o mesmo | 200.000 caracteres | Não aceito |

Enviar `null` ou texto vazio remove a imagem. Qualquer outro formato, ou um tamanho acima do limite, devolve `400`. O site reduz a imagem no navegador antes de enviar, por isso a maioria das fotos cabe no limite.

### Limite de tentativas de login

Para o mesmo endereço de IP e o mesmo e-mail (sem diferenciar maiúsculas), o servidor conta as falhas de login dos últimos 10 minutos. Com 10 falhas nessa janela, a próxima tentativa recebe `429` até que as falhas mais antigas saiam da janela. Um login bem-sucedido zera a contagem daquele par de IP e e-mail. A contagem fica só na memória do servidor: ela se perde quando o servidor reinicia.

## Autenticação

### Login

Substitua `voce@exemplo.com` e `SUA_SENHA` pelo e-mail e pela senha de uma conta válida:

```bash
curl -X POST http://localhost:3090/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@exemplo.com","senha":"SUA_SENHA"}'
```

Resposta (`200`):

```json
{
  "token": "eyJhbGciOi...",
  "usuario": { "id": 1, "nome": "Nome da pessoa", "email": "voce@exemplo.com", "perfil": "ADMIN", "alunoId": null, "professorId": null }
}
```

Se o e-mail ou a senha estiverem errados, ou se a conta estiver inativa, a resposta é `401`.

### Usar o token

```bash
curl http://localhost:3090/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN"
```

O token vale por 12 horas. Depois disso, a API responde `401` e é preciso fazer login de novo.

### Perfis

| Código | Perfil | Portal |
|---|---|---|
| `ADMIN` | Administrador | Administrativo |
| `TI` | Equipe de TI | Administrativo (mesmo acesso do `ADMIN`) |
| `SECRETARIA` | Secretaria | Administrativo |
| `PROFESSOR` | Professor | Professor |
| `ALUNO` | Aluno | Aluno |

O perfil `TI` tem as mesmas permissões do `ADMIN`: o servidor trata `TI` como `ADMIN` em cada rota. A resposta de login e de `GET /auth/me` devolve `perfil: "TI"` para essas contas, para que a tela mostre o papel real.

Nas tabelas abaixo, a coluna **Quem** usa estas abreviações:

- **A** = ADMIN (inclui TI)
- **S** = SECRETARIA
- **P** = PROFESSOR
- **L** = ALUNO
- **todos** = qualquer usuário logado

Quando a permissão depende de regra extra, a coluna explica (por exemplo, "P dono da turma"). Essas regras são aplicadas dentro da rota.

## Saúde da API (módulo `auth`)

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/saude` | público | | `{ "ok": true }` |

## Autenticação e conta (módulo `auth`)

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| POST `/auth/login` | público | `{ email, senha }` | `{ token, usuario }`. `usuario` = `{ id, nome, email, perfil, alunoId, professorId }`. `401` se inválido ou inativo; `429` após 10 falhas em 10 minutos (veja "Limite de tentativas de login"). Registra `LOGIN` ou `FALHA_LOGIN` no log. |
| GET `/auth/me` | todos | | `usuario`, no mesmo formato do login |
| POST `/auth/trocar-senha` | todos | `{ senhaAtual, novaSenha }` (mínimo 6 caracteres) | `204` |
| POST `/auth/sair` | todos | | `204`. Registra a saída no log. |
| GET `/painel` | todos | | `{ cartoes: [{ rotulo, valor }] }`, com os cartões de acordo com o perfil |

## Painel e busca (módulo `painel`)

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/painel/resumo` | todos | | Dados da tela inicial (veja abaixo) |
| GET `/busca` | todos | `?q=` (mínimo de 2 caracteres) | Resultados da busca (veja abaixo) |

### `GET /painel/resumo`

```ts
{
  primeiroNome: string;
  cartoes: {                // exatamente 4, nesta ordem
    chave: string;
    rotulo: string;
    valor: string;          // já formatado, por exemplo "1.248", "96,8%" ou "8,4"
    icone: string;
    cor: 'azul' | 'roxo' | 'verde' | 'laranja';
    variacao: number | null; // em pontos percentuais; null = não mostrar
  }[];
  desempenho: { mes: string; rotulo: string; valor: number | null }[]; // 12 meses, do mais antigo ao atual; mes = "AAAA-MM"
  destaque: { etiqueta: string; titulo: string; subtitulo: string; caminho: string } | null;
}
```

Os cartões mudam conforme o perfil. Para ADMIN e SECRETARIA, são alunos matriculados, professores ativos, turmas ativas e frequência média. Para PROFESSOR, são minhas turmas, meus alunos, orientações e frequência média. Para ALUNO, são disciplinas cursando, média geral, frequência média e mensalidades em aberto.

A `variacao` só aparece no cartão de alunos matriculados, e só quando há matrículas nos últimos 30 dias e também matrículas anteriores. Nos outros cartões, é `null`.

### `GET /busca`

Resposta: array de `{ tipo, titulo, subtitulo, caminho }`, com `tipo` igual a `Aluno`, `Professor`, `Turma`, `Curso` ou `Livro`. Cada tipo traz no máximo 4 resultados. A busca não diferencia maiúsculas de minúsculas. Com menos de 2 caracteres, a resposta é `[]`.

## Cadastros (módulo `cadastros`)

`AlunoDTO` é o registro `Aluno` com `usuario: { id, nome, email, cpf, telefone, ativo }`. `ProfessorDTO` segue o mesmo modelo. Nenhuma resposta traz `senhaHash`.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/usuarios` | A | `?perfil=&busca=` (`perfil` aceita `TI`) | Usuários, sem `senhaHash` |
| POST `/usuarios` | A | `{ nome, email, senha, perfil }`, com perfil `ADMIN`, `TI` ou `SECRETARIA` | `201` usuário. `409` se o e-mail já existe. |
| PUT `/usuarios/:id` | A | `{ nome?, email?, telefone?, ativo? }` | Usuário |
| POST `/usuarios/:id/redefinir-senha` | A | `{ novaSenha }` | `204` |
| GET `/alunos` | A, S, P | `?busca=` (nome, e-mail ou RA) | `AlunoDTO[]`, por nome |
| GET `/alunos/:id` | A, S, P | | `AlunoDTO` + `matriculas: [{ id, status, serieAtual, curso: { id, nome, nivel } }]` |
| POST `/alunos` | A, S | `{ nome, email, senha, cpf?, telefone?, dataNascimento, endereco?, responsavelNome?, responsavelTelefone?, responsavelEmail? }` | `201` `AlunoDTO`. Cria o usuário e o aluno na mesma operação. O RA é o ano atual seguido de 5 dígitos (por exemplo, `202600001`). |
| PUT `/alunos/:id` | A, S | mesmos campos, todos opcionais, sem `senha` | `AlunoDTO` |
| DELETE `/alunos/:id` | A, S | | `204`. Apenas marca o usuário como inativo. |
| GET `/professores` | A, S | `?busca=` | `ProfessorDTO[]` |
| GET `/professores/:id` | A, S | | `ProfessorDTO` |
| POST `/professores` | A, S | `{ nome, email, senha, cpf?, telefone?, titulacao, area? }` | `201`. O registro é `P` seguido de 4 dígitos (por exemplo, `P0001`). |
| PUT `/professores/:id` | A, S | campos opcionais, sem `senha` | `ProfessorDTO` |
| DELETE `/professores/:id` | A, S | | `204`. Marca como inativo. |
| GET `/perfil/meu` | todos | | Usuário, sem `senhaHash`, com `aluno` ou `professor` (ou `null`) |
| PUT `/perfil/meu` | todos | `{ telefone?, endereco? }` (`endereco` só para aluno) | Mesmo formato do GET |

## Fichas do aluno e do professor (módulo `fichas`)

Estas rotas juntam, numa resposta só, os dados que o sistema tem sobre uma pessoa. A tela de ficha usa essas rotas para mostrar um mini painel.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/alunos/:id/ficha` | A, S, P | | Ficha do aluno. `:id` é o id do **Aluno**. `404` se não existir. |
| GET `/professores/:id/ficha` | A, S | | Ficha do professor. `:id` é o id do **Professor**. `404` se não existir. |

### `GET /alunos/:id/ficha`

Resposta com as seções `aluno`, `indicadores`, `matriculas`, `disciplinas`, `mensalidades`, `emprestimos` e `projeto`:

- `aluno`: dados cadastrais, incluindo `ra`, `idade` e `responsavelNome`.
- `indicadores`: `disciplinasCursando`, `mediaGeral`, `frequenciaMedia`, `mensalidadesEmAberto`, `valorEmAberto` e `emprestimosAtivos`.
- `matriculas`: matrículas com status, série atual, curso e período de ingresso.
- `disciplinas`: todas as inscrições, da mais recente para a mais antiga, com nota final, frequência e status.
- `mensalidades`: as 6 mensalidades com vencimento mais recente.
- `emprestimos`: os 5 empréstimos mais recentes, com a indicação de atraso.
- `projeto`: primeiro projeto de pesquisa das matrículas, ou `null`.

Regras de permissão e de dados:

- Um professor só vê a ficha de aluno que tem inscrição em uma turma dele. Caso contrário, recebe `403`.
- Para o professor, `mensalidades` vem vazio, os indicadores financeiros vêm zerados e os campos de contato restrito (`cpf`, `endereco`, `responsavelTelefone` e `responsavelEmail`) vêm `null`.
- Aluno não acessa esta rota (`403`).
- A rota nunca devolve `senhaHash`.

### `GET /professores/:id/ficha`

Resposta com as seções `professor`, `indicadores`, `turmas`, `horarios`, `orientacoes`, `bancas` e `emprestimos`:

- `professor`: dados cadastrais, incluindo `registro`, `titulacao` e `area`.
- `indicadores`: `turmasAtivas`, `alunos`, `orientacoes`, `frequenciaMedia`, `mediaDasTurmas` e `cargaSemanalHoras`.
- `turmas`: todas as turmas do professor, com os períodos ativos primeiro.
- `horarios`: horários das turmas em períodos ativos, por dia e hora.
- `orientacoes`: projetos em que o professor é orientador ou coorientador.
- `bancas`: participações como membro de banca, da mais recente para a mais antiga.
- `emprestimos`: os 5 empréstimos mais recentes do usuário do professor.

## Log de atividades (módulo `logs`)

O servidor grava automaticamente as atividades dos usuários (veja a seção "Log de atividades" em `ARQUITETURA.md`). As rotas abaixo registram ações que o servidor não consegue ver sozinho e consultam o log.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| POST `/logs/tela` | todos | `{ caminho, titulo }` (`caminho` começa com `/`; até 200 e 80 caracteres) | `204`. Registra "Abriu a tela {titulo}". Repetição do mesmo usuário e caminho em menos de 5 segundos não é gravada. |
| GET `/logs` | A (inclui TI) | `?usuarioId=&tipo=&modulo=&busca=&de=&ate=&depoisDe=&antesDe=&limite=` | `{ itens: LogDTO[], haMais: boolean }`, do mais novo para o mais antigo |
| GET `/logs/resumo` | A (inclui TI) | | `ResumoLogDTO` |
| GET `/logs/usuarios/:id/resumo` | A (inclui TI) | | `ResumoUsuarioLogDTO`. `:id` é o id do usuário. |

Parâmetros de `GET /logs`:

- `tipo`: um de `LOGIN`, `FALHA_LOGIN`, `SAIDA`, `TELA`, `CONSULTA`, `CRIACAO`, `ALTERACAO`, `EXCLUSAO`. Outro valor devolve `400`.
- `busca`: procura em descrição, nome do usuário e caminho, sem diferenciar maiúsculas de minúsculas.
- `de` e `ate`: datas `AAAA-MM-DD`, com o dia inteiro incluído.
- `depoisDe`: só registros com `id` maior que o informado (usado pelo painel em tempo real).
- `antesDe`: só registros com `id` menor que o informado (usado para "carregar mais").
- `limite`: padrão 50, máximo 200.
- `haMais`: indica se existem registros mais antigos além dos devolvidos.

`LogDTO` traz `id`, `criadoEm`, `usuarioId`, `usuarioNome`, `perfil`, `tipo`, `modulo`, `descricao`, `metodo`, `caminho`, `status`, `duracaoMs`, `ip` e `navegador`.

`ResumoLogDTO` (painel de atividades):

```ts
{
  agora: string;
  online: { usuarioId, nome, perfil, ultimaDescricao, ultimoTipo, telaAtual: string | null, ultimaAtividade }[]; // atividade nos últimos 5 minutos
  hoje: { atividades, usuariosAtivos, logins, falhasLogin, alteracoes };  // alteracoes = CRIACAO + ALTERACAO + EXCLUSAO
  porHora: { hora: string, total: number }[];     // últimas 24 horas, da mais antiga para a atual
  porModulo: { modulo, total }[];                 // hoje, os 8 maiores
  porTipo: { tipo, total }[];                     // hoje
  topUsuarios: { usuarioId, nome, perfil, total }[]; // hoje, os 8 maiores
  recentes: LogDTO[];                             // os 15 últimos
}
```

`ResumoUsuarioLogDTO` (ficha de atividade de um usuário):

```ts
{
  ultimoLogin: string | null;
  ultimaAtividade: string | null;
  telaAtual: string | null;   // última tela aberta, se houve atividade nos últimos 5 minutos
  online: boolean;
  atividadesHoje: number;
  atividades7Dias: number;
  porTipo: { tipo, total }[]; // últimos 7 dias
}
```

## Perfil, medalhas e níveis (módulo `conquistas`)

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/perfil/completo` | todos | | `PerfilCompletoDTO` do usuário logado (inclui o próprio e-mail) |
| GET `/usuarios/:id/perfil-publico` | todos | | `PerfilPublicoDTO`. `404` se o usuário não existir ou estiver inativo. Não traz e-mail, CPF nem telefone. |
| PUT `/perfil/foto` | todos | `{ foto }`: data URL, endereço `http(s)` ou `null` | `{ foto }` |
| GET `/medalhas/catalogo` | todos | | `MedalhaCatalogoDTO[]`: as medalhas automáticas do perfil do usuário, com `conquistada` e `progresso` |
| POST `/medalhas` | A, S, P | `{ usuarioId, titulo, descricao?, icone?, cor?, pontos? }` | `201` `MedalhaDTO` |
| DELETE `/medalhas/:id` | A, ou quem concedeu | | `204`. `403` para quem não concedeu. `404` se não existir. |

Regras de `POST /medalhas`:

- `titulo`: de 3 a 60 caracteres. `descricao`: até 200 caracteres.
- `icone`: `medalha` (padrão), `estrela`, `boletim`, `biblioteca`, `grafico`, `pos` ou `alunos`.
- `cor`: `azul` (padrão), `roxo`, `verde` ou `laranja`.
- `pontos`: de 5 a 50. Padrão 20.
- O destinatário precisa ser aluno ou professor (`400` caso contrário). Usuário inexistente ou inativo devolve `404`.
- Um PROFESSOR só concede medalha a aluno que tenha inscrição, em qualquer status, em turma dele. Caso contrário, `403`.

Formatos:

```ts
interface MedalhaDTO {
  codigo: string;              // automáticas: o código da tabela abaixo; manuais: "manual-<id>"
  titulo: string; descricao: string; icone: string;
  cor: 'azul' | 'roxo' | 'verde' | 'laranja';
  pontos: number;
  conquistada: boolean; conquistadaEm: string | null;
  manual: boolean; id: number | null; concedidaPor: string | null;
  progresso: { atual: number; meta: number } | null;
}

interface PerfilCompletoDTO {
  usuario: { id; nome; email; perfil; telefone; foto; criadoEm; ra; registro; titulacao; area; curso };
  // perfil é o verdadeiro (TI aparece como TI); curso é o da primeira matrícula ativa; ra, registro, titulacao e area podem ser null
  nivel: { pontos: number; nivel: number; titulo: string; pontosDoNivel: number; pontosProximoNivel: number | null };
  resumo: { rotulo: string; valor: string; icone: string; cor: string }[];  // 4 indicadores, os mesmos do painel
  medalhas: MedalhaDTO[];       // conquistadas primeiro (as mais recentes antes), depois as não conquistadas com progresso
  atividadeRecente: { id; criadoEm; tipo; descricao; modulo }[];  // 10 últimos registros do log do próprio usuário, sem CONSULTA
}

interface PerfilPublicoDTO {
  usuario: { id; nome; perfil; foto; curso: string | null; titulacao: string | null };
  nivel: PerfilCompletoDTO['nivel'];
  medalhas: MedalhaDTO[];       // só as conquistadas
}
```

`pontos` do perfil é a soma dos pontos das medalhas conquistadas, automáticas e manuais.

Níveis (pelos pontos):

| Pontos mínimos | Nível | Título |
|---|---|---|
| 0 | 1 | Iniciante |
| 50 | 2 | Dedicado |
| 120 | 3 | Destaque |
| 220 | 4 | Exemplar |
| 350 | 5 | Lendário |

Medalhas automáticas são calculadas na hora, a partir dos dados do sistema. Só as concedidas à mão (`POST /medalhas`) ficam guardadas no banco.

Medalhas automáticas de aluno:

| Código | Título | Regra | Pontos | Cor |
|---|---|---|---|---|
| `primeiros-passos` | Primeiros passos | Ter uma matrícula | 10 | azul |
| `presenca-total` | Presença total | Alguma inscrição (não trancada) com frequência de 100% | 20 | verde |
| `assiduo` | Assíduo | Frequência média de 90% ou mais, com pelo menos 2 inscrições com frequência | 30 | verde |
| `nota-dez` | Nota máxima | Alguma nota igual à nota máxima da avaliação | 20 | laranja |
| `excelencia` | Excelência | Média das notas finais de 9,0 ou mais, com pelo menos 2 notas finais | 40 | roxo |
| `aprovado` | Aprovado | Ter 1 disciplina aprovada (progresso sobre 1) | 10 | azul |
| `maratonista` | Maratonista | Ter 5 disciplinas aprovadas (progresso sobre 5) | 30 | azul |
| `leitor` | Leitor | Ter 1 empréstimo de livro | 10 | laranja |
| `rato-de-biblioteca` | Rato de biblioteca | Ter 5 empréstimos de livro (progresso sobre 5) | 30 | laranja |
| `em-dia` | Em dia | Ter pelo menos 3 mensalidades pagas e nenhuma atrasada | 20 | verde |
| `pesquisador` | Pesquisador | Ter projeto de pesquisa | 20 | roxo |
| `mestre-da-banca` | Aprovado pela banca | Projeto com status `QUALIFICADO` ou `APROVADO` | 40 | roxo |
| `voz-ativa` | Voz ativa | 3 publicações ou comentários no fórum (progresso sobre 3) | 10 | azul |

Medalhas automáticas de professor:

| Código | Título | Regra | Pontos | Cor |
|---|---|---|---|---|
| `mestre` | Na ativa | Lecionar pelo menos uma turma em período ativo | 10 | azul |
| `diario-em-dia` | Diário em dia | Ter registrado pelo menos 10 aulas (progresso sobre 10) | 20 | verde |
| `avaliador` | Avaliador | Ter lançado notas em 5 avaliações (progresso sobre 5) | 20 | laranja |
| `orientador` | Orientador | Orientar ou coorientar pelo menos um projeto | 20 | roxo |
| `banca` | Membro de banca | Participar de pelo menos uma banca | 20 | roxo |
| `turma-nota-alta` | Turma nota alta | Alguma turma dele com média de notas finais de 8,0 ou mais (pelo menos 2 notas) | 30 | laranja |
| `leitor` e `voz-ativa` | | Mesmas regras das medalhas do aluno | 10 | |

Outros perfis não têm medalhas automáticas. Recebem só as manuais, se houver, e o nível é calculado da mesma forma.

## Suporte por chamados (módulo `suporte`)

Quem atende cada categoria:

| Categoria | Quem atende |
|---|---|
| `TECNICO` | ADMIN (inclui TI) |
| `SECRETARIA` | SECRETARIA, ADMIN (inclui TI) |
| `FINANCEIRO` | SECRETARIA, ADMIN (inclui TI) |
| `ACADEMICO` | O professor da turma escolhida no chamado, ADMIN (inclui TI) |

A equipe de um chamado é quem atende a categoria dele. O autor nunca é tratado como equipe no próprio chamado.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/chamados/meus` | todos | | `ChamadoDTO[]` do usuário, da última mensagem para a mais antiga |
| GET `/chamados/novidades` | todos | | `{ meus, atendimento }`. `meus`: chamados meus com resposta da equipe ainda não lida. `atendimento`: chamados que eu atendo, não encerrados, com a última mensagem do autor ainda não lida pela equipe. |
| GET `/chamados/atendimento` | quem atende alguma categoria | `?status=&categoria=&prioridade=&busca=&meus=true` | `ChamadoDTO[]` dos chamados que o usuário pode atender. `busca` tem até 120 caracteres. `meus=true` mostra só os chamados em que ele é responsável. |
| GET `/chamados/turmas` | todos | | Turmas para escolher em `ACADEMICO`: para ALUNO, as turmas com inscrição `CURSANDO`; para os demais, as turmas de períodos ativos. Formato `{ id, codigo, disciplina, professor }[]`. |
| GET `/chamados/:id` | autor ou equipe | | `ChamadoDTO` + `mensagens: MensagemDTO[]`. Marca como lido para quem abriu. `404` se não existir; `403` se não for autor nem equipe. |
| POST `/chamados` | todos | `{ categoria, assunto, prioridade?, turmaId?, texto, anexo? }` | `201` `ChamadoDTO`. `turmaId` é obrigatório em `ACADEMICO`. Aluno só abre chamado de turma em que tem inscrição `CURSANDO` (`403`). |
| POST `/chamados/:id/mensagens` | autor ou equipe | `{ texto, anexo?, aguardarUsuario? }` | `201` `MensagemDTO`. `409` se o chamado estiver `FECHADO`. |
| PUT `/chamados/:id` | equipe | `{ status?, prioridade?, responsavelId? }` | `ChamadoDTO`. `status` aceita `EM_ATENDIMENTO`, `AGUARDANDO_USUARIO` ou `RESOLVIDO`. `responsavelId` precisa atender a categoria (`400`). `409` se estiver `FECHADO`. |
| POST `/chamados/:id/assumir` | equipe | | `ChamadoDTO`. Torna quem chamou o responsável. Se estava `ABERTO`, passa a `EM_ATENDIMENTO`. |
| POST `/chamados/:id/encerrar` | autor | `{ avaliacao?: 1 a 5, comentario? (até 500) }` | `ChamadoDTO` com status `FECHADO`. `409` se já estiver encerrado. |
| POST `/chamados/:id/reabrir` | autor | | `ChamadoDTO` com status `ABERTO`. Só a partir de `RESOLVIDO` ou `FECHADO`; caso contrário, `409`. |

Formatos:

```ts
interface ChamadoDTO {
  id; categoria; assunto; prioridade; status;
  turma: { id; codigo; disciplina } | null;
  autor: UsuarioResumo; responsavel: UsuarioResumo | null;
  avaliacao: number | null; avaliacaoComentario: string | null;
  criadoEm; atualizadoEm; ultimaMensagemEm; totalMensagens: number;
  naoLido: boolean;      // para quem pediu: há mensagem do outro lado que ainda não foi lida
  souEquipe: boolean;
  previa: string;        // começo da última mensagem
}
interface MensagemDTO { id; texto; anexo: string | null; criadoEm; daEquipe: boolean; autor: UsuarioResumo }
interface UsuarioResumo { id: number; nome: string; perfil: string; foto: string | null }  // nunca e-mail, CPF nem telefone
```

Valores e regras:

- `categoria`: `TECNICO`, `SECRETARIA`, `FINANCEIRO` ou `ACADEMICO`.
- `prioridade`: `BAIXA`, `NORMAL` (padrão) ou `ALTA`.
- `status`: `ABERTO`, `EM_ATENDIMENTO`, `AGUARDANDO_USUARIO`, `RESOLVIDO` ou `FECHADO`.
- `assunto`: de 3 a 120 caracteres. `texto` da mensagem: de 1 a 4.000 caracteres.
- Mensagem da equipe: o chamado vai para `EM_ATENDIMENTO`, ou para `AGUARDANDO_USUARIO` quando `aguardarUsuario` é verdadeiro. Se o chamado não tinha responsável, quem respondeu passa a ser o responsável.
- Mensagem do autor em chamado `AGUARDANDO_USUARIO`, `EM_ATENDIMENTO` ou `RESOLVIDO`: o chamado volta para `ABERTO`.
- A equipe pode colocar `RESOLVIDO`. Só o autor encerra (com avaliação opcional) e reabre.
- Anexo: só data URL de imagem (JPEG, PNG ou WebP), com até 200.000 caracteres. Endereço `http(s)` não é aceito.

## Fórum (módulo `forum`)

Participam ALUNO e PROFESSOR. ADMIN (inclui TI) e SECRETARIA também leem, publicam e moderam. Moderar é tarefa do ADMIN (inclui TI) e da SECRETARIA; o PROFESSOR modera as próprias publicações.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/forum/comunidades` | todos | | `ComunidadeDTO[]`, ordenadas pela quantidade de publicações |
| POST `/forum/comunidades` | A, S, P | `{ nome, descricao?, cor? }` | `201` `ComunidadeDTO`. O `slug` é gerado do nome (minúsculas, sem acento, com hífen). `409` se já existir. |
| GET `/forum/publicacoes` | todos | `?comunidade=&ordem=&busca=&autorId=&antesDe=&limite=` | `{ itens: PublicacaoDTO[], haMais: boolean }`. Com `comunidade`, as fixadas aparecem primeiro. `404` se a comunidade não existir. |
| GET `/forum/publicacoes/:id` | todos | | `PublicacaoDTO` + `comentariosLista: ComentarioDTO[]`. Lista plana: cada comentário traz `paiId`, e o site monta a árvore. `404` se não existir ou se estiver removida. |
| POST `/forum/publicacoes` | todos | `{ comunidade: <slug>, titulo, corpo, imagem? }` | `201` `PublicacaoDTO`. `404` se a comunidade não existir. |
| PUT `/forum/publicacoes/:id` | autor: `titulo`, `corpo`, `imagem`; moderador: `fixada`, `fechada` | campos conforme o papel | `PublicacaoDTO`. `403` se tentar alterar um campo que não é seu. |
| DELETE `/forum/publicacoes/:id` | autor ou moderador | | `204`. Marca como removida. |
| POST `/forum/publicacoes/:id/voto` | todos | `{ valor: 1, -1 ou 0 }` | `{ pontos, meuVoto }`. `0` remove o voto. |
| POST `/forum/publicacoes/:id/comentarios` | todos | `{ corpo, paiId? }` | `201` `ComentarioDTO`. `409` se a publicação estiver fechada ou removida. `paiId` precisa ser um comentário da mesma publicação (`400`). |
| PUT `/forum/comentarios/:id` | autor | `{ corpo }` | `ComentarioDTO` |
| DELETE `/forum/comentarios/:id` | autor ou moderador | | `204`. Marca como removido: o texto passa a aparecer como "[comentário removido]" e o autor como "Removido". |
| POST `/forum/comentarios/:id/voto` | todos | `{ valor: 1, -1 ou 0 }` | `{ pontos, meuVoto }` |

Formatos:

```ts
interface ComunidadeDTO { id; nome; slug; descricao: string | null; cor; publicacoes: number; criadoEm }
interface PublicacaoDTO {
  id; titulo; corpo; imagem: string | null; fixada: boolean; fechada: boolean;
  pontos: number;        // soma dos votos
  comentarios: number;   // comentários não removidos
  meuVoto: 1 | -1 | 0; criadoEm; editadoEm: string | null;
  autor: UsuarioResumo;
  comunidade: { nome; slug; cor };
  posso: { editar: boolean; excluir: boolean; moderar: boolean };
}
interface ComentarioDTO {
  id; paiId: number | null; corpo; removido: boolean; pontos: number; meuVoto: 1 | -1 | 0;
  criadoEm; editadoEm: string | null; autor: UsuarioResumo;
  posso: { editar: boolean; excluir: boolean };
}
```

Ordenação (`ordem`):

- `alta` (padrão, "Em alta"): pontuação `pontos / (horas desde a criação + 2) ^ 1,5`, calculada sobre as 200 publicações mais recentes do filtro.
- `novas`: data de criação, da mais nova para a mais antiga.
- `votadas`: pontos, do maior para o menor.

Paginação: `antesDe` recebe o `id` da última publicação da página anterior (para "carregar mais"). `haMais` indica se há outra página.

Limites: `titulo` de 3 a 160 caracteres. `corpo` da publicação de 0 a 10.000 caracteres. `corpo` do comentário de 1 a 4.000. `limite` padrão 20, máximo 50. Imagem da publicação: só data URL (JPEG, PNG ou WebP), com até 200.000 caracteres.

## Estrutura acadêmica (módulo `academico`)

`TurmaDTO` é a `Turma` com `disciplina: { id, nome, codigo, creditos, cursoId, curso: { id, nome, nivel, regime } }`, `professor: { id, usuario: { nome } }`, `periodoLetivo: { id, nome }` e `_count: { inscricoes }`.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/cursos` | todos | `?nivel=&ativo=` | Cursos, por nome |
| GET `/cursos/:id` | todos | | Curso + `disciplinas` (por `periodoSugerido` e nome), cada uma com `preRequisitos: [{ id, nome, codigo }]` |
| POST `/cursos` | A, S | `{ nome, codigo, nivel, regime, duracaoPeriodos, cargaHorariaTotal, mensalidade }` | `201`. `409` se o código já existe. |
| PUT `/cursos/:id` | A, S | campos opcionais, `ativo?` | Curso |
| DELETE `/cursos/:id` | A, S | | `204`. Marca como `ativo = false`. |
| GET `/disciplinas` | todos | `?cursoId=` | Disciplinas, com `preRequisitos` |
| POST `/disciplinas` | A, S | `{ cursoId, nome, codigo, cargaHoraria, creditos, periodoSugerido, obrigatoria, preRequisitoIds: number[] }` | `201` |
| PUT `/disciplinas/:id` | A, S | campos opcionais (`preRequisitoIds` substitui a lista) | Disciplina |
| DELETE `/disciplinas/:id` | A, S | | `204`. `409` se a disciplina tiver turmas. |
| GET `/periodos-letivos` | todos | `?ativo=` | Períodos, do início mais recente para o mais antigo |
| POST `/periodos-letivos` | A, S | `{ nome, ano, tipo, inicio, fim }` | `201` |
| PUT `/periodos-letivos/:id` | A, S | campos opcionais, `ativo?` | Período |
| GET `/turmas/minhas` | P | `?periodoLetivoId=` | `TurmaDTO[]` do professor logado |
| GET `/turmas` | A, S, P | `?periodoLetivoId=&cursoId=&professorId=&grupo=` | `TurmaDTO[]` |
| GET `/turmas/:id` | A, S, P | | `TurmaDTO` |
| POST `/turmas` | A, S | `{ codigo, disciplinaId, periodoLetivoId, professorId, grupo?, vagas, sala? }` | `201`. `409` se o código já existe no período. |
| PUT `/turmas/:id` | A, S | campos opcionais | `TurmaDTO` |
| DELETE `/turmas/:id` | A, S | | `204`. `409` se a turma tiver inscrições. |

## Matrícula (módulo `matricula`)

`MatriculaDTO` é a `Matricula` com `aluno: { id, ra, usuario: { nome } }`, `curso: { id, nome, nivel, regime }` e `periodoIngresso: { id, nome }`.

`InscricaoDTO` é a `Inscricao` com `turma: { id, codigo, grupo, disciplina: { id, nome, codigo, creditos, cargaHoraria }, periodoLetivo: { id, nome }, professor: { usuario: { nome } } }`.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/matriculas/minhas` | L | | `MatriculaDTO[]` do aluno logado |
| GET `/matriculas` | A, S, P | `?alunoId=&cursoId=&status=` | `MatriculaDTO[]` |
| GET `/matriculas/:id` | A, S, P, ou L dono | | `MatriculaDTO` + `inscricoes: InscricaoDTO[]` |
| POST `/matriculas` | A, S | `{ alunoId, cursoId, periodoIngressoId, serieAtual? }` | `201`. `409` se o aluno já está matriculado no curso. |
| PUT `/matriculas/:id` | A, S | `{ status?, serieAtual? }` | `MatriculaDTO` |
| POST `/matriculas/:id/enturmar` | A, S | `{ periodoLetivoId, grupo }` | `{ inscritas: number }`. Inscreve o aluno em todas as turmas do período com esse grupo cujas disciplinas são do curso da matrícula, pulando as que já estão inscritas. |
| GET `/matriculas/:id/turmas-disponiveis` | A, S, ou L dono | `?periodoLetivoId=` | `TurmaDTO[]` das disciplinas do curso no período, cada uma com `situacao` e `pendentes: string[]` |
| POST `/inscricoes` | A, S, ou L dono | `{ matriculaId, turmaId }` | `201` `InscricaoDTO`. `409` com o motivo se a `situacao` não for `DISPONIVEL`. |
| DELETE `/inscricoes/:id` | A, S, ou L dono | | `204`. Só para inscrição `CURSANDO`: apaga se não houver notas nem presenças; caso contrário, muda para `TRANCADO`. |

Valores de `situacao` na tabela de turmas disponíveis, na ordem em que são avaliados:

- `JA_INSCRITO`: o aluno já está cursando a disciplina no período.
- `JA_APROVADO`: o aluno já foi aprovado na disciplina, em qualquer período.
- `PRE_REQUISITO_PENDENTE`: algum pré-requisito ainda não foi aprovado. `pendentes` traz os nomes.
- `SEM_VAGA`: a turma não tem mais vagas.
- `DISPONIVEL`: pode se inscrever.

A matrícula precisa estar `ATIVA` para receber inscrições. Caso contrário, a resposta é `409`.

## Diário, notas e boletim (módulo `diario`)

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/turmas/:id/diario` | A, S, ou P dono da turma | | `{ turma, inscricoes, avaliacoes, notas, aulas }`. `inscricoes` traz `{ id, status, notaFinal, frequencia, aluno: { ra, nome } }`, sem as `TRANCADO`. `aulas` traz `{ id, data, conteudo, presentes, total }`. |
| POST `/turmas/:id/avaliacoes` | A, ou P dono | `{ nome, peso, data, notaMaxima? }` | `201` avaliação |
| PUT `/avaliacoes/:id` | A, ou P dono | campos opcionais | Avaliação |
| DELETE `/avaliacoes/:id` | A, ou P dono | | `204` |
| PUT `/avaliacoes/:id/notas` | A, ou P dono | `{ notas: [{ inscricaoId, valor }] }`, com `0 <= valor <= notaMaxima` | `204`. Grava as notas e recalcula as inscrições. |
| GET `/aulas/:id` | A, S, ou P dono | | Aula + `presencas: [{ inscricaoId, presente }]` |
| POST `/turmas/:id/aulas` | A, ou P dono | `{ data, conteudo?, presencas: [{ inscricaoId, presente }] }` | `201` aula. Recalcula. |
| PUT `/aulas/:id` | A, ou P dono | mesmo corpo | Aula. Recalcula. |
| DELETE `/aulas/:id` | A, ou P dono | | `204`. Recalcula. |
| POST `/turmas/:id/fechar` | A, ou P dono | | Inscrições atualizadas. Define o `status` de cada inscrição `CURSANDO` pela regra de aprovação. |
| POST `/turmas/:id/reabrir` | A | | `204`. Volta para `CURSANDO` as inscrições aprovadas ou reprovadas da turma. |
| GET `/boletim/meu` | L | `?matriculaId=` (padrão: primeira matrícula `ATIVA`) | `BoletimDTO` |
| GET `/boletim/:matriculaId` | A, S | | `BoletimDTO` |
| GET `/historico/meu` | L | `?matriculaId=` | `HistoricoDTO` |
| GET `/historico/:matriculaId` | A, S | | `HistoricoDTO` |

Cálculo de uma inscrição (sem mudar o status):

- `notaFinal`: média ponderada dos valores convertidos para escala de 0 a 10 (`valor / notaMaxima * 10`), pelo peso das avaliações com nota lançada. Arredondada para 1 casa. `null` se não houver nota.
- `frequencia`: presenças marcadas como `true` sobre o total de presenças registradas, em percentual. Arredondada para 1 casa. `null` se não houver aula.

`BoletimDTO` traz `matricula` e `periodos` (do mais recente para o mais antigo). Cada período traz `itens`, com as avaliações, a nota final, a frequência e o status.

`HistoricoDTO` traz `matricula`, `itens` e `resumo: { creditosConcluidos, cargaHorariaConcluida, coeficiente }`. O `coeficiente` é a média das notas finais das inscrições aprovadas ou reprovadas, ponderada pela carga horária, com 2 casas decimais, ou `null`.

## Pós-graduação (módulo `pos`)

`ProjetoDTO` é o `ProjetoPesquisa` com `matricula: { id, aluno: { ra, usuario: { nome } }, curso: { id, nome, nivel } }`, `orientador: { id, usuario: { nome } }`, `coorientador` (igual ou `null`) e `bancas`, cada uma com seus membros.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/pos/projetos` | todos | `?status=` | `ProjetoDTO[]`. A e S veem todos. P vê onde é orientador ou coorientador. L vê os das próprias matrículas. |
| GET `/pos/projetos/:id` | mesmas regras da lista | | `ProjetoDTO`. `404` se o projeto não existir ou não for do usuário. |
| POST `/pos/projetos` | A, S | `{ matriculaId, orientadorId, coorientadorId?, titulo, resumo, linhaPesquisa? }` | `201`. `409` se o curso não for de pós-graduação ou se a matrícula já tiver projeto. |
| PUT `/pos/projetos/:id` | A, S (tudo); L dono (só `titulo`, `resumo`, `linhaPesquisa`) | `{ titulo?, resumo?, linhaPesquisa?, orientadorId?, coorientadorId?, status? }` | `ProjetoDTO` |
| POST `/pos/projetos/:id/bancas` | A, S | `{ tipo, data, local?, membros: [{ professorId?, nomeExterno?, instituicao?, papel }] }` | `201` banca com membros |
| PUT `/pos/bancas/:id` | A, S | `{ data?, local?, resultado?, parecer?, membros? }` (`membros` substitui a lista) | Banca com membros |
| DELETE `/pos/bancas/:id` | A, S | | `204` |

Regras:

- Cada membro de banca tem `professorId` **ou** `nomeExterno`. Se nenhum dos dois for enviado, ou se os dois forem enviados, a resposta é `400`.
- Banca de `DEFESA` em curso de mestrado ou doutorado só pode ser criada com o projeto `QUALIFICADO` (`409`).
- Ao gravar o `resultado`: qualificação aprovada (com ou sem ressalvas) leva o projeto a `QUALIFICADO`; defesa aprovada leva a `APROVADO`; defesa reprovada leva a `REPROVADO`.

## Financeiro (módulo `financeiro`)

`MensalidadeDTO` é a `Mensalidade` com `valorFinal` (`valor - desconto`) e `matricula: { id, aluno: { ra, usuario: { nome } }, curso: { nome } }`.

Antes de qualquer listagem, as mensalidades `ABERTA` com vencimento anterior a hoje passam a `ATRASADA`.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/mensalidades/minhas` | L | | `MensalidadeDTO[]`, por vencimento |
| GET `/mensalidades` | A, S | `?matriculaId=&status=&competencia=` | `MensalidadeDTO[]` |
| POST `/mensalidades/gerar` | A, S | `{ matriculaId, ano, mesInicial, mesFinal, diaVencimento }` | `{ criadas: number }`. Uma por mês. O valor é a mensalidade do curso. O desconto é o percentual da bolsa ativa de maior percentual. Pula as competências que já existem. |
| POST `/mensalidades/:id/pagar` | A, S | `{ formaPagamento }` | `MensalidadeDTO`. `409` se já estiver paga ou cancelada. |
| POST `/mensalidades/:id/cancelar` | A, S | | `MensalidadeDTO`. `409` se estiver paga. |
| GET `/bolsas` | A, S | `?matriculaId=` | Bolsas, com `matricula` |
| POST `/bolsas` | A, S | `{ matriculaId, nome, percentual, inicio, fim? }` | `201` |
| PUT `/bolsas/:id` | A, S | campos opcionais, `ativa?` | Bolsa |
| DELETE `/bolsas/:id` | A, S | | `204` |
| GET `/financeiro/resumo` | A, S | | `{ aberto, pago, atrasado, quantidadeBolsas }`, com as somas de `valorFinal` por status |

O módulo financeiro é só controle interno. Não há cobrança, boleto nem integração com meios de pagamento.

## Biblioteca (módulo `biblioteca`)

`EmprestimoDTO` é o `Emprestimo` com `livro: { id, titulo, autor }`, `usuario: { id, nome, perfil }` e `atrasado` (verdadeiro quando o empréstimo está ativo e a devolução prevista já passou).

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/livros` | todos | `?busca=` (título, autor ou categoria) | Livros, por título, com o campo `capa` |
| POST `/livros` | A, S | `{ titulo, autor, isbn?, editora?, ano?, categoria?, exemplares, capa? }` | `201`. `disponiveis` começa igual a `exemplares`. |
| PUT `/livros/:id` | A, S | campos opcionais, incluindo `capa?` | Livro. Ao mudar `exemplares`, ajusta `disponiveis` pela diferença, sem deixar o valor negativo. |

Regra do campo `capa` (`string | null`, opcional):

- Endereço que começa com `http://` ou `https://`, com até 500 caracteres.
- Ou data URL de imagem: `data:image/jpeg;base64,`, `data:image/png;base64,` ou `data:image/webp;base64,`, com até 200.000 caracteres. A imagem é reduzida no navegador antes de ser enviada.
- Vazio ou `null` remove a capa. Qualquer outro formato devolve `400`.
- Sem capa, o site desenha uma capa com a cor da categoria e as iniciais do título.
| DELETE `/livros/:id` | A, S | | `204`. `409` se o livro tiver empréstimo ativo. |
| GET `/emprestimos/meus` | todos | | `EmprestimoDTO[]` do usuário logado |
| GET `/emprestimos` | A, S | `?status=&usuarioId=` | `EmprestimoDTO[]` |
| POST `/emprestimos` | A, S | `{ livroId, usuarioId, dias? }` (padrão 14 dias) | `201`. `409` se não houver exemplar disponível. Diminui `disponiveis` na mesma operação. |
| POST `/emprestimos/:id/devolver` | A, S | | `EmprestimoDTO`. `409` se já foi devolvido. Aumenta `disponiveis`. |

## Horários e calendário (módulo `agenda`)

`HorarioDTO` é o `HorarioAula` com `turma: { id, codigo, grupo, sala, disciplina: { nome }, professor: { usuario: { nome } }, periodoLetivo: { id, nome } }`.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/horarios/meus` | P, L | | `HorarioDTO[]`. Para P, são as turmas dele em períodos ativos. Para L, são as turmas com inscrição `CURSANDO`. |
| GET `/horarios` | A, S | `?turmaId=&periodoLetivoId=&grupo=` | `HorarioDTO[]`, por dia e hora |
| POST `/horarios` | A, S | `{ turmaId, diaSemana, horaInicio, horaFim, sala? }` | `201`. `400` se `horaFim` não for depois de `horaInicio`. `409` se houver choque, no mesmo período letivo e dia, de horário para o mesmo professor ou a mesma sala. |
| DELETE `/horarios/:id` | A, S | | `204` |
| GET `/calendario` | todos | `?de=&ate=` | Eventos, por `inicio` |
| POST `/calendario` | A, S | `{ titulo, descricao?, inicio, fim, tipo, periodoLetivoId? }` | `201` |
| PUT `/calendario/:id` | A, S | campos opcionais | Evento |
| DELETE `/calendario/:id` | A, S | | `204` |

Valores de `tipo` do calendário: `LETIVO`, `FERIADO`, `PROVA`, `EVENTO` e `RECESSO`.

## Comunicados (módulo `comunicados`)

`ComunicadoDTO` é o `Comunicado` com `autor: { nome }`, `turma: { codigo }` ou `null`, `curso: { nome }` ou `null`, e `lido` (verdadeiro quando o usuário logado já leu).

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/comunicados` | todos | | `ComunicadoDTO[]`, do mais novo para o mais antigo. Só os visíveis para o usuário. |
| POST `/comunicados` | A, S (qualquer público); P (só `TURMA` de uma turma dele) | `{ titulo, corpo, publico, turmaId?, cursoId? }` | `201`. `publico` é `TODOS`, `ALUNOS`, `PROFESSORES`, `TURMA` ou `CURSO`. `turmaId` é obrigatório para `TURMA`, e `cursoId` para `CURSO`. |
| DELETE `/comunicados/:id` | A, ou o autor | | `204` |
| POST `/comunicados/:id/ler` | todos | | `204`. Registra a leitura, se ela ainda não existir. |

Quem vê cada comunicado:

- A e S veem todos.
- O autor vê os próprios comunicados.
- `TODOS` é visto por todos.
- `ALUNOS` é visto só por alunos.
- `PROFESSORES` é visto só por professores.
- `TURMA` é visto pelos alunos com inscrição não trancada na turma e pelo professor da turma.
- `CURSO` é visto pelos alunos com matrícula no curso e pelos professores com turma em disciplina do curso.
