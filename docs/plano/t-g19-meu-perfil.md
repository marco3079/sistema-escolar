# Mini-plano g19: tela "Meu perfil" com foto, nível, medalhas e atividade

## Objetivo

O usuário pediu que o "Meu perfil" mostre "o perfil, medalhas e tudo mais". Pelo popup: foto do usuário, resumo de desempenho, nível e pontos, atividade recente e medalhas (automáticas e manuais). Refaça a tela, que hoje só mostra dados e a troca de senha.

Leia antes: `docs/plano/terceira-leva.md` (seção "Perfil e medalhas": formatos `PerfilCompletoDTO`, `MedalhaDTO`, a lista das medalhas e o endpoint `PUT /perfil/foto`; o g15 está implementando o servidor), `client/src/modules/cadastros/perfil.tsx` (tela atual, que você reescreve mantendo a edição de telefone/endereço e a troca de senha), `client/src/modules/cadastros/index.tsx` (rotas que usam `MeuPerfil`), `client/src/lib/auth.tsx` (o g18 está acrescentando `atualizarFoto`), `client/src/ui/index.tsx` (o g18 está acrescentando `Avatar`), `client/src/ui/icones.tsx`, `client/src/modules/biblioteca/CampoCapa.tsx` (exemplo de redução de imagem por canvas) e `client/src/layout/painel.css` (estilo dos cartões de indicador). Abra a referência `.claude/referencias/exemplo.png` para seguir o estilo.

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/modules/cadastros/perfil.tsx` (reescrever; continua exportando `MeuPerfil`)
- `client/src/modules/cadastros/PerfilMedalhas.tsx` (novo)
- `client/src/modules/cadastros/PerfilFoto.tsx` (novo)
- `client/src/modules/cadastros/perfil.css` (novo)

## Regras gerais

- Classes com prefixo `perfil-`. Cores, raios e sombras só por variáveis de `client/src/ui/estilo.css`. Nenhuma cor fixa (salvo `rgba` em sombra).
- A tela serve aos quatro perfis (administrativo, TI, professor e aluno). Para quem não tem medalhas automáticas, o bloco de medalhas mostra só as manuais ou uma frase ("As medalhas automáticas são para alunos e professores.").

## Passos

1. Dados: `GET /perfil/completo` (`useDados`). Enquanto carrega, `<Carregando />`; em erro, `<Aviso tipo="erro">`, mantendo visível a parte de dados e senha (que usa `GET /perfil/meu`, como hoje).
2. **Cabeçalho do perfil** (cartão largo com fundo `var(--gradiente-primario)` na faixa de cima e a foto sobreposta): foto grande (96 px, `Avatar`), nome, papel (ADMIN "Administrador", TI "TI", SECRETARIA "Secretaria", PROFESSOR "Professor", ALUNO "Aluno"), a linha de identificação (aluno: "RA {ra} · {curso}"; professor: "Registro {registro} · {titulação} · {área}"), "No sistema desde {mês e ano}", e o botão "Trocar foto".
3. **`PerfilFoto.tsx`**: popup (`Modal`) para trocar a foto: prévia redonda, "Enviar imagem" (arquivo PNG, JPEG ou WebP; recorte quadrado centralizado e redução para 256 x 256 px num `<canvas>`, exportando JPEG com qualidade 0.85; se passar de 190.000 caracteres, reduza a qualidade), "Ou cole um endereço" (`https://...`), "Remover foto" e "Salvar". Salvar chama `PUT /perfil/foto` e, no sucesso, `atualizarFoto(foto)` do contexto de autenticação (para o avatar do topo mudar na hora) e recarrega o perfil.
4. **Nível e pontos**: cartão com "Nível {nivel}: {titulo}", os pontos, e uma barra de progresso de `pontosDoNivel` até `pontosProximoNivel` ("faltam {n} pontos para o próximo nível"; no último nível, "Nível máximo"). Barra com `var(--gradiente-primario)` sobre `var(--cor-superficie-2)`.
5. **Resumo**: os quatro indicadores de `resumo`, como cartões de indicador (quadrado colorido com ícone, valor e rótulo).
6. **`PerfilMedalhas.tsx`**: bloco "Medalhas" com um contador "{conquistadas} de {total}" e a grade de medalhas (`repeat(auto-fill, minmax(150px, 1fr))`, 2 colunas em 360 px). Cada medalha: um emblema redondo de 64 px com o ícone (fundo suave e ícone na cor da medalha quando conquistada; em cinza, com `opacity` reduzida e um pequeno ícone `cadeado`, quando não conquistada), o título, os pontos ("+20 pts") e, embaixo, a descrição em texto suave; nas não conquistadas com `progresso`, uma barrinha e "{atual} de {meta}"; nas manuais, "Concedida por {nome}" e a data. Clicar numa medalha abre um `Modal` pequeno com o emblema grande e todos os detalhes. Filtro em pílulas: "Todas", "Conquistadas", "A conquistar".
7. **Atividade recente**: lista dos itens de `atividadeRecente` (ícone por tipo, descrição, módulo e tempo relativo); "Sem atividade recente." quando vazia.
8. **Dados e segurança** (o que a tela já tinha): seção "Meus dados" (nome, e-mail, telefone editável, endereço editável se aluno, botão salvar) e seção "Trocar senha" (senha atual, nova senha, confirmar; `POST /auth/trocar-senha`). Mantenha a lógica atual.
9. Organização: `Abas` com "Visão geral" (nível, resumo, medalhas, atividade) e "Dados e segurança"; o cabeçalho fica acima das abas.
10. Rode a verificação.

## Critérios de aceite

- A tela mostra foto, nível, pontos, resumo, medalhas (conquistadas e a conquistar, com progresso) e atividade recente, com dados reais da API.
- Trocar a foto funciona pelas duas formas e atualiza o avatar do topo sem recarregar a página.
- Edição de telefone/endereço e troca de senha continuam funcionando.
- Nenhuma cor fixa em `perfil.css`; nada estoura em 360 px; legível nos dois temas.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de `Avatar`, `atualizarFoto` ou ícone novo ainda não gravado pelo g18, espere a nota dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
