# Mini-plano g17: API do fórum

## Objetivo

O usuário pediu "um fórum para os alunos e professores poderem publicar e responder as publicações", com a estrutura de um fórum com votos: comunidades, publicações com voto para cima e para baixo, comentários em árvore e ordenação por "Em alta", "Novas" e "Mais votadas". Você faz o servidor.

Leia antes: `docs/plano/terceira-leva.md` (seções "Decisões do main", "Validação de imagem", `UsuarioResumo` e "Fórum": é o seu contrato, com endpoints, formatos e regras), `server/prisma/schema.prisma` (modelos `ForumComunidade`, `ForumPublicacao`, `ForumComentario`, `ForumVoto`), os arquivos reais de `server/src/lib/` (`auth.ts` tem `perfil` efetivo e `perfilReal`) e, como exemplo de módulo, `server/src/modules/comunicados/routes.ts`.

## Arquivo que você pode criar (e só este)

- `server/src/modules/forum/routes.ts`

## Passos

1. Funções auxiliares no arquivo:
   - `gerarSlug(nome)`: minúsculas, sem acentos (`normalize('NFD')` e remoção dos diacríticos), tudo que não for letra ou número vira hífen, sem hífen repetido nem nas pontas, até 40 caracteres; 400 se ficar vazio.
   - `validarImagem(valor)`: regra "Validação de imagem" do contrato, só data URL; `null` quando vazio.
   - `ehModerador(req)`: perfil efetivo `ADMIN` ou `SECRETARIA`.
   - `usuarioResumo(u)`: `{ id, nome, perfil, foto }`.
   - `paraPublicacaoDTO(p, req, meuVoto)` e `paraComentarioDTO(c, req, meuVoto)`, com os campos `posso`. Comentário removido devolve `corpo: '[comentário removido]'` e `autor` com nome "Removido" e sem foto.
2. Implemente os doze endpoints do contrato.
3. `GET /forum/comunidades`: com a contagem de publicações não removidas.
4. `GET /forum/publicacoes`: filtros `comunidade` (slug; 404 se não existir), `busca` (título ou corpo, sem diferenciar maiúsculas), `autorId`; `ordem` padrão `alta`. Para `novas` e `votadas`, ordene no banco e pagine com `antesDe` e `limite + 1`. Para `alta`, carregue as 200 mais recentes do filtro, calcule a pontuação do contrato em memória, ordene e corte em `limite` (para `alta`, `haMais` é sempre `false`). Com `comunidade` informada, as fixadas vêm primeiro. Carregue os votos do usuário para as publicações devolvidas numa única consulta.
5. `GET /forum/publicacoes/:id`: 404 se removida; `comentariosLista` com todos os comentários da publicação por `criadoEm` crescente, e os votos do usuário numa única consulta.
6. Votos (`POST .../voto`): numa transação, crie, atualize ou apague o voto do usuário e recalcule `pontos` com um `aggregate` da soma dos votos; devolva `{ pontos, meuVoto }`. `valor` só pode ser 1, -1 ou 0 (400).
7. Comentários: `paiId`, quando informado, tem de ser de um comentário da mesma publicação (400); 409 se a publicação estiver fechada ou removida; atualize o contador `comentarios` da publicação na mesma transação ao criar e ao remover.
8. `PUT /forum/publicacoes/:id`: o autor altera `titulo`, `corpo` e `imagem` (grava `editadoEm`); o moderador altera `fixada` e `fechada`; campos que a pessoa não pode alterar devolvem 403.
9. `DELETE`: marca `removida` (publicação) ou `removido` (comentário); autor ou moderador; 403 para os demais.
10. Rode a verificação.

## Critérios de aceite

- Formatos e regras idênticos ao contrato; `UsuarioResumo` sem e-mail, CPF nem telefone.
- Um usuário tem no máximo um voto por publicação e por comentário; `pontos` sempre igual à soma dos votos.
- Nenhuma consulta dentro de laço nas listagens.
- `cd server && npx tsc --noEmit`: zero erro no SEU arquivo.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker, e não mexa nos contêineres do sistema.
