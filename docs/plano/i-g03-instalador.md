# Mini-plano g03: instalador, guia para IA e README

## Objetivo

Qualquer pessoa consegue instalar o sistema com um comando, ou pedindo a um assistente de IA que instale para ela. O README vira a vitrine do repositório: profissional, com prints e instruções claras.

Leia antes: `docs/plano/instalacao.md` (contrato: variáveis de ambiente, comportamento do seed, nomes dos prints), o `README.md` atual, `docker-compose.yml`, `.env.example`, `server/Dockerfile` e `client/Dockerfile`.

## Arquivos que você pode criar ou editar (e só estes)

- `docker-compose.yml`
- `.env.example`
- `instalar.ps1` (novo)
- `instalar.sh` (novo)
- `AGENTS.md` (novo)
- `INSTALAR.md` (novo)
- `README.md` (reescrito)

Não crie `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `.github/`, `.editorconfig`, `.gitattributes` nem nada em `docs/` (são do g04). Não toque em `server/` nem em `client/`.

## Passos

### 1. `docker-compose.yml`

- Serviço `api`, em `environment`, acrescente:
  ```yaml
  ADMIN_NOME: ${ADMIN_NOME:-Administrador}
  ADMIN_EMAIL: ${ADMIN_EMAIL:-admin@escola.local}
  ADMIN_SENHA: ${ADMIN_SENHA:-}
  SEED_DEMO: ${SEED_DEMO:-false}
  ```
- Serviço `db`: a porta passa a ser `"127.0.0.1:${DB_PORT:-5432}:5432"`.
- Serviço `api`: acrescente um `healthcheck` que usa o Node (a imagem não tem curl):
  ```yaml
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
    interval: 10s
    timeout: 5s
    retries: 12
    start_period: 30s
  ```
- Serviço `web`: `depends_on: api: condition: service_healthy`.
- Nada mais muda.

### 2. `.env.example`

Todas as variáveis da tabela do contrato, na mesma ordem, cada uma com um comentário de uma linha em português, com os valores padrão (`ADMIN_SENHA=` vazio, `SEED_DEMO=false`, `DB_PORT=5432`). No topo, um aviso: os valores são exemplos; o instalador cria o `.env` com segredos aleatórios.

### 3. `instalar.ps1` (Windows, PowerShell 5.1 ou mais novo)

Regras de escrita: só ASCII no arquivo (sem acentos nas mensagens, para não depender de codificação); sem `&&`, `||`, operador ternário nem `??`; `$ErrorActionPreference = 'Stop'`.

Parâmetros: `-Demo` (carrega dados de demonstração), `-PortaWeb <int>` (padrão 8090), `-PortaApi <int>` (padrão 3090), `-SemPerguntas` (não pede confirmação para nada).

Passos do script, cada um com uma mensagem `[n/6] ...`:
1. Vai para a pasta do script (`Set-Location $PSScriptRoot`).
2. Docker: se `docker --version` falhar, explica que o Docker Desktop é necessário e, se `winget` existir, pergunta se pode instalar (com `-SemPerguntas` instala direto) usando `winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements`; depois avisa que é preciso abrir o Docker Desktop, esperar ele iniciar e rodar o script de novo, e sai com código 2. Sem `winget`, mostra o endereço https://www.docker.com/products/docker-desktop/ e sai com código 2.
3. Docker rodando: se `docker info` falhar, avisa para abrir o Docker Desktop e esperar, e sai com código 3. Confere `docker compose version` (código 3 se faltar).
4. Portas: para a porta do site e a da API, testa se já há algo escutando (`Get-NetTCPConnection -State Listen -LocalPort <p> -ErrorAction SilentlyContinue`). Se estiver ocupada, procura a próxima livre somando 1 (até 20 tentativas) e avisa qual escolheu.
5. `.env`: se **não** existir, cria com `POSTGRES_PASSWORD` (24 caracteres), `JWT_SECRET` (48 caracteres) e `ADMIN_SENHA` (16 caracteres) aleatórios (letras e números, gerados com `System.Security.Cryptography.RandomNumberGenerator`), `ADMIN_NOME=Administrador`, `ADMIN_EMAIL=admin@escola.local`, `SEED_DEMO` (`true` com `-Demo`, senão `false`), `WEB_PORT`, `API_PORT` e `DB_PORT=5432`. Grava em UTF-8 sem BOM (`[System.IO.File]::WriteAllText`). Se o `.env` **já existir**, não sobrescreve: lê dele `WEB_PORT`, `API_PORT` e `ADMIN_EMAIL` e avisa "Usando o .env existente".
6. Sobe: `docker compose up -d --build`; se o código de saída não for 0, mostra as últimas 40 linhas de `docker compose logs` e sai com código 4. Espera a API responder em `http://localhost:<API_PORT>/api/saude` (até 180 segundos, tentando a cada 3 com `Invoke-WebRequest -UseBasicParsing`); se não responder, mostra os logs da API e sai com código 5.

Final: imprime um quadro com o endereço do site (`http://localhost:<WEB_PORT>`), o e-mail do administrador e a senha (a senha só é impressa se o `.env` foi criado nesta execução; se já existia, diz "a senha esta no arquivo .env, variavel ADMIN_SENHA"), o aviso para trocar a senha em "Meu perfil", como usar no celular (mesma rede, `http://<IP do computador>:<WEB_PORT>`) e os comandos para parar (`docker compose down`) e para apagar tudo (`docker compose down -v`).

### 4. `instalar.sh` (Linux e macOS, bash)

Mesmo comportamento e mesmas mensagens, com `set -euo pipefail`, opções `--demo`, `--porta-web N`, `--porta-api N`, `--sem-perguntas`.
- Docker ausente: no macOS, se houver `brew`, oferece `brew install --cask docker` e pede para abrir o Docker e rodar de novo; no Linux, mostra o comando oficial `curl -fsSL https://get.docker.com | sh` e pergunta se pode executar (com `--sem-perguntas` executa); em qualquer caso, sem instalar, sai com código 2 e o endereço da documentação.
- Segredos aleatórios com `LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c N`.
- Porta ocupada: testa com `(echo >/dev/tcp/127.0.0.1/PORTA) 2>/dev/null`.
- Espera da API com `curl -fsS`; se não houver `curl`, usa `docker compose exec -T api node -e "fetch('http://localhost:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
- Primeira linha `#!/usr/bin/env bash`. Quebras de linha LF.

### 5. `AGENTS.md` (instruções para assistentes de IA)

Arquivo curto e imperativo, em português, escrito para um assistente de IA que recebeu o pedido "instale este sistema". Seções:
- **O que é**: uma frase (sistema escolar; site + API + PostgreSQL, tudo em Docker).
- **Instalar**: (1) se o repositório ainda não estiver na máquina, `git clone https://github.com/marco3079/sistema-escolar.git` e entre na pasta; (2) Windows: `powershell -ExecutionPolicy Bypass -File .\instalar.ps1`; Linux e macOS: `bash instalar.sh`; (3) o script faz tudo: confere o Docker, cria o `.env`, baixa as dependências e sobe os contêineres.
- **Códigos de saída do instalador** e o que fazer em cada um (2: Docker não instalado; 3: Docker não está rodando; 4: falha ao subir; 5: API não respondeu).
- **Como confirmar que funcionou**: `docker compose ps` com `db`, `api` e `web` no ar; `GET http://localhost:<API_PORT>/api/saude` devolve `{"ok":true}`; o site abre em `http://localhost:<WEB_PORT>`.
- **O que dizer ao usuário no fim**: o endereço do site, o e-mail do administrador, que a senha está no arquivo `.env` (variável `ADMIN_SENHA`) e que ele deve trocá-la em "Meu perfil".
- **Regras para o assistente**: não imprima nem copie o conteúdo do `.env` em respostas além de indicar onde a senha está; não rode `docker compose down -v` (apaga o banco) sem pedido explícito do usuário; não altere as portas de outros contêineres da máquina; se uma porta estiver ocupada, o instalador escolhe outra sozinho; não commite o `.env`.
- **Opções**: `-Demo` / `--demo` (dados fictícios para teste), portas, atualizar (`git pull` e rodar o instalador de novo), parar, apagar tudo.
- **Desenvolvimento**: onde ficam servidor e cliente e os comandos de verificação (`npx tsc --noEmit` em `server` e em `client`, `npx vite build` em `client`).

### 6. `INSTALAR.md` (para pessoas)

Guia em português, passo a passo, para quem não é programador:
- **Jeito 1, com um assistente de IA**: um bloco de texto pronto para copiar e colar no assistente (Claude Code, Cursor, Copilot ou outro com acesso ao terminal): "Instale o sistema escolar do repositório https://github.com/marco3079/sistema-escolar neste computador seguindo o arquivo AGENTS.md do repositório. Ao terminar, me diga o endereço para abrir no navegador e onde está a senha do administrador."
- **Jeito 2, com um comando**: Windows (PowerShell) e Linux/macOS (terminal), incluindo o `git clone`.
- **O que você precisa**: Docker Desktop (o instalador oferece instalar) e Git.
- **Primeiro acesso**: abrir o endereço, entrar com o e-mail e a senha mostrados, trocar a senha em "Meu perfil", e a ordem sugerida para começar a usar (período letivo, cursos e disciplinas, professores, turmas, alunos, matrículas).
- **Usar no celular**, **atualizar**, **parar**, **apagar tudo**, **quero ver com dados de exemplo** (`-Demo` / `--demo`, numa instalação nova).
- **Problemas comuns**: Docker não está aberto; porta ocupada; esqueci a senha do administrador (está no `.env` se não foi trocada; se foi trocada, só apagando o banco ou pedindo a outro administrador).

### 7. `README.md` (reescrito, profissional)

Em português. Estrutura, nesta ordem:
1. Logo centralizada (mantenha a linha `<p align="center"><img src="assets/artes/logo.png" alt="Sistema Escolar" width="420"></p>`), uma frase de descrição centralizada e uma linha de selos em `<p align="center">`: licença MIT (`https://img.shields.io/badge/licen%C3%A7a-MIT-blue`), Docker (`https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white`), Node 20, React 18, TypeScript e PostgreSQL 16 (mesmo padrão de shields.io; nenhum selo de serviço que o projeto não usa).
2. Print principal: `<p align="center"><img src="docs/imagens/painel-claro.png" alt="Tela inicial do portal administrativo" width="900"></p>`.
3. **Sumário** com links para as seções.
4. **Visão geral**: o que é, para quem serve, os oito níveis de ensino.
5. **Funcionalidades**: por portal (Administrativo, Professor, Aluno), em listas curtas, só o que existe de verdade (cadastros com ficha do aluno e do professor, cursos e turmas, matrícula com pré-requisitos e vagas, diário com notas e frequência, boletim e histórico, pós-graduação com bancas, financeiro, biblioteca, horários, calendário, comunicados, busca geral, avisos, painel com indicadores e gráfico, temas claro e escuro, uso no celular).
6. **Telas**: os outros prints do contrato, cada um com uma legenda de uma linha: `painel-escuro.png`, `alunos.png`, `ficha-aluno.png`, `diario.png`, `login.png` (largura 900) e `boletim-celular.png` (largura 320). Diga que os dados dos prints são fictícios.
7. **Instalação rápida**: os dois comandos (Windows e Linux/macOS), o que o instalador faz, e o link para `INSTALAR.md`. Um parágrafo "Instalar com um assistente de IA" com o texto pronto e o link para `AGENTS.md`.
8. **Primeiro acesso**: administrador criado na instalação, senha no `.env`, trocar em "Meu perfil". **Nenhuma senha escrita no README.**
9. **Dados de demonstração (opcional)**: `-Demo` / `--demo` numa instalação nova carrega uma escola fictícia; os acessos de demonstração usam o domínio `escola.demo` e estão em `server/prisma/seed-demo.ts`. Não escreva a senha no README.
10. **Configuração**: tabela das variáveis do `.env` (do contrato).
11. **Arquitetura**: três contêineres, estrutura de pastas, tecnologias; links para `docs/ARQUITETURA.md` e `docs/API.md` (o g04 está criando).
12. **Desenvolvimento**: rodar sem Docker (como no README atual, usando `DB_PORT`), comandos de verificação.
13. **Contribuindo**, **Segurança** e **Licença**: uma linha cada, com links para `CONTRIBUTING.md`, `SECURITY.md` e `LICENSE`.

Regras do README: nada de promessa que o sistema não cumpre; sem emojis em títulos; sem a tabela antiga de usuários de demonstração com senha; portas padrão 8090 (site) e 3090 (API).

## Critérios de aceite

- `docker compose config` sem erro, com e sem `.env`.
- `instalar.ps1` passa na análise de sintaxe do PowerShell (0 erros) e só tem ASCII.
- `instalar.sh` passa em `bash -n instalar.sh` e tem quebras de linha LF.
- Nenhum segredo real nem senha fixa em nenhum arquivo.
- Todos os links relativos do README, do AGENTS.md e do INSTALAR.md apontam para arquivos do contrato ou existentes.

## Verificação

```
docker compose config
bash -n instalar.sh
powershell -NoProfile -Command "$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path instalar.ps1),[ref]$null,[ref]$e); $e.Count"
```

**Não execute os instaladores** e não rode `docker compose up`, `down` nem `build`: o sistema do usuário está no ar nesta máquina, e o teste real é do main.
