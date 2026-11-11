# Mini-plano g20: telas do suporte (popup "Suporte" e área "Atendimento")

## Objetivo

O usuário pediu: "um botão de suporte, que abre um popup que dá para ver os tickets meus criados e até onde eles estão, e responder e receber resposta da equipe de suporte responsável ou do professor responsável; e cria uma área em que a pessoa responsável pode ver e responder os tickets". Pelo popup de perguntas: atendimento por categoria, anexo de imagem, prioridade, aviso de resposta nova e avaliação ao encerrar.

Leia antes: `docs/plano/terceira-leva.md` (seção "Suporte": endpoints, `ChamadoDTO`, `MensagemDTO`, regras de status e quem atende cada categoria; o g16 está implementando o servidor), `client/src/lib/api.ts`, `client/src/lib/useDados.ts`, `client/src/lib/auth.tsx`, `client/src/lib/rotas.ts`, `client/src/ui/index.tsx` (o g18 está acrescentando `Avatar`), `client/src/ui/estilo.css` (classes `barra-ferramentas`, `filtros`, `segmentado`), `client/src/ui/icones.tsx`, `client/src/modules/cadastros/FichaComum.tsx` (exemplo de popup largo com armadilha de foco) e `client/src/modules/biblioteca/CampoCapa.tsx` (exemplo de redução de imagem por canvas). Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode criar (e só estes)

- `client/src/modules/suporte/index.tsx` (exporta `rotas`)
- `client/src/modules/suporte/PainelSuporte.tsx` (o popup "meus chamados"; o menu do usuário, feito pelo g18, importa `PainelSuporte` daqui)
- `client/src/modules/suporte/Atendimento.tsx` (a área de quem responde)
- `client/src/modules/suporte/Conversa.tsx` (a conversa de um chamado, usada nos dois)
- `client/src/modules/suporte/NovoChamado.tsx`
- `client/src/modules/suporte/comum.tsx` (tipos, rótulos, peças)
- `client/src/modules/suporte/suporte.css`

## Regras gerais

- Classes com prefixo `suporte-`. Cores, raios e sombras só por variáveis de `client/src/ui/estilo.css`.
- Rótulos: categoria TECNICO "Técnico", SECRETARIA "Secretaria", FINANCEIRO "Financeiro", ACADEMICO "Acadêmico"; prioridade BAIXA "Baixa" (cinza), NORMAL "Normal" (azul), ALTA "Alta" (vermelho); status ABERTO "Aberto" (azul), EM_ATENDIMENTO "Em atendimento" (amarelo), AGUARDANDO_USUARIO "Aguardando você" para o autor e "Aguardando o usuário" para a equipe (roxo ou amarelo), RESOLVIDO "Resolvido" (verde), FECHADO "Fechado" (cinza).
- Atualização: a lista aberta se atualiza a cada 15 segundos e a conversa aberta a cada 8 segundos (`setInterval` sempre limpo, pausado com a aba oculta).

## Passos

1. **`comum.tsx`**: tipos `ChamadoDTO` e `MensagemDTO`; rótulos e `Selo` de categoria, prioridade e status; `tempoRelativo`; e a **linha do tempo do chamado** (`EtapasChamado({ status })`): quatro etapas em linha ("Aberto", "Em atendimento", "Resolvido", "Fechado") com a atual destacada e as anteriores marcadas, para a pessoa ver "até onde ele está".
2. **`Conversa.tsx`**: `Conversa({ chamadoId, aoMudar })`. Busca `GET /chamados/:id` e mostra:
   - cabeçalho: assunto, número ("#12"), `Selo` de categoria, prioridade e status, a turma (se houver), quem abriu, o responsável (ou "Ainda sem responsável") e `EtapasChamado`;
   - mensagens como uma conversa: balões alinhados à direita para quem está lendo e à esquerda para o outro lado, com `Avatar`, nome, papel ("Equipe" quando `daEquipe`), hora e o texto com quebras de linha preservadas; anexo como miniatura que abre em tamanho maior num `Modal`; rolagem até a última mensagem ao abrir e ao chegar mensagem nova;
   - caixa de resposta (some quando o chamado está FECHADO): `AreaTexto`, botão de anexar imagem (ícone `anexo`; reduza no `<canvas>` para no máximo 1000 px de largura, JPEG 0.8, até 190.000 caracteres; mostre a prévia com opção de remover) e o botão "Enviar" (ícone `enviar`; `Ctrl+Enter` também envia);
   - ações conforme `souEquipe`: para a equipe, "Assumir" (`POST .../assumir`), a opção "Pedir mais informações" (envia com `aguardarUsuario: true`), "Marcar como resolvido" (`PUT` com `status: 'RESOLVIDO'`) e a troca de prioridade; para o autor, "Encerrar chamado" (abre um `Modal` com a avaliação de 1 a 5 estrelas, ícone `estrela`, e um comentário opcional) e "Reabrir" quando RESOLVIDO ou FECHADO;
   - chamado FECHADO com avaliação mostra as estrelas e o comentário.
3. **`NovoChamado.tsx`**: formulário (`Modal`): categoria (com uma frase dizendo quem responde: "Técnico: equipe de TI", "Secretaria" e "Financeiro: secretaria", "Acadêmico: o professor da turma"), turma (só em Acadêmico; `GET /chamados/turmas`), assunto, prioridade, descrição e anexo opcional. `POST /chamados`.
4. **`PainelSuporte.tsx`**: `export function PainelSuporte({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void })`: popup largo (até 980 px; tela cheia abaixo de 720 px; fecha com Escape, clique fora e botão; foco preso dentro) com duas colunas a partir de 820 px: à esquerda, "Meus chamados" (`GET /chamados/meus`) com o botão "Novo chamado", filtro em pílulas ("Abertos", "Encerrados", "Todos") e a lista (assunto, prévia, `Selo` de status, tempo e um ponto quando `naoLido`); à direita, a `Conversa` do chamado escolhido (ou um estado vazio com o ícone `suporte`: "Escolha um chamado ou abra um novo."). Em telas estreitas, a lista e a conversa alternam (com botão "Voltar"). Não renderize nada quando `aberto` for falso.
5. **`Atendimento.tsx`**: a área de quem responde, como página: cartões de resumo no topo (Aguardando resposta, Em atendimento, Resolvidos, Total), barra de ferramentas com busca, filtros de status, categoria e prioridade e a opção "Só os meus", e o mesmo layout de duas colunas (lista de `GET /chamados/atendimento` à esquerda, com autor, categoria, prioridade, tempo e marca de não lido; `Conversa` à direita). Ordene com os não lidos e os de prioridade alta primeiro.
6. **`index.tsx`**: rotas `/admin/atendimento` (`perfis: ['ADMIN', 'SECRETARIA']`) e `/professor/atendimento` (`perfis: ['PROFESSOR']`), rótulo "Atendimento", ícone `suporte`, ordem 81.
7. Rode a verificação.

## Critérios de aceite

- Pelo menu do usuário, qualquer pessoa abre o popup, vê os próprios chamados com a etapa em que estão, abre um novo, responde e recebe resposta.
- Quem atende vê e responde só os chamados da sua categoria (a API garante; a tela não mostra ações que a pessoa não pode fazer).
- Anexo, prioridade, marca de não lido e avaliação ao encerrar funcionam.
- Intervalos sempre limpos; nenhuma cor fixa em `suporte.css`; nada estoura em 360 px.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de `Avatar` ou de ícone novo ainda não gravado pelo g18, espere a nota dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
