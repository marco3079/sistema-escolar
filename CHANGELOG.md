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

### Alterado

- O banco passa a nascer somente com a conta de administrador. Os dados de demonstração deixam de ser carregados por padrão e podem ser ativados com `SEED_DEMO=true`, apenas para teste.

### Segurança

- Limite de tentativas de login: 10 falhas em 10 minutos para o mesmo endereço de IP e e-mail devolvem `429` nas tentativas seguintes.
- Segredo JWT aleatório quando `JWT_SECRET` estiver ausente, curto ou com valor de exemplo, com aviso no log do servidor.
- Porta direta da API e porta do banco publicadas só no próprio computador (`127.0.0.1`).
- Cabeçalhos de segurança no site: `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`.
