# Sistema escolar

Sistema de gestão escolar que cobre do ensino fundamental ao doutorado. Ele reúne cadastros, matrícula, vida acadêmica, notas e frequência, pós-graduação, financeiro, horários, biblioteca e comunicados em um único app web.

## Níveis de ensino cobertos

- Ensino fundamental I e II
- Ensino médio
- Ensino técnico
- Graduação
- Especialização
- Mestrado
- Doutorado

As regras de aprovação seguem o nível: frequência mínima de 75% e média mínima 6 para os níveis básicos, técnico e graduação; média mínima 7 para especialização, mestrado e doutorado.

## Portais

Um único app web com três portais, escolhidos pelo perfil do usuário no login:

- **Administrativo** (perfis ADMIN e SECRETARIA, em `/admin`): alunos, professores, usuários (só ADMIN), cursos, períodos letivos, turmas, matrículas, boletins, pós-graduação, financeiro, biblioteca, horários, calendário e comunicados.
- **Professor** (perfil PROFESSOR, em `/professor`): minhas turmas, diário de classe (notas, frequência e aulas), orientações, biblioteca, horário, calendário, comunicados e meu perfil.
- **Aluno** (perfil ALUNO, em `/aluno`): matrícula e inscrição em disciplinas, boletim, histórico, pesquisa (pós-graduação), financeiro (mensalidades), biblioteca, horário, calendário, comunicados e meu perfil.

## Como rodar com Docker

Requisitos: Docker com Docker Compose.

```bash
docker compose up --build
```

Depois de subir:

- Aplicativo web: abra `http://localhost:8090`
- API (teste de saúde): `http://localhost:3090/api/saude`

As portas podem ser trocadas com as variáveis `WEB_PORT` e `API_PORT` (veja `.env.example`).

O banco PostgreSQL roda no contêiner `db` e só fica acessível pelo próprio computador (`127.0.0.1:5432`). Os valores padrão de senha e segredo JWT são de exemplo (veja `.env.example`) e devem ser trocados em produção.

## Como usar no celular

1. Conecte o celular na mesma rede Wi-Fi do computador onde o sistema está rodando.
2. No navegador do celular, abra `http://<IP-do-computador>:8090` (por exemplo, `http://192.168.0.10:8090`).
3. Use a opção "Adicionar à tela inicial" do navegador para instalar o app como PWA.

## Usuários de demonstração

Todos os usuários abaixo usam a senha **`demo1234`**.

Os dados são **fictícios** e existem só para demonstração. Não use estes usuários nem estes dados em uma escola real.

| Perfil | E-mail |
|---|---|
| Administrador | `admin@escola.demo` |
| Secretaria | `secretaria@escola.demo` |
| Professor | `prof.ana@escola.demo` |
| Aluno (fundamental) | `aluno.lucas@escola.demo` |
| Aluno (graduação) | `aluna.marina@escola.demo` |
| Aluno (doutorado) | `aluno.rafael@escola.demo` |

## Desenvolvimento sem Docker

Para desenvolver sem contêineres de aplicação, suba só o banco pelo Compose e rode a API e o app com o Node.js 20:

```bash
# 1) banco (PostgreSQL publicado só em 127.0.0.1:5432)
docker compose up -d db

# 2) API
cd server
cp .env.example .env
npm install
npm run db:push
npm run seed
npm run dev

# 3) aplicativo web
cd ../client
npm install
npm run dev
```

Com o app em modo de desenvolvimento, abra `http://localhost:5173`.

## Estrutura de pastas

```
sistema_escolar/
  docker-compose.yml
  server/    API (Node 20, TypeScript, Express, Prisma)
  client/    Aplicativo web (React, TypeScript, Vite)
```

Dentro de `server/`: `prisma/` (esquema do banco e dados de demonstração), `src/server.ts`, `src/app.ts`, `src/lib/` (código compartilhado) e `src/modules/<modulo>/routes.ts` (um arquivo de rotas por módulo).

Dentro de `client/`: `src/main.tsx`, `src/App.tsx`, `src/lib/` (código compartilhado), `src/ui/` (componentes visuais) e `src/modules/<modulo>/index.tsx` (telas de cada módulo).

## Tecnologias

- **API**: Node.js 20, TypeScript, Express 4, Prisma 5, zod, JWT, bcryptjs
- **Aplicativo**: React 18, TypeScript, Vite 5, react-router-dom 6
- **Banco de dados**: PostgreSQL 16
- **Implantação**: Docker Compose, nginx (serve o app e encaminha `/api` para a API)

## Licença

Este projeto é distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
