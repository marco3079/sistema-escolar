# Como instalar o sistema escolar

Este guia leva você do zero até o sistema funcionando no seu computador. Não precisa saber programar.

## O que você precisa

- **Docker Desktop**: programa que roda o sistema em "caixas" separadas. O instalador oferece instalar para você (no Windows, pelo winget; no Linux, pelo comando oficial; no macOS, pelo Homebrew, se você tiver). Também dá para baixar em https://www.docker.com/products/docker-desktop/.
- **Git**: programa para baixar o projeto. Baixe em https://git-scm.com/downloads. Se não quiser instalar o Git, use o botão "Code" > "Download ZIP" no repositório, descompacte e pule o comando `git clone`.
- Conexão com a internet na primeira instalação (o Docker baixa as dependências automaticamente).

## Jeito 1: pedir para um assistente de IA instalar

Se você usa um assistente com acesso ao terminal (Claude Code, Cursor, Copilot ou outro), copie o texto abaixo e cole no assistente:

> Instale o sistema escolar do repositório https://github.com/marco3079/sistema-escolar neste computador seguindo o arquivo AGENTS.md do repositório. Ao terminar, me diga o endereço para abrir no navegador e o e-mail e a senha do administrador.

O assistente baixa o projeto, roda o instalador e avisa o endereço do site. A senha inicial do administrador é `admin1234` (e-mail `admin@escola.local`); o assistente informa as duas e avisa para trocar a senha no primeiro acesso.

## Jeito 2: com um comando

Abra o terminal (no Windows, o **PowerShell**; no Linux ou macOS, o **Terminal**) e rode os comandos de acordo com o seu sistema.

**Windows (PowerShell):**

```powershell
git clone https://github.com/marco3079/sistema-escolar.git
cd sistema-escolar
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

**Linux e macOS (Terminal):**

```bash
git clone https://github.com/marco3079/sistema-escolar.git
cd sistema-escolar
bash instalar.sh
```

O instalador confere o Docker, oferece instalar o que faltar, cria o arquivo `.env` com segredos aleatórios, baixa tudo e sobe o sistema. No fim ele mostra:

- o endereço do site (por exemplo, `http://localhost:8090`);
- o e-mail do administrador (`admin@escola.local`);
- a senha do administrador (`admin1234`, a senha padrão; troque em "Meu perfil" no primeiro acesso).

Se o instalador parar com uma mensagem, leia a mensagem: ela diz o que fazer. Os códigos de saída estão em `AGENTS.md`.

## Primeiro acesso

1. Abra o endereço do site no navegador.
2. Entre com o e-mail e a senha mostrados no fim da instalação.
3. Troque a senha em **Meu perfil**, no menu do seu nome.
4. Comece a cadastrar, nesta ordem:
   1. período letivo;
   2. cursos e disciplinas;
   3. professores;
   4. turmas;
   5. alunos;
   6. matrículas.

O sistema começa vazio, só com a conta do administrador.

## Usar no celular

1. Conecte o celular na mesma rede Wi-Fi do computador onde o sistema está rodando.
2. No navegador do celular, abra `http://<IP-do-computador>:8090`. O IP aparece no fim da instalação. Exemplo: `http://192.168.0.10:8090`.
3. Use "Adicionar à tela inicial" para instalar como app.

Só o site fica acessível pela rede. A API e o banco aceitam conexões somente deste computador.

## Atualizar

Como atualizo o sistema? A forma mais simples é pelo próprio sistema: entre como administrador, abra **Configurações**, depois a aba **Atualização**, clique em **Verificar agora** e, se houver novidades, em **Atualizar agora**. A tela mostra cada etapa e, no fim, o botão **Recarregar a página**. Os dados do banco são mantidos. Os detalhes estão no README, na seção "Como atualizar".

Se preferir fazer à mão, entre na pasta do projeto e rode:

```bash
git pull
```

Depois rode o instalador de novo (`.\instalar.ps1` no Windows ou `bash instalar.sh` no Linux e macOS). Os dados do banco são mantidos.

## Parar o sistema

Na pasta do projeto:

```bash
docker compose down
```

Os dados continuam guardados. Para ligar de novo, rode o instalador outra vez.

## Apagar tudo

Atenção: este comando **apaga o banco de dados** (alunos, notas, tudo).

```bash
docker compose down -v
```

## Quero ver com dados de exemplo

Para testar com uma escola fictícia, use a opção de demonstração numa instalação **nova**:

- Windows: `powershell -ExecutionPolicy Bypass -File .\instalar.ps1 -Demo`
- Linux e macOS: `bash instalar.sh --demo`

Os dados de demonstração são fictícios e servem só para teste.

## Como faço uma cópia de segurança?

Entre como administrador e abra **Configurações**, depois a aba **Cópia de segurança**. Clique em **Criar cópia agora**. A cópia também é feita sozinha todo dia, na hora escolhida na mesma tela.

Para guardar uma cópia fora do computador, abra o menu de ações da cópia e clique em **Baixar**. Guarde o arquivo `.sql.gz` em lugar seguro, como um pendrive ou outro disco. Ele tem todos os dados do sistema, então não deixe em lugar aberto.

## Como passo o sistema para outro computador?

1. No computador antigo, faça uma cópia e clique em **Baixar** nela (veja acima).
2. No outro computador, instale o sistema como descrito neste guia, com o instalador.
3. Entre como administrador no novo sistema, abra **Configurações** → **Cópia de segurança** e clique em **Enviar arquivo de cópia**. Escolha o arquivo `.sql.gz` baixado.
4. Clique em **Restaurar** na cópia enviada e digite `RESTAURAR` para confirmar. Os dados e os usuários passam a ser os do computador antigo.
5. Entre de novo com um usuário da cópia. A senha é a mesma que era no computador antigo.

Antes de restaurar, o sistema guarda o estado do computador novo numa cópia "Antes de restaurar", caso você queira voltar.

## Os arquivos enviados entram na cópia de segurança?

Não. A cópia de segurança guarda só o banco de dados. Os arquivos das salas de aula (materiais, tarefas e entregas) ficam no volume `dados_arquivos` do Docker e precisam de uma cópia à parte. Para fazê-la, com o sistema rodando:

1. Descubra o nome do volume com `docker volume ls`. Ele termina em `dados_arquivos` e começa com o nome do projeto (por exemplo, `sistema_escolar_dados_arquivos`).
2. Copie o conteúdo do volume para uma pasta sua, trocando `NOME_DO_VOLUME` pelo nome encontrado e `PASTA_DE_DESTINO` pelo caminho completo da pasta:

```bash
docker run --rm -v NOME_DO_VOLUME:/origem -v PASTA_DE_DESTINO:/destino alpine tar -C /origem -czf /destino/arquivos-salas.tar.gz .
```

Guarde esse arquivo junto com a cópia de segurança do banco. Sem ele, os anexos das salas de aula não voltam se o volume for perdido.

## Qual o tamanho máximo de arquivo?

Cada arquivo anexado a um material, uma tarefa ou uma entrega pode ter até **20 MB**, e cada item aceita até 10 arquivos. Os tipos aceitos são PDF, imagens (PNG, JPG, WEBP e GIF), textos (TXT e CSV), documentos do Word, planilhas do Excel, apresentações do PowerPoint, documentos do LibreOffice (ODT, ODS e ODP) e arquivos ZIP. Vídeos não são enviados como arquivo: coloque o link do vídeo no material.

Um arquivo enviado e não anexado a nada é apagado depois de 24 horas.

## Problemas comuns

**O Docker não está aberto.** O instalador diz "o Docker está instalado, mas não está rodando". Abra o Docker Desktop, espere ele iniciar e rode o instalador de novo.

**Porta ocupada.** Na primeira instalação, se a porta 8090 (site) ou 3090 (API) já estiver em uso, o instalador escolhe a próxima livre e avisa qual usou. Confira o endereço no fim da instalação. Se já existe um arquivo `.env`, o instalador usa as portas dele e só avisa que estão ocupadas.

**Esqueci a senha do administrador.** Se você não trocou a senha, ela é `admin1234`, com o e-mail `admin@escola.local` (ou o que estiver em `ADMIN_EMAIL` no arquivo `.env`). Se você definiu outra senha em `ADMIN_SENHA` no `.env`, ela está lá. Se já trocou e esqueceu, a saída é apagar o banco (`docker compose down -v`, o que apaga todos os dados) e instalar de novo, ou pedir a outro administrador que redefina o acesso.

**O instalador parou com a mensagem "Ja existe um banco de dados desta instalacao" (código 6).** O banco de uma instalação anterior ainda existe, mas o arquivo `.env` com a senha dele não está na pasta. Duas saídas: (a) se você tem o `.env` antigo, copie-o de volta para a pasta do projeto e rode o instalador de novo; (b) se você não precisa mais dos dados antigos, apague o banco com `docker compose down -v` (isso apaga tudo) e rode o instalador de novo. O instalador não apaga nada sozinho.

**A instalação falhou no meio.** Rode o instalador de novo. Ele não sobrescreve o `.env` que já existe.

**O botão de atualizar diz que o serviço não está respondendo.** A instalação foi feita antes do serviço de atualização existir. Rode o instalador de novo na pasta do projeto (`.\instalar.ps1` ou `bash instalar.sh`): ele cria o serviço e não apaga os dados. Se o aviso continuar, veja se a pasta do projeto foi baixada como ZIP: nesse caso, o botão não funciona. Instale de novo com `git clone`, como mostrado acima.

**Como faço a plataforma enviar e-mails?** O sistema manda e-mails de recuperação de senha, boas-vindas a novos usuários, comunicados e respostas do suporte, mas só depois de você informar uma conta de e-mail. Entre como administrador, abra **Configurações** (no menu, na seção Sistema) e a aba **E-mail**. Preencha o servidor de envio (SMTP), a porta, o usuário e a senha da conta, o e-mail e o nome do remetente, e o endereço do site (por exemplo, `http://localhost:8090`). Marque **Envio de e-mails ligado** e salve. Para conferir, use **Enviar e-mail de teste** com o seu endereço. Se a conta tiver verificação em duas etapas, o provedor costuma pedir uma senha de aplicativo, que você cria no próprio provedor. Os detalhes estão no README, na seção "Como conectar um e-mail".
