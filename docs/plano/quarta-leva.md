# Quarta leva: configurações da plataforma, e-mail e chat privado

Pedido do usuário: "cria configurações da plataforma que só o admin pode acessar que dá para mudar a logo, nome e cores da plataforma e dá para conectar um e-mail para a plataforma conseguir mandar e-mail, e cria um chat privado tipo WhatsApp que todos os usuários podem usar".

Decisões do usuário (popup):

- E-mails enviados: "esqueci minha senha", boas-vindas a novos usuários, comunicados e respostas do suporte.
- Chat: conversas individuais e grupos; todos podem falar com todos.
- Recursos do chat: imagens, confirmação de entrega e leitura (dois tiques), quem está online e "digitando...", apagar a própria mensagem e responder citando uma mensagem.

Decisões do main:

- "Só o admin" = perfil efetivo `ADMIN` (administrador e TI, como no resto do sistema).
- Conexão de e-mail por SMTP (biblioteca `nodemailer`, já instalada em `server/`).
- Chat em tempo real por consulta periódica curta (`GET /chat/sincronizar` a cada 2 s com o chat aberto), sem WebSocket: não exige mudança no nginx nem no Docker.
- O chat usa a identidade visual do próprio sistema (nenhum nome, logo, cor de marca ou som de outro produto).
- O schema (`server/prisma/schema.prisma`) **já foi alterado pelo main** e o Prisma Client já foi gerado. Ninguém edita o schema. Modelos novos: `ConfiguracaoPlataforma`, `TokenSenha`, `EmailEnviado`, `ChatConversa`, `ChatParticipante`, `ChatMensagem`; enums `TipoTokenSenha`, `StatusEmail`, `TipoConversa`. Leia-os no schema antes de começar.

Regras gerais para todos:

- Servidor: módulos em `server/src/modules/<modulo>/routes.ts` com `export default router` (rotas autenticadas) e, se precisar, `export const publico` (rotas sem login). Use `asyncHandler`, `HttpError`, `validar`, `idParam` de `lib/erros`, `permitir` de `lib/auth` e `prisma` de `lib/prisma`. `req.usuario` tem `id`, `perfil` (efetivo) e `perfilReal`. Erros no formato `{ erro: string }`.
- Imagens: `validarImagem(valor, { aceitaEndereco })` de `server/src/modules/conquistas/imagem.ts` (data URL jpeg/png/webp de até 200.000 caracteres).
- Nunca devolver `senhaHash`, `smtpSenhaCifrada`, e-mail, CPF ou telefone de outras pessoas em respostas do chat.
- Cliente: `api` de `client/src/lib/api.ts`; componentes de `client/src/ui/index.tsx`; cores só por variáveis de `client/src/ui/estilo.css`; classes novas com o prefixo do módulo; nada estoura em 360 px; funciona nos temas claro e escuro.
- Verificação de cada parte: `npx tsc --noEmit` no lado em que mexeu. Se o erro for de um arquivo de outro gerador ainda não gravado, espere o `done` dele na sala e rode de novo. Não rode `npm install`, `vite build` nem Docker.

---

## Contrato A: plataforma e configurações

### `GET /plataforma` (pública, sem login)

```ts
interface PlataformaPublica {
  nome: string;
  slogan: string;
  logo: string | null;          // null = usar /logo-simbolo.png
  corPrimaria: string;          // "#rrggbb"
  corSecundaria: string;        // "#rrggbb"
  emailAtivo: boolean;          // SMTP configurado e ligado
  recuperacaoSenha: boolean;    // emailAtivo && emailRecuperacao
}
```

Se a linha de configuração não existir, devolve os padrões (`Sistema Escolar`, `Construindo um futuro melhor.`, `null`, `#2563eb`, `#1d4ed8`, `false`, `false`). Cabeçalho `Cache-Control: no-store`.

### `GET /configuracoes` (ADMIN)

```ts
interface ConfiguracoesDTO extends PlataformaPublica {
  enderecoSite: string | null;
  smtpServidor: string | null;
  smtpPorta: number;
  smtpSeguro: boolean;
  smtpUsuario: string | null;
  smtpSenhaDefinida: boolean;   // a senha nunca é devolvida
  emailRemetente: string | null;
  emailNomeRemetente: string | null;
  emailRecuperacao: boolean;
  emailBoasVindas: boolean;
  emailComunicados: boolean;
  emailSuporte: boolean;
  atualizadoEm: string | null;
}
```

### `PUT /configuracoes/identidade` (ADMIN)

Corpo `{ nome, slogan, logo, corPrimaria, corSecundaria }`. `nome` 2 a 40 caracteres; `slogan` até 80; `logo` validada com `validarImagem(..., { aceitaEndereco: true })` (null volta ao padrão); cores no formato `^#[0-9a-fA-F]{6}$` (gravar em minúsculas). Devolve `ConfiguracoesDTO`.

### `PUT /configuracoes/email` (ADMIN)

Corpo `{ enderecoSite, smtpServidor, smtpPorta, smtpSeguro, smtpUsuario, smtpSenha?, emailRemetente, emailNomeRemetente, emailAtivo, emailRecuperacao, emailBoasVindas, emailComunicados, emailSuporte }`.

- `smtpSenha` ausente ou `undefined` mantém a senha gravada; string vazia apaga; string não vazia grava cifrada.
- `enderecoSite`: `http://` ou `https://`, até 200 caracteres, sem barra no fim (remover).
- `smtpPorta` 1 a 65535; `emailRemetente` com formato de e-mail.
- `emailAtivo: true` exige `smtpServidor`, `emailRemetente` e `enderecoSite` preenchidos (senão `400` dizendo o que falta).
- Devolve `ConfiguracoesDTO`.

### `POST /configuracoes/email/teste` (ADMIN)

Corpo `{ para }` (e-mail). Envia um e-mail de teste com a configuração gravada, **mesmo com `emailAtivo` falso**, esperando o resultado: `200 { ok: true }` ou `400 { erro: 'Não foi possível enviar: <mensagem do servidor de e-mail>' }` (a mensagem cortada em 300 caracteres, nunca com a senha). Tempo limite de conexão: 15 s.

### `GET /configuracoes/email/historico` (ADMIN)

Últimos 30 registros de `EmailEnviado`: `{ id, para, assunto, tipo, status, erro, criadoEm }[]`.

### `server/src/lib/email.ts` (exportações exatas; outros módulos dependem delas)

```ts
export type TipoEmail = 'TESTE' | 'RECUPERACAO' | 'BOAS_VINDAS' | 'COMUNICADO' | 'SUPORTE';

export interface MensagemEmail {
  para: string;
  assunto: string;
  titulo: string;                 // título dentro do e-mail
  paragrafos: string[];           // texto puro; o módulo escapa o HTML
  botao?: { rotulo: string; endereco: string };
  tipo: TipoEmail;
}

// Lê a configuração (com cache de 30 s, invalidado por limparCacheConfiguracao).
export function lerConfiguracao(): Promise<ConfiguracaoPlataforma>;  // cria a linha id=1 se não existir
export function limparCacheConfiguracao(): void;

// true quando emailAtivo e o tipo está ligado (TESTE sempre true se houver servidor configurado).
export function emailHabilitado(tipo: TipoEmail): Promise<boolean>;

// Endereço do site para montar links: enderecoSite da configuração, ou null.
export function enderecoDoSite(): Promise<string | null>;

// Envia e espera. Lança Error com mensagem legível em caso de falha. Registra em EmailEnviado.
export function enviarEmailAgora(mensagem: MensagemEmail): Promise<void>;

// Põe na fila e volta na hora (nunca lança). Não faz nada se emailHabilitado(tipo) for falso.
// A fila envia um por vez, com intervalo de 300 ms; cada resultado vai para EmailEnviado.
export function enfileirarEmail(mensagem: MensagemEmail): void;
```

- O e-mail tem versão HTML (cabeçalho com o nome da plataforma na `corPrimaria`, título, parágrafos, botão, rodapé "Mensagem automática de {nome}") e versão texto.
- `server/src/lib/cripto.ts`: `cifrar(texto): string` e `decifrar(cifrado): string | null` com AES-256-GCM; chave = SHA-256 de `process.env.JWT_SECRET` (ou de um valor fixo de desenvolvimento se ausente); formato `iv.tag.dados` em base64. `decifrar` devolve `null` se falhar (segredo trocado): nesse caso o envio falha com "Senha do e-mail precisa ser digitada de novo nas configurações".
- A fila tem limite de 500 mensagens pendentes (excedente é descartado com registro `FALHOU`, erro "Fila cheia").

## Contrato B: senha por e-mail e avisos

### `server/src/lib/tokens-senha.ts`

```ts
export function criarTokenSenha(usuarioId: number, tipo: 'RECUPERACAO' | 'BOAS_VINDAS'): Promise<string>; // devolve o token em claro (32 bytes em hex); grava só o SHA-256
export function consultarTokenSenha(token: string): Promise<{ usuarioId: number; nome: string; tipo: 'RECUPERACAO' | 'BOAS_VINDAS' } | null>; // null se inexistente, usado, vencido ou usuário inativo
export function consumirTokenSenha(token: string, novaSenha: string): Promise<boolean>; // troca a senha e marca usado, numa transação; invalida os outros tokens do usuário
```

Validade: RECUPERACAO 1 hora; BOAS_VINDAS 7 dias. Criar um token RECUPERACAO invalida os anteriores do mesmo tipo e usuário.

### Rotas públicas em `server/src/modules/auth/routes.ts`

- `POST /auth/esqueci-senha` `{ email }` → sempre `200 { mensagem: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' }`, exista ou não a conta (não revelar). Só envia se `emailHabilitado('RECUPERACAO')` e houver `enderecoDoSite()`; se a recuperação estiver desligada, `400 { erro: 'A recuperação de senha por e-mail não está disponível. Procure a secretaria.' }`. Limite em memória: 3 pedidos por 15 minutos por `ip|email` e 20 por IP (excedeu: mesma resposta 200, sem enviar). Link: `{enderecoSite}/redefinir-senha/{token}`.
- `GET /auth/redefinir-senha/:token` → `200 { valido: true, nome, tipo }` ou `200 { valido: false }`.
- `POST /auth/redefinir-senha` `{ token, novaSenha }` (mínimo 6 caracteres, como a troca de senha atual) → `204`, ou `400 { erro: 'Link inválido ou vencido. Peça um novo.' }`.
- Registrar no log de atividades (sem senha nem token): pedido de recuperação e senha redefinida.

### Avisos por e-mail (sempre com `enfileirarEmail`, nunca atrasando nem derrubando a resposta)

- **Boas-vindas** (`BOAS_VINDAS`): nas quatro criações de usuário de `server/src/modules/cadastros/routes.ts` (usuário, aluno, professor e a outra que existir), depois de gravar: e-mail com o nome da plataforma, o e-mail de acesso e o botão "Criar minha senha" (`/redefinir-senha/{token}` com token BOAS_VINDAS). A senha digitada no cadastro continua valendo; o e-mail não a contém.
- **Comunicados** (`COMUNICADO`): em `POST /comunicados`, depois de gravar, para os usuários ativos do público do comunicado (use a mesma regra de visibilidade que o módulo já aplica na leitura, invertida: todos, só alunos, só professores, turma ou curso), exceto o autor; no máximo 300 destinatários por comunicado; corpo com o título, os primeiros 600 caracteres do texto e o botão "Ler no sistema" (`{enderecoSite}/login`).
- **Suporte** (`SUPORTE`): em `server/src/modules/suporte/routes.ts`, quando uma mensagem nova é gravada num chamado: se foi da equipe, avisa o autor do chamado; se foi do autor, avisa o responsável do chamado (se houver). Corpo com o assunto do chamado, os primeiros 400 caracteres da mensagem e o botão "Abrir o suporte".

## Contrato C: chat

Prefixo `/chat`, todas autenticadas, para todos os perfis. Só participantes ativos (`saiuEm` nulo) acessam uma conversa: senão `404`.

```ts
interface PessoaChat { id: number; nome: string; perfil: 'ADMIN' | 'TI' | 'SECRETARIA' | 'PROFESSOR' | 'ALUNO'; foto: string | null; online: boolean }

interface MensagemChat {
  id: number;
  conversaId: number;
  autor: { id: number; nome: string; foto: string | null };
  texto: string;                 // "" quando apagada
  imagem: string | null;         // null quando apagada
  apagada: boolean;
  sistema: boolean;
  respostaA: { id: number; autorNome: string; texto: string; temImagem: boolean; apagada: boolean } | null; // texto cortado em 120 caracteres
  criadaEm: string;
  minha: boolean;
  estado: 'ENVIADA' | 'ENTREGUE' | 'LIDA' | null; // só nas minhas; ENTREGUE/LIDA quando TODOS os outros participantes ativos receberam/leram
}

interface ConversaChat {
  id: number;
  tipo: 'INDIVIDUAL' | 'GRUPO';
  nome: string;                  // grupo: nome; individual: nome da outra pessoa
  foto: string | null;
  outro: PessoaChat | null;      // só em INDIVIDUAL
  participantes: number;         // quantidade de ativos
  souAdmin: boolean;             // administrador do grupo
  ultima: { texto: string; autorNome: string; minha: boolean; temImagem: boolean; apagada: boolean; criadaEm: string; estado: MensagemChat['estado'] } | null; // texto cortado em 80
  naoLidas: number;
  digitando: string[];           // primeiros nomes de quem está digitando (sem mim)
  atualizadaEm: string;
}

interface ConversaDetalhe extends ConversaChat {
  membros: (PessoaChat & { admin: boolean })[];
}
```

| Rota | O que faz |
|---|---|
| `GET /chat/contatos?busca=` | Usuários ativos, menos eu, por nome (contém, sem diferenciar maiúsculas); ordem alfabética; até 40. `PessoaChat[]`. |
| `GET /chat/conversas` | Minhas conversas ativas, da mais recente para a mais antiga (`atualizadaEm`). `ConversaChat[]`. |
| `POST /chat/conversas` | `{ tipo: 'INDIVIDUAL', usuarioId }`: devolve a existente (pela `chaveIndividual`) ou cria; não pode ser comigo (`400`); usuário inativo ou inexistente `404`. `{ tipo: 'GRUPO', nome, participantes: number[], foto? }`: nome 2 a 60; 1 a 99 outros participantes ativos; quem cria é administrador; grava uma mensagem `sistema` "{nome} criou o grupo". `201 ConversaDetalhe`. |
| `GET /chat/conversas/:id` | `ConversaDetalhe`. |
| `PUT /chat/conversas/:id` | Só grupo e só administrador do grupo: `{ nome?, foto? }`. `ConversaDetalhe`. |
| `POST /chat/conversas/:id/participantes` | Só administrador do grupo: `{ usuarioIds: number[] }`; quem já saiu volta (`saiuEm = null`); mensagem `sistema`. `ConversaDetalhe`. |
| `DELETE /chat/conversas/:id/participantes/:usuarioId` | Administrador remove alguém, ou a própria pessoa sai. Se o último administrador sair, o participante ativo mais antigo vira administrador. Mensagem `sistema`. `204`. Conversa individual: `400`. |
| `GET /chat/conversas/:id/mensagens?antesDe=&limite=` | Mensagens em ordem crescente de data; `limite` 1 a 50 (padrão 30); `antesDe` = id (traz as anteriores). `{ itens: MensagemChat[], haMais: boolean }`. Quem entrou depois num grupo só vê o que veio a partir de `entrouEm`. |
| `POST /chat/conversas/:id/mensagens` | `{ texto?, imagem?, respostaAId? }`: texto até 4.000 caracteres (aparado), imagem por `validarImagem(..., { aceitaEndereco: false })`; exige texto ou imagem; `respostaAId` tem de ser da mesma conversa. Atualiza `atualizadaEm` da conversa e a minha `ultimaLeituraEm`. Limite: 30 mensagens por minuto por usuário (`429`). `201 MensagemChat`. |
| `DELETE /chat/mensagens/:id` | Só o autor: marca `apagadaEm` (o texto e a imagem deixam de sair pela API). `204`. Atualiza `atualizadaEm` da conversa. |
| `POST /chat/conversas/:id/lida` | `ultimaLeituraEm = agora` (e `ultimaEntregaEm`). `204`. |
| `POST /chat/conversas/:id/digitando` | Marca em memória que estou digitando por 5 s. `204`. |
| `GET /chat/sincronizar?desde=&conversaId=` | O coração do tempo real. Ver abaixo. |
| `GET /chat/nao-lidas` | `{ total: number }` (soma de não lidas das minhas conversas). Leve, para o contador do topo. |

`GET /chat/sincronizar`:

- Marca minha presença (mapa em memória `usuarioId → instante`; online = visto há menos de 20 s; `GET /chat/nao-lidas` também marca) e atualiza `ultimaEntregaEm = agora` nos meus participantes que tenham mensagem mais nova que a entrega anterior.
- `desde` (ISO, opcional): devolve só o que mudou depois dele.
- Resposta:

```ts
interface Sincronizacao {
  agora: string;                  // usar como "desde" na próxima chamada
  naoLidasTotal: number;
  conversas: ConversaChat[];      // as que mudaram desde "desde" (todas, se "desde" ausente) e as que têm alguém digitando ou mudança de presença do "outro"
  aberta: null | {                // só quando conversaId vem e sou participante
    mensagens: MensagemChat[];    // novas ou alteradas (apagadas) desde "desde"; vazio se "desde" ausente
    digitando: string[];
    leitura: { entregueAte: string | null; lidaAte: string | null }; // menor ultimaEntregaEm e menor ultimaLeituraEm entre os OUTROS participantes ativos (null se alguém ainda não tem)
    online: boolean | null;       // presença do outro (individual); null em grupo
  };
}
```

- O cliente recalcula o estado (tiques) das próprias mensagens com `leitura`.
- Estas rotas não podem encher o log de atividades: `GET /chat/sincronizar`, `GET /chat/nao-lidas`, `POST /chat/conversas/:id/digitando` e `POST /chat/conversas/:id/lida` ficam **fora** do registro automático; as demais do chat entram com descrição genérica ("Enviou mensagem no chat", "Criou conversa no chat"), **sem o conteúdo**.

## Contrato D: base do cliente

### `client/src/lib/plataforma.tsx`

```ts
export interface Plataforma { nome: string; slogan: string; logo: string | null; corPrimaria: string; corSecundaria: string; emailAtivo: boolean; recuperacaoSenha: boolean }
export const PLATAFORMA_PADRAO: Plataforma;
export function PlataformaProvider(props: { children: ReactNode }): JSX.Element;
export function usePlataforma(): { plataforma: Plataforma; logoSrc: string; recarregar: () => Promise<void>; aplicarPrevia: (parcial: Partial<Plataforma> | null) => void };
```

- Ao montar: usa o que estiver em `localStorage` (`escola.plataforma`, com `try/catch`) e busca `GET /plataforma`; grava o resultado.
- `logoSrc` = `plataforma.logo ?? '/logo-simbolo.png'`.
- Aplica no `document.documentElement` (estilo em linha): `--cor-primaria`, `--cor-primaria-escura` (`color-mix(in srgb, <primária> 82%, black)`), `--cor-primaria-suave` (`color-mix(in srgb, <primária> 14%, var(--cor-superficie))`), `--cor-azul-suave` (igual à suave), `--gradiente-primario` (`linear-gradient(135deg, <primária>, <secundária>)`) e `--sombra-primaria` (`0 6px 16px color-mix(in srgb, <primária> 30%, transparent)`). Com as cores padrão, **não** aplica nada (valem as do tema).
- Atualiza `document.title` com o nome, e os `<link rel="icon">` e `apple-touch-icon` com `logoSrc`.
- `aplicarPrevia(parcial)` aplica temporariamente (para a tela de configurações mostrar a prévia ao vivo); `aplicarPrevia(null)` volta ao gravado.

### Ícones novos em `client/src/ui/icones.tsx`

`chat`, `email`, `paleta`, `visto` (um tique), `visto-duplo` (dois tiques), `responder`, `lixeira`, `grupo`, `mais-circulo`, `seta-esquerda`. Sólidos, no estilo dos existentes; entram em `NomeIcone` e `NOMES_ICONES`. (`engrenagem`, `imagem`, `enviar`, `anexo`, `fechar`, `busca`, `cadeado` já existem.)

### Rotas e menu

- `client/src/layout/grupos.ts`: `chat` entra no grupo "Comunidade" (antes de `forum`); `engrenagem` entra no grupo "Sistema".
- Rotas públicas novas em `App.tsx`: `/esqueci-senha` (componente `EsqueciSenha` de `client/src/layout/EsqueciSenha.tsx`) e `/redefinir-senha/:token` (`RedefinirSenha` de `client/src/layout/RedefinirSenha.tsx`).
- Módulos novos (registrados sozinhos por `modules/*/index.tsx`): `configuracoes` (`/admin/configuracoes`, rótulo "Configurações", ícone `engrenagem`, perfis `['ADMIN']`, ordem 97) e `chat` (`/admin/chat`, `/professor/chat`, `/aluno/chat`, rótulo "Chat", ícone `chat`, perfis conforme o portal, ordem 58).
- `client/src/modules/chat/naoLidas.ts` exporta `useChatNaoLidas(ativo: boolean): number` (consulta `GET /chat/nao-lidas` a cada 10 s, pausa com a aba do navegador oculta, falha silenciosa). O `Layout` usa esse hook num botão redondo com o ícone `chat` e contador, ao lado do sino (computador e celular), que leva ao chat do portal.

---

## Partes

| Parte | Gerador | Arquivos (só estes) |
|---|---|---|
| P1: configurações e e-mail no servidor | g08 | `server/src/lib/email.ts`, `server/src/lib/cripto.ts`, `server/src/modules/plataforma/routes.ts` (todos novos) |
| P2: senha por e-mail e avisos | g15 | `server/src/lib/tokens-senha.ts` (novo), `server/src/modules/auth/routes.ts`, `server/src/modules/cadastros/routes.ts`, `server/src/modules/comunicados/routes.ts`, `server/src/modules/suporte/routes.ts` |
| P3: chat no servidor | g16 | `server/src/modules/chat/*` (novo), `server/src/app.ts` e `server/src/lib/log.ts` (só o que for preciso para o registro de atividades do chat) |
| P4: base do cliente | g18 | `client/src/lib/plataforma.tsx` (novo), `client/src/main.tsx`, `client/src/App.tsx`, `client/src/ui/icones.tsx`, `client/src/layout/Layout.tsx`, `client/src/layout/casca.css`, `client/src/layout/Login.tsx`, `client/src/layout/login.css`, `client/src/layout/grupos.ts`, `client/index.html` |
| P5: tela de configurações | g19 | `client/src/modules/configuracoes/*` (novo) |
| P6: telas de senha por e-mail | g20 | `client/src/layout/EsqueciSenha.tsx`, `client/src/layout/RedefinirSenha.tsx`, `client/src/layout/senha.css` (novos) |
| P7: tela do chat | g21 | `client/src/modules/chat/*` (novo) |

Depois de aprovadas: dados de demonstração do chat e documentação (API, arquitetura, segurança, README, CHANGELOG).

### P1 (g08)

Implemente o Contrato A inteiro. Detalhes:

1. `lerConfiguracao` usa `upsert` da linha `id: 1`.
2. Transporte do `nodemailer`: `host`, `port`, `secure: smtpSeguro`, `auth` só quando houver usuário, `connectionTimeout`, `greetingTimeout` e `socketTimeout` de 15 s; remetente `"Nome" <email>`.
3. `PUT` invalida o cache; valide com `zod`.
4. As mensagens de erro do SMTP passam por uma função que remove a senha se ela aparecer e corta em 300 caracteres.
5. Teste à mão sem servidor de e-mail não é necessário; o revisor testa com um servidor SMTP de teste.

### P2 (g15)

Implemente o Contrato B inteiro. Detalhes:

1. Compare tokens só pelo hash SHA-256; nunca registre o token nem o link no log.
2. No cadastro, o envio de boas-vindas acontece depois da transação, dentro de um `void (async () => { ... })().catch(() => undefined)`, para nunca derrubar a resposta.
3. Em comunicados, monte a lista de destinatários com consultas Prisma (alunos pela matrícula/inscrição na turma ou no curso, conforme o módulo já faz para decidir quem vê); se a regra de visibilidade for ambígua, siga exatamente a função que o módulo usa em `GET /comunicados`.
4. Não mude os formatos de resposta das rotas existentes.

### P3 (g16)

Implemente o Contrato C inteiro. Detalhes:

1. Estados em memória (presença, digitando, limite de mensagens) em mapas com limpeza periódica (`setInterval(...).unref()`), sem crescer sem limite.
2. `naoLidas` de uma conversa = mensagens de outros, não `sistema`, não apagadas, com `criadaEm` maior que a minha `ultimaLeituraEm` (ou que `entrouEm`, se nunca li).
3. Evite consultas N+1 em `GET /chat/conversas` e em `sincronizar` (uma consulta para as conversas com a última mensagem, uma agregada para as não lidas).
4. O registro de atividades: leia `server/src/app.ts` (`registrarAtividade`) e `server/src/lib/log.ts` (`descreverRequisicao`) e faça a exclusão das quatro rotas e as descrições genéricas do chat com a menor mudança possível.

### P4 (g18)

Implemente o Contrato D inteiro. Detalhes:

1. `main.tsx`: `PlataformaProvider` por fora do `AuthProvider`.
2. `Layout.tsx` e `Login.tsx`: nome, slogan e logo vêm de `usePlataforma()` (a logo com `object-fit: contain` e cantos arredondados; o cartão ilustrado da lateral usa o slogan). No `Login`, embaixo do botão "Entrar", o link "Esqueci minha senha" (para `/esqueci-senha`) aparece só quando `plataforma.recuperacaoSenha` for verdadeiro.
3. Botão do chat com contador ao lado do sino, no computador e no celular; some quando a pessoa já está na tela do chat.
4. Publique uma nota na sala assim que `plataforma.tsx` e os ícones estiverem gravados (P5, P6 e P7 dependem deles).

### P5 (g19)

Tela `/admin/configuracoes` com `Abas`: **Identidade**, **Cores** e **E-mail**.

1. **Identidade**: nome, slogan, logo (enviar do computador, com redução no navegador para no máximo 256 px no maior lado e saída PNG ou WebP abaixo de 200.000 caracteres; ou colar um endereço; botão "Voltar à logo padrão"); ao lado, uma prévia da barra lateral e do cartão de login com o nome e a logo.
2. **Cores**: cor primária e cor secundária com `input type="color"` e campo de texto do código; oito combinações prontas em amostras clicáveis (inclua a padrão azul); prévia ao vivo com `aplicarPrevia` (botões, selo, link, gradiente); "Restaurar padrão". Ao sair da tela sem salvar, `aplicarPrevia(null)`.
3. Identidade e Cores salvam juntas em `PUT /configuracoes/identidade` (um botão "Salvar" por aba, enviando os cinco campos) e depois chamam `recarregar()`.
4. **E-mail**: endereço do site (pré-preenchido com `window.location.origin` quando vazio), servidor, porta, "Conexão segura (TLS direto, porta 465)", usuário, senha (campo de senha vazio com a dica "Deixe em branco para manter a senha atual" quando `smtpSenhaDefinida`), e-mail e nome do remetente, chave "Envio de e-mails ligado" e quatro caixas (recuperação de senha, boas-vindas, comunicados, respostas do suporte). Um quadro de ajuda curto com os valores comuns (porta 587 com STARTTLS, 465 com TLS direto; contas com verificação em duas etapas costumam exigir uma "senha de aplicativo"). Botão "Salvar" (`PUT /configuracoes/email`) e, separado, "Enviar e-mail de teste" (pede o destinatário, chama `POST /configuracoes/email/teste` e mostra o resultado ou o erro devolvido).
5. Embaixo, "Últimos envios" (`GET /configuracoes/email/historico`): data, destinatário, assunto, tipo e situação em `Selo`, com o erro em texto suave.
6. Arquivos: `index.tsx` (rotas), componentes e `configuracoes.css`.

### P6 (g20)

Duas telas públicas no mesmo visual da tela de login (leia `client/src/layout/Login.tsx` e `login.css`; reaproveite as classes de lá, sem editá-las; o que faltar vai em `senha.css`), com nome e logo de `usePlataforma()` e o botão de tema (`BotaoTema` de `Layout.tsx`).

1. `EsqueciSenha`: campo de e-mail e botão "Enviar instruções" (`POST /auth/esqueci-senha`); depois do envio, mostra a mensagem devolvida e o link "Voltar para o login"; mostra o erro `400` quando a recuperação estiver desligada.
2. `RedefinirSenha`: ao abrir, `GET /auth/redefinir-senha/:token`; se inválido, mensagem "Link inválido ou vencido" e o link para pedir outro; se válido, "Olá, {nome}" (título "Criar senha" quando `tipo` for `BOAS_VINDAS`, "Redefinir senha" quando `RECUPERACAO`), campos "Nova senha" e "Confirmar nova senha" (mínimo 6, iguais), botão "Salvar senha" (`POST /auth/redefinir-senha`); sucesso leva ao login com a mensagem "Senha salva. Entre com a nova senha."

### P7 (g21)

Tela do chat, no estilo de aplicativo de mensagens, com a identidade do próprio sistema. Arquivos sugeridos: `index.tsx` (rotas dos três portais), `Chat.tsx`, `ListaConversas.tsx`, `Conversa.tsx`, `Mensagem.tsx`, `NovaConversa.tsx`, `DetalheGrupo.tsx`, `comum.ts` (tipos do Contrato C e auxiliares), `naoLidas.ts` (Contrato D) e `chat.css`.

1. **Duas colunas** a partir de 900 px: lista de conversas à esquerda (360 px) e a conversa à direita; a área ocupa a altura disponível da tela (`calc(100dvh - cabeçalho)`), com rolagem só dentro da lista e dentro das mensagens. Abaixo de 900 px, uma coluna por vez: a lista, e ao tocar numa conversa ela ocupa a tela, com botão de voltar (`seta-esquerda`); a barra inferior do celular não pode cobrir o campo de mensagem.
2. **Lista**: busca, botão "Nova conversa" (`mais-circulo`), cada item com `Avatar` (bolinha verde quando o outro está online), nome, prévia da última mensagem (com o tique quando é minha, "Foto" quando é imagem, "Mensagem apagada" em itálico), hora (hoje: hora; ontem: "Ontem"; antes: data) e contador de não lidas; "digitando..." em verde no lugar da prévia.
3. **Nova conversa** (`Modal`): busca de contatos (`GET /chat/contatos`), tocar numa pessoa abre a conversa individual; alternador "Novo grupo": nome, foto opcional e seleção de várias pessoas.
4. **Conversa**: cabeçalho com avatar, nome e "online" / "digitando..." / "{n} participantes" (tocar no cabeçalho do grupo abre o detalhe); mensagens em balões (minhas à direita com `var(--cor-primaria)` e texto `var(--cor-sobre-primaria)`; dos outros à esquerda com `var(--cor-superficie)`), agrupadas por dia com separador ("Hoje", "Ontem", data), nome do autor em cima nos grupos, hora e tique no canto do balão (`visto` enviada, `visto-duplo` entregue em cor suave, `visto-duplo` lida em destaque), citação em bloco dentro do balão (tocar leva à mensagem citada, se estiver carregada), imagem com clique para ampliar (`Modal`), mensagem apagada em itálico ("Mensagem apagada"), mensagens de sistema centralizadas e pequenas. Menu de cada mensagem (aparece ao passar o mouse ou ao tocar): "Responder" e, nas minhas, "Apagar" (com confirmação). "Carregar anteriores" no topo mantém a posição da rolagem. Ao chegar mensagem nova: rola para o fim se a pessoa já estava no fim; senão mostra um botão "Novas mensagens".
5. **Campo de envio**: caixa de texto que cresce até 5 linhas; Enter envia e Shift+Enter quebra linha (no celular, Enter quebra linha e o botão envia); botão de imagem (redução no navegador para no máximo 1280 px no maior lado, JPEG, abaixo de 200.000 caracteres, com prévia antes de enviar); barra de "Respondendo a {nome}" com o X para cancelar; envio otimista (a mensagem aparece na hora com o tique simples e é confirmada pela resposta; em erro, marca "Não enviada. Tentar de novo").
6. **Tempo real**: `GET /chat/sincronizar` a cada 2 s com a tela visível (5 s sem conversa aberta; pausa com a aba oculta e retoma na hora ao voltar), aplicando conversas, mensagens novas ou apagadas, `digitando`, `leitura` e `online`. `POST .../digitando` no máximo uma vez a cada 3 s enquanto a pessoa digita. `POST .../lida` ao abrir a conversa e quando chega mensagem com a conversa aberta e a aba visível.
7. **Detalhe do grupo** (`Modal`): foto, nome (editar se `souAdmin`), lista de membros com selo "Administrador" e bolinha de online, "Adicionar pessoas" e "Remover" (se `souAdmin`), e "Sair do grupo".
8. Estados vazios: sem conversas ("Comece uma conversa") e nenhuma conversa selecionada (ilustração simples com o ícone `chat`).
9. Acessibilidade: `aria-label` nos botões de ícone, `aria-live="polite"` na área de mensagens, foco no campo ao abrir a conversa.

### P8 (g01): dados de demonstração do chat

Arquivo (só este): `server/prisma/seed-demo.ts`. Acrescente ao fim de `carregarDemonstracao`, sem alterar o que já existe (os usuários de demonstração são localizados por e-mail, como o bloco da terceira leva já faz):

1. Três conversas individuais: Marina com a professora Ana (dúvida sobre o trabalho, 6 mensagens, a última da Ana ainda não lida pela Marina), Marina com Lucas (4 mensagens, tudo lido) e a secretaria com o professor Bruno (3 mensagens, a última do Bruno não lida pela secretaria). `chaveIndividual` = "menorId:maiorId".
2. Um grupo "Turma de Algoritmos II" criado pela professora Ana (administradora), com Marina, João e mais um aluno da turma: mensagem de sistema "Ana Ribeiro criou o grupo" e 8 mensagens em sequência natural, uma delas respondendo a outra (`respostaAId`), uma apagada (`apagadaEm`), as duas últimas não lidas pela Marina.
3. Datas no passado, espalhadas pelas últimas 48 horas, em ordem crescente dentro de cada conversa; `atualizadaEm` da conversa = data da última mensagem; `ultimaLeituraEm` e `ultimaEntregaEm` dos participantes coerentes com o que está lido (entrega = agora para todos; leitura conforme descrito); `entrouEm` anterior à primeira mensagem.
4. Sem imagens. Texto em português correto, escolar e neutro, sem dados pessoais reais nem marcas.
5. Não crie linha em `ConfiguracaoPlataforma` (o servidor cria com os padrões).
6. Verificação: `cd server && npx tsc --noEmit`.

### P9 (g04): documentação da quarta leva

Arquivos (só estes): `docs/API.md`, `docs/ARQUITETURA.md`, `SECURITY.md`, `README.md`, `CHANGELOG.md`, `INSTALAR.md`. Leia o código real (não só este plano): `server/src/modules/plataforma/routes.ts`, `server/src/modules/chat/*`, `server/src/modules/auth/routes.ts`, `server/src/lib/email.ts`, `cripto.ts`, `tokens-senha.ts`.

1. `docs/API.md`: módulos novos **plataforma e configurações**, **senha por e-mail** (as três rotas públicas de `auth`) e **chat** (todas as rotas, formatos `PessoaChat`, `MensagemChat`, `ConversaChat`, `ConversaDetalhe`, `Sincronizacao`, regras de tiques, não lidas, presença, limite de 30 mensagens por minuto), no mesmo formato de tabela das seções existentes; cruze método e caminho com o código até não sobrar divergência.
2. `docs/ARQUITETURA.md`: seções curtas "Configurações da plataforma e identidade visual", "E-mail (SMTP, fila e histórico)", "Senha por e-mail" e "Chat (consulta periódica, presença e tiques em memória)"; entidades novas no diagrama.
3. `SECURITY.md`: senha do SMTP cifrada (AES-256-GCM com chave derivada do `JWT_SECRET`; trocar o segredo exige redigitar a senha), nunca devolvida pela API; tokens de senha de uso único guardados só como hash, com validade; resposta igual para e-mail existente ou não; link montado com o endereço do site gravado; limites de pedidos; chat sem conteúdo no log de atividades e sem dados de contato nas respostas; mensagens do chat ficam no banco em texto puro (dizer isso com clareza: não há criptografia de ponta a ponta).
4. `README.md`: na lista de recursos, configurações da plataforma (logo, nome, cores), e-mail (o que é enviado) e chat privado; um parágrafo "Como conectar um e-mail" (onde fica a tela, os campos, senha de aplicativo, botão de teste).
5. `INSTALAR.md`: uma pergunta nova na seção de dúvidas: "Como faço a plataforma enviar e-mails?".
6. `CHANGELOG.md`: itens em 1.0.0 (Adicionado), sem criar cabeçalho repetido.
7. Sem e-mail pessoal, caminho local, segredo, promessa de CI ou marca de terceiros (não cite nomes de aplicativos de mensagens; diga "chat privado").
