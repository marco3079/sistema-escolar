# Changelog

Todas as mudanças relevantes do projeto são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

## [1.0.0] - 2026-11-10

### Adicionado

- Três portais no mesmo app web, escolhidos pelo perfil do usuário:
  - Administrativo (perfis ADMIN e SECRETARIA): alunos, professores, usuários, cursos, períodos letivos, turmas, matrículas, boletins, pós-graduação, financeiro, biblioteca, horários, calendário e comunicados.
  - Professor: minhas turmas, diário de classe, orientações, biblioteca, horário, calendário, comunicados e meu perfil.
  - Aluno: matrícula, boletim, histórico, pesquisa, financeiro, biblioteca, horário, calendário, comunicados e meu perfil.
- Redesenho da interface: painel com indicadores e gráfico de desempenho, busca, sino de avisos, atalhos e temas claro e escuro (o escuro segue a preferência do aparelho).
- Logo, ícones e ilustrações próprios.
- Instalador para Windows e Linux/macOS, com cálculo automático de segredos, e guia para assistentes de IA instalarem o sistema.
- Ficha do aluno e ficha do professor, com um mini painel de informações ao clicar na pessoa.
- Perfil TI, com o mesmo acesso do administrador.
- Log de atividades, com painel de atividades em tempo real para o administrador e o TI.
- Capas de livro, com alternância entre tabela e cartões na biblioteca.
- Calendário em grade mensal.
- Nova tela de comunicados.
- Perfil com foto, nível, pontos e medalhas, com medalhas automáticas (calculadas pelos dados) e manuais (concedidas por administrador, secretaria ou professor).
- Suporte por chamados, com atendimento por categoria, anexo de imagem, prioridade e avaliação do atendimento.
- Fórum com comunidades, votos e comentários em árvore, com ordenação "Em alta", "Novas" e "Mais votadas".
- Ficha e menu de ações na tela de Usuários.
- Novo layout das telas de Cursos, Períodos letivos, Turmas e Boletins.
- Botão de tema (claro, escuro ou seguir o aparelho) no topo, no menu do usuário, na tela de login e em "Meu perfil"; a escolha fica guardada no navegador.
- Aba "Dados e segurança" de "Meu perfil" em duas colunas, com confirmação da nova senha.
- Configurações da plataforma, só para administrador e TI: nome, slogan, logo e cores (primária e secundária), aplicados na tela de entrada, no menu e no título da aba.
- Envio de e-mails por SMTP, configurado na própria tela de Configurações, com botão de teste e histórico dos últimos envios. São enviados avisos de recuperação de senha, boas-vindas a novos usuários, comunicados e respostas do suporte.
- Recuperação de senha por link enviado por e-mail, com as telas "Esqueci minha senha" e "Redefinir senha", e criação de senha por link para novos usuários.
- Chat privado entre usuários, com conversas individuais e grupos (administração do grupo, adicionar e remover pessoas, sair do grupo), imagens, confirmação de entrega e de leitura, "digitando...", quem está online, resposta citando uma mensagem e apagar a própria mensagem.
- Botão do chat com contador de mensagens não lidas, ao lado do sino.
- Atualização pelo painel, em Configurações → Atualização (perfis ADMIN e TI): verifica o último commit do GitHub, mostra as novidades e atualiza o sistema (baixa o código, reconstrói a API e o site e os reinicia), sem apagar dados do banco. Novo serviço `atualizador` no `docker-compose.yml`.

### Alterado

- Senha inicial do administrador passa a ser a padrão `admin1234` (e-mail `admin@escola.local`), trocável em "Meu perfil" no primeiro acesso. Substitui a senha aleatória gerada pelo instalador e pelo servidor.
- O banco passa a nascer somente com a conta de administrador. Os dados de demonstração deixam de ser carregados por padrão e podem ser ativados com `SEED_DEMO=true`, apenas para teste.

### Segurança

- Limite de tentativas de login: 10 falhas em 10 minutos para o mesmo endereço de IP e e-mail devolvem `429` nas tentativas seguintes.
- Segredo JWT aleatório quando `JWT_SECRET` estiver ausente, curto ou com valor de exemplo, com aviso no log do servidor.
- Porta direta da API e porta do banco publicadas só no próprio computador (`127.0.0.1`).
- Cabeçalhos de segurança no site: `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`.
- Senha do servidor de e-mail guardada cifrada (AES-256-GCM) e nunca devolvida pela API.
- Tokens de senha por e-mail de uso único, guardados só como hash, com validade, e limites para pedidos de recuperação de senha.
- Chat só para participantes da conversa, com limite de 30 mensagens por minuto por pessoa.
- Serviço de atualização sem porta publicada, com token derivado de `JWT_SECRET`, só duas ordens fixas, só avanço rápido a partir do `origin` do checkout e sem ações que apaguem dados.
