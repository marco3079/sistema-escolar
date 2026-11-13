# Referência da API

Esta referência é para quem vai integrar com o sistema escolar ou consultar a API durante o desenvolvimento. Os endpoints aqui foram conferidos com as rotas do código em `server/src/modules/*/routes.ts`.

## Convenções

- **Endereço base**: `http://localhost:3090/api` com as portas padrão (`API_PORT=3090`). A porta direta da API (3090) é publicada só em `127.0.0.1`, ou seja, só o próprio computador a acessa. A porta do site (8090, `WEB_PORT`) é publicada em todas as interfaces e encaminha `/api` para a API; por isso `http://localhost:8090/api` funciona e também responde a outros aparelhos da rede local.
- **Formato**: corpo e resposta em JSON (`Content-Type: application/json`).
- **Autenticação**: cabeçalho `Authorization: Bearer <token>`. Todas as rotas exigem login, exceto `GET /api/saude`, `POST /api/auth/login`, `GET /api/plataforma` (nome, logo e cores da tela de entrada), `GET /api/plataforma/manifesto` e `GET /api/plataforma/logo` (nome e ícone do app instalado) e as rotas de senha por e-mail (`/api/auth/esqueci-senha` e `/api/auth/redefinir-senha`, veja a seção "Senha por e-mail").
- **Datas**: string ISO 8601 (por exemplo, `2026-03-02T00:00:00.000Z`).
- **Dinheiro**: número em reais (por exemplo, `1250.5`).
- **IDs**: inteiros. Um `:id` que não seja número devolve `400`.
- **E-mail**: é gravado sem espaços nas pontas e em minúsculas, em todo cadastro e alteração. O login, o pedido de recuperação de senha e a checagem de e-mail já usado comparam sem diferenciar maiúsculas de minúsculas.
- **Listas**: devolvem um array JSON simples, sem paginação. Os filtros vão na query string (`?busca=...`). A exceção é o log de atividades, que devolve `{ itens, haMais }`.
- **Tamanho do corpo**: até 1 MB por requisição. Capas de livro em data URL cabem nesse limite. Exceção: o envio de arquivo de cópia de segurança (`POST /backups/enviar`), que aceita até 200 MB.
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
| `413` | Corpo da requisição maior que 1 MB (`{ "erro": "Corpo da requisição grande demais" }`). No envio de cópia de segurança, maior que 200 MB. |
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
| Logo da plataforma (`logo` em `PUT /configuracoes/identidade`) | o mesmo | 200.000 caracteres | Aceito, até 500 caracteres |
| Foto de grupo do chat (`foto` em `/chat/conversas`) | o mesmo | 200.000 caracteres | Não aceito |
| Imagem de mensagem do chat (`imagem` em `/chat/conversas/:id/mensagens`) | o mesmo | 200.000 caracteres | Não aceito |

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

## Senha por e-mail (módulo `auth`)

Rotas públicas, sem login. A recuperação só funciona com o envio de e-mails ligado, com o endereço do site gravado e com a caixa "recuperação de senha" marcada (veja "Plataforma e configurações").

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| POST `/auth/esqueci-senha` | público | `{ email }` | `200 { mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções." }`, exista ou não a conta. `400 { erro: "A recuperação de senha por e-mail não está disponível. Procure a secretaria." }` se a recuperação estiver desligada. |
| GET `/auth/redefinir-senha/:token` | público | | `200 { valido: true, nome, tipo }`, com `tipo` `RECUPERACAO` ou `BOAS_VINDAS`; ou `200 { valido: false }`. |
| POST `/auth/redefinir-senha` | público | `{ token, novaSenha }` (mínimo 6 caracteres, como na troca de senha) | `204`. `400 { erro: "Link inválido ou vencido. Peça um novo." }` se o link não servir. |

Regras:

- O pedido de recuperação responde do mesmo jeito para e-mail cadastrado ou não, e para conta inativa. Só conta ativa recebe o e-mail, e o envio acontece em segundo plano: a resposta não espera nem revela o cadastro.
- O link enviado é `{endereço do site}/redefinir-senha/{token}`. O endereço do site é o gravado nas configurações da plataforma, não o de quem faz o pedido.
- Validade: 1 hora para a recuperação e 7 dias para o link de criação de senha que chega no cadastro de uma conta nova (`BOAS_VINDAS`). Cada link vale uma vez.
- Um novo pedido de recuperação invalida o link anterior da mesma conta. Ao redefinir a senha, os outros links da conta deixam de valer.
- Limites de pedidos, guardados só na memória do servidor: 3 pedidos por 15 minutos para o mesmo IP e e-mail, e 20 por 15 minutos para o mesmo IP. Acima disso, a resposta é a mesma `200`, mas nada é enviado.
- O log de atividades registra "Pediu a recuperação de senha por e-mail" e "Redefiniu a senha pelo link enviado por e-mail", sem senha e sem token.

## Plataforma e configurações (módulo `plataforma`)

Nome, slogan, logo, cores e envio de e-mails da plataforma. Só o perfil ADMIN (inclui TI) lê e altera as configurações. A rota pública `GET /plataforma` devolve apenas o que a tela de entrada precisa.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/plataforma` | público | | `PlataformaPublica`. Cabeçalho `Cache-Control: no-store`. |
| GET `/plataforma/manifesto` | público | | Manifesto do aplicativo instalado (`application/manifest+json`, `Cache-Control: no-cache`): `name` (nome da plataforma), `short_name` (o nome cortado em 12 caracteres), `theme_color` (cor primária), `background_color: "#ffffff"`, `start_url: "/"`, `display: "standalone"` e `icons`. |
| GET `/plataforma/logo` | público | | A logo, com o tipo da imagem (`Cache-Control: public, max-age=300`). Logo em data URL é devolvida decodificada. Endereço `http(s)` recebe `302` para ele. Sem logo própria, `302` para `/logo-simbolo.png`. |
| GET `/configuracoes` | A | | `ConfiguracoesDTO` |
| PUT `/configuracoes/identidade` | A | `{ nome, slogan, logo, corPrimaria, corSecundaria }` | `ConfiguracoesDTO`. `400` se algum campo for inválido. |
| PUT `/configuracoes/email` | A | `{ enderecoSite, smtpServidor, smtpPorta, smtpSeguro, smtpUsuario, smtpSenha?, emailRemetente, emailNomeRemetente, emailAtivo, emailRecuperacao, emailBoasVindas, emailComunicados, emailSuporte }` | `ConfiguracoesDTO`. `400` se algum campo for inválido ou se faltar o que o envio ligado exige. |
| POST `/configuracoes/email/teste` | A | `{ para }` (um e-mail) | `200 { ok: true }`. `400 { erro: "Não foi possível enviar: <motivo>" }` quando o servidor recusa. |
| GET `/configuracoes/email/historico` | A | | `HistoricoEmailDTO[]`, os 30 registros mais recentes, do mais novo para o mais antigo. |

Formatos:

```ts
interface PlataformaPublica {
  nome: string;
  slogan: string;
  logo: string | null;          // null = logo padrão do sistema
  corPrimaria: string;          // "#rrggbb"
  corSecundaria: string;        // "#rrggbb"
  emailAtivo: boolean;          // servidor SMTP preenchido e envio ligado
  recuperacaoSenha: boolean;    // emailAtivo e caixa de recuperação marcada
}

interface ConfiguracoesDTO extends PlataformaPublica {
  enderecoSite: string | null;
  smtpServidor: string | null;
  smtpPorta: number;
  smtpSeguro: boolean;          // true = TLS direto (porta 465)
  smtpUsuario: string | null;
  smtpSenhaDefinida: boolean;   // a senha nunca é devolvida
  emailRemetente: string | null;
  emailNomeRemetente: string | null;
  emailRecuperacao: boolean;
  emailBoasVindas: boolean;
  emailComunicados: boolean;
  emailSuporte: boolean;
  atualizadoEm: string;
}

interface HistoricoEmailDTO {
  id: number;
  para: string;
  assunto: string;
  tipo: 'TESTE' | 'RECUPERACAO' | 'BOAS_VINDAS' | 'COMUNICADO' | 'SUPORTE';
  status: 'ENVIADO' | 'FALHOU';
  erro: string | null;
  criadoEm: string;
}
```

Regras:

- Sem linha de configuração gravada, `GET /plataforma` devolve os padrões: `Sistema Escolar`, `Construindo um futuro melhor.`, logo `null`, `#2563eb`, `#1d4ed8`, e os dois e-mails desligados. A linha é criada na primeira leitura.
- Identidade: `nome` de 2 a 40 caracteres; `slogan` até 80 (pode ficar vazio). `logo` aceita data URL de imagem ou endereço `http(s)` (veja "Imagens"); `null` ou vazio volta à logo padrão. As cores precisam ser `#rrggbb` e são gravadas em minúsculas.
- `enderecoSite`: precisa começar com `http://` ou `https://`, até 200 caracteres. Barras no fim são removidas. Vazio vira `null`.
- `smtpPorta`: de 1 a 65535. Com `smtpSeguro` falso, a conexão começa sem criptografia e passa a TLS se o servidor pedir (costuma ser a porta 587). Com `smtpSeguro` verdadeiro, a conexão já começa com TLS (costuma ser a porta 465).
- `smtpSenha`: se for omitida ou `null`, a senha gravada continua; string vazia apaga a senha; outro texto substitui a senha, que é guardada cifrada. A senha nunca volta pela API.
- `emailRemetente`: formato de e-mail, senão `400`.
- `emailAtivo: true` exige servidor SMTP, e-mail do remetente e endereço do site. Se faltar algum, `400` com a lista, por exemplo: `"Para ligar o envio de e-mails, preencha: servidor SMTP, endereço do site."`.
- Teste: envia com a configuração gravada mesmo com o envio desligado, e espera o resultado do servidor. Cada etapa da conexão tem limite de 15 segundos. A mensagem de erro sai sem a senha e com no máximo 300 caracteres. O teste também entra no histórico, com o tipo `TESTE`.
- O histórico guarda destinatário, assunto, tipo, situação e erro. O corpo do e-mail não é guardado.
- O manifesto aponta os ícones para `/api/plataforma/logo` (192 e 512) quando há logo própria. Sem logo própria, aponta para `/logo-simbolo-192.png` e `/logo-simbolo.png`. O navegador usa o manifesto ao instalar o site como aplicativo.

## Atualização (módulo `atualizacao`)

Botão de atualizar do sistema (Configurações → Atualização). Só o perfil ADMIN (inclui TI) acessa. A API conversa com o serviço `atualizador` pela rede interna do Compose (`ATUALIZADOR_URL`, padrão `http://atualizador:4000`), com um token derivado de `JWT_SECRET`. O serviço não publica porta. Veja a seção "Atualização pelo painel" em `ARQUITETURA.md` e o `SECURITY.md`.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/atualizacao` | A | | `AtualizacaoDTO`. Sem `verificar`, usa o que já se sabe (limite de 8 segundos). |
| GET `/atualizacao?verificar=1` | A | | `AtualizacaoDTO`. Antes, o serviço busca as novidades no GitHub (limite de 40 segundos). |
| POST `/atualizacao` | A | | `202 { iniciada: true }`; `409 { erro }` se já houver uma atualização em andamento; `503 { erro }` se o serviço não responder ou recusar o pedido. |

Formatos:

```ts
interface CommitInfo {
  commit: string;   // hash completo
  curto: string;    // 7 primeiros caracteres
  data: string;     // ISO 8601 (data do commit)
  mensagem: string; // primeira linha
}

interface EstadoAtualizacao {
  ramo: string | null;
  repositorio: string | null;     // endereço do origin, sem usuário e senha
  instalado: CommitInfo | null;   // commit do código em execução na pasta do projeto
  implantado: string | null;      // commit que o serviço subiu por último (hash completo)
  remoto: CommitInfo | null;      // origin/<ramo>, como conhecido localmente
  atras: number;                  // commits que faltam para o remoto
  novidades: { curto: string; mensagem: string; data: string }[]; // até 20, do mais novo para o mais antigo
  precisaReconstruir: boolean;    // o commit implantado é diferente do instalado
  atualizadorMudou: boolean;      // os arquivos do serviço de atualização mudaram no checkout
  verificadoEm: string | null;
  erroVerificacao: string | null; // motivo curto da última busca no GitHub que falhou
  tarefa: {
    estado: 'PARADA' | 'EXECUTANDO' | 'CONCLUIDA' | 'FALHOU';
    etapa: string;                // "Baixando o código", "Reconstruindo", "Reiniciando", "Concluída"
    iniciadaEm: string | null;
    terminadaEm: string | null;
    erro: string | null;
    log: string[];                // últimas 200 linhas do Git e do Docker, cada uma com até 500 caracteres
  };
}

type AtualizacaoDTO =
  | { disponivel: false; motivo: string }   // serviço desligado, inacessível ou com resposta inválida
  | ({ disponivel: true } & EstadoAtualizacao);
```

Regras:

- `GET /atualizacao` devolve `200` mesmo quando o serviço de atualização não responde: nesse caso, `disponivel` é `false` e `motivo` diz o que fazer (por exemplo, "O serviço de atualização não está respondendo. Rode o instalador de novo para criá-lo."). O motivo `Defina JWT_SECRET no .env para usar a atualização` aparece quando `JWT_SECRET` está vazio.
- Textos que citem o endereço interno do serviço saem com o rótulo "o serviço de atualização" no lugar do endereço. Credenciais de `repositorio` e de mensagens de erro são removidas.
- `POST /atualizacao` manda o pedido ao serviço e não aceita nenhum parâmetro. A atualização roda em segundo plano: o `202` só confirma que ela começou. Acompanhe pelo `GET`, campo `tarefa`.
- Ordem da tarefa: "Baixando o código" (`git pull --ff-only`), "Reconstruindo" (`docker compose build api web`), "Reiniciando" (`docker compose up -d --no-deps api web`). Se um passo falhar, a tarefa vira `FALHOU` com o passo em `erro`, e os passos seguintes não rodam. O banco de dados não é tocado.
- Durante a etapa "Reiniciando", a API fica fora do ar por instantes: as chamadas podem falhar de rede até ela voltar.
- Cada `POST` aceito grava no log de atividades "Iniciou a atualização do sistema", sem detalhes.
- O `GET /atualizacao` (com ou sem `verificar`) fica fora do log de atividades, porque a tela o consulta a cada 2 segundos durante a atualização.

## Chat (módulo `chat`)

Chat privado entre usuários de qualquer perfil. Todas as rotas exigem login. Todos podem conversar com todos. Só participantes ativos acessam uma conversa; quem não participa, ou saiu do grupo, recebe `404`.

Formatos:

```ts
interface PessoaChat {
  id: number;
  nome: string;
  perfil: 'ADMIN' | 'TI' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO';
  foto: string | null;
  online: boolean;              // visto nos últimos 20 segundos
}

interface MensagemChat {
  id: number;
  conversaId: number;
  autor: { id: number; nome: string; foto: string | null };
  texto: string;                // "" quando apagada
  imagem: string | null;        // null quando apagada
  apagada: boolean;
  sistema: boolean;             // aviso do sistema (grupo criado, entrou, saiu, removido)
  respostaA: { id: number; autorNome: string; texto: string; temImagem: boolean; apagada: boolean } | null; // texto cortado em 120 caracteres
  criadaEm: string;
  minha: boolean;
  estado: 'ENVIADA' | 'ENTREGUE' | 'LIDA' | null; // só nas minhas mensagens, sem as de sistema
}

interface ConversaChat {
  id: number;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome: string;                 // grupo: o nome; individual: o nome da outra pessoa
  foto: string | null;
  outro: PessoaChat | null;     // só em INDIVIDUAL
  participantes: number;        // quantidade de participantes ativos
  souAdmin: boolean;            // administrador do grupo
  ultima: { texto: string; autorNome: string; minha: boolean; temImagem: boolean; apagada: boolean; criadaEm: string; estado: MensagemChat['estado'] } | null; // texto cortado em 80 caracteres
  naoLidas: number;
  digitando: string[];          // primeiros nomes de quem está digitando, sem mim
  atualizadaEm: string;
}

interface ConversaDetalhe extends ConversaChat {
  membros: (PessoaChat & { admin: boolean })[];  // ordenados por nome
}

interface Sincronizacao {
  agora: string;                // usar como "desde" na próxima chamada (já vem recuado 2 segundos)
  naoLidasTotal: number;
  conversas: ConversaChat[];    // todas (sem "desde") ou só as que mudaram desde "desde"
  aberta: null | {              // só com conversaId de uma conversa minha
    mensagens: MensagemChat[];  // novas ou apagadas desde "desde"; [] sem "desde"
    digitando: string[];
    leitura: { entregueAte: string | null; lidaAte: string | null }; // menor entrega e menor leitura entre os outros participantes ativos; null se algum ainda não tem
    online: boolean | null;     // presença do outro (individual); null em grupo
  };
}
```

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/chat/contatos` | todos | `?busca=` (até 80 caracteres; contém o termo, sem diferenciar maiúsculas) | `PessoaChat[]`, por nome, até 40. Não traz eu mesmo nem usuários inativos. |
| GET `/chat/conversas` | todos | | `ConversaChat[]`, da mais recente para a mais antiga (`atualizadaEm`). |
| POST `/chat/conversas` | todos | Individual: `{ tipo: "INDIVIDUAL", usuarioId }`. Grupo: `{ tipo: "GRUPO", nome, participantes: number[], foto? }` | Individual: `201` com `ConversaDetalhe` quando cria, ou `200` com a conversa que já existia. Grupo: `201` `ConversaDetalhe`. |
| GET `/chat/conversas/:id` | participante | | `ConversaDetalhe` |
| PUT `/chat/conversas/:id` | administrador do grupo | `{ nome?, foto? }` (`foto` vazia ou `null` remove a foto) | `ConversaDetalhe` |
| POST `/chat/conversas/:id/participantes` | administrador do grupo | `{ usuarioIds: number[] }` (de 1 a 99) | `ConversaDetalhe` |
| DELETE `/chat/conversas/:id/participantes/:usuarioId` | administrador do grupo, ou a própria pessoa (sair) | | `204` |
| GET `/chat/conversas/:id/mensagens` | participante | `?antesDe=&limite=` (`limite` de 1 a 50, padrão 30; `antesDe` é um id de mensagem) | `{ itens: MensagemChat[], haMais: boolean }`, em ordem crescente de data |
| POST `/chat/conversas/:id/mensagens` | participante | `{ texto?, imagem?, respostaAId? }` | `201` `MensagemChat` |
| DELETE `/chat/mensagens/:id` | autor da mensagem | | `204` |
| POST `/chat/conversas/:id/lida` | participante | | `204` |
| POST `/chat/conversas/:id/digitando` | participante | | `204` |
| GET `/chat/sincronizar` | todos | `?desde=&conversaId=` (`desde` em ISO 8601) | `Sincronizacao`. `400` se `desde` não for uma data. |
| GET `/chat/nao-lidas` | todos | | `{ total: number }`, soma das não lidas das minhas conversas |

Erros e regras das rotas:

- `POST /chat/conversas` individual: `400` se for comigo mesmo; `404` se o usuário não existir ou estiver inativo. A conversa individual é uma só por par de pessoas (`chaveIndividual`).
- `POST /chat/conversas` grupo: nome de 2 a 60 caracteres; de 1 a 99 outras pessoas, todas ativas (senão `400`). Quem cria vira administrador. Grava a mensagem de sistema "{nome} criou o grupo".
- `PUT /chat/conversas/:id`: `400` em conversa individual; `403` para quem não é administrador do grupo.
- `POST /chat/conversas/:id/participantes`: `400` em conversa individual, ou se o grupo passar de 100 participantes ativos, ou se alguém não estiver disponível; `403` para quem não é administrador. Quem já saiu volta com uma nova data de entrada, e não vê o que foi enviado enquanto esteve fora. Grava a mensagem de sistema.
- `DELETE .../participantes/:usuarioId`: `400` em conversa individual; `404` se a pessoa não estiver no grupo; `403` se quem pede não é administrador e não é a própria pessoa. Se o último administrador sair, o participante ativo mais antigo vira administrador. Grava a mensagem de sistema.
- `GET .../mensagens`: quem entrou depois num grupo só vê o que foi enviado a partir da data de entrada.
- `POST .../mensagens`: o texto é aparado nas pontas e tem no máximo 4.000 caracteres. A mensagem precisa de texto ou de imagem (`400`). `respostaAId` precisa ser uma mensagem da mesma conversa (`400`). Enviar conta como leitura da própria conversa. Limite de 30 mensagens por minuto por pessoa (contado em uma janela de 60 segundos a partir do primeiro envio dela); acima disso, `429` com `"Muitas mensagens em pouco tempo. Aguarde um instante."`.
- `DELETE /chat/mensagens/:id`: `404` se a mensagem não existir ou se eu não participar da conversa; `403` se eu não for o autor. Marca a mensagem como apagada: texto e imagem deixam de sair pela API, e quem a citou vê "Mensagem apagada".
- `POST .../lida`: marca que li a conversa e que as mensagens chegaram até agora para mim.
- `POST .../digitando`: vale por 5 segundos a cada chamada. Não conta como presença.

Tiques, leitura e presença:

- `estado` de uma mensagem minha: `ENVIADA` (um tique) enquanto ninguém a recebeu; `ENTREGUE` (dois tiques) quando todos os outros participantes ativos já receberam a conversa até a hora dela; `LIDA` quando todos já leram. Em grupo, vale só quando todos chegaram. Se eu for o único participante ativo, fica `ENVIADA`. Mensagens de sistema não têm estado.
- A entrega é registrada quando eu sincronizo e a conversa tem mensagem nova. A leitura é registrada em `POST .../lida` e ao enviar mensagem.
- Não lidas de uma conversa: mensagens de outras pessoas, que não são de sistema nem apagadas, criadas depois da minha última leitura (ou depois da minha entrada, se eu nunca li).
- Presença (`online`): a pessoa fica online enquanto sincroniza ou consulta `GET /chat/nao-lidas` nos últimos 20 segundos. Não é gravada no banco.
- `GET /chat/sincronizar`: sem `desde`, devolve todas as conversas e não devolve mensagens em `aberta`. Com `desde`, devolve só as conversas que mudaram e, em `aberta`, as mensagens criadas ou apagadas depois dele. Conversa com alguém digitando ou com mudança de presença do outro também aparece. O `agora` devolvido vem recuado 2 segundos, para não perder mensagem gravada no mesmo instante; o cliente elimina repetidas pelo `id`.
- Não entram no registro de atividades: `GET /chat/sincronizar`, `GET /chat/nao-lidas`, `POST .../digitando` e `POST .../lida`. As demais rotas do chat entram com descrição genérica ("Enviou mensagem no chat", "Criou conversa no chat"), sem o conteúdo.

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

### Importar alunos e professores por planilha

Quem pode: A e S, nas rotas de alunos e de professores. A planilha é lida pelo site (CSV) e chega à API como linhas em JSON. Cada linha é um objeto em que a chave é o nome da coluna do cabeçalho.

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/alunos/importar/modelo` | A, S | | `{ colunas: string[]; exemplo: string[] }` |
| POST `/alunos/importar` | A, S | `{ linhas, simular, senhaInicial? }` | Relatório (veja abaixo) |
| GET `/professores/importar/modelo` | A, S | | `{ colunas: string[]; exemplo: string[] }` |
| POST `/professores/importar` | A, S | `{ linhas, simular, senhaInicial? }` | Relatório (veja abaixo) |

Corpo:

```ts
interface CorpoImportacao {
  linhas: Record<string, string>[]; // de 1 a 500 linhas (sem o cabeçalho)
  simular: boolean;                 // true só confere; false grava se não houver erro
  senhaInicial?: string;            // 8 caracteres ou mais; obrigatória quando simular é false
}
```

Colunas (o nome do cabeçalho não diferencia maiúsculas, acentos, espaços e hífens; `E-mail` vale como `email`; `data_de_nascimento` e `data_nascimento` valem como `nascimento`):

| Planilha | Colunas | Obrigatórias |
|---|---|---|
| Alunos | `nome`, `email`, `cpf`, `telefone`, `nascimento`, `endereco`, `responsavel_nome`, `responsavel_email`, `responsavel_telefone` | `nome`, `email`, `nascimento` |
| Professores | `nome`, `email`, `cpf`, `telefone`, `titulacao`, `area` | `nome`, `email`, `titulacao` |

- `nascimento`: `dd/mm/aaaa` ou `aaaa-mm-dd`. Data que não existe (por exemplo, 31/02) é erro.
- `titulacao`: `GRADUADO`, `ESPECIALISTA`, `MESTRE` ou `DOUTOR`, ou os mesmos rótulos em minúsculas (`mestre`), com ou sem acento. Outro valor é erro.
- Cada campo passa pelas mesmas validações do cadastro individual (por exemplo, nome obrigatório e formato do e-mail). Colunas que não existem no modelo são ignoradas.
- Valores são aparados nas pontas. Coluna em branco é tratada como vazia.
- O RA do aluno e o registro do professor são gerados como no cadastro individual (RA: ano atual e 5 dígitos; registro: `P` e 4 dígitos), em sequência, sem repetir.

Relatório:

```ts
interface RelatorioImportacao {
  total: number;      // linhas recebidas
  validas: number;    // linhas sem erro
  criadas: number;    // registros gravados (0 na simulação)
  resultados: {
    linha: number;                            // número da linha na planilha (a primeira linha de dados é a 2)
    situacao: 'OK' | 'ERRO' | 'CRIADA';
    erros: string[];                          // no formato "coluna: mensagem"
    nome: string;
    email: string;                            // em minúsculas
  }[];
}
```

Respostas:

| Situação | Resposta |
|---|---|
| `simular: true` | `200` com o relatório. `situacao` é `OK` ou `ERRO`; `criadas` é 0. Nada é gravado. |
| `simular: false` e nenhuma linha com erro | `201` com o relatório. `situacao` é `CRIADA`. Registra "Importou {n} alunos por planilha" (ou professores) no log, sem os dados. |
| `simular: false` com alguma linha com erro | `400 { erro: "Há linhas com erro; nenhuma foi importada", detalhes: relatório }`. Nada é gravado. |
| Corpo inválido (sem linhas, mais de 500, `senhaInicial` com menos de 8 caracteres ou ausente com `simular: false`) | `400 { erro }` |

Regras:

- E-mail repetido dentro da planilha, ou já cadastrado (sem diferenciar maiúsculas), é erro nas linhas envolvidas.
- Com `simular: false`, a importação é tudo ou nada: todas as linhas são gravadas numa única transação, ou nenhuma. Se todas as linhas forem válidas, cada pessoa criada recebe o e-mail de boas-vindas (se o envio de e-mails estiver ligado), depois de gravada.
- Todos os usuários de um mesmo lote recebem a mesma senha inicial. Oriente cada pessoa a trocá-la no primeiro acesso, em "Meu perfil".

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

## Notificações (módulo `notificacoes`)

Central de avisos, o sino. Todos os perfis acessam, e cada pessoa vê só os próprios avisos: um id de outra pessoa devolve `404`. Os avisos são criados pelo servidor depois de cada evento. A lista de eventos está em `ARQUITETURA.md`, na seção "Central de notificações".

```ts
type TipoNotificacao = 'COMUNICADO' | 'SUPORTE' | 'FORUM' | 'NOTA' | 'FINANCEIRO' | 'MEDALHA' | 'BIBLIOTECA' | 'SISTEMA';

interface NotificacaoDTO {
  id: number;
  tipo: TipoNotificacao;
  titulo: string;       // até 120 caracteres
  texto: string;        // até 300 caracteres; pode ser vazio
  link: string | null;  // caminho dentro do portal, por exemplo "/boletim"
  criadaEm: string;
  lida: boolean;
}
```

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/notificacoes` | todos | `?limite=&antesDe=` | `{ itens: NotificacaoDTO[], haMais: boolean, naoLidas: number }`, do mais novo para o mais antigo. `limite` de 1 a 50 (padrão 20). `antesDe` é um id: traz só avisos com id menor (usado em "Carregar mais"). |
| GET `/notificacoes/nao-lidas` | todos | | `{ total: number }` |
| POST `/notificacoes/:id/lida` | todos | | `204`. `404` se o aviso não for da pessoa logada. |
| POST `/notificacoes/lidas` | todos | | `204`. Marca todos os avisos da pessoa logada como lidos. |
| DELETE `/notificacoes/:id` | todos | | `204`. `404` se o aviso não for da pessoa logada. |

Regras:

- `limite` fora de 1 a 50, ou `antesDe` que não seja número, devolve `400`.
- Avisos com mais de 60 dias são apagados pela limpeza automática, que roda ao subir o servidor e depois a cada 12 horas.
- Não é criado de novo um aviso com a mesma `chave` para a mesma pessoa. Essa chave é usada, por exemplo, para não repetir o aviso de nota no mesmo dia.
- A consulta do sino (`GET /notificacoes` e `GET /notificacoes/nao-lidas`) e as marcações como lido ficam fora do log de atividades, porque o sino consulta a cada 30 segundos.

## Cópia de segurança (módulo `backups`)

Cópias do banco inteiro, em arquivos `.sql.gz`, guardadas no próprio servidor. Só o perfil ADMIN acessa (inclui TI). Leia o `SECURITY.md` antes de usar: a cópia tem todos os dados do sistema.

Os nomes seguem o padrão `escola-AAAAMMDD-HHMMSS-<origem>.sql.gz`, com origem `auto` (automática), `manual`, `enviado` ou `pre-restauracao`. Qualquer nome fora desse padrão devolve `400` antes de tocar no disco.

```ts
interface BackupDTO {
  nome: string;
  tamanho: number;                                            // bytes
  criadoEm: string;
  origem: 'auto' | 'manual' | 'enviado' | 'pre-restauracao';
}

interface ConfigBackupDTO {
  backupAutomatico: boolean;
  backupHora: number;            // 0 a 23, relógio do servidor
  backupManter: number;          // 1 a 60 cópias automáticas
  ultimoAutomatico: string | null;
  ferramentasOk: boolean;        // pg_dump responde e é da versão 16
}
```

| Método e caminho | Quem | Corpo ou query | Resposta |
|---|---|---|---|
| GET `/backups` | A | | `{ config: ConfigBackupDTO, itens: BackupDTO[], emAndamento: "copia" \| "restauracao" \| null }`. Itens do mais novo para o mais antigo. |
| PUT `/backups/configuracao` | A | `{ backupAutomatico, backupHora (0 a 23), backupManter (1 a 60) }` | `ConfigBackupDTO`. `400` se algum valor estiver fora da faixa. |
| POST `/backups` | A | | `201 BackupDTO`, origem `manual`. Espera a cópia terminar. `400` se já houver 40 cópias guardadas. `409` se outra cópia ou restauração estiver em andamento. `500` se a ferramenta falhar. |
| POST `/backups/enviar` | A | Corpo bruto do arquivo `.sql.gz`, com `Content-Type: application/gzip`, até 200 MB | `201 BackupDTO`, origem `enviado`. `415` se o tipo não for `application/gzip`; `413` se passar de 200 MB; `400` se o arquivo não tiver a assinatura gzip ou se já houver 40 cópias; `409` se outra operação estiver em andamento. |
| GET `/backups/:nome` | A | | O arquivo, com `Content-Type: application/gzip` e `Content-Disposition: attachment`. `404` se não existir. |
| POST `/backups/:nome/restaurar` | A | `{ confirmacao: "RESTAURAR" }` | `200 { restaurado: true, copiaAnterior: string }`. `400` sem a palavra exata. `404` se a cópia não existir. `409` se outra operação estiver em andamento. `500 { erro }` se falhar. |
| DELETE `/backups/:nome` | A | | `204`. `404` se não existir. `409` se houver operação em andamento. |

Regras:

- Só uma cópia ou restauração roda por vez. A trava fica na memória do servidor; um segundo pedido recebe `409`.
- Restaurar faz primeiro uma cópia do estado atual, com origem `pre-restauracao`, e o nome dela volta em `copiaAnterior`. Se essa cópia falhar, nada é alterado e a resposta é `500`.
- Depois, a restauração roda numa única transação. Se qualquer parte falhar, a transação é desfeita, o banco fica como estava e a resposta é `500` com o nome da cópia anterior.
- A restauração troca **todos** os dados, inclusive usuários e senhas. Depois dela, é preciso entrar de novo no sistema.
- Limite de 40 cópias guardadas no total. Depois de cada cópia automática, as automáticas além de `backupManter` são apagadas, da mais antiga para a mais nova. Manuais, enviadas e de pré-restauração não são apagadas sozinhas.
- A cópia automática roda uma vez por dia, a partir da hora de `backupHora`, se `backupAutomatico` estiver ligado. Se o servidor estava desligado na hora, roda ao subir, no mesmo dia. Se naquele momento já houver cópia ou restauração em andamento, a automática do dia é pulada e um aviso vai para o log do servidor.
- O registro de atividades não guarda conteúdo: "Criou uma cópia de segurança", "Enviou uma cópia de segurança", "Baixou uma cópia de segurança", "Apagou uma cópia de segurança" e "Restaurou o banco a partir de uma cópia". As demais rotas de `/backups` ficam fora do registro automático.
