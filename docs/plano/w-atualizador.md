# Rodada W: botão de atualizar pelo GitHub

Pedido do usuário: "coloca um botão de atualizar que atualiza para o último commit do repositório do GitHub".

## Como funciona

O sistema roda em contêineres e não consegue, sozinho, baixar código novo nem se reconstruir. Entra um quarto serviço no `docker-compose.yml`, o **atualizador**:

- tem a pasta do projeto montada em `/projeto` e o soquete do Docker (`/var/run/docker.sock`);
- não publica porta nenhuma: só a API fala com ele, pela rede interna do Compose, com um token;
- aceita apenas duas ordens, sem parâmetros: **consultar o estado** e **atualizar**;
- atualizar = `git pull --ff-only` do ramo atual a partir de `origin`, depois `docker compose build api web` e `docker compose up -d --no-deps api web`. Nunca usa `reset --hard`, nunca apaga volume, nunca mexe no banco nem recria a si mesmo.

A tela fica em **Configurações → Atualização** (perfil efetivo ADMIN: administrador e TI).

Decisões do main:

- Só avanço rápido (`--ff-only`): se a pasta tiver commits próprios divergentes ou arquivos alterados que conflitem, a atualização para com a mensagem do Git, sem perder nada.
- O repositório e o ramo são os do próprio checkout (`origin` e o ramo atual). A tela não deixa escolher endereço.
- O atualizador nunca se reconstrói; quando os arquivos dele mudarem num commit, a tela avisa que é preciso rodar o instalador de novo.

Regras gerais: sem dependências novas no servidor nem no cliente (use `fetch` nativo do Node 20 na API); o atualizador é um único arquivo Node sem dependências; verificação de cada parte com `npx tsc --noEmit` no lado em que mexeu (o atualizador: `node --check`). Não suba Docker; o main e o revisor testam.

## Contrato do atualizador (HTTP interno, porta 4000)

Autenticação: cabeçalho `X-Atualizador-Token` igual a `SHA-256('atualizador:' + JWT_SECRET)` em hexadecimal (os dois lados recebem `JWT_SECRET` do Compose; comparação em tempo constante). Sem o cabeçalho certo: `401`.

### `GET /estado` e `GET /estado?verificar=1`

`verificar=1` roda antes `git fetch --prune origin <ramo>` (tempo limite de 30 s). Sem ele, devolve o que já se sabe. Resposta `200`:

```ts
interface CommitInfo { commit: string; curto: string; data: string; mensagem: string } // curto = 7 caracteres; data ISO; mensagem = primeira linha

interface EstadoAtualizacao {
  ramo: string | null;
  repositorio: string | null;          // endereço de origin SEM credenciais (remova "usuario:senha@" se houver)
  instalado: CommitInfo | null;        // HEAD da pasta do projeto
  implantado: string | null;           // commit em execução (último que o atualizador subiu; ver abaixo)
  remoto: CommitInfo | null;           // origin/<ramo> como conhecido localmente
  atras: number;                       // commits que faltam: HEAD..origin/<ramo>
  novidades: { curto: string; mensagem: string; data: string }[]; // até 20, do mais novo para o mais antigo
  precisaReconstruir: boolean;         // implantado !== null && implantado !== instalado.commit
  atualizadorMudou: boolean;           // servidor.mjs ou Dockerfile da imagem em execução diferem dos da pasta (SHA-256, CRLF normalizado)
  verificadoEm: string | null;
  erroVerificacao: string | null;      // mensagem curta do último fetch que falhou
  tarefa: {
    estado: 'PARADA' | 'EXECUTANDO' | 'CONCLUIDA' | 'FALHOU';
    etapa: string;                     // "Baixando o código", "Reconstruindo", "Reiniciando", "Concluída"...
    iniciadaEm: string | null;
    terminadaEm: string | null;
    erro: string | null;
    log: string[];                     // últimas 200 linhas (stdout e stderr dos comandos), cada uma cortada em 500 caracteres
  };
}
```

- `implantado`: guardado no arquivo `/dados/implantado` (volume nomeado `dados_atualizador`). Na primeira subida, se o arquivo não existir, grava o HEAD atual (o instalador acabou de construir tudo).
- `atualizadorMudou` compara o conteúdo de `/app/servidor.mjs` e `/app/Dockerfile` (copiados para a imagem) com os de `/projeto/atualizador/`.
- Enquanto a tarefa está `EXECUTANDO`, `GET /estado` devolve as informações de Git já conhecidas e só a tarefa atualizada (os comandos Git esperam a vez na fila da tarefa).

### `POST /atualizar`

- `409 { erro: 'Já existe uma atualização em andamento' }` se `tarefa.estado === 'EXECUTANDO'`.
- Senão `202 { iniciada: true }` e a tarefa roda em segundo plano, nesta ordem, cada comando com saída indo para o log:
  1. "Baixando o código": `git fetch --prune origin <ramo>` e `git pull --ff-only origin <ramo>`;
  2. "Reconstruindo": `docker compose -p <projeto> -f /projeto/docker-compose.yml build api web`;
  3. "Reiniciando": `docker compose -p <projeto> -f /projeto/docker-compose.yml up -d --no-deps api web`;
  4. grava o novo HEAD em `/dados/implantado`; estado `CONCLUIDA`.
- Qualquer comando com saída diferente de zero: estado `FALHOU`, `erro` com a etapa e as últimas linhas, e **para** (sem tentar o resto). Se o `pull` falhou, nada foi reconstruído; se o `build` falhou, o sistema antigo continua no ar.
- Tempo limite: 5 minutos para o Git, 20 minutos para o build, 5 minutos para o `up`.
- `<projeto>` vem da variável `PROJETO_COMPOSE`.
- O estado da tarefa também é gravado em `/dados/tarefa.json` a cada mudança de etapa e relido na subida (uma tarefa que estava `EXECUTANDO` quando o serviço caiu vira `FALHOU` com erro "O atualizador reiniciou durante a atualização").

### Git dentro do contêiner

`git config --global --add safe.directory /projeto` na subida. Todos os comandos Git com `-C /projeto`. Nunca usar `reset`, `clean`, `checkout` de arquivos nem `stash`.

## Contrato da API (módulo novo `server/src/modules/atualizacao/routes.ts`, ADMIN)

- `GET /atualizacao` e `GET /atualizacao?verificar=1` → `200`:

```ts
type AtualizacaoDTO =
  | { disponivel: false; motivo: string }                // atualizador desligado, inacessível ou sem Git
  | ({ disponivel: true } & EstadoAtualizacao);
```

  Endereço do atualizador: variável `ATUALIZADOR_URL` (padrão `http://atualizador:4000`). Tempo limite de 40 s com `verificar`, 8 s sem. Falha de conexão: `{ disponivel: false, motivo: 'O serviço de atualização não está respondendo. Rode o instalador de novo para criá-lo.' }`.
- `POST /atualizacao` → repassa o `POST /atualizar`: `202 { iniciada: true }`, `409` com o erro, ou `503 { erro }` se o atualizador não responder. Registra no log de atividades "Iniciou a atualização do sistema" (sem detalhes).
- O `GET /atualizacao` fica **fora** do registro automático de atividades (é consultado a cada 2 s durante a atualização): acrescente o caminho à exclusão que já existe em `server/src/app.ts` para as rotas do chat.

## Partes

| Parte | Gerador | Arquivos (só estes) |
|---|---|---|
| W1: serviço atualizador e Compose | g03 | `atualizador/Dockerfile`, `atualizador/servidor.mjs`, `atualizador/.dockerignore` (novos), `docker-compose.yml`, `.env.example`, `instalar.ps1`, `instalar.sh` |
| W2: API | g08 | `server/src/modules/atualizacao/routes.ts` (novo), `server/src/app.ts` (só a exclusão do log), `server/src/lib/log.ts` (só o rótulo do módulo, se precisar) |
| W3: tela | g19 | `client/src/modules/configuracoes/Atualizacao.tsx` (novo), `Configuracoes.tsx` (só a aba nova), `tipos.ts`, `configuracoes.css` |

Depois de aprovadas: documentação (README, INSTALAR, SECURITY, API, ARQUITETURA, CHANGELOG).

### W1 (g03)

1. `atualizador/Dockerfile`: base `docker:27-cli` (traz `docker` e o plugin `compose`); `apk add --no-cache git nodejs`; copia `servidor.mjs`; `ENTRYPOINT ["node", "/app/servidor.mjs"]` (a imagem base tem um ponto de entrada que trata o comando como subcomando do `docker`). Sem `npm install`.
2. `atualizador/servidor.mjs`: servidor `node:http` na porta 4000 implementando o contrato acima; comandos com `spawn` (nunca `exec` com texto montado; argumentos sempre em lista), capturando stdout e stderr linha a linha; uma tarefa por vez; sem aceitar nada do corpo da requisição.
3. `docker-compose.yml`: serviço `atualizador` com `build: ./atualizador`, `volumes: [".:/projeto", "/var/run/docker.sock:/var/run/docker.sock", "dados_atualizador:/dados"]`, `environment: JWT_SECRET (o mesmo da api), PROJETO_COMPOSE: ${COMPOSE_PROJECT_NAME}`, `restart: unless-stopped`, **sem `ports`**. Na `api`: `ATUALIZADOR_URL: http://atualizador:4000`. Volume `dados_atualizador` na lista de volumes. Um comentário de duas linhas dizendo o que o serviço faz e que ele tem acesso ao Docker do computador.
4. `COMPOSE_PROJECT_NAME` precisa existir para a interpolação: confira na documentação do Compose se ela é preenchida automaticamente na interpolação do arquivo; se não for garantido, faça os instaladores gravarem `COMPOSE_PROJECT_NAME=<nome da pasta em minúsculas, só letras, números, _ e ->` no `.env` (e no `.env.example`, comentado), sem mudar o nome de projeto de instalações que já existem (o nome padrão do Compose é o da pasta, normalizado do mesmo jeito).
5. Instaladores: se a pasta não for um repositório Git (baixada como ZIP), avisar no resumo final que o botão de atualizar não vai funcionar e que é preciso instalar com `git clone`. Não mudar os códigos de saída.
6. `node --check atualizador/servidor.mjs` e `bash -n instalar.sh`.

### W2 (g08)

Implemente o contrato da API. Leia `server/src/modules/plataforma/routes.ts` (padrão de módulo ADMIN), `server/src/app.ts` (a exclusão do chat no registro de atividades) e `server/src/lib/auth.ts` (`segredoDoServidor()`: **não** use; o token do atualizador vem de `process.env.JWT_SECRET` puro, porque o atualizador não conhece o segredo aleatório de execução; se `JWT_SECRET` estiver vazio, devolva `disponivel: false` com o motivo "Defina JWT_SECRET no .env para usar a atualização"). Valide o formato do que vier do atualizador antes de repassar (objeto com os campos esperados; senão `disponivel: false`).

### W3 (g19)

Aba **Atualização** na tela de configurações (depois de "E-mail"), com o ícone e o padrão visual das outras abas:

1. Ao abrir a aba: `GET /atualizacao?verificar=1`. Botão "Verificar agora" repete.
2. `disponivel: false`: aviso com o `motivo`.
3. Cartão "Versão instalada": commit curto em fonte monoespaçada, mensagem e data; ramo e repositório em texto suave. Cartão "Última versão no GitHub": o mesmo para `remoto`, com `Selo` verde "Atualizado" quando `atras === 0` e não `precisaReconstruir`, ou laranja "{n} atualização(ões) disponível(is)".
4. Lista "O que vem nesta atualização" (`novidades`): commit curto, mensagem e data.
5. Botão principal **"Atualizar agora"** (habilitado quando `atras > 0` ou `precisaReconstruir`), com confirmação num `Modal`: "O sistema vai baixar a versão nova, reconstruir e reiniciar. Leva alguns minutos e as pessoas conectadas podem ser desconectadas por instantes." Chama `POST /atualizacao`.
6. Durante a tarefa (`EXECUTANDO`): consulta `GET /atualizacao` a cada 2 s; mostra a etapa atual, um indicador de progresso em etapas (Baixando o código → Reconstruindo → Reiniciando → Concluída) e o log numa caixa de texto monoespaçada com rolagem que acompanha o fim. **A API reinicia durante a etapa "Reiniciando"**: erros de rede ou 502/503/504 nesse período não são erro; mostre "Reiniciando o sistema..." e continue tentando por até 5 minutos. Como a função `api` do cliente redireciona para o login em `401`, e o token continua válido depois do reinício, basta tratar as falhas de rede.
7. `CONCLUIDA`: aviso de sucesso com o botão "Recarregar a página" (`window.location.reload()`), porque o site também foi trocado. `FALHOU`: aviso de erro com `tarefa.erro` e o log.
8. `atualizadorMudou`: aviso "O serviço de atualização também mudou nesta versão. Para atualizá-lo, rode o instalador de novo na pasta do projeto."
9. `erroVerificacao`: aviso amarelo com o texto (por exemplo, sem internet).
10. Cores só por variáveis; classes com prefixo `config-`; nada estoura em 360 px.

### W4 (g04): documentação

Arquivos (só estes): `README.md`, `INSTALAR.md`, `SECURITY.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `CHANGELOG.md`, `AGENTS.md`. Escreva a partir do código real (`atualizador/servidor.mjs`, `atualizador/Dockerfile`, `docker-compose.yml`, `server/src/modules/atualizacao/routes.ts`, `client/src/modules/configuracoes/Atualizacao.tsx`, os instaladores).

1. `README.md`: recurso "Atualização pelo painel" na lista do administrador; uma subseção curta "Como atualizar" (Configurações → Atualização → Verificar agora → Atualizar agora; o que acontece; quanto tempo leva; que o banco não é tocado) e a alternativa manual (`git pull` e rodar o instalador de novo).
2. `INSTALAR.md`: perguntas "Como atualizo o sistema?" e "O botão de atualizar diz que o serviço não está respondendo" (instalação antiga sem o serviço: rodar o instalador de novo; pasta baixada como ZIP: instalar com `git clone`).
3. `SECURITY.md`: o serviço atualizador tem acesso ao soquete do Docker do computador (equivale a controle total da máquina); as proteções (sem porta publicada, só a API fala com ele, token derivado do `JWT_SECRET`, só duas ordens fixas sem parâmetros, só avanço rápido a partir do `origin` do próprio checkout, nenhuma ação que apague dados); o que isso significa na prática (quem tem a senha de administrador pode disparar a atualização para o último commit do repositório configurado; a confiança passa a ser no repositório de origem); como desligar (remover o serviço `atualizador` do `docker-compose.yml` ou não subi-lo: o botão passa a avisar que o serviço não responde).
4. `docs/API.md`: módulo **atualização** (`GET /atualizacao`, `GET /atualizacao?verificar=1`, `POST /atualizacao`), formatos `AtualizacaoDTO`, `EstadoAtualizacao`, `CommitInfo`, códigos (202, 409, 503) e a nota de que o `GET` não entra no log de atividades.
5. `docs/ARQUITETURA.md`: o quarto serviço no diagrama e uma seção "Atualização pelo painel" (fluxo em etapas, o que é persistido em `dados_atualizador`, por que o atualizador não se reconstrói).
6. `AGENTS.md`: uma linha dizendo que, para atualizar uma instalação existente, o assistente roda `git pull` e o instalador de novo (ou orienta a usar o botão).
7. `CHANGELOG.md`: item em 1.0.0 (Adicionado) e uma linha em Segurança.
8. Sem e-mail pessoal, caminho local, segredo nem promessa de CI.
