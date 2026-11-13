# Política de segurança

## Versões com suporte

Apenas a branch `main` recebe correções de segurança.

## Como relatar uma vulnerabilidade

**Não abra issue pública para vulnerabilidades.** Relate em particular:

1. Acesse a aba **Security** do repositório: https://github.com/marco3079/sistema-escolar/security
2. Escolha **Report a vulnerability**.
3. Descreva o problema com o máximo de detalhes que puder.

Os mantenedores respondem pelo próprio GitHub. Não há prazo garantido de resposta, pois o projeto é mantido de forma voluntária.

### O que incluir no relato

- Qual parte do sistema foi afetada (API, site, instalador, banco).
- Versão ou commit usado.
- Passos para reproduzir o problema.
- Impacto esperado (por exemplo, acesso a dados de outro usuário).
- Se possível, uma sugestão de correção.

Não envie senhas reais, tokens válidos nem dados pessoais no relato. Use dados fictícios.

## Medidas de segurança já existentes

- **Senhas** são guardadas com bcrypt (biblioteca `bcryptjs`), nunca em texto puro. A resposta da API nunca inclui o hash.
- **Login** por JWT enviado no cabeçalho `Authorization: Bearer`, com validade de 12 horas. Todas as rotas exigem login, exceto o login, o teste de saúde da API, a leitura pública de nome, logo e cores da tela de entrada e as rotas de senha por e-mail.
- **Permissões por perfil** (ADMIN, SECRETARIA, PROFESSOR, ALUNO) são verificadas em cada rota.
- **Banco de dados** publicado somente em `127.0.0.1`, ou seja, acessível apenas pelo próprio computador.
- **Segredos** (senha do banco e segredo do JWT) são gerados pelo instalador de forma aleatória e gravados no arquivo `.env`, que não vai para o Git.
- **Senha do administrador**: a conta de administrador nasce com a senha padrão conhecida `admin1234` (e-mail `admin@escola.local`), definida em `ADMIN_SENHA`. **Ela precisa ser trocada no primeiro acesso em "Meu perfil"**, principalmente se o site ficar acessível na rede. O login tem limite de tentativas. Para outra senha inicial, defina `ADMIN_SENHA` com 8 caracteres ou mais antes da primeira subida.
- **Segredo JWT**: se `JWT_SECRET` estiver ausente, com menos de 16 caracteres ou com um valor de exemplo, o servidor gera um segredo aleatório a cada subida e avisa no log. Nesse caso, os logins são invalidados quando o servidor reinicia. Defina `JWT_SECRET` no `.env` (o instalador faz isso).
- **Log de atividades**: toda requisição autenticada à API é registrada com usuário, perfil, ação, módulo, caminho, status e IP. Telas abertas e entradas e saídas também são registradas. O log não guarda corpo de requisição, senha nem token, e os registros são apagados após 90 dias. Só o administrador e o perfil TI consultam o log.
- **Perfil TI** tem o mesmo acesso do administrador. Trate contas TI com o mesmo cuidado que contas de administrador.
- **Senha do servidor de e-mail (SMTP)**: fica cifrada no banco com AES-256-GCM. A chave é derivada (SHA-256) do segredo efetivo do servidor, o mesmo que assina os logins. A API nunca devolve a senha: a tela só informa se há uma senha gravada. Se o `JWT_SECRET` for trocado, a senha guardada deixa de ser lida, e o envio falha pedindo que ela seja digitada de novo. Sem `JWT_SECRET` no ambiente (ou com o valor de exemplo), o servidor usa um segredo aleatório a cada subida: nesse caso a senha do e-mail precisa ser digitada de novo depois de cada reinício. O instalador sempre define o segredo.
- **Mensagens de erro do e-mail**: o erro devolvido pelo servidor de e-mail perde a senha, se ela aparecer no texto, e é cortado em 300 caracteres antes de ir para a resposta e para o histórico. O histórico de e-mails guarda destinatário, assunto e situação, sem o corpo da mensagem.
- **Tokens de senha por e-mail**: links de uso único, guardados só como SHA-256 (o token em claro não fica no banco). Validade de 1 hora para a recuperação e de 7 dias para a criação de senha no cadastro. Um novo pedido de recuperação invalida o anterior, e ao redefinir a senha os outros links da conta deixam de valer. A troca de senha e a marcação do link como usado acontecem na mesma transação, o que evita uso duplo.
- **Pedido de recuperação**: a resposta é igual para e-mail cadastrado ou não, e nada é enviado para conta inativa. O link é montado com o endereço do site gravado nas configurações, e não com o endereço de quem fez o pedido; sem esse endereço, o pedido é recusado. Limites: 3 pedidos por 15 minutos para o mesmo IP e e-mail, e 20 por 15 minutos para o mesmo IP. O link e o token nunca vão para o log de atividades.
- **Chat privado**: só participantes ativos acessam uma conversa; quem não participa recebe `404`. As respostas do chat não trazem e-mail, CPF nem telefone de outras pessoas. Cada mensagem enviada tem limite de 30 por minuto por pessoa, o que impede inundação. O log de atividades não guarda o conteúdo das mensagens, e as descrições do chat não citam pessoas nem o texto. As consultas de tempo real (sincronizar, não lidas, digitando e lida) ficam fora do log.
- **Chat sem criptografia de ponta a ponta**: as mensagens e as imagens do chat ficam no banco em texto puro (imagem em data URL). Quem tem acesso ao banco pode lê-las, e a API as devolve aos participantes da conversa. Não há criptografia de ponta a ponta. Não use o chat para dados que exijam esse nível de sigilo sem avaliar essa limitação.

- **Limite de tentativas de login**: 10 falhas em 10 minutos para o mesmo endereço de IP e e-mail fazem as próximas tentativas receberem `429` (`Muitas tentativas. Aguarde alguns minutos.`). Um login bem-sucedido zera a contagem. A contagem fica na memória do servidor.
- **Limite de tamanho**: o corpo de cada requisição é limitado a 1 MB. Acima disso, a API responde `413`. As exceções são o envio de arquivo de cópia de segurança, que aceita até 200 MB (veja a seção "Cópias de segurança e planilhas"), e o envio de arquivo das salas de aula, que aceita até 20 MB (veja a seção "Sala de aula").
- **E-mail sem diferenciar maiúsculas**: o e-mail é gravado aparado e em minúsculas. Login, recuperação de senha e a checagem de e-mail já usado comparam sem diferenciar maiúsculas, para que `Ana@X.com` e `ana@x.com` não sejam duas contas.
- **Central de avisos**: cada pessoa lê, marca e apaga só os próprios avisos. Aviso de outra pessoa devolve `404`, como se não existisse.
- **Validação de imagens**: foto de perfil, capa de livro, anexo de chamado e imagem de publicação só aceitam JPEG, PNG ou WebP (em data URL), com até 200.000 caracteres. Foto e capa também aceitam endereço `http(s)`, de até 500 caracteres. Qualquer outro formato é recusado com `400`.
- **API publicada só no próprio computador**: o `docker-compose.yml` publica a porta direta da API e a do banco somente em `127.0.0.1`. O site é publicado em todas as interfaces e encaminha `/api`, então a API também responde pela porta do site na rede local. Por isso, exponha só a porta do site, com HTTPS na frente.
- **Cabeçalhos de segurança no site**: o nginx envia `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` e `Referrer-Policy: strict-origin-when-cross-origin`.
- **Perfil público sem dados de contato**: o perfil público (usado pelo fórum e por outras telas) mostra nome, perfil, foto, curso, titulação, nível e medalhas. Não mostra e-mail, CPF nem telefone. O mesmo vale para os autores de chamados e de publicações.

## Cópias de segurança e planilhas

- **As cópias contêm todos os dados do sistema.** Elas incluem usuários, notas, financeiro, mensagens do chat e as senhas em hash. Também incluem a senha do servidor de e-mail cifrada: para ela voltar a ser lida numa instalação nova, o `JWT_SECRET` precisa ser o mesmo (veja "Senha do servidor de e-mail" acima).
- **As cópias não são cifradas.** O arquivo `.sql.gz` é só compactado. Quem tiver o arquivo tem os dados. Guarde as cópias baixadas em lugar seguro, de preferência fora do computador onde o sistema roda.
- **Ficam num volume do Docker** (`dados_backups`) no mesmo computador. Uma cópia no próprio computador não protege contra perda do computador.
- **Só o administrador** (inclui TI, que tem o mesmo acesso) cria, baixa, envia, apaga e restaura cópias. Todas as rotas de `/api/backups` exigem esse perfil.
- **Nomes de arquivo validados**: todo nome recebido pela API precisa seguir o padrão `escola-AAAAMMDD-HHMMSS-<origem>.sql.gz` antes de tocar no disco. Barras, `..` e outros formatos são recusados com `400`.
- **Ferramentas sem shell**: `pg_dump` e `psql` são chamados com argumentos em lista. A senha do banco vai só na variável de ambiente do processo filho, nunca na linha de comando, e não aparece em mensagens de erro.
- **Restauração protegida**: exige a palavra `RESTAURAR` no corpo da requisição e a tela pede a mesma palavra. Antes de restaurar, o estado atual é guardado numa cópia `pre-restauracao`. A restauração é uma transação só: se falhar, o banco não fica pela metade.
- **Envio de arquivo**: só aceita um arquivo com a assinatura gzip, de até 200 MB. A assinatura não garante o conteúdo: a restauração executa o SQL do arquivo com o usuário do banco, pelo `psql` (com `ON_ERROR_STOP`). Envie só cópias geradas pelo próprio sistema.
- **Planilhas exportadas**: o CSV neutraliza fórmulas. Célula que começa com `=`, `+`, `-`, `@`, TAB ou CR, e não é número simples, ganha um apóstrofo antes, para o Excel não executar a fórmula.
- **Importação de planilhas**: a validação é feita no servidor, com as mesmas regras do cadastro individual, e a gravação é tudo ou nada. A importação define **uma senha inicial igual para todas as pessoas do lote** (mínimo de 8 caracteres). Oriente cada pessoa a trocá-la no primeiro acesso. A senha inicial não é gravada em log.

## Sala de aula (arquivos, provas e chamada)

**O que o sistema garante:**

- **Arquivos: tipos e tamanho.** Só as extensões da lista (`pdf`, imagens, documentos do Office e do OpenDocument, `txt`, `csv` e `zip`) são gravadas. O tipo enviado precisa combinar com a extensão. O limite é de 20 MB por arquivo, conferido durante a leitura do envio.
- **Arquivos: nome em disco.** O nome do arquivo no disco é aleatório (32 caracteres hexadecimais). O nome original fica só no banco, sem caminho, e não é usado para gravar nada.
- **Arquivos: download.** A resposta traz `X-Content-Type-Options: nosniff` e `Cache-Control: private, no-store`. Só PNG, JPEG, WebP e GIF abrem no navegador; os demais tipos baixam como anexo.
- **Arquivos: acesso.** Material e tarefa seguem as regras de acesso à turma. Entrega é vista só pelo aluno dono e pelo professor e pela gestão da turma. Quem não tem acesso recebe `404`, sem saber se o arquivo existe.
- **Provas: gabarito.** Nenhuma rota do aluno devolve a alternativa correta antes de a prova fechar. O gabarito só aparece depois do envio, com a prova fechada e com `mostrarGabarito` ligado.
- **Provas: tempo do servidor.** O término da tentativa é calculado e conferido pelo servidor. Horário enviado pelo cliente não define prazo, e respostas enviadas depois do tempo (com 15 segundos de tolerância) são recusadas.
- **Chamada: segredo.** O segredo da chamada nunca sai pela API nem vai para o log. O código de 6 dígitos é comparado em tempo constante.
- **Chamada: código rotativo.** O código troca a cada 20 segundos. Reabrir a chamada troca o segredo, e os códigos anteriores deixam de valer.
- **Acesso às salas.** Toda rota da sala, de tarefas, de provas e da chamada confere o vínculo com a turma (professor, gestão ou aluno com inscrição não trancada) antes de agir.

**O que não é garantido:**

- **O conteúdo dos arquivos não é verificado.** O sistema confere a extensão e o tipo declarado, não o conteúdo, e não há antivírus. Um arquivo pode ter a extensão de um documento e conter outra coisa. Quem baixa deve tratar o arquivo como de origem desconhecida.
- **Os arquivos não são cifrados.** Ficam em texto puro no volume `dados_arquivos`. Quem tem acesso ao disco do servidor lê os arquivos.
- **Os arquivos não entram na cópia de segurança do banco.** Uma restauração do banco não traz os arquivos de volta, e se o volume `dados_arquivos` for perdido, a cópia do banco não recupera nada dele. O volume precisa de cópia à parte (veja `INSTALAR.md`).
- **Os links não são verificados.** Materiais aceitam link `http` ou `https` sem checar o destino.
- **Provas: consulta e troca de respostas não são impedidas.** O sistema não bloqueia outros sites, materiais ou conversas durante a prova, não impede copiar e colar, não detecta troca de aba e não confirma quem está respondendo. Não há fiscalização por câmera.
- **Provas: quem tem acesso ao banco** lê respostas e gabarito em texto puro, como os demais dados.
- **Chamada: presença não prova que a pessoa está na sala.** O código vale a janela atual e a anterior, ou seja, até cerca de 40 segundos. Quem está fora da sala e vê o QR ou o código digitado nesse intervalo, por foto ou repasse, consegue marcar presença. A troca a cada 20 segundos reduz esse repasse, mas não o elimina. O sistema não confere a localização.
- **Limites em memória.** O limite de 10 tentativas por minuto da chamada fica na memória do servidor e recomeça quando ele reinicia.

## Atualização pelo painel (serviço `atualizador`)

O botão de atualizar (Configurações → Atualização) usa um quarto serviço do `docker-compose.yml`, o `atualizador`. Ele precisa de acesso ao Docker do computador: o soquete `/var/run/docker.sock` é montado dentro dele. **Isso equivale a controle total da máquina onde o sistema roda**, porque quem controla o Docker controla os contêineres, os volumes e os arquivos montados. Por isso, o serviço foi feito com estas proteções:

- **Sem porta publicada.** O `atualizador` não tem `ports` no Compose. Só a API fala com ele, pela rede interna dos contêineres (`http://atualizador:4000`).
- **Token próprio.** Cada chamada leva o cabeçalho `X-Atualizador-Token`, que é o SHA-256 de `atualizador:` seguido do `JWT_SECRET`. A comparação é em tempo constante. Sem o token certo, a resposta é `401`. O segredo aleatório da execução da API não é usado, para que o atualizador possa conferir o token sozinho.
- **Só duas ordens, sem parâmetros.** O atualizador aceita consultar o estado e atualizar. Não recebe nada do corpo da requisição, não aceita endereço de repositório nem nome de ramo, e não executa texto montado por ninguém: os comandos são fixos e rodam sem shell.
- **Só avanço rápido.** A atualização usa `git pull --ff-only` a partir do `origin` do próprio checkout. Commits próprios divergentes ou arquivos locais em conflito fazem a atualização parar com a mensagem do Git. Nada é descartado (o serviço não usa `reset --hard`, `clean`, `checkout` de arquivos nem `stash`).
- **Nenhuma ação que apague dados.** O serviço reconstrói a API e o site (`docker compose build api web`) e os reinicia (`docker compose up -d --no-deps api web`). Não apaga volume, não mexe no banco e não se reconstrói.
- **Uma tarefa por vez.** Um segundo pedido enquanto a atualização roda recebe `409`.

Na prática, isso significa:

- Quem tem a senha de administrador (ou de TI, que tem o mesmo acesso) pode disparar a atualização do sistema para o último commit do repositório configurado. A confiança passa a estar no repositório de origem: quem consegue colocar código nele consegue colocar código rodando nesta máquina na próxima atualização. Proteja a conta do repositório e revise os commits antes de aceitá-los.
- Trate contas de administrador e de TI como contas que controlam o computador inteiro.

Para desligar o recurso, remova o serviço `atualizador` do `docker-compose.yml` ou não o suba. O botão de atualizar passa a avisar que o serviço não está respondendo, e o sistema continua funcionando normalmente, sem atualização pelo painel.

## Recomendações antes de expor o sistema à internet

- **Use HTTPS.** Coloque um proxy reverso com certificado (por exemplo, Caddy, Nginx ou Traefik) na frente do site e da API. O projeto não traz HTTPS pronto.
- Troque todos os valores de exemplo, se algum tiver sido usado.
- Não exponha a porta do banco de dados.
- Mantenha o Docker e as imagens atualizados.

## Pontos de atenção conhecidos

- O token de login fica guardado no armazenamento local do navegador. Em um computador compartilhado, faça sempre o logout ao sair.
- A cópia automática fica no mesmo computador. Ela não substitui uma cópia guardada fora dele.
- Os arquivos das salas de aula ficam no volume `dados_arquivos`, fora da cópia de segurança do banco.
