# Mini-plano g08: log de atividades e perfil TI no servidor

## Objetivo

O usuário pediu: "cria uma área de log que só quem pode ver é o administrador e o TI; o log registra todas as atividades na plataforma de todos os usuários em tempo real" e um painel de atividades. Você faz a parte do servidor: o perfil TI (com o mesmo acesso do administrador), o registro automático de toda atividade e os endpoints de consulta.

Leia antes: `docs/plano/segunda-leva.md` inteiro (as seções "Decisões do main" e "Contrato do servidor" são o seu contrato, com assinaturas, regras e formatos exatos), `server/prisma/schema.prisma` (enum `Perfil` com `TI`, modelo `LogAtividade`), `server/src/app.ts`, `server/src/lib/auth.ts`, `server/src/lib/erros.ts`, `server/src/modules/auth/routes.ts` e `server/src/modules/cadastros/routes.ts`.

## Arquivos que você pode criar ou editar (e só estes)

- `server/src/lib/auth.ts`
- `server/src/lib/log.ts` (novo)
- `server/src/app.ts`
- `server/src/modules/logs/routes.ts` (novo)
- `server/src/modules/auth/routes.ts`
- `server/src/modules/cadastros/routes.ts` (só o que envolve o perfil `TI`)

Não altere `schema.prisma` (já tem tudo) nem outros módulos.

## Passos

1. **`lib/auth.ts`**: acrescente `perfilReal?: Perfil` a `UsuarioToken`. Em `autenticar`, depois de validar o token: `perfilReal = payload.perfil` e `perfil = payload.perfil === 'TI' ? 'ADMIN' : payload.perfil`. `gerarToken` continua gravando o perfil que recebe (o verdadeiro). `permitir` não muda.
   - **Segredo do JWT** (achado de segurança): hoje `segredo()` usa `'dev-secret'` quando `JWT_SECRET` não está definido, e o `docker-compose.yml` tem o padrão `troque-este-segredo-de-exemplo`. Como o repositório é público, esses dois valores são conhecidos de todos. Troque por: uma constante de módulo calculada uma vez na subida: se `process.env.JWT_SECRET` estiver vazio, tiver menos de 16 caracteres, ou for igual a `troque-este-segredo-de-exemplo` ou `dev-secret`, gere um segredo aleatório com `crypto.randomBytes(48).toString('hex')` e imprima um aviso único: `Aviso: JWT_SECRET ausente ou de exemplo. Um segredo aleatório foi gerado para esta execução; os logins expiram quando o servidor reiniciar. Defina JWT_SECRET no .env (o instalador faz isso).` Caso contrário, use o valor da variável.
2. **`lib/log.ts`**: implemente `TipoLog`, `registrarLog`, `descreverRequisicao` e `iniciarLimpezaDeLogs` exatamente como no contrato.
   - `registrarLog` faz `prisma.logAtividade.create(...)` sem `await` no chamador (devolve `void`) e captura qualquer erro com `console.error` curto; nunca derruba a requisição.
   - Cache de nomes: `Map<number, { nome: string; ate: number }>`; função interna `nomeDoUsuario(id)` que consulta o banco quando não há entrada válida (10 minutos). Como é assíncrona, `registrarLog` aceita `usuarioNome` ausente e resolve o nome antes de gravar.
   - Anti-repetição de `CONSULTA`: `Map<string, number>` com chave `usuarioId + ' ' + caminho`, janela de 90 segundos; limpe entradas vencidas quando o mapa passar de 5.000 chaves.
   - `iniciarLimpezaDeLogs`: `deleteMany` de registros com `criadoEm` anterior a 90 dias, ao iniciar e em `setInterval` de 24 horas com `.unref()`.
3. **`app.ts`**:
   - `express.json({ limit: '1mb' })`;
   - `app.set('trust proxy', true)` (o site chega pela rede do Docker através do nginx);
   - um middleware, registrado depois do `express.json` e antes das rotas, que guarda o instante de início e, em `res.on('finish')`, chama `registrarLog` quando: o caminho começa com `/api/`, `req.usuario` existe, o método não é `OPTIONS` e o caminho não é `/api/saude`, não começa com `/api/logs` e não é `/api/auth/login` nem `/api/auth/sair`. Use `descreverRequisicao(req.method, caminhoSemQuery)`, `status: res.statusCode`, `duracaoMs`, `ip: req.ip`, `navegador` (user-agent até 200 caracteres), `usuarioId: req.usuario.id`, `perfil: req.usuario.perfilReal ?? req.usuario.perfil`;
   - chame `iniciarLimpezaDeLogs()` uma vez em `criarApp()`.
4. **`modules/auth/routes.ts`**:
   - login: no sucesso, `registrarLog({ tipo: 'LOGIN', modulo: 'Sessão', descricao: 'Entrou no sistema', usuarioId, usuarioNome, perfil, ip, navegador, metodo: 'POST', caminho: '/api/auth/login', status: 200 })`; na falha, `FALHA_LOGIN` com `descricao: 'Tentativa de login sem sucesso: ' + e-mail informado (cortado em 120 caracteres)` e `status: 401`. Nunca registre a senha;
   - `POST /auth/sair` no router autenticado: registra `SAIDA` ("Saiu do sistema") e responde 204;
   - a resposta de login e de `/auth/me` continua devolvendo o perfil verdadeiro do banco (`TI` para TI);
   - o `GET /painel` antigo deste arquivo: trate `TI` como `ADMIN` (use `req.usuario.perfil`, que já vem efetivo).
5. **`modules/cadastros/routes.ts`**: o esquema de criação de usuário aceita `perfil` `ADMIN`, `TI` ou `SECRETARIA`; o filtro `?perfil=` de `GET /usuarios` aceita os cinco perfis. Nada mais muda nesse arquivo.
6. **`modules/logs/routes.ts`**: `POST /logs/tela` (todos), `GET /logs`, `GET /logs/resumo` e `GET /logs/usuarios/:id/resumo` (os três com `permitir('ADMIN')`, o que já inclui TI), nos formatos do contrato.
   - `POST /logs/tela`: valide `caminho` (começa com `/`, até 200 caracteres) e `titulo` (1 a 80 caracteres); anti-repetição de 5 segundos por usuário e caminho; responde 204 sempre que os dados forem válidos.
   - `GET /logs`: monte o `where` com os filtros; busque `limite + 1` registros por `id` decrescente para calcular `haMais`.
   - `GET /logs/resumo`: carregue de uma vez os registros das últimas 24 horas (só os campos necessários) e agregue em memória: `online` (últimos 5 minutos, um por usuário, com o registro mais recente e a tela mais recente), `hoje` (desde 00:00 local), `porHora` (24 posições), `porModulo`, `porTipo`, `topUsuarios`; `recentes` com os 15 últimos em formato `LogDTO`.
   - `GET /logs/usuarios/:id/resumo`: conforme `ResumoUsuarioLogDTO` (`online` = atividade nos últimos 5 minutos).
7. Rode a verificação.

## Critérios de aceite

- Um usuário TI passa em todas as rotas que aceitam ADMIN; SECRETARIA, PROFESSOR e ALUNO recebem 403 em `GET /logs*`.
- Toda requisição autenticada gera um registro (respeitando as exceções e a anti-repetição); login, falha de login, saída e tela aberta geram os seus.
- Nenhum registro contém senha, token ou corpo de requisição.
- O log nunca derruba nem atrasa uma requisição (gravação sem `await` e com `catch`).
- `cd server && npx tsc --noEmit` com zero erro.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker, e não mexa nos contêineres do sistema.
