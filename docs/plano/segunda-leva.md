# Plano da segunda leva: log de atividades, perfil TI, capas, calendário, comunicados e usuários

## Pedidos do usuário

1. Biblioteca: "coloca a imagem do livro em miniatura e deixa a possibilidade de trocar de tabela para card".
2. Usuários: "faz a mesma coisa" (pelo popup: como em Alunos e Professores, ou seja, menu de ações no fim da linha e ficha em popup).
3. "Cria uma área de log que só quem pode ver é o administrador e o TI; o log registra todas as atividades na plataforma de todos os usuários em tempo real, e cria um dashboard de atividades que dá para ver o que cada um está fazendo."
4. Calendário: "nessa parte o layout está bem feio".
5. Comunicados: "arruma aqui também".

## Decisões do usuário (popup de 10/11/2026)

- Imagem: enviar do computador **ou** colar um endereço (as duas formas).
- TI é um novo tipo de usuário, com **tudo o que o administrador acessa**.
- O log registra **tudo, inclusive telas abertas**.
- O log é guardado por **90 dias**.

## Decisões do main

- TI no servidor: o middleware de autenticação trata `TI` como `ADMIN` nas permissões (`req.usuario.perfil` vira `ADMIN`) e guarda o perfil verdadeiro em `req.usuario.perfilReal`. Assim nenhuma rota precisa mudar. Rotas "só ADMIN" passam a valer para ADMIN e TI; SECRETARIA não vê o log.
- TI no cliente: `usuario.perfil` é o perfil efetivo (`ADMIN` para TI) e `usuario.perfilReal` guarda `TI`, usado só para mostrar o papel.
- Tempo real por consulta periódica (a cada 5 segundos), sem conexão permanente.
- O log não guarda corpo de requisição, senha nem token. Consultas repetidas iguais em menos de 90 segundos não são registradas de novo (as telas se atualizam sozinhas e encheriam o log).
- Capa de livro: campo `Livro.capa` (endereço http(s) ou imagem reduzida no navegador e guardada como data URL). Sem capa, o sistema desenha uma capa com a cor da categoria e as iniciais do título.
- Foto de usuário fica de fora desta leva (o usuário escolheu para Usuários o padrão de Alunos e Professores, sem miniatura).

O `server/prisma/schema.prisma` já foi alterado pelo main: valor `TI` no enum `Perfil`, campo `Livro.capa` e modelo `LogAtividade`. Ninguém altera o schema.

## Contrato do servidor (dono: g08)

### Autenticação

```ts
// lib/auth.ts
export interface UsuarioToken {
  id: number;
  perfil: Perfil;        // efetivo: nunca 'TI' depois de `autenticar` (TI vira 'ADMIN')
  perfilReal?: Perfil;   // preenchido por `autenticar` com o perfil verdadeiro
  alunoId: number | null;
  professorId: number | null;
}
```
O token continua carregando o perfil verdadeiro. A resposta de `POST /auth/login` e de `GET /auth/me` devolve `usuario.perfil` verdadeiro (`TI` para TI).

### Registro de atividades

`server/src/lib/log.ts`:
```ts
export type TipoLog = 'LOGIN' | 'FALHA_LOGIN' | 'SAIDA' | 'TELA' | 'CONSULTA' | 'CRIACAO' | 'ALTERACAO' | 'EXCLUSAO';
export function registrarLog(dados: { usuarioId?: number | null; usuarioNome?: string | null; perfil?: string | null; tipo: TipoLog; modulo: string; descricao: string; metodo?: string; caminho?: string; status?: number; duracaoMs?: number; ip?: string | null; navegador?: string | null }): void; // nunca lança; grava sem bloquear a resposta
export function descreverRequisicao(metodo: string, caminho: string): { tipo: TipoLog; modulo: string; descricao: string };
export function iniciarLimpezaDeLogs(): void; // apaga registros com mais de 90 dias ao subir e a cada 24 horas
```
- Um middleware em `app.ts` registra, ao terminar a resposta, toda requisição sob `/api` com usuário autenticado, exceto: `/api/saude`, tudo sob `/api/logs`, `/api/auth/login`, `/api/auth/sair` e método `OPTIONS`.
- `tipo`: GET = `CONSULTA`; DELETE = `EXCLUSAO`; PUT = `ALTERACAO`; POST = `CRIACAO`, salvo quando o caminho termina em uma ação (`/pagar`, `/cancelar`, `/fechar`, `/reabrir`, `/devolver`, `/ler`, `/enturmar`, `/gerar`, `/redefinir-senha`, `/trocar-senha`, `/notas`), que é `ALTERACAO`.
- `modulo`: primeiro segmento do caminho depois de `/api`, com rótulo em português (alunos "Alunos", professores "Professores", usuarios "Usuários", cursos "Cursos", disciplinas "Disciplinas", periodos-letivos "Períodos letivos", turmas "Turmas", matriculas "Matrículas", inscricoes "Inscrições", avaliacoes "Avaliações", aulas "Frequência", boletim "Boletim", historico "Histórico", pos "Pós-graduação", mensalidades "Mensalidades", bolsas "Bolsas", financeiro "Financeiro", livros "Biblioteca", emprestimos "Empréstimos", horarios "Horários", calendario "Calendário", comunicados "Comunicados", painel "Painel", busca "Busca", perfil "Perfil", auth "Sessão"; outro segmento: o próprio texto).
- `descricao`: "Consultou {Módulo}", "Criou um registro em {Módulo}", "Alterou um registro em {Módulo}", "Excluiu um registro em {Módulo}", e frases próprias para as ações ("Registrou pagamento de mensalidade", "Cancelou uma mensalidade", "Gerou mensalidades", "Fechou uma turma", "Reabriu uma turma", "Registrou devolução de livro", "Marcou um comunicado como lido", "Enturmou uma matrícula", "Lançou notas", "Redefiniu a senha de um usuário", "Trocou a própria senha").
- Consulta repetida: `CONSULTA` do mesmo usuário no mesmo caminho em menos de 90 segundos não é gravada (mapa em memória, limpo periodicamente).
- `caminho` sem query string; `ip` de `req.ip`; `navegador` = cabeçalho `user-agent` cortado em 200 caracteres; `usuarioNome` vem de um cache em memória (id para nome, consultando o banco uma vez por usuário a cada 10 minutos); `perfil` = perfil verdadeiro.
- `POST /auth/login`: grava `LOGIN` ("Entrou no sistema") no sucesso e `FALHA_LOGIN` ("Tentativa de login sem sucesso: {e-mail informado}") na falha, com `usuarioId` nulo na falha.

### Endpoints novos

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| POST `/auth/sair` | todos | | 204; grava `SAIDA` ("Saiu do sistema") |
| POST `/logs/tela` | todos | `{ caminho: string, titulo: string }` | 204; grava `TELA` ("Abriu a tela {titulo}", módulo = segundo segmento do caminho da tela com inicial maiúscula, ou "Início"); ignora repetição do mesmo usuário e caminho em menos de 5 segundos |
| GET `/logs` | ADMIN (e TI) | `?usuarioId=&tipo=&modulo=&busca=&de=&ate=&depoisDe=&antesDe=&limite=` | `{ itens: LogDTO[], haMais: boolean }`, do mais novo para o mais antigo |
| GET `/logs/resumo` | ADMIN (e TI) | | `ResumoLogDTO` |
| GET `/logs/usuarios/:id/resumo` | ADMIN (e TI) | | `ResumoUsuarioLogDTO` |

`LogDTO`: todos os campos de `LogAtividade` (`id`, `criadoEm`, `usuarioId`, `usuarioNome`, `perfil`, `tipo`, `modulo`, `descricao`, `metodo`, `caminho`, `status`, `duracaoMs`, `ip`, `navegador`).

`GET /logs`: `busca` procura em `descricao`, `usuarioNome` e `caminho` (sem diferenciar maiúsculas); `de` e `ate` são datas `AAAA-MM-DD` (dia inteiro); `depoisDe` devolve só registros com `id` maior (para o tempo real); `antesDe` devolve registros com `id` menor (para "carregar mais"); `limite` padrão 50, máximo 200. `haMais` indica se existem registros mais antigos além dos devolvidos.

```ts
interface ResumoLogDTO {
  agora: string;
  online: { usuarioId: number; nome: string; perfil: string; ultimaDescricao: string; ultimoTipo: string; telaAtual: string | null; ultimaAtividade: string }[]; // quem teve atividade nos últimos 5 minutos, mais recente primeiro; telaAtual = descrição do último registro TELA do usuário nesse intervalo, sem o prefixo "Abriu a tela "
  hoje: { atividades: number; usuariosAtivos: number; logins: number; falhasLogin: number; alteracoes: number }; // alteracoes = CRIACAO + ALTERACAO + EXCLUSAO
  porHora: { hora: string; total: number }[];        // últimas 24 horas, da mais antiga para a atual; hora no formato "14h"
  porModulo: { modulo: string; total: number }[];    // hoje, os 8 maiores
  porTipo: { tipo: string; total: number }[];        // hoje
  topUsuarios: { usuarioId: number; nome: string; perfil: string; total: number }[]; // hoje, os 8 maiores
  recentes: LogDTO[];                                // os 15 últimos
}
interface ResumoUsuarioLogDTO {
  ultimoLogin: string | null; ultimaAtividade: string | null; telaAtual: string | null; online: boolean;
  atividadesHoje: number; atividades7Dias: number; porTipo: { tipo: string; total: number }[]; // últimos 7 dias
}
```

### Usuários e livros

- `POST /usuarios` passa a aceitar `perfil` `ADMIN`, `TI` ou `SECRETARIA`. `GET /usuarios?perfil=` aceita `TI`.
- `POST /livros` e `PUT /livros/:id` aceitam `capa: string | null`: endereço que começa com `http://` ou `https://` (até 500 caracteres) ou data URL `data:image/jpeg;base64,`, `data:image/png;base64,` ou `data:image/webp;base64,` (até 200.000 caracteres); qualquer outra coisa devolve 400. `GET /livros` devolve `capa`. (Dono: g11.)
- `app.ts`: `express.json({ limit: '1mb' })`.

## Contrato do cliente (dono: g09)

```ts
// lib/tipos.ts
export type Perfil = 'ADMIN' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO';   // perfil efetivo (não muda)
export type PerfilReal = Perfil | 'TI';
export interface UsuarioLogado { id; nome; email; perfil: Perfil; perfilReal: PerfilReal; alunoId; professorId }
```
- `lib/auth.tsx` normaliza o usuário recebido da API e o guardado no navegador: `perfilReal` = perfil recebido; `perfil` = `ADMIN` quando o recebido for `TI`. `sair()` chama `POST /auth/sair` (sem esperar nem falhar) antes de limpar a sessão.
- `App.tsx` avisa o servidor a cada troca de tela: `POST /logs/tela` com o caminho e o rótulo da rota (falha silenciosa).
- Ícones novos em `ui/icones.tsx`: `atividade`, `log`, `grade`, `lista`, `imagem`, `pausar`, `reproduzir`.
- `layout/grupos.ts`: novo grupo `{ titulo: 'Sistema', icones: ['atividade', 'log'] }`, antes de "Conta".
- `layout/MenuUsuario.tsx`: o papel mostrado vem de `perfilReal` (TI "TI").

Telas novas (dono: g10), módulo `client/src/modules/logs/`:

| Caminho | Rótulo | Ícone | Perfis | Ordem |
|---|---|---|---|---|
| `/admin/atividades` | Atividades | `atividade` | `['ADMIN']` | 95 |
| `/admin/logs` | Log do sistema | `log` | `['ADMIN']` | 96 |

## Partes

| Agente | Mini-plano | Arquivos |
|---|---|---|
| `g08` | [s-g08-log-servidor.md](s-g08-log-servidor.md) | `server/src/app.ts`, `server/src/lib/auth.ts`, `server/src/lib/log.ts`, `server/src/modules/logs/routes.ts`, `server/src/modules/auth/routes.ts`, `server/src/modules/cadastros/routes.ts` |
| `g09` | [s-g09-cliente-base.md](s-g09-cliente-base.md) | `client/src/lib/tipos.ts`, `client/src/lib/auth.tsx`, `client/src/App.tsx`, `client/src/ui/icones.tsx`, `client/src/layout/grupos.ts`, `client/src/layout/MenuUsuario.tsx` |
| `g10` | [s-g10-telas-log.md](s-g10-telas-log.md) | `client/src/modules/logs/` |
| `g11` | [s-g11-biblioteca.md](s-g11-biblioteca.md) | `server/src/modules/biblioteca/routes.ts`, `client/src/modules/biblioteca/` |
| `g12` | [s-g12-calendario.md](s-g12-calendario.md) | `client/src/modules/agenda/`, `client/src/modules/academico/turmas.tsx` |
| `g13` | [s-g13-comunicados.md](s-g13-comunicados.md) | `client/src/modules/comunicados/` |
| `g14` | [s-g14-usuarios.md](s-g14-usuarios.md) | `client/src/modules/cadastros/usuarios.tsx`, `client/src/modules/cadastros/FichaUsuario.tsx` (depois de g06 e g08 aprovados) |

## Andamento

| Parte | Estado |
|---|---|
| Schema e mini-planos | feito |
| Entregas | não iniciadas |
| Teste e envio | não iniciado (junto com a primeira leva: `instalacao.md`) |
