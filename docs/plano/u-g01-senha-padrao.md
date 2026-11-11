# Mini-plano g01: senha padrão do administrador

## Objetivo

O usuário pediu uma senha padrão para a conta de administrador. Hoje o instalador e o seed geram uma senha aleatória. A partir de agora, toda instalação nova começa com:

- E-mail: `admin@escola.local`
- Senha: `admin1234`

O sistema continua pedindo, na documentação e nas mensagens, que a senha seja trocada em "Meu perfil" depois do primeiro acesso. Quem quiser outra senha inicial continua podendo definir `ADMIN_SENHA` no `.env` antes da primeira subida (8 caracteres ou mais).

## Arquivos que você pode editar (e só estes)

- `server/prisma/seed.ts`
- `instalar.ps1`, `instalar.sh`
- `.env.example`, `docker-compose.yml`
- `README.md`, `INSTALAR.md`, `AGENTS.md`, `SECURITY.md`, `CHANGELOG.md`

## Passos

1. `server/prisma/seed.ts`: crie a constante `SENHA_PADRAO = 'admin1234'`. Quando `ADMIN_SENHA` estiver vazia ou tiver menos de 8 caracteres, use `SENHA_PADRAO` no lugar de gerar uma senha. Remova `gerarSenha`, `ALFABETO_SENHA`, `TAMANHO_SENHA` e o import de `randomBytes`. No bloco de mensagens, quando a senha usada for a padrão, imprima `Senha padrão: admin1234`; quando vier do `.env`, não imprima a senha. Mantenha a linha "Troque a senha em "Meu perfil" depois do primeiro acesso." e o resto do arquivo (idempotência, demonstração) como está. Atualize o comentário do topo.
2. `docker-compose.yml`: `ADMIN_SENHA: ${ADMIN_SENHA:-admin1234}`.
3. `.env.example`: `ADMIN_SENHA=admin1234`, com o comentário "Senha inicial do administrador (padrão: admin1234); troque em Meu perfil depois do primeiro acesso". Ajuste a linha 3 do arquivo: o que precisa ser trocado ao copiar na mão são `POSTGRES_PASSWORD` e `JWT_SECRET`.
4. `instalar.ps1` e `instalar.sh`: ao criar o `.env`, grave `ADMIN_SENHA=admin1234` (a senha do banco e o `JWT_SECRET` continuam aleatórios). No resumo final:
   - `.env` criado agora: `Senha:          admin1234 (padrao; troque em "Meu perfil")`;
   - `.env` já existia com `ADMIN_SENHA` igual a `admin1234` ou vazia: a mesma linha;
   - `.env` já existia com outra senha: `Senha:          a senha esta no arquivo .env, variavel ADMIN_SENHA` (como hoje).
   Remova o ramo "gerada pelo servidor na primeira subida". Não mude os códigos de saída nem o resto do fluxo. Mensagens dos scripts continuam sem acentos, como já estão.
5. Documentação, sempre dizendo o e-mail e a senha padrão e pedindo a troca no primeiro acesso:
   - `README.md`: a seção de primeiro acesso (perto da linha 154), a tabela de variáveis (`ADMIN_SENHA`, padrão `admin1234`), a parte de desenvolvimento (`npm run seed`) e o texto sugerido para pedir a instalação a uma IA (trocar "onde está a senha do administrador" por "o e-mail e a senha do administrador").
   - `INSTALAR.md`: os mesmos pontos, e a pergunta "Esqueci a senha do administrador" (se não trocou, é `admin1234`).
   - `AGENTS.md`: o assistente informa o e-mail e a senha padrão e avisa para trocar; remova a instrução de não escrever a senha na resposta.
   - `SECURITY.md`: senha do banco e segredo do JWT continuam aleatórios; a conta de administrador nasce com senha padrão conhecida e **precisa ser trocada no primeiro acesso**, principalmente se o site ficar acessível na rede; o login tem limite de tentativas.
   - `CHANGELOG.md`: uma linha em 1.0.0 (Alterado ou equivalente).
6. Rode a verificação.

## Critérios de aceite

- Nenhuma menção restante a senha aleatória do administrador ou a "senha gerada" (procure por `gerad`, `aleat`, `logs api` nos arquivos acima).
- `ADMIN_SENHA` definida no `.env` com 8 caracteres ou mais continua valendo.
- Dados de demonstração (`SEED_DEMO=true`) não mudam.
- `cd server && npx tsc --noEmit`: zero erro. `bash -n instalar.sh`: sem erro de sintaxe.

Não suba Docker nem banco.
