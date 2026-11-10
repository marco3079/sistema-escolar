# Mini-plano g03: infraestrutura (Docker e repositório)

## Objetivo

Deixar o sistema subindo inteiro com `docker compose up --build` e preparar os arquivos de raiz do repositório público.

Leia antes: `docs/plano/CONTRATOS.md` (seções 1 e 2) e `docs/plano/PLANO.md`.

## Arquivos que você pode criar (e só estes)

- `docker-compose.yml`
- `server/Dockerfile`, `server/.dockerignore`
- `client/Dockerfile`, `client/.dockerignore`, `client/nginx.conf`
- `.gitignore`, `.env.example`, `LICENSE`, `README.md`

Não crie nem edite nada dentro de `server/src`, `server/prisma`, `client/src` ou `docs/plano`.

## Passos

1. `docker-compose.yml` com três serviços:
   - `db`: imagem `postgres:16-alpine`; variáveis `POSTGRES_USER=escola`, `POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-escola}`, `POSTGRES_DB=escola`; volume nomeado `dados_db:/var/lib/postgresql/data`; `healthcheck` com `pg_isready -U escola -d escola` (intervalo 5s, 10 tentativas). Sem porta publicada.
   - `api`: `build: ./server`; `depends_on: db: condition: service_healthy`; variáveis `DATABASE_URL=postgresql://escola:${POSTGRES_PASSWORD:-escola}@db:5432/escola?schema=public`, `JWT_SECRET=${JWT_SECRET:-troque-este-segredo-de-exemplo}`, `PORT=3000`; porta `3000:3000`; `restart: unless-stopped`.
   - `web`: `build: ./client`; `depends_on: [api]`; porta `8080:80`; `restart: unless-stopped`.
2. `server/Dockerfile`:
   ```dockerfile
   FROM node:20-slim
   RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
   WORKDIR /app
   COPY package.json package-lock.json* ./
   COPY prisma ./prisma
   RUN npm install
   COPY . .
   EXPOSE 3000
   CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npx tsx src/server.ts"]
   ```
   (`prisma` é copiado antes do `npm install` porque o `postinstall` roda `prisma generate`.)
3. `server/.dockerignore`: `node_modules`, `.env`, `dist`.
4. `client/Dockerfile` em dois estágios: `node:20-slim` roda `npm install` e `npm run build`; `nginx:1.27-alpine` copia `dist` para `/usr/share/nginx/html` e `nginx.conf` para `/etc/nginx/conf.d/default.conf`.
5. `client/nginx.conf`: escuta na 80; `location /api/ { proxy_pass http://api:3000; }` com cabeçalhos `Host` e `X-Real-IP`; `location / { try_files $uri /index.html; }`; `sw.js` e `manifest.webmanifest` com `Cache-Control: no-cache`.
6. `client/.dockerignore`: `node_modules`, `dist`.
7. `.gitignore` de raiz: `node_modules/`, `dist/`, `.env`, `.env.local`, `*.log`, `.DS_Store`, `.claude/`, `.vscode/`.
8. `.env.example` de raiz com `POSTGRES_PASSWORD=escola` e `JWT_SECRET=troque-este-segredo-de-exemplo`, e um comentário dizendo que são valores de exemplo para desenvolvimento e devem ser trocados em produção.
9. `LICENSE`: texto padrão da licença MIT, ano 2026, titular `marco3079`.
10. `README.md` em português:
    - o que é o sistema e os níveis de ensino cobertos (fundamental I e II, médio, técnico, graduação, especialização, mestrado, doutorado);
    - os três portais (administrativo, professor, aluno) e os módulos de cada um;
    - como rodar: `docker compose up --build`, abrir `http://localhost:8080`; API em `http://localhost:3000/api/saude`;
    - como usar no celular: abrir `http://<IP-do-computador>:8080` na mesma rede e "Adicionar à tela inicial";
    - tabela de usuários de demonstração, **todos com a senha `demo1234`**, com o aviso de que são dados fictícios e só para demonstração:
      | Perfil | E-mail |
      |---|---|
      | Administrador | `admin@escola.demo` |
      | Secretaria | `secretaria@escola.demo` |
      | Professor | `prof.ana@escola.demo` |
      | Aluno (fundamental) | `aluno.lucas@escola.demo` |
      | Aluno (graduação) | `aluna.marina@escola.demo` |
      | Aluno (doutorado) | `aluno.rafael@escola.demo` |
    - desenvolvimento sem Docker (banco pelo compose, `npm run dev` em `server` e `client`);
    - estrutura de pastas e tecnologias;
    - licença MIT.

## Critérios de aceite

- `docker compose config` termina sem erro.
- Nenhum segredo real nos arquivos: só os valores de exemplo acima.
- O README não promete nada que os módulos da seção 5 do contrato não tenham.

## Verificação

```
docker compose config
```

Não rode `docker compose up` nem `build`: `server/src`, `client/src` e o seed ainda estão sendo escritos por outros geradores.
