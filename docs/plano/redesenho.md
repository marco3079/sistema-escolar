# Plano do redesenho (igual ao exemplo do usuário)

## Pedido

"Deixa a versão clara como base e eu criei esse exemplo, faz 100% igual."

A imagem do exemplo está em `.claude/referencias/exemplo.png` (fora do repositório). **Todo agente desta rodada abre essa imagem (Read) antes de começar.** Ela mostra o mesmo painel em tema claro (metade de cima) e escuro (metade de baixo).

## Decisões do usuário (popup de 10/11/2026)

- Nome e logo continuam **Sistema Escolar** com o símbolo de livro e lápis (`/logo-simbolo.png`). Onde o exemplo escreve "EduCore", o app escreve "Sistema Escolar"; onde o exemplo põe o subtítulo "Sistema Escolar", o app põe o nome do portal (Administrativo, Professor ou Aluno).
- Tema: claro é a base; o escuro entra sozinho quando o aparelho está em modo escuro (`prefers-color-scheme`), como hoje.
- Redesenho de tudo: casca (barra lateral e topo), tela inicial dos três portais, login e telas internas.
- O que o exemplo mostra e o sistema não tinha é implementado com **dados reais**: busca, sino de avisos, gráfico de desempenho, frequência média, atalhos. Variação percentual só onde houver histórico; sem histórico, a variação não aparece.
- Menu agrupado em seções, com todas as telas.
- Ilustrações (prédio, pilha de livros, capelo) criadas pelo artista no Canva.
- Ícones refeitos em estilo preenchido (sólido).
- Envio ao GitHub ao fim da rodada aprovada.

## Como é o exemplo (descrição de referência)

**Barra lateral** (largura de cerca de 232 px, fundo quase branco): logo e nome no topo; lista de itens com ícone sólido cinza-azulado e texto; o item ativo é uma pílula azul com degradê, texto e ícone brancos, cantos de 10 px e sombra azul suave; no rodapé, um cartão com a frase "Construindo um futuro melhor." e a ilustração do capelo sobre ondas azuis.

**Topo**: campo de busca arredondado com lupa ("Buscar por alunos, professores, turmas..."); à direita, sino com contador vermelho, avatar redondo escuro com as iniciais, nome e papel do usuário e uma seta.

**Cabeçalho da tela inicial**: "Olá, {primeiro nome}!" grande e em negrito; abaixo, "Aqui está um resumo do sistema escolar."; um traço azul curto sob o texto; à direita, a data ("Seg, 29 de Set de 2025") com ícone de calendário e a hora grande ("21:40"); atrás, à direita, a ilustração do prédio esmaecida.

**Linha de 4 cartões de indicador**: cada um com um quadrado arredondado de cor suave contendo um ícone sólido (azul, roxo, verde, laranja), o valor grande em negrito, o rótulo pequeno e, à direita embaixo, a variação em verde com seta para cima.

**Linha de baixo, três colunas**: (1) cartão "Desempenho Acadêmico" com seletor "Últimos 6 meses" e gráfico de linha azul com área em degradê, pontos brancos de borda azul, eixo de 0% a 100% e um balão escuro com o valor do último ponto; (2) cartão "Avisos Recentes" com "Ver todos →" e três avisos (bolinha colorida, título em negrito, texto e tempo "há 1h"); (3) coluna com o cartão "Minha Turma" (título, subtítulo, botão "Ver detalhes →" e a ilustração da pilha de livros) e o cartão "Atalhos Rápidos" com quatro botões quadrados (ícone azul e rótulo em duas linhas).

**Geral**: fundo da página azul muito claro; cartões brancos com cantos de 16 px, borda quase invisível e sombra suave; textos em azul-marinho quase preto; cinza-azulado para textos secundários.

## Contrato visual: variáveis de CSS (dono: g03, em `client/src/ui/estilo.css`)

Os nomes abaixo são fixos. Todos os outros arquivos de CSS usam só estas variáveis para cor, raio e sombra (nenhuma cor fixa fora de `estilo.css`).

| Variável | Claro | Escuro |
|---|---|---|
| `--cor-fundo` | `#f3f6fc` | `#070d1a` |
| `--cor-superficie` | `#ffffff` | `#0e1627` |
| `--cor-superficie-2` | `#f6f8fd` | `#131d33` |
| `--cor-texto` | `#0f172a` | `#f1f5f9` |
| `--cor-texto-suave` | `#64748b` | `#94a3b8` |
| `--cor-borda` | `#e6ebf5` | `#1c2740` |
| `--cor-primaria` | `#2563eb` | `#3b82f6` |
| `--cor-primaria-escura` | `#1d4ed8` | `#2563eb` |
| `--cor-primaria-suave` | `#e8f0fe` | `#12244a` |
| `--gradiente-primario` | `linear-gradient(135deg, #3b82f6, #1d4ed8)` | `linear-gradient(135deg, #3b82f6, #1e40af)` |
| `--cor-roxo` / `--cor-roxo-suave` | `#7c3aed` / `#efe9fe` | `#a78bfa` / `#231a47` |
| `--cor-verde` / `--cor-verde-suave` | `#10b981` / `#e3f8f0` | `#34d399` / `#0c2b25` |
| `--cor-laranja` / `--cor-laranja-suave` | `#f59e0b` / `#fef3dc` | `#fbbf24` / `#33240a` |
| `--cor-azul-suave` | `#e8f0fe` | `#12244a` |
| `--cor-sobre-primaria` (texto e ícone sobre fundo azul ou degradê) | `#ffffff` | `#ffffff` |
| `--cor-perigo` | `#dc2626` | `#f87171` |
| `--cor-sucesso` | `#059669` | `#34d399` |
| `--cor-aviso` | `#d97706` | `#fbbf24` |
| `--cor-info` | `#2563eb` | `#60a5fa` |
| `--raio` | `16px` | igual |
| `--raio-pequeno` | `10px` | igual |
| `--sombra` | `0 4px 20px rgba(15, 23, 42, 0.06)` | `0 4px 20px rgba(0, 0, 0, 0.35)` |
| `--sombra-primaria` | `0 6px 16px rgba(37, 99, 235, 0.28)` | `0 6px 16px rgba(37, 99, 235, 0.35)` |
| `--largura-lateral` | `240px` | igual |
| `--altura-barra-inferior` | `64px` | igual |

Fonte: pilha do sistema (`Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`), sem baixar fonte externa.

Pontos de quebra: abaixo de 900 px a barra lateral some e entram a barra superior compacta, a barra inferior e a gaveta; abaixo de 720 px as grades viram uma coluna.

## Contrato de ícones (dono: g02, `client/src/ui/icones.tsx`)

Mesma assinatura de hoje (`Icone({ nome, tamanho?, className? })`, `NomeIcone`, `NOMES_ICONES`). Os 22 nomes atuais continuam e entram mais 12:

`busca`, `sino`, `seta-direita`, `seta-cima`, `seta-baixo`, `chevron-baixo`, `relogio`, `raio`, `grafico`, `engrenagem`, `documento`, `lapis`

Estilo: **preenchido** (`fill="currentColor"`, sem traço), como no exemplo.

## Contrato de API (dono: g01, módulo novo `server/src/modules/painel/routes.ts`)

O `GET /painel` antigo continua existindo (módulo `auth`); ninguém mexe nele.

### `GET /api/painel/resumo` (todos os perfis)

```ts
{
  primeiroNome: string;                      // primeira palavra do nome do usuário
  cartoes: {                                 // exatamente 4, nesta ordem
    chave: string;
    rotulo: string;
    valor: string;                           // já formatado: "1.248", "96,8%", "8,4"
    icone: NomeIcone;
    cor: 'azul' | 'roxo' | 'verde' | 'laranja';
    variacao: number | null;                 // em pontos percentuais, 1 casa; null = não mostrar
  }[];
  desempenho: { mes: string; rotulo: string; valor: number | null }[]; // 12 meses, do mais antigo ao atual; mes "AAAA-MM"; rotulo "Jan".."Dez"; valor de 0 a 100, 1 casa
  destaque: { etiqueta: string; titulo: string; subtitulo: string; caminho: string } | null;
}
```

Cartões por perfil (cor na ordem azul, roxo, verde, laranja):

| Perfil | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| ADMIN, SECRETARIA | "Alunos matriculados" (alunos distintos com matrícula ATIVA), ícone `turmas` | "Professores ativos", ícone `professores` | "Turmas ativas" (em períodos ativos), ícone `biblioteca` | "Frequência média" (média de `Inscricao.frequencia` não nula, "96,8%"; "—" se não houver), ícone `grafico` |
| PROFESSOR | "Minhas turmas" (períodos ativos), `turmas` | "Meus alunos" (inscrições CURSANDO nelas), `alunos` | "Orientações", `pos` | "Frequência média" das turmas dele, `grafico` |
| ALUNO | "Disciplinas cursando", `biblioteca` | "Média geral" (média de `notaFinal` não nula das inscrições dele, "8,4"; "—" se não houver), `boletim` | "Frequência média" dele, `grafico` | "Mensalidades em aberto" (ABERTA + ATRASADA), `financeiro` |

`variacao`: só no cartão "Alunos matriculados": `novas / anteriores * 100`, em que `novas` = matrículas ATIVAS com `dataMatricula` nos últimos 30 dias e `anteriores` = as demais ATIVAS; `null` se `anteriores` for 0 ou `novas` for 0. Em todos os outros cartões, `null`.

`desempenho`: para cada um dos últimos 12 meses, média de `Nota.valor / Avaliacao.notaMaxima * 100` das notas cujas avaliações têm `data` naquele mês; `null` se não houver nota. Escopo: ADMIN e SECRETARIA = todas; PROFESSOR = avaliações das turmas dele; ALUNO = notas das inscrições dele.

`destaque` (o cartão "Minha Turma" do exemplo):

| Perfil | etiqueta | titulo | subtitulo | caminho |
|---|---|---|---|---|
| ADMIN, SECRETARIA | "Turma em destaque" | nome da disciplina da turma com mais inscrições em período ativo | "{curso} · {código da turma}" | `/admin/turmas` |
| PROFESSOR | "Minha turma" | disciplina da turma dele com mais inscrições em período ativo | "{curso} · {código}" | `/professor/diario/{id}` |
| ALUNO | "Meu curso" | nome do curso da primeira matrícula ATIVA | "{rótulo do nível} · {série}ª série" para regime SERIADO, ou "{rótulo do nível} · Por créditos" | `/aluno/matricula` |

`null` quando não houver turma ou matrícula.

### `GET /api/busca?q=` (todos os perfis)

`q` com menos de 2 caracteres devolve `[]`. Busca sem diferenciar maiúsculas. Resposta: `{ tipo: 'Aluno' | 'Professor' | 'Turma' | 'Curso' | 'Livro'; titulo: string; subtitulo: string; caminho: string }[]`, no máximo 4 por tipo.

| Perfil | O que busca | caminho |
|---|---|---|
| ADMIN, SECRETARIA | Alunos (nome, RA; subtítulo "RA ..."), professores (nome; subtítulo = área ou registro), turmas (código ou nome da disciplina; subtítulo = período), cursos (nome ou código; subtítulo = rótulo do nível), livros (título ou autor; subtítulo = autor) | `/admin/alunos`, `/admin/professores`, `/admin/turmas`, `/admin/cursos`, `/admin/biblioteca` |
| PROFESSOR | Turmas dele, livros | `/professor/diario/{id}`, `/professor/biblioteca` |
| ALUNO | Cursos, livros | `/aluno/matricula`, `/aluno/biblioteca` |

Os avisos do sino e do cartão "Avisos Recentes" vêm do endpoint que já existe, `GET /api/comunicados` (campo `lido`).

## Arquivos de ilustração (dono: `arte`)

| Arquivo | Dimensões | Conteúdo |
|---|---|---|
| `client/public/ilustracoes/predio-claro.png` | cerca de 1200 x 500 | Prédio escolar moderno de vidro, em perspectiva, em tons de azul claro e branco, esmaecido, sobre fundo `#f3f6fc` |
| `client/public/ilustracoes/predio-escuro.png` | idem | O mesmo prédio à noite, em azul-marinho, com janelas acesas em azul, sobre fundo `#070d1a` |
| `client/public/ilustracoes/livros-claro.png` | cerca de 600 x 400 | Pilha de livros azuis e brancos, em perspectiva, sobre fundo `#e8f0fe` |
| `client/public/ilustracoes/livros-escuro.png` | idem | A mesma pilha em tons de azul-marinho, sobre fundo `#12244a` |
| `client/public/ilustracoes/capelo.png` | cerca de 480 x 360 | Capelo azul com borla sobre ondas azuis suaves, sobre fundo branco |

Cópias dos originais em `assets/artes/ilustracoes/`.

## Partes desta rodada

| Agente | Mini-plano | Arquivos |
|---|---|---|
| `arte` | [r-arte-ilustracoes.md](r-arte-ilustracoes.md) | as 5 ilustrações |
| `g01` | [r-g01-api-painel.md](r-g01-api-painel.md) | `server/src/modules/painel/routes.ts` |
| `g02` | [r-g02-icones-solidos.md](r-g02-icones-solidos.md) | `client/src/ui/icones.tsx` |
| `g03` | [r-g03-estilo-base.md](r-g03-estilo-base.md) | `client/src/ui/estilo.css` |
| `g04` | [r-g04-casca.md](r-g04-casca.md) | `client/src/layout/Layout.tsx` e arquivos novos em `client/src/layout/` |
| `g05` | [r-g05-painel.md](r-g05-painel.md) | `client/src/layout/Painel.tsx` e arquivos novos |
| `g06` | [r-g06-login.md](r-g06-login.md) | `client/src/layout/Login.tsx`, `client/src/layout/login.css` |

Prefixos de classes, para não haver choque: casca usa `casca-`, painel usa `painel-`, login usa `entrada-`. As classes dos componentes de `client/src/ui/index.tsx` mantêm os nomes atuais.

Depois: revisor em cada entrega; o main reconstrói no Docker, compara as telas com o exemplo em claro e escuro, em desktop e celular, roda o teste de ponta a ponta da API e envia ao GitHub.

## Andamento

| Parte | Estado |
|---|---|
| Mini-planos | feito |
| Entregas | todas aprovadas pelo revisor (casca, painel e estilo com um passe de acabamento) |
| Teste e envio | Docker reconstruído, 169 verificações da API sem falha, telas comparadas com o exemplo em claro e escuro, desktop e celular |
