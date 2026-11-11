# Mini-plano g14: tela de Usuários com menu de ações e ficha

## Objetivo

O usuário pediu que a tela de Usuários (`/admin/usuarios`) tenha "a mesma coisa" que Alunos e Professores: um menu de ações (três pontos) no fim de cada linha e, ao clicar na pessoa, um popup com a ficha dela, como um mini painel. Além disso, o sistema ganhou o perfil TI, que precisa aparecer no filtro e na criação de usuários.

Leia antes: `client/src/modules/cadastros/usuarios.tsx` (tela atual), `alunos.tsx` e `FichaAluno.tsx` (o padrão a seguir), `FichaComum.tsx` (peças prontas: `FichaModal`, `FichaCabecalho`, `FichaIndicador`, `FichaSecao`, `FichaLinha`, `FichaItem`, `SeloStatus`), `fichas.css`, `tipos.ts`; `docs/plano/segunda-leva.md` (endpoints `GET /logs?usuarioId=` e `GET /logs/usuarios/:id/resumo`, formatos `LogDTO` e `ResumoUsuarioLogDTO`); `client/src/ui/index.tsx` (o g18 está acrescentando `Avatar`, a exportação de `MenuAcoes` e as props `acoes` e `alinhar` de `ColunaTabela`); `client/src/ui/estilo.css` (classes `barra-ferramentas`, `filtros`, `resumo`).

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/modules/cadastros/usuarios.tsx`
- `client/src/modules/cadastros/FichaUsuario.tsx` (novo)
- `client/src/modules/cadastros/tipos.ts` (acrescentar tipos)
- `client/src/modules/cadastros/fichas.css` (só acrescentar no fim, se precisar)

A API não muda. A tela continua só para o perfil efetivo ADMIN (administrador e TI).

## Passos

1. **Perfil TI na tela**: o filtro de perfil passa a ter "Todos", "Administrador", "TI", "Secretaria", "Professor" e "Aluno"; o formulário de novo usuário permite criar "Administrador", "TI" ou "Secretaria" (professores e alunos continuam sendo criados nas telas deles; diga isso numa frase de ajuda no formulário); os rótulos de perfil em toda a tela ficam em português (TI "TI").
2. **Barra de ferramentas**: filtro de perfil e busca lado a lado (`barra-ferramentas` com `filtros`), e o botão "Novo usuário" à direita.
3. **Fileira de resumo** (`resumo`): total de usuários, ativos, inativos e administradores (ADMIN + TI), calculados sobre a lista carregada.
4. **Tabela**: Usuário (com `Avatar` e, embaixo do nome, o e-mail em texto suave), Perfil (`Selo`: Administrador azul, TI roxo, Secretaria verde, Professor laranja, Aluno cinza), Telefone, Cadastro (data), Situação (`Selo`) e a coluna de ações (`acoes: true`) com `MenuAcoes`: "Ver ficha", "Editar", "Redefinir senha", e "Desativar" (`perigo`) ou "Reativar". Clicar na linha abre a ficha. Não permita desativar o próprio usuário logado (a ação não aparece na própria linha).
5. **`FichaUsuario.tsx`**: `FichaUsuario({ usuario, aoFechar, aoEditar })`, no mesmo padrão visual das outras fichas (`FichaModal`):
   - cabeçalho: avatar, nome, perfil em `Selo`, e-mail, situação, e os botões "Editar" e "Fechar";
   - indicadores (de `GET /logs/usuarios/{id}/resumo`): "Atividades hoje", "Atividades em 7 dias", "Último acesso" (data e hora de `ultimoLogin`, ou "Nunca") e "Agora" ("Online: {telaAtual}" em verde, ou "Offline");
   - coluna esquerda: "Dados" (e-mail, telefone, CPF se houver, cadastrado em, perfil); "Atividade por tipo" (lista de `porTipo` com barra proporcional e total);
   - coluna direita: "Últimas atividades" (`GET /logs?usuarioId={id}&limite=20`): hora, tipo em `Selo`, descrição e módulo; "Sem atividade registrada." quando vazia; link "Ver no log do sistema" para `/admin/logs`;
   - se o usuário for aluno ou professor, um aviso com o atalho para a tela dele ("Este usuário é um aluno: a ficha acadêmica fica em Alunos." com link para `/admin/alunos`, e o equivalente para professores).
6. Rótulos e cores dos tipos de log: LOGIN "Entrada" (verde), FALHA_LOGIN "Falha de login" (vermelho), SAIDA "Saída" (cinza), TELA "Tela" (azul), CONSULTA "Consulta" (cinza), CRIACAO "Criação" (verde), ALTERACAO "Alteração" (amarelo), EXCLUSAO "Exclusão" (vermelho).
7. Rode a verificação.

## Critérios de aceite

- Clicar numa linha abre a ficha; o menu de três pontos não abre a ficha e fica encostado à direita.
- TI aparece no filtro, na criação e nos rótulos.
- Editar, redefinir senha, desativar e reativar continuam funcionando e recarregam a lista.
- Nenhuma cor fixa nova; nada estoura em 360 px.
- `cd client && npx tsc --noEmit`: zero erro nos SEUS arquivos (se o erro for de `MenuAcoes`, `Avatar` ou `acoes` ainda não gravados pelo g18, espere a nota dele na sala e rode de novo).

## Verificação

```
cd client
npx tsc --noEmit
```

Não rode `npm install` nem `vite build`, não suba Docker.
