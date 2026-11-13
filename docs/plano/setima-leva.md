# Sétima leva: secretaria e famílias

Terceira leva do [ROTEIRO.md](ROTEIRO.md). O usuário disse "vai" em 13/11/2026.

Itens: documentos em PDF (boletim, histórico, declaração de matrícula e ficha, com a logo); ocorrências disciplinares; portal dos responsáveis (perfil novo, ligado a um ou mais alunos); matrícula e rematrícula online (formulário público, documentos e aprovação pela secretaria).

Padrões definidos pelo main (sem perguntar): PDF gerado no servidor com `pdfkit`; todo PDF emitido ganha um código de conferência, com página pública de validação; o perfil novo se chama `RESPONSAVEL` e o portal fica em `/responsavel`; a matrícula online nasce **fechada** e a secretaria abre por um botão; documentos do pedido de matrícula: `pdf jpg jpeg png`, até 10 MB cada, até 6 por pedido.

**Já feito pelo main (ninguém edita estes arquivos, salvo quando a parte disser):**

- `server/prisma/schema.prisma`: `Perfil.RESPONSAVEL`; modelos `ResponsavelAluno`, `Ocorrencia`, `DocumentoEmitido`, `SolicitacaoMatricula`; enums `TipoOcorrencia`, `GravidadeOcorrencia`, `TipoSolicitacao`, `StatusSolicitacao`; campos `matriculaOnlineAberta` e `matriculaOnlineTexto` em `ConfiguracaoPlataforma`. Leia-os antes de começar. Prisma Client já gerado.
- `server/src/lib/responsaveis.ts`: `vinculosDoResponsavel(usuarioId)`, `alunosDoResponsavel(usuarioId)`, `usuariosResponsaveisDoAluno(alunoId)`, `acessoAoAluno(req, alunoId)` e `acessoAMatricula(req, matriculaId)`. **Toda rota que mostra dados de um aluno ao próprio aluno ou a um responsável confere o acesso por estas funções.** Papéis: `GESTAO` (administrador, TI e secretaria), `PROPRIO` (o aluno) e `RESPONSAVEL` (com vínculo). Professor não passa por elas.
- `server/src/lib/boletim.ts`: `montarBoletim(matriculaId)`, `montarHistorico(matriculaId)`, `paraMatriculaResposta`, `incluirMatricula` e os tipos `BoletimDTO` e `HistoricoDTO` (saíram do diário, sem mudança de formato).
- `server/src/lib/arquivos.ts`: contexto novo `SOLICITACAO` e `receberArquivo(req, { donoId, contexto, contextoId, limiteBytes?, extensoes? })`, que grava o corpo bruto do pedido já ligado ao item. O download em `GET /arquivos/:id` já aceita `SOLICITACAO` só para administrador, TI e secretaria.
- Tipos de aviso `OCORRENCIA` e `SECRETARIA` em `server/src/lib/notificacoes.ts` e no sino do cliente; tipo de e-mail `SECRETARIA` em `server/src/lib/email.ts` (vale quando o e-mail da plataforma está ativo).
- `GET /plataforma` devolve `matriculaOnline: boolean`; a tela de login mostra o link "Quero me matricular" para `/matricula-online` quando está aberta.
- Cliente: `Perfil` ganhou `'RESPONSAVEL'` (`client/src/lib/tipos.ts`); `caminhoDoPerfil` devolve `/responsavel`; papel "Responsável" no menu do usuário; `RotaPublica` em `client/src/lib/rotas.ts`: um módulo pode exportar `rotasPublicas: RotaPublica[]` (telas sem login, fora do layout do portal) além de `rotas`; grupos do menu em `client/src/layout/grupos.ts` já contam com os ícones `familia`, `ocorrencia` e `solicitacao` (criados na parte C1).

Regras gerais (iguais às das levas anteriores): módulos do servidor em `server/src/modules/<modulo>/routes.ts` (`export default router`; rotas sem login em `export const publico = Router()`), com `asyncHandler`, `HttpError`, `validar`, `idParam`, `permitir` e `prisma`; erros `{ erro: string }`; validação com zod; nunca devolver hash de senha; e-mail, CPF e telefone de uma pessoa só para a gestão ou para a própria pessoa. Cliente com `api` de `client/src/lib/api.ts`, componentes de `client/src/ui/index.tsx`, cores só por variáveis de `estilo.css`, classes com prefixo do módulo, nada estoura em 360 px, temas claro e escuro, texto vindo da API sempre como texto (nunca HTML). Verificação: `npx tsc --noEmit` no lado em que mexeu. Não rode `vite build` nem Docker; `npm install` só a parte S3. Em todo comando do BUS, passe o nome da sala `sistema_escolar`.

Segurança desta leva: um responsável só enxerga alunos com vínculo; rotas públicas têm limite por IP em memória (`req.ip`), nunca devolvem dados de outra pessoa e não revelam se um e-mail já existe no sistema; chaves e protocolos de acompanhamento vão no corpo ou em cabeçalhos, nunca na URL.

---

## Contrato A: responsáveis (parte S1)

Módulo `server/src/modules/responsaveis/` (`routes.ts` e `servico.ts`).

### `servico.ts`

```ts
export interface DadosResponsavel { nome: string; email: string; telefone?: string | null; cpf?: string | null; parentesco: string; financeiro?: boolean }
export interface ResultadoVinculo { vinculoId: number; usuarioId: number; usuarioCriado: boolean; senhaInicial: string | null; conviteEnviado: boolean }
// Liga um responsável ao aluno. Se já existe usuário com o e-mail (sem diferenciar maiúsculas):
// precisa ser de perfil RESPONSAVEL (senão HttpError 409 "Este e-mail já pertence a um usuário de outro perfil")
// e ainda não estar ligado ao aluno (senão 409). Se não existe, cria o usuário RESPONSAVEL.
// Usuário novo: com e-mail da plataforma ativo (emailHabilitado('SECRETARIA')) e endereço do site definido,
// manda o convite "Criar minha senha" (mesmo formato de avisarBoasVindas em cadastros/importacao.ts) e
// senhaInicial = null; senão gera uma senha inicial aleatória de 10 caracteres e a devolve uma única vez.
export function vincularResponsavel(alunoId: number, dados: DadosResponsavel): Promise<ResultadoVinculo>;
```

A parte S4 importa `vincularResponsavel` ao aprovar uma matrícula.

### Rotas da gestão (`permitir('ADMIN', 'SECRETARIA')`)

| Rota | Resposta |
|---|---|
| `GET /alunos/:alunoId/responsaveis` | `[{ vinculoId, usuarioId, nome, email, telefone, parentesco, financeiro, ativo }]` |
| `POST /alunos/:alunoId/responsaveis` corpo `DadosResponsavel` | 201 `ResultadoVinculo` |
| `PUT /responsaveis/vinculos/:id` corpo `{ parentesco, financeiro }` | o vínculo atualizado |
| `DELETE /responsaveis/vinculos/:id` | 204 (o usuário continua existindo) |
| `GET /responsaveis?busca=` | `[{ usuarioId, nome, email, telefone, ativo, alunos: [{ vinculoId, alunoId, nome, ra, parentesco }] }]` (até 200) |

### Rotas do portal (`/familia/...`)

`GET /familia/alunos`: só `RESPONSAVEL`. Devolve, para cada vínculo:

```ts
{ alunoId, nome, ra, foto, idade, parentesco, financeiro,
  matriculas: [{ id, curso, nivel, status, serieAtual }],
  resumo: { mediaGeral: number | null, frequenciaMedia: number | null, mensalidadesAbertas: number, mensalidadesAtrasadas: number, ocorrenciasSemCiencia: number } }
```

As demais passam por `acessoAoAluno(req, alunoId)` (servem ao responsável, ao próprio aluno e à gestão). `?matriculaId=` é opcional (precisa ser do aluno; padrão: a primeira `ATIVA`, senão a mais recente).

| Rota | Resposta |
|---|---|
| `GET /familia/alunos/:alunoId/boletim` | `BoletimDTO` |
| `GET /familia/alunos/:alunoId/historico` | `HistoricoDTO` |
| `GET /familia/alunos/:alunoId/frequencia` | `[{ turmaId, turma, disciplina, aulas, presencas, faltas, percentual: number \| null, ultimasFaltas: string[] }]` (datas `AAAA-MM-DD`, até 5) das inscrições do período mais recente |
| `GET /familia/alunos/:alunoId/mensalidades` | exige `financeiro` (senão 403); `[{ id, competencia, vencimento, valor, desconto, valorFinal, status, pagoEm }]`, com `ATRASADA` calculada como no módulo financeiro |

---

## Contrato B: ocorrências (parte S2)

Módulo `server/src/modules/ocorrencias/routes.ts`.

```ts
interface OcorrenciaDTO {
  id: number; aluno: { id: number; nome: string; ra: string };
  turma: { id: number; codigo: string; disciplina: string } | null;
  autor: { id: number; nome: string };
  tipo: TipoOcorrencia; gravidade: GravidadeOcorrencia;
  titulo: string; descricao: string; medidas: string;
  data: string; // AAAA-MM-DD
  visivelFamilia: boolean; cienteEm: string | null; cientePor: { id: number; nome: string } | null;
  criadoEm: string; podeEditar: boolean; podeDarCiencia: boolean;
}
```

| Rota | Quem | Regra |
|---|---|---|
| `GET /ocorrencias?alunoId&tipo&gravidade&de&ate&busca&pagina` | ADMIN, SECRETARIA, PROFESSOR | gestão vê todas; professor só as que ele registrou. `{ itens, total, pagina, porPagina: 30 }` |
| `GET /ocorrencias/resumo` | ADMIN, SECRETARIA | `{ ultimos30Dias, semCiencia, porTipo: Record<tipo, number>, porGravidade: Record<gravidade, number> }` |
| `GET /alunos/:alunoId/ocorrencias` | gestão: todas; professor: as dele, se o aluno tem inscrição não trancada numa turma dele (senão 403); próprio aluno e responsável (`acessoAoAluno`): só `visivelFamilia` | lista de `OcorrenciaDTO`, mais recentes primeiro |
| `POST /ocorrencias` corpo `{ alunoId, turmaId?, tipo, gravidade, titulo (3 a 120), descricao (1 a 4000), medidas? (até 2000), data, visivelFamilia }` | ADMIN, SECRETARIA, PROFESSOR | professor: o aluno precisa ter inscrição não trancada numa turma dele e `turmaId`, se vier, precisa ser dele. Data no futuro: 400. 201 `OcorrenciaDTO` |
| `PUT /ocorrencias/:id` (mesmos campos, menos `alunoId`) | autor enquanto não houver ciência; ADMIN sempre | |
| `DELETE /ocorrencias/:id` | autor enquanto não houver ciência; ADMIN sempre | 204 |
| `POST /ocorrencias/:id/ciencia` | responsável com vínculo; ou o próprio aluno com 18 anos ou mais | só `visivelFamilia`; grava `cienteEm` e `cientePorId`; repetir devolve 200 sem mudar |

`podeDarCiencia` segue a regra da última linha e é falso quando já há ciência.

Avisos ao criar com `visivelFamilia` (ou ao tornar visível numa edição): `notificar` para o usuário do aluno e para `usuariosResponsaveisDoAluno`, tipo `OCORRENCIA`, título `Nova ocorrência: {titulo}` (para `ELOGIO`: `Elogio registrado: {titulo}`), link `/ocorrencias`, chave `ocorrencia-{id}`. E-mail (tipo `SECRETARIA`, se habilitado) só para os responsáveis, sem a descrição: diz que há um registro novo e convida a entrar no portal. Ao dar ciência: aviso ao autor (link `/ocorrencias`).

---

## Contrato C: documentos em PDF (parte S3)

`server/src/lib/pdf.ts` (montagem comum: cabeçalho com a logo e o nome da plataforma, título, rodapé com código de conferência, tabelas com quebra de página) e `server/src/modules/documentos/routes.ts`. Dependência: `pdfkit` (versão 0.15.x mais recente, fixada sem `^`) e `@types/pdfkit`, instaladas com `npm install` dentro de `server/` (atualiza `package.json` e `package-lock.json`).

Logo: `ConfiguracaoPlataforma.logo` é data URL (`image/png`, `image/jpeg` ou `image/webp`) ou endereço http(s). Só PNG e JPEG em data URL entram no PDF; nos outros casos o cabeçalho sai só com o nome (nunca buscar endereço externo).

| Rota | Acesso | Conteúdo |
|---|---|---|
| `GET /documentos/boletim/:matriculaId` | `acessoAMatricula` | boletim (`montarBoletim`): por período, disciplina, notas das avaliações, nota final, frequência e situação |
| `GET /documentos/historico/:matriculaId` | `acessoAMatricula` | histórico (`montarHistorico`) com o resumo (créditos, carga horária, coeficiente) |
| `GET /documentos/declaracao/:matriculaId` | `acessoAMatricula` | declaração de matrícula em texto corrido (nome, RA, curso, nível, série ou período, data). Matrícula que não está `ATIVA`: 409 |
| `GET /documentos/ficha/:alunoId` | só gestão | ficha cadastral: dados pessoais, responsáveis ligados, matrículas |
| `GET /documentos/emitidos?alunoId=` | só gestão | `[{ id, codigo, tipo, descricao, alunoNome, emitidoEm, emitidoPor }]` (até 200) |
| `GET /documentos/validar/:codigo` (**público**) | limite de 30 por minuto por IP | 200 `{ valido: true, tipo, descricao, alunoNome, emitidoEm }` com o nome mascarado (primeiro nome e iniciais dos demais) ou 404 `{ valido: false }` |

Cada emissão grava um `DocumentoEmitido` com código `XXXX-XXXX-XXXX` (letras e números sem `0 O 1 I`, aleatório com `crypto`). O rodapé de toda página traz o código, a data e hora da emissão e, se `enderecoDoSite()` existir, `Confira em {endereço}/validar/{codigo}`. Resposta: `Content-Type: application/pdf`, `Content-Disposition: attachment` com nome `boletim-{ra}.pdf`, `historico-{ra}.pdf`, `declaracao-{ra}.pdf`, `ficha-{ra}.pdf`, `Cache-Control: private, no-store`. As fontes padrão do pdfkit (Helvetica) cobrem os acentos do português.

---

## Contrato D: matrícula e rematrícula online (parte S4)

Módulo `server/src/modules/solicitacoes/` (`routes.ts`, `servico.ts`).

```ts
interface SolicitacaoResumoDTO { id: number; protocolo: string; tipo: TipoSolicitacao; status: StatusSolicitacao; nome: string; curso: { id: number; nome: string; nivel: string }; criadoEm: string; atualizadoEm: string; documentos: number }
interface SolicitacaoDTO extends Omit<SolicitacaoResumoDTO, 'documentos'> {
  email: string; cpf: string | null; dataNascimento: string; telefone: string | null; endereco: string | null;
  responsavelNome: string | null; responsavelEmail: string | null; responsavelTelefone: string | null; responsavelParentesco: string | null;
  observacao: string; parecer: string; periodoLetivo: { id: number; nome: string } | null;
  alunoId: number | null; matriculaId: number | null; analisadoPor: { id: number; nome: string } | null; analisadoEm: string | null;
  documentos: ArquivoDTO[];
}
```

Protocolo: `{ano}-{id com 6 dígitos}`. Chave de acompanhamento: 10 caracteres aleatórios (sem `0 O 1 I`), devolvida uma única vez; no banco fica só o SHA-256.

### Públicas (`export const publico`)

| Rota | Regra |
|---|---|
| `GET /matricula-online` | `{ aberta, texto, cursos: [{ id, nome, nivel, regime, mensalidade }] (ativos), periodos: [{ id, nome }] (ativos, com fim de hoje em diante) }`. Fechada: `cursos` e `periodos` vazios |
| `POST /matricula-online` corpo `{ cursoId, periodoLetivoId?, nome, email, cpf?, dataNascimento, telefone?, endereco?, responsavelNome?, responsavelEmail?, responsavelTelefone?, responsavelParentesco?, observacao?, site }` | fechada: 403. `site` é armadilha para robôs: se vier preenchido, responde 201 com protocolo e chave falsos e não grava. Menor de 18 anos: `responsavelNome` e `responsavelEmail` obrigatórios. Limite de 5 por hora por IP. Mesmo e-mail e curso com pedido em `ENVIADA`, `EM_ANALISE` ou `PENDENTE`: 409. 201 `{ protocolo, chave }`. E-mail de confirmação (tipo `SECRETARIA`) com o protocolo, **sem** a chave |
| `POST /matricula-online/acompanhar` corpo `{ protocolo, chave }` | limite de 20 por minuto por IP; protocolo ou chave errados: 404 com a mesma mensagem. `{ protocolo, tipo, status, nome, curso, criadoEm, parecer, documentos: [{ nome, tamanho }], podeEnviarDocumentos }` |
| `POST /matricula-online/documentos` (corpo bruto; cabeçalhos `X-Protocolo`, `X-Chave`, `X-Nome-Arquivo`, `Content-Type`) | só em `ENVIADA` ou `PENDENTE`; até 6 arquivos; `receberArquivo(req, { donoId: 0, contexto: 'SOLICITACAO', contextoId, limiteBytes: 10 MB, extensoes: ['pdf','jpg','jpeg','png'] })`. 201 `{ nome, tamanho }` |

### Rematrícula (logado: aluno ou responsável)

| Rota | Regra |
|---|---|
| `GET /rematricula/opcoes` | para cada matrícula `ATIVA` ou `TRANCADA` do aluno logado (ou dos alunos do responsável): `{ matriculaId, alunoId, alunoNome, curso, serieAtual, status, periodos: [{ id, nome }], pedidoAberto: { protocolo, status } \| null }` |
| `POST /rematricula` corpo `{ matriculaId, periodoLetivoId, observacao? }` | `acessoAMatricula` com papel `PROPRIO` ou `RESPONSAVEL`; pedido aberto para a mesma matrícula: 409. Cria `SolicitacaoMatricula` do tipo `REMATRICULA` copiando os dados do aluno, com `solicitanteId`. 201 `SolicitacaoResumoDTO` |
| `GET /rematricula/minhas` | pedidos com `solicitanteId` de quem está logado, com `parecer` |

### Secretaria (`permitir('ADMIN', 'SECRETARIA')`)

| Rota | Regra |
|---|---|
| `GET /solicitacoes?status&tipo&busca&pagina` | `{ itens: SolicitacaoResumoDTO[], total, pagina, porPagina: 30, contagem: Record<StatusSolicitacao, number> }` |
| `GET /solicitacoes/:id` | `SolicitacaoDTO` (documentos baixados por `GET /arquivos/:id`) |
| `PUT /solicitacoes/:id/status` corpo `{ status: 'EM_ANALISE' \| 'PENDENTE' \| 'RECUSADA', parecer }` | não muda pedido `APROVADA` ou `RECUSADA` (409). `PENDENTE` e `RECUSADA` exigem parecer. E-mail (tipo `SECRETARIA`) para o e-mail do pedido; aviso `SECRETARIA` ao `solicitanteId`, se houver (link `/rematricula`) |
| `POST /solicitacoes/:id/aprovar` corpo `{ parecer?, avancarSerie?, criarResponsavel? }` | ver abaixo. 200 `{ solicitacao: SolicitacaoDTO, senhaInicial: string \| null, responsavel: ResultadoVinculo \| null }` |
| `PUT /matricula-online/configuracao` corpo `{ aberta, texto (até 2000) }` | grava em `ConfiguracaoPlataforma` e chama `limparCacheConfiguracao()` |
| `DELETE /solicitacoes/:id` | só ADMIN e só pedido `RECUSADA`; apaga os documentos (`apagarArquivosDe`). 204 |

Aprovar `NOVA`: e-mail do pedido já usado por um usuário: 409 "Já existe um usuário com este e-mail; faça a matrícula pelo cadastro do aluno". Sem `periodoLetivoId` no pedido, usa o período ativo mais recente (nenhum: 400). Numa transação: cria usuário e aluno pelo mesmo caminho do cadastro (`criarAlunoNoBanco` e o gerador de RA de `cadastros/importacao.ts`; leia o arquivo e reutilize o que estiver exportado, exportando o que faltar sem mudar o comportamento) e a `Matricula` (`ATIVA`, série 1). Depois: convite de senha como no cadastro (`avisarBoasVindas`) ou, sem e-mail ativo, senha inicial aleatória devolvida uma vez; se `criarResponsavel` e houver `responsavelEmail`, chama `vincularResponsavel` (falha nesse passo não desfaz a matrícula: devolve `responsavel: null` e o motivo em `parecer` não é alterado). Aprovar `REMATRICULA`: matrícula volta a `ATIVA`; com `avancarSerie` e `serieAtual < curso.duracaoPeriodos`, soma 1. Em ambos: status `APROVADA`, `analisadoPorId`, `analisadoEm`, e-mail e aviso como na mudança de status.

`client/nginx.conf`: a parte S4 acrescenta um `location = /api/matricula-online/documentos` com `client_max_body_size 12m` e `proxy_request_buffering off`, no mesmo formato do bloco de `/api/arquivos`.

---

## Contrato E: cliente

### Componentes compartilhados (assinaturas fixas)

```tsx
// client/src/modules/documentos/BotaoPdf.tsx (parte C5)
export function BotaoPdf(props: { caminho: string; nomeArquivo: string; rotulo?: string; variante?: 'primario' | 'secundario' }): JSX.Element;
// baixa com api.baixar(caminho, nomeArquivo); mostra "Gerando..." e o erro, se houver. Rótulo padrão: "Baixar PDF".

// client/src/modules/ocorrencias/ListaOcorrencias.tsx (parte C3)
export function ListaOcorrencias(props: { alunoId: number; modo: 'gestao' | 'familia' }): JSX.Element;
// lê GET /alunos/{alunoId}/ocorrencias; 'gestao' permite registrar, editar e excluir; 'familia' só lê e mostra "Dar ciência" quando podeDarCiencia.

// client/src/modules/responsavel/ResponsaveisDoAluno.tsx (parte C2)
export function ResponsaveisDoAluno(props: { alunoId: number }): JSX.Element;
// gestão dos vínculos (lista, incluir, editar parentesco e financeiro, remover); mostra a senha inicial uma única vez quando vier.
```

### Rotas de tela

| Caminho | Parte | Observação |
|---|---|---|
| `/responsavel` | C2 | início do portal: um cartão por aluno com o resumo; ícone `inicio`, ordem 0 |
| `/responsavel/aluno/:alunoId` | C2 | abas Boletim, Frequência, Financeiro (se `financeiro`), Ocorrências (`ListaOcorrencias` modo `familia`) e Documentos (`BotaoPdf` de boletim, histórico e declaração); `menu: false` |
| `/responsavel/ocorrencias` | C2 | ocorrências de todos os alunos do responsável, agrupadas por aluno; ícone `ocorrencia` |
| `/admin/responsaveis` | C2 | lista de responsáveis (`GET /responsaveis`); ícone `familia` |
| `/admin/ocorrencias`, `/professor/ocorrencias` | C3 | lista com filtros, resumo (gestão) e registro; ícone `ocorrencia` |
| `/aluno/ocorrencias` | C3 | `ListaOcorrencias` do próprio aluno em modo `familia`; ícone `ocorrencia` |
| ficha do aluno (`cadastros/FichaAluno.tsx`) | C3 | abas novas "Ocorrências" e "Responsáveis" e o botão "Ficha em PDF" |
| `/validar` e `/validar/:codigo` (**públicas**) | C5 | conferência de documento |
| boletim e histórico (`diario/index.tsx`), tela de matrícula do aluno (`matricula/aluno.tsx`) | C5 | botões de PDF; na gestão, lista de documentos emitidos na tela do boletim por matrícula |
| `/matricula-online` e `/matricula-online/acompanhar` (**públicas**) | C6 | formulário, comprovante com protocolo e chave, envio de documentos e acompanhamento |
| `/admin/solicitacoes` e `/admin/solicitacoes/:id` | C6 | fila da secretaria, botão de abrir e fechar a matrícula online; ícone `solicitacao` |
| `/aluno/rematricula`, `/responsavel/rematricula` | C6 | pedido e acompanhamento da rematrícula; ícone `matriculas` |

Telas públicas usam a identidade da plataforma (`usePlataforma` de `client/src/lib/plataforma.tsx`) e o visual da tela de login (`client/src/layout/Login.tsx` e as classes `entrada-*`), sem o layout do portal.

---

## Partes

| Parte | Gerador | Arquivos |
|---|---|---|
| S1 Responsáveis (servidor) | g01 | `server/src/modules/responsaveis/routes.ts`, `servico.ts` |
| S2 Ocorrências (servidor) | g02 | `server/src/modules/ocorrencias/routes.ts` |
| S3 Documentos em PDF (servidor) | g03 | `server/src/lib/pdf.ts`, `server/src/modules/documentos/routes.ts`, `server/package.json`, `server/package-lock.json` |
| S4 Matrícula e rematrícula (servidor) | g04 | `server/src/modules/solicitacoes/routes.ts`, `servico.ts`, `client/nginx.conf`; exportações em `server/src/modules/cadastros/importacao.ts` |
| S5 Perfil de responsável nos módulos existentes (servidor) | g05 | `server/src/modules/comunicados/routes.ts`, `painel/routes.ts`, `chat/*.ts`, `suporte/routes.ts`, `cadastros/routes.ts`, `auth/routes.ts`, `agenda/routes.ts`, `server/src/lib/log.ts`, `server/src/app.ts` |
| C1 Base do cliente e perfil de responsável nas telas existentes | g06 | `client/src/ui/icones.tsx`, `client/src/modules/{comunicados,chat,suporte,inicio,agenda}/index.tsx`, `client/src/modules/cadastros/{index.tsx,usuarios.tsx,tipos.ts,FichaUsuario.tsx}`, `client/src/layout/Painel.tsx`, `client/src/modules/logs/comum.tsx` |
| C2 Portal dos responsáveis | g07 | `client/src/modules/responsavel/*` |
| C3 Ocorrências e ficha do aluno | g08 | `client/src/modules/ocorrencias/*`, `client/src/modules/cadastros/FichaAluno.tsx` |
| C5 Documentos (telas) | g09 | `client/src/modules/documentos/*`, `client/src/modules/diario/index.tsx`, `client/src/modules/matricula/aluno.tsx` |
| C6 Matrícula e rematrícula (telas) | g10 | `client/src/modules/solicitacoes/*` |
| R11 Dados de demonstração | depois | `server/prisma/seed-demo.ts` |
| R12 Documentação | depois | `README.md`, `INSTALAR.md`, `SECURITY.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `CHANGELOG.md` |
