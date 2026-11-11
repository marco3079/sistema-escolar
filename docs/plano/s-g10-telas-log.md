# Mini-plano g10: telas "Atividades" e "Log do sistema"

## Objetivo

O usuário pediu "uma área de log que só quem pode ver é o administrador e o TI", com tudo "em tempo real", e "um dashboard de atividades que dá para ver o que cada um está fazendo". Você faz as duas telas.

Leia antes: `docs/plano/segunda-leva.md` (formatos exatos de `GET /logs`, `GET /logs/resumo`, `LogDTO` e `ResumoLogDTO`; o g08 está implementando o servidor), `client/src/lib/api.ts`, `client/src/lib/useDados.ts`, `client/src/lib/rotas.ts`, `client/src/ui/index.tsx`, `client/src/ui/icones.tsx`, `client/src/layout/painel.css` (estilo dos cartões de indicador e do gráfico, que são a referência visual), e, como exemplo de módulo de tela, `client/src/modules/financeiro/index.tsx`. Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode criar (e só estes)

- `client/src/modules/logs/index.tsx` (exporta `rotas`)
- `client/src/modules/logs/Atividades.tsx`
- `client/src/modules/logs/LogSistema.tsx`
- `client/src/modules/logs/comum.tsx` (tipos, rótulos, peças compartilhadas)
- `client/src/modules/logs/logs.css`

## Regras gerais

- Classes com prefixo `logs-`. Cores, raios e sombras só por variáveis de `client/src/ui/estilo.css`. Nenhuma cor fixa (salvo `rgba` em sombra).
- Ícones com `<Icone nome="..." />`. Os nomes `atividade`, `log`, `pausar` e `reproduzir` estão sendo criados agora pelo g09; os demais já existem.
- Tempo real por consulta periódica: `setInterval` de 5 segundos, sempre limpo no retorno do efeito, pausado quando a aba do navegador está oculta (`document.visibilityState`) e quando o usuário clicar em "Pausar".
- Tudo funciona em 360 px e nos dois temas.

## Passos

1. **`index.tsx`**: rotas `/admin/atividades` ("Atividades", ícone `atividade`, `perfis: ['ADMIN']`, ordem 95, `<Atividades />`) e `/admin/logs` ("Log do sistema", ícone `log`, `perfis: ['ADMIN']`, ordem 96, `<LogSistema />`). (TI entra como ADMIN no cliente.)
2. **`comum.tsx`**: tipos `LogDTO`, `ResumoLogDTO`; rótulos e cores por tipo (LOGIN "Entrada" verde, FALHA_LOGIN "Falha de login" vermelho, SAIDA "Saída" cinza, TELA "Tela" azul, CONSULTA "Consulta" cinza, CRIACAO "Criação" verde, ALTERACAO "Alteração" amarelo, EXCLUSAO "Exclusão" vermelho) com `Selo`; rótulos de perfil (ADMIN "Administrador", TI "TI", SECRETARIA "Secretaria", PROFESSOR "Professor", ALUNO "Aluno"); `tempoRelativo(iso)` ("agora", "há 20 s", "há 5 min", "há 2 h"); `Avatar({ nome })` redondo com iniciais; `horaCurta(iso)` ("14:32:05").
3. **`Atividades.tsx`** (o painel "o que cada um está fazendo"), com `GET /logs/resumo` a cada 5 segundos:
   - cabeçalho da página com o título, um indicador "Ao vivo" (ponto verde pulsando; "Pausado" em cinza) e o botão Pausar/Retomar (ícones `pausar` e `reproduzir`);
   - fileira de 5 indicadores (cartões como os do painel): Usuários online (verde, `turmas`; `online.length`), Atividades hoje (azul, `atividade`), Usuários ativos hoje (roxo, `alunos`), Alterações hoje (laranja, `lapis`), Falhas de login hoje (vermelho, `fechar`);
   - bloco **"Online agora"**: grade de cartões, um por usuário de `online`: avatar com iniciais e um ponto verde, nome, `Selo` do perfil, "Em: {telaAtual}" (ou "—"), a última ação (`ultimaDescricao`) e o tempo relativo; "Ninguém ativo nos últimos 5 minutos." quando vazio;
   - bloco **"Atividade nas últimas 24 horas"**: gráfico de barras em SVG feito à mão (uma barra por hora de `porHora`, altura proporcional ao maior total, rótulo da hora a cada 3 barras, `<title>` com "{hora}: {total}" em cada barra, cores por classes CSS com variáveis), desenhado no tamanho do contêiner (largura 100%, altura de 220 px, `viewBox` proporcional com `preserveAspectRatio="none"` só nas barras, ou meça com `ResizeObserver`);
   - dois blocos lado a lado: **"Por módulo"** e **"Usuários mais ativos"** (listas com barra horizontal proporcional e o total);
   - bloco **"Últimas atividades"**: os `recentes`, cada um com hora, avatar, nome, `Selo` do tipo, descrição e módulo; link "Ver o log completo" para `/admin/logs`.
   - Enquanto carrega pela primeira vez, `<Carregando />`; em erro, `<Aviso tipo="erro">` sem apagar os dados anteriores.
4. **`LogSistema.tsx`** (o log completo, ao vivo):
   - barra de ferramentas (classe utilitária `barra-ferramentas` com `filtros`, de `estilo.css`): busca por texto, tipo (`Selecao`), módulo (texto), data inicial e data final, e os botões Pausar/Retomar e "Limpar filtros";
   - carga inicial `GET /logs?limite=50` com os filtros; tempo real: a cada 5 segundos, `GET /logs?depoisDe={maior id}` com os mesmos filtros, colocando os novos no topo (destaque suave por 2 segundos nas linhas novas, com animação CSS); mantenha no máximo 500 linhas na memória;
   - mudança de filtro refaz a carga (com espera de 300 ms na busca por texto) e ignora respostas antigas;
   - tabela (`Tabela` de `ui`): Hora (data e hora), Usuário (avatar, nome e perfil), Tipo (`Selo`), Atividade (descrição), Módulo, Status (código HTTP; vermelho quando >= 400) e Duração ("{n} ms"); no celular vira cartões;
   - clique na linha abre um `Modal` com todos os campos do registro (inclusive caminho, método, IP e navegador);
   - botão "Carregar mais antigos" quando `haMais` (usa `antesDe={menor id}`);
   - contador "{n} registros carregados" e o indicador "Ao vivo" / "Pausado".
5. Rode a verificação.

## Critérios de aceite

- As duas telas aparecem só para ADMIN (e TI), no grupo "Sistema" do menu.
- Atualização a cada 5 segundos, sem piscar a tela nem perder a posição de rolagem; pausa manual e pausa automática com a aba oculta; nenhum `setInterval` sem limpeza.
- Nenhum número inventado: tudo vem da API.
- Nenhuma cor fixa em `logs.css`; nada estoura em 360 px.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de nome de ícone que o g09 ainda não gravou, espere o `done` dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
