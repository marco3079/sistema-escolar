# Mini-plano g16: API do suporte (chamados)

## Objetivo

O usuário pediu um suporte por tickets: a pessoa vê os chamados que criou e em que ponto estão, responde e recebe resposta da equipe de suporte responsável ou do professor responsável; e a pessoa responsável tem uma área para ver e responder. Pelo popup: atendimento por categoria, todos os usuários podem abrir, com anexo de imagem, prioridade, aviso de resposta nova e avaliação ao encerrar. Você faz o servidor.

Leia antes: `docs/plano/terceira-leva.md` (seções "Decisões do main", "Validação de imagem", `UsuarioResumo` e "Suporte": é o seu contrato, com endpoints, formatos e regras de status), `server/prisma/schema.prisma` (modelos `Chamado`, `ChamadoMensagem` e os três enums de chamado; também `Turma`, `Inscricao`, `Usuario`), os arquivos reais de `server/src/lib/` (`auth.ts` tem `perfil` efetivo e `perfilReal`) e, como exemplo de módulo, `server/src/modules/comunicados/routes.ts`.

## Arquivo que você pode criar (e só este)

- `server/src/modules/suporte/routes.ts`

## Passos

1. Funções auxiliares no arquivo:
   - `validarAnexo(valor)`: regra "Validação de imagem" do contrato, só data URL (sem endereço); `null` quando vazio.
   - `usuarioResumo(u)`: `{ id, nome, perfil, foto }`.
   - `async function equipeDoChamado(req, chamado)`: devolve `true` se o usuário logado atende a categoria do chamado e não é o autor: `TECNICO` = perfil efetivo `ADMIN`; `SECRETARIA` e `FINANCEIRO` = `ADMIN` ou `SECRETARIA`; `ACADEMICO` = `ADMIN`, ou `PROFESSOR` cujo `professorId` é o da turma do chamado.
   - `filtroAtendimento(req)`: o `where` do Prisma com os chamados que o usuário pode atender (ADMIN: todos; SECRETARIA: categorias `SECRETARIA` e `FINANCEIRO`; PROFESSOR: `ACADEMICO` com `turmaId` em turmas dele; ALUNO: nenhum), sempre excluindo os de autoria própria.
   - `paraDTO(chamado, req)`: monta `ChamadoDTO` (com `naoLido`, `souEquipe`, `previa` de até 120 caracteres e `totalMensagens`).
2. Implemente os onze endpoints do contrato. Declare as rotas fixas (`/chamados/meus`, `/chamados/novidades`, `/chamados/atendimento`, `/chamados/turmas`) antes de `/chamados/:id`.
3. `naoLido`: para o autor, `ultimaMensagemEquipe === true` e (`lidoPeloAutorEm` nulo ou anterior a `ultimaMensagemEm`); para a equipe, `ultimaMensagemEquipe === false` e (`lidoPelaEquipeEm` nulo ou anterior a `ultimaMensagemEm`) e status diferente de `FECHADO`.
4. `GET /chamados/:id`: 404 se não existe; 403 se o usuário não é o autor nem equipe; depois de montar a resposta, grave `lidoPeloAutorEm` ou `lidoPelaEquipeEm` com a data atual.
5. `POST /chamados`: cria o chamado e a primeira mensagem na mesma transação; `ACADEMICO` exige `turmaId` de uma turma existente (400); para ALUNO, a turma tem de ser uma em que ele tem inscrição (403).
6. `POST /chamados/:id/mensagens`: aplique as regras de status do contrato na mesma transação; mensagem da equipe marca `daEquipe: true`.
7. `PUT /chamados/:id` (equipe): `status` só pode ir para `EM_ATENDIMENTO`, `AGUARDANDO_USUARIO` ou `RESOLVIDO`; `responsavelId` tem de ser alguém que atende a categoria (400).
8. `encerrar` e `reabrir`: só o autor (403 para os demais); `avaliacao` inteira de 1 a 5; `comentario` até 500 caracteres.
9. `GET /chamados/novidades`: duas contagens, sem carregar as mensagens.
10. Rode a verificação.

## Critérios de aceite

- Formatos e regras idênticos ao contrato.
- Ninguém lê nem responde chamado que não é dele nem da categoria que atende (403); aluno nunca aparece como equipe.
- Anexo fora do formato ou do tamanho devolve 400.
- `cd server && npx tsc --noEmit`: zero erro no SEU arquivo.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker, e não mexa nos contêineres do sistema.
