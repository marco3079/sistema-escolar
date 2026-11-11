# Plano da terceira leva: perfil com medalhas, suporte, fórum e passe de layout

## Pedidos do usuário

1. No menu do usuário: "Meu perfil, para a pessoa ver o perfil, medalhas e tudo mais".
2. "Um botão de suporte, que abre um popup que dá para ver os tickets meus criados e até onde eles estão, e responder e receber resposta da equipe de suporte responsável ou do professor responsável; e cria uma área em que a pessoa responsável pode ver e responder os tickets."
3. "Cria um fórum para os alunos e professores poderem publicar e responder as publicações", com o layout "muito parecido com o do Reddit".
4. "Melhora o layout da tela de Boletins", "de Turmas também", "de Cursos também", e um print de Períodos letivos marcando o vazio à direita da coluna de ações.

## Decisões do usuário (popup de 10/11/2026)

- Medalhas para alunos e professores; automáticas (regras) e manuais (concedidas por professor ou administrador).
- "Meu perfil" mostra: foto do usuário, resumo de desempenho, nível e pontos, atividade recente, medalhas.
- Suporte: atendimento por categoria; todos os usuários podem abrir ticket; com anexo de imagem, prioridade, aviso de resposta nova e avaliação ao encerrar.

## Decisões do main

- Fórum: mesma **estrutura** de um fórum com votos (comunidades, publicações com voto para cima e para baixo, comentários em árvore, ordenação por "Em alta", "Novas" e "Mais votadas", barra lateral da comunidade), com a identidade visual do próprio sistema (cores, ícones e componentes daqui). Não se copia nome, logotipo, textos nem a aparência exata de outro produto.
- Medalhas automáticas são calculadas na hora, a partir dos dados; só as manuais ficam no banco (`MedalhaConcedida`).
- Imagens (foto, anexo de ticket, imagem de publicação): reduzidas no navegador e guardadas como data URL, com os mesmos limites da capa de livro (até 200.000 caracteres; `image/jpeg`, `image/png` ou `image/webp`). A foto também aceita endereço `http(s)`.
- Passe de layout: a coluna de ações das tabelas passa a ser alinhada à direita, com menu de ações (três pontos) no lugar de vários links ou botões soltos.

O `server/prisma/schema.prisma` já foi alterado pelo main (`Usuario.foto`, `MedalhaConcedida`, `Chamado`, `ChamadoMensagem`, `ForumComunidade`, `ForumPublicacao`, `ForumComentario`, `ForumVoto` e os enums de chamado). Ninguém altera o schema.

Lembrete: depois da segunda leva, `req.usuario.perfil` é o perfil **efetivo** (TI vira ADMIN) e `req.usuario.perfilReal` é o verdadeiro.

## Contrato de API

Validação de imagem (usada nos três módulos): `null`, ou data URL que começa com `data:image/jpeg;base64,`, `data:image/png;base64,` ou `data:image/webp;base64,` e tem até 200.000 caracteres. Onde indicado, também endereço `http://` ou `https://` de até 500 caracteres.

`UsuarioResumo` (usado nos três módulos): `{ id: number; nome: string; perfil: string; foto: string | null }` (perfil verdadeiro; nunca e-mail, CPF nem telefone).

### Perfil e medalhas (módulo `conquistas`, dono: g15)

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/perfil/completo` | todos | | `PerfilCompletoDTO` do usuário logado |
| GET `/usuarios/:id/perfil-publico` | todos | | `PerfilPublicoDTO` (para o fórum) |
| PUT `/perfil/foto` | todos | `{ foto: string \| null }` (data URL ou endereço) | `{ foto }` |
| GET `/medalhas/catalogo` | todos | | `MedalhaCatalogoDTO[]` (as automáticas possíveis para o perfil do usuário) |
| POST `/medalhas` | ADMIN, SECRETARIA, PROFESSOR | `{ usuarioId, titulo, descricao?, icone?, cor?, pontos? }` | 201 `MedalhaDTO`; PROFESSOR só para aluno com inscrição em turma dele (403); o destinatário tem de ser ALUNO ou PROFESSOR (400); `pontos` de 5 a 50 |
| DELETE `/medalhas/:id` | ADMIN, ou quem concedeu | | 204 |

```ts
interface MedalhaDTO { codigo: string; titulo: string; descricao: string; icone: string; cor: 'azul'|'roxo'|'verde'|'laranja'; pontos: number; conquistada: boolean; conquistadaEm: string | null; manual: boolean; id: number | null; concedidaPor: string | null; progresso: { atual: number; meta: number } | null }
interface PerfilCompletoDTO {
  usuario: { id; nome; email; perfil /* verdadeiro */; telefone; foto; criadoEm; ra: string | null; registro: string | null; titulacao: string | null; area: string | null; curso: string | null /* curso da primeira matrícula ativa */ };
  nivel: { pontos: number; nivel: number; titulo: string; pontosDoNivel: number; pontosProximoNivel: number | null }; // faixas: 0 Iniciante, 50 Dedicado, 120 Destaque, 220 Exemplar, 350 Lendário (nível 1 a 5)
  resumo: { rotulo: string; valor: string; icone: string; cor: string }[]; // 4 indicadores conforme o perfil (os mesmos do painel)
  medalhas: MedalhaDTO[];          // conquistadas primeiro (mais recentes antes), depois as ainda não conquistadas com progresso
  atividadeRecente: { id: number; criadoEm: string; tipo: string; descricao: string; modulo: string }[]; // 10 últimos registros de LogAtividade do próprio usuário, sem CONSULTA
}
interface PerfilPublicoDTO { usuario: UsuarioResumo & { curso: string | null; titulacao: string | null }; nivel: PerfilCompletoDTO['nivel']; medalhas: MedalhaDTO[] /* só conquistadas */ }
```

Medalhas automáticas (código, título, regra, pontos, cor, ícone):

Aluno:
- `primeiros-passos` "Primeiros passos": ter uma matrícula; 10; azul; `matriculas`.
- `presenca-total` "Presença total": alguma inscrição encerrada ou em curso com frequência de 100%; 20; verde; `calendario`.
- `assiduo` "Assíduo": frequência média de 90% ou mais (com pelo menos 2 inscrições com frequência); 30; verde; `grafico`.
- `nota-dez` "Nota máxima": alguma nota de avaliação igual à nota máxima; 20; laranja; `boletim`.
- `excelencia` "Excelência": média geral de 9,0 ou mais (pelo menos 2 notas finais); 40; roxo; `medalha`.
- `aprovado` "Aprovado": primeira disciplina aprovada; 10; azul; `documento`. Progresso: aprovadas / 1.
- `maratonista` "Maratonista": 5 disciplinas aprovadas; 30; azul; `historico`. Progresso: aprovadas / 5.
- `leitor` "Leitor": 1 empréstimo de livro; 10; laranja; `biblioteca`.
- `rato-de-biblioteca` "Rato de biblioteca": 5 empréstimos; 30; laranja; `biblioteca`. Progresso: empréstimos / 5.
- `em-dia` "Em dia": pelo menos 3 mensalidades pagas e nenhuma atrasada; 20; verde; `financeiro`.
- `pesquisador` "Pesquisador": ter projeto de pesquisa; 20; roxo; `pos`.
- `mestre-da-banca` "Aprovado pela banca": projeto com status QUALIFICADO ou APROVADO; 40; roxo; `pos`.
- `voz-ativa` "Voz ativa": 3 publicações ou comentários no fórum; 10; azul; `forum`. Progresso / 3.

Professor:
- `mestre` "Na ativa": lecionar pelo menos uma turma em período ativo; 10; azul; `turmas`.
- `diario-em-dia` "Diário em dia": ter registrado pelo menos 10 aulas; 20; verde; `diario`. Progresso / 10.
- `avaliador` "Avaliador": ter lançado notas em pelo menos 5 avaliações; 20; laranja; `boletim`. Progresso / 5.
- `orientador` "Orientador": orientar ou coorientar pelo menos um projeto; 20; roxo; `pos`.
- `banca` "Membro de banca": participar de pelo menos uma banca; 20; roxo; `pos`.
- `turma-nota-alta` "Turma nota alta": alguma turma dele com média de notas finais de 8,0 ou mais (pelo menos 2 notas); 30; laranja; `grafico`.
- `leitor` e `voz-ativa`: como as do aluno.

Outros perfis não têm medalhas automáticas (`medalhas` só com as manuais, se houver; em geral vazio) e `nivel` calculado normalmente. `pontos` = soma dos pontos das medalhas conquistadas (automáticas e manuais).

### Suporte (módulo `suporte`, dono: g16)

Quem atende: `TECNICO` = ADMIN e TI; `SECRETARIA` e `FINANCEIRO` = SECRETARIA, ADMIN e TI; `ACADEMICO` = o professor da turma do chamado, ADMIN e TI. "Equipe" de um chamado = quem atende a categoria dele. O autor nunca é tratado como equipe no próprio chamado.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/chamados/meus` | todos | | `ChamadoDTO[]` do usuário, por `ultimaMensagemEm` decrescente |
| GET `/chamados/novidades` | todos | | `{ meus: number; atendimento: number }` (meus = chamados meus com resposta da equipe não lida; atendimento = chamados que eu atendo, não encerrados, com última mensagem do autor não lida pela equipe) |
| GET `/chamados/atendimento` | quem atende algo | `?status=&categoria=&prioridade=&busca=&meus=true` | `ChamadoDTO[]` dos chamados que o usuário pode atender |
| GET `/chamados/turmas` | todos | | turmas para escolher em ACADEMICO: ALUNO = turmas em que tem inscrição `CURSANDO`; demais = turmas de períodos ativos; `{ id, codigo, disciplina, professor }[]` |
| GET `/chamados/:id` | autor ou equipe | | `ChamadoDTO` + `mensagens: MensagemDTO[]`; marca como lido para quem abriu |
| POST `/chamados` | todos | `{ categoria, assunto, prioridade?, turmaId?, texto, anexo? }` | 201 `ChamadoDTO`; `turmaId` obrigatório em ACADEMICO |
| POST `/chamados/:id/mensagens` | autor ou equipe | `{ texto, anexo?, aguardarUsuario?: boolean }` | 201 `MensagemDTO`; 409 se o chamado estiver FECHADO |
| PUT `/chamados/:id` | equipe | `{ status?, prioridade?, responsavelId? }` | `ChamadoDTO` |
| POST `/chamados/:id/assumir` | equipe | | `ChamadoDTO` (responsável = quem chamou; status EM_ATENDIMENTO se estava ABERTO) |
| POST `/chamados/:id/encerrar` | autor | `{ avaliacao?: 1..5, comentario? }` | `ChamadoDTO` (status FECHADO) |
| POST `/chamados/:id/reabrir` | autor | | `ChamadoDTO` (status ABERTO; só a partir de RESOLVIDO ou FECHADO) |

```ts
interface ChamadoDTO { id; categoria; assunto; prioridade; status; turma: { id; codigo; disciplina } | null; autor: UsuarioResumo; responsavel: UsuarioResumo | null; avaliacao: number | null; avaliacaoComentario: string | null; criadoEm; atualizadoEm; ultimaMensagemEm; totalMensagens: number; naoLido: boolean /* para quem pediu: há mensagem do outro lado que ele ainda não leu */; souEquipe: boolean; previa: string /* começo da última mensagem */ }
interface MensagemDTO { id; texto; anexo: string | null; criadoEm; daEquipe: boolean; autor: UsuarioResumo }
```

Regras de status: mensagem da equipe = `EM_ATENDIMENTO` (ou `AGUARDANDO_USUARIO` se `aguardarUsuario`), e define o responsável se não houver; mensagem do autor em chamado `AGUARDANDO_USUARIO`, `EM_ATENDIMENTO` ou `RESOLVIDO` = `ABERTO`. A equipe pode pôr `RESOLVIDO`. Só o autor fecha (com avaliação opcional) e reabre. Toda mensagem atualiza `ultimaMensagemEm`, `ultimaMensagemEquipe` e `atualizadoEm`. `texto` de 1 a 4.000 caracteres; `assunto` de 3 a 120.

### Fórum (módulo `forum`, dono: g17)

Participam ALUNO e PROFESSOR; ADMIN, TI e SECRETARIA também leem, publicam e moderam. Moderador = ADMIN (inclui TI) e SECRETARIA; o PROFESSOR modera as próprias publicações e pode criar comunidade.

| Método e caminho | Quem | Corpo / query | Resposta |
|---|---|---|---|
| GET `/forum/comunidades` | todos | | `ComunidadeDTO[]` por quantidade de publicações |
| POST `/forum/comunidades` | ADMIN, SECRETARIA, PROFESSOR | `{ nome, descricao?, cor? }` | 201; `slug` gerado do nome (minúsculas, sem acento, hífen); 409 se repetido |
| GET `/forum/publicacoes` | todos | `?comunidade=<slug>&ordem=alta\|novas\|votadas&busca=&autorId=&antesDe=<id>&limite=` | `{ itens: PublicacaoDTO[]; haMais: boolean }`; fixadas primeiro quando há `comunidade` |
| GET `/forum/publicacoes/:id` | todos | | `PublicacaoDTO` + `comentariosLista: ComentarioDTO[]` (lista plana com `paiId`; o cliente monta a árvore) |
| POST `/forum/publicacoes` | todos | `{ comunidade: <slug>, titulo, corpo, imagem? }` | 201 `PublicacaoDTO` |
| PUT `/forum/publicacoes/:id` | autor: `titulo`, `corpo`, `imagem`; moderador: `fixada`, `fechada` | | `PublicacaoDTO` |
| DELETE `/forum/publicacoes/:id` | autor ou moderador | | 204 (marca `removida`) |
| POST `/forum/publicacoes/:id/voto` | todos | `{ valor: 1 \| -1 \| 0 }` | `{ pontos, meuVoto }` |
| POST `/forum/publicacoes/:id/comentarios` | todos | `{ corpo, paiId? }` | 201 `ComentarioDTO`; 409 se a publicação estiver fechada |
| PUT `/forum/comentarios/:id` | autor | `{ corpo }` | `ComentarioDTO` |
| DELETE `/forum/comentarios/:id` | autor ou moderador | | 204 (marca `removido`; o texto vira "[comentário removido]" na resposta) |
| POST `/forum/comentarios/:id/voto` | todos | `{ valor: 1 \| -1 \| 0 }` | `{ pontos, meuVoto }` |

```ts
interface ComunidadeDTO { id; nome; slug; descricao: string | null; cor; publicacoes: number; criadoEm }
interface PublicacaoDTO { id; titulo; corpo; imagem: string | null; fixada; fechada; pontos; comentarios; meuVoto: 1 | -1 | 0; criadoEm; editadoEm: string | null; autor: UsuarioResumo; comunidade: { nome; slug; cor }; posso: { editar: boolean; excluir: boolean; moderar: boolean } }
interface ComentarioDTO { id; paiId: number | null; corpo; removido; pontos; meuVoto: 1 | -1 | 0; criadoEm; editadoEm: string | null; autor: UsuarioResumo; posso: { editar: boolean; excluir: boolean } }
```

Regras: `valor: 0` remove o voto; `pontos` é sempre recalculado como a soma dos votos, na mesma transação; publicações removidas não aparecem nas listas (o `GET` por id devolve 404); "Em alta" = ordenação por `pontos / (horas desde a criação + 2) ^ 1.5` calculada em memória sobre as 200 publicações mais recentes do filtro; "Novas" = `criadoEm` decrescente; "Mais votadas" = `pontos` decrescente. `titulo` de 3 a 160; `corpo` da publicação de 0 a 10.000; `corpo` do comentário de 1 a 4.000. `limite` padrão 20, máximo 50. Ao criar ou remover comentário, atualize o contador `comentarios` da publicação.

## Contrato do cliente (base desta leva, dono: g18)

- `UsuarioLogado` ganha `foto: string | null` (vinda de `/auth/login` e `/auth/me`; o g15 inclui `foto` nessas respostas? Não: o g18 busca `GET /perfil/completo` uma vez depois do login para obter a foto, e guarda no contexto de autenticação, com uma função `atualizarFoto(foto)`).
- Ícones novos em `ui/icones.tsx`: `medalha`, `suporte`, `forum`, `voto-cima`, `voto-baixo`, `comentario`, `anexo`, `estrela`, `enviar`, `fixar`, `cadeado`.
- `ui/index.tsx`: `ColunaTabela` ganha `alinhar?: 'esquerda' | 'direita' | 'centro'` e `acoes?: boolean` (coluna de ações: alinhada à direita, largura mínima, sem título, e no modo cartão do celular aparece sem o rótulo e sem os dois-pontos). Novo componente `Avatar({ nome, foto?, tamanho? })` (iniciais ou foto, redondo). O componente `MenuAcoes` (hoje em `modules/cadastros/`) passa a ser exportado também por `ui/index.tsx` (reexportação), para os outros módulos usarem.
- `layout/MenuUsuario.tsx`: usa `Avatar` com a foto; o menu passa a ter "Meu perfil", "Suporte" (com o contador de `GET /chamados/novidades` `.meus`) e "Sair".
- `layout/grupos.ts`: grupo novo `{ titulo: 'Comunidade', icones: ['forum', 'suporte'] }`, antes de "Sistema".

Telas novas:

| Caminho | Rótulo | Ícone | Perfis | Ordem | Dono |
|---|---|---|---|---|---|
| `/admin/forum`, `/professor/forum`, `/aluno/forum` (e `.../forum/c/:slug`, `.../forum/p/:id`, sem menu) | Fórum | `forum` | conforme o portal | 80 | g21 |
| `/admin/atendimento`, `/professor/atendimento` | Atendimento | `suporte` | ADMIN, SECRETARIA; PROFESSOR | 81 | g20 |
| `/admin/perfil`, `/professor/perfil`, `/aluno/perfil` (já existem) | Meu perfil | `perfil` | | 90 | g19 (refaz a tela) |

O popup "Suporte" (meus tickets) é aberto pelo menu do usuário, em qualquer tela: o g20 exporta `PainelSuporte({ aberto, aoFechar })` em `client/src/modules/suporte/PainelSuporte.tsx`, e o g18 o usa no `MenuUsuario`.

## Partes

| Agente | Mini-plano | Arquivos |
|---|---|---|
| `g15` | [t-g15-conquistas-api.md](t-g15-conquistas-api.md) | `server/src/modules/conquistas/` |
| `g16` | [t-g16-suporte-api.md](t-g16-suporte-api.md) | `server/src/modules/suporte/` |
| `g17` | [t-g17-forum-api.md](t-g17-forum-api.md) | `server/src/modules/forum/` |
| `g18` | t-g18-cliente-base.md | ícones, `ui/index.tsx`, `estilo.css`, `MenuUsuario`, `grupos`, `tipos`, `auth` |
| `g19` | t-g19-meu-perfil.md | `client/src/modules/cadastros/perfil.tsx` e arquivos novos |
| `g20` | t-g20-suporte-telas.md | `client/src/modules/suporte/` |
| `g21` | t-g21-forum-telas.md | `client/src/modules/forum/` |
| `g22` | t-g22-layout-academico.md | Cursos, Períodos letivos e Turmas |
| `g23` | t-g23-layout-boletins.md | Boletins, boletim e histórico do aluno |
| `g14` | s-g14-usuarios.md | Usuários: menu de ações e ficha |

As partes de servidor (g15, g16, g17) começam já. As de cliente começam quando a segunda leva estiver entregue, porque usam arquivos que ela está alterando.

## Andamento

| Parte | Estado |
|---|---|
| Schema e contrato | feito |
| Servidor (g15, g16, g17) | não iniciado |
| Cliente (g18 a g23, g14) | não iniciado |
| Teste e envio | não iniciado |
