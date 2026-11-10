# Mini-plano g04: cadastros

## Objetivo

Módulo de pessoas: alunos, professores, usuários administrativos e a tela "Meu perfil".

Leia antes: `docs/plano/CONTRATOS.md` (seções 3, 4, 5.2, 6, 7 e 8), `server/prisma/schema.prisma` (modelos `Usuario`, `Aluno`, `Professor`), e os arquivos reais `server/src/lib/*.ts`, `client/src/lib/*.ts(x)` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/cadastros/routes.ts`
- `client/src/modules/cadastros/index.tsx`
- outros arquivos dentro de `client/src/modules/cadastros/` se quiser dividir as telas

## Passos do servidor

1. Implemente todos os endpoints da seção 5.2, com as permissões da tabela (`permitir(...)` em cada rota).
2. Crie uma função `semSenha(usuario)` que remove `senhaHash` e use em toda resposta.
3. Senhas: `bcrypt.hash(senha, 10)`; mínimo de 6 caracteres na validação zod.
4. `POST /alunos` e `POST /professores`: `prisma.$transaction` criando `Usuario` e o registro filho. E-mail repetido devolve 409 `E-mail já cadastrado` (verifique antes de criar).
5. RA: `ano atual` + sequência de 5 dígitos; pegue o maior RA que começa com o ano e some 1 (primeiro: `AAAA00001`). Registro do professor: `P` + 4 dígitos, mesmo método.
6. `?busca=`: `contains` com `mode: 'insensitive'` em nome e e-mail do usuário, e em `ra` (alunos) ou `registro` (professores).
7. `dataNascimento` chega como `"AAAA-MM-DD"`; converta com `new Date(valor)`.
8. `PUT /alunos/:id` e `PUT /professores/:id` atualizam campos do `Usuario` (`nome`, `email`, `cpf`, `telefone`) e do registro filho na mesma transação.
9. `DELETE` só marca `usuario.ativo = false`.
10. `GET /perfil/meu` e `PUT /perfil/meu` usam `req.usuario.id`.

## Passos do cliente

Exporte `rotas` com as linhas do g04 na seção 7:

1. `/admin/alunos` (ADMIN, SECRETARIA, ícone 🎓, ordem 10): campo de busca, tabela (RA, nome, e-mail, telefone, situação com `Selo`), botão "Novo aluno" abrindo `Modal` com o formulário completo (inclusive dados do responsável), clique na linha abre o modal de edição, botão "Desativar" com `window.confirm`.
2. `/admin/professores` (ADMIN, SECRETARIA, ícone 👩‍🏫, ordem 11): mesmo padrão; `Selecao` de titulação (Graduado, Especialista, Mestre, Doutor).
3. `/admin/usuarios` (só ADMIN, ícone 🔑, ordem 12): lista de usuários com filtro por perfil, criar usuário ADMIN ou SECRETARIA, ativar/desativar, redefinir senha.
4. `/aluno/perfil` e `/professor/perfil` (ícone 👤, ordem 90, rótulo "Meu perfil"): um mesmo componente que mostra os dados de `GET /perfil/meu`, permite editar telefone (e endereço, se aluno) e trocar a senha com `POST /auth/trocar-senha`.

## Critérios de aceite

- Todos os endpoints da seção 5.2 existem, com método, caminho, permissão e formato de resposta do contrato.
- Nenhuma resposta contém `senhaHash`.
- `npx tsc --noEmit` em `server` e em `client` sem erro nos seus arquivos.
- Telas usam só componentes de `client/src/ui` e funcionam em 360 px.

## Verificação

Seção 8 do contrato.
