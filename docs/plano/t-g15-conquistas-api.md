# Mini-plano g15: API do perfil completo, medalhas, nível e foto

## Objetivo

O usuário pediu que o "Meu perfil" mostre "o perfil, medalhas e tudo mais": foto, resumo de desempenho, nível e pontos, atividade recente e medalhas (automáticas, por regras, e manuais, concedidas por professor ou administrador). Você faz o servidor.

Leia antes: `docs/plano/terceira-leva.md` (seções "Decisões do main", "Contrato de API" até o fim de "Perfil e medalhas": é o seu contrato, com endpoints, formatos e a lista exata de medalhas), `server/prisma/schema.prisma` inteiro (inclusive `Usuario.foto`, `MedalhaConcedida`, `LogAtividade` e os modelos do fórum), os arquivos reais de `server/src/lib/` (`auth.ts` agora tem `perfilReal`) e, como exemplos, `server/src/modules/painel/routes.ts` (indicadores por perfil) e `server/src/modules/fichas/routes.ts`.

## Arquivos que você pode criar (e só estes)

- `server/src/modules/conquistas/routes.ts`
- `server/src/modules/conquistas/medalhas.ts` (catálogo e cálculo das medalhas automáticas)
- `server/src/modules/conquistas/imagem.ts` (validação de imagem)

Não edite outros módulos. Os caminhos `/perfil/completo` e `/perfil/foto` não colidem com `/perfil/meu`, que continua no módulo `cadastros`.

## Passos

1. `imagem.ts`: `export function validarImagem(valor: unknown, opcoes: { aceitaEndereco: boolean }): string | null` conforme a regra "Validação de imagem" do contrato (lança `HttpError(400, 'Imagem inválida')`; string vazia ou `null` devolve `null`).
2. `medalhas.ts`:
   - o catálogo como constante (código, título, descrição de uma frase, ícone, cor, pontos, perfil a que se aplica), exatamente com os itens do contrato;
   - `export async function calcularMedalhas(usuario: { id: number; perfil: Perfil; alunoId: number | null; professorId: number | null }): Promise<MedalhaDTO[]>`: carrega de uma vez (poucas consultas, nenhuma em laço) os dados necessários e devolve cada medalha automática do perfil com `conquistada`, `progresso` (quando o contrato define) e `conquistadaEm: null` (as automáticas não têm data), seguidas das manuais do banco (`manual: true`, `id`, `concedidaPor` = nome de quem concedeu, `conquistadaEm` = `criadoEm`, `codigo` = `'manual-' + id`);
   - `export function calcularNivel(pontos: number)`: faixas do contrato (0 Iniciante, 50 Dedicado, 120 Destaque, 220 Exemplar, 350 Lendário), devolvendo `pontos`, `nivel` (1 a 5), `titulo`, `pontosDoNivel` (início da faixa atual) e `pontosProximoNivel` (ou `null` no último nível).
3. `routes.ts`: os seis endpoints do contrato.
   - `GET /perfil/completo`: use `req.usuario.id`; o perfil devolvido em `usuario.perfil` é o verdadeiro (do banco); `resumo` com os mesmos quatro indicadores que `GET /painel/resumo` devolve para o perfil (copie a lógica; não importe de outro módulo); `atividadeRecente`: 10 últimos `LogAtividade` do usuário com `tipo` diferente de `CONSULTA`; ordene `medalhas` com as conquistadas primeiro.
   - `GET /usuarios/:id/perfil-publico`: só nome, perfil, foto, curso ou titulação, nível e medalhas conquistadas. Nunca e-mail, CPF, telefone, endereço nem dados do responsável. 404 se o usuário não existir ou estiver inativo.
   - `PUT /perfil/foto`: valida com `validarImagem(..., { aceitaEndereco: true })` e grava em `Usuario.foto`.
   - `POST /medalhas`: regras do contrato (PROFESSOR só para aluno com inscrição em turma dele; destinatário ALUNO ou PROFESSOR; `titulo` de 3 a 60; `descricao` até 200; `icone` entre os nomes `medalha`, `estrela`, `boletim`, `biblioteca`, `grafico`, `pos`, `alunos`; `cor` azul, roxo, verde ou laranja; `pontos` de 5 a 50, padrão 20); `concedidaPorId = req.usuario.id`.
   - `DELETE /medalhas/:id`: ADMIN ou quem concedeu.
4. Rode a verificação.

## Critérios de aceite

- Formatos idênticos ao contrato; nenhuma resposta com `senhaHash`, e o perfil público sem dado pessoal.
- Nenhuma consulta dentro de laço; o cálculo das medalhas de um usuário usa poucas consultas.
- `cd server && npx tsc --noEmit`: zero erro nos SEUS arquivos.

## Verificação

```
cd server
npx tsc --noEmit
```

Não rode `npm install`, não suba banco nem Docker, e não mexa nos contêineres do sistema.
