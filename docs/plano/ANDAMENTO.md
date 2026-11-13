# Andamento: rodada concluída

Rodada de 10/11/2026 (três levas mais um passe de polimento). Todas as partes foram aprovadas pelo revisor e testadas numa instalação temporária com dados de demonstração.

## Planos e contratos

- Leva 1: [instalacao.md](instalacao.md) e os mini-planos `i-*.md`.
- Leva 2: [segunda-leva.md](segunda-leva.md) e os mini-planos `s-*.md`.
- Leva 3: [terceira-leva.md](terceira-leva.md) e os mini-planos `t-*.md`.

## O que entrou

| Leva | Parte | Gerador |
|---|---|---|
| 1 | Seed só com administrador e dados de demonstração opcionais (`SEED_DEMO=true`) | g01 |
| 1 | "Meu perfil" para o administrativo | g02 |
| 1 | Instalador (`instalar.ps1`, `instalar.sh`), `AGENTS.md`, `INSTALAR.md`, README | g03 |
| 1 | Documentação do repositório (contribuição, segurança, API, arquitetura, modelos de issue e PR) | g04 |
| 1 | API das fichas de aluno e professor | g05 |
| 1 | Menu de ações e fichas de aluno e professor | g06 |
| 1 | Layout do Financeiro | g07 |
| 2 | Log de atividades e perfil TI no servidor | g08 |
| 2 | Perfil TI, registro de telas e ícones no cliente | g09 |
| 2 | Telas "Atividades" e "Log do sistema" | g10 |
| 2 | Biblioteca com capas e tabela ou cartões | g11 |
| 2 | Calendário em grade, filtros de Horários e Turmas | g12 |
| 2 | Comunicados | g13 |
| 2 | Usuários com menu de ações e ficha | g14 |
| 3 | API de perfil, medalhas, nível e foto | g15 |
| 3 | API do suporte (chamados) | g16 |
| 3 | API do fórum | g17 |
| 3 | Base do cliente (ícones, Avatar, coluna de ações, menu do usuário) | g18 |
| 3 | Tela "Meu perfil" com medalhas | g19 |
| 3 | Telas do suporte | g20 |
| 3 | Telas do fórum | g21 |
| 3 | Layout de Cursos, Períodos e Turmas | g22 |
| 3 | Layout de Boletins | g23 |

## Passe de polimento (depois das capturas de tela)

- Financeiro e Biblioteca: ações em menu de três pontos, sem links soltos.
- "Meu perfil": texto fora da faixa colorida, barra do nível com mínimo visível.
- Fichas: um único botão de fechar, indicadores em grade que se ajusta.
- Log do sistema: colunas sem quebra, status em selo, módulos com acento.
- Atendimento: resumo com ícones, filtro "Só os meus" na linha dos filtros.
- Celular: fileira de resumo com dois cartões por linha.

## Testes

- `npx tsc --noEmit` no cliente e no servidor, e build do cliente.
- Instalação temporária com `SEED_DEMO=true`: regressão da API (169 verificações) e capturas das telas em claro e escuro, computador e celular.
- Prints do README em `docs/imagens/`.

## Pontos em aberto

- Integração contínua (GitHub Actions) ficou de fora: a credencial usada para enviar ao GitHub não tem permissão para arquivos de workflow.
- A instalação no celular ("Adicionar à tela inicial") continua sem teste em aparelho real.
- No calendário, o fim dos eventos de demonstração é gravado às 23:59; em fuso a leste de UTC o último dia pode aparecer no dia seguinte.

## Quarta leva (11/11/2026): configurações da plataforma, e-mail e chat

Plano e contratos em [quarta-leva.md](quarta-leva.md). Todas as partes aprovadas pelo revisor.

| Parte | Gerador |
|---|---|
| Configurações e e-mail no servidor (SMTP, fila, histórico, senha cifrada) | g08 |
| Senha por e-mail, boas-vindas e avisos de comunicados e suporte | g15 |
| Chat no servidor | g16 |
| Base do cliente (identidade da plataforma, ícones, botão do chat) | g18 |
| Tela de configurações | g19 |
| Telas "Esqueci minha senha" e "Redefinir senha" | g20 |
| Tela do chat | g21 |
| Dados de demonstração do chat | g01 |
| Documentação | g04 |

Testes: e-mail e chat testados de verdade pelo revisor (API, banco e servidor de e-mail de teste descartáveis); regressão da API (169 verificações); chat e configurações abertos no navegador numa instalação temporária (mensagem em tempo real entre duas contas, tiques, troca de cores).

Rodadas menores do mesmo dia: senha padrão do administrador ([u-g01-senha-padrao.md](u-g01-senha-padrao.md)), botão de tema e aba "Dados e segurança" ([v-tema-e-perfil.md](v-tema-e-perfil.md)).

Pontos em aberto desta leva:

- O envio de e-mail pela tela (botão "Enviar e-mail de teste") foi testado pela API; pela tela, não.
- O chat não foi aberto em celular real nem em 360 px no navegador (conferido por leitura do CSS).
- As mensagens do chat ficam no banco em texto puro (sem criptografia de ponta a ponta).

## Rodada W (12/11/2026): botão de atualizar pelo GitHub

Plano e contratos em [w-atualizador.md](w-atualizador.md). Serviço atualizador (g03), API (g08), aba "Atualização" (g19) e documentação (g04), todos aprovados pelo revisor.

Teste real numa cópia separada do projeto, com origem local um commit à frente: atualização normal concluída (código avançou, site novo no ar, banco preservado, só API e site reiniciados) e caso de conflito local (parou sem perder nada). O teste revelou e corrigiu dois defeitos: o ponto de entrada da imagem do atualizador e a consulta de estado travada durante a reconstrução.

Pontos em aberto:

- O clique em "Atualizar agora" pela tela não foi exercitado (a atualização foi disparada pela API; a aba foi aberta e conferida depois de concluída).
- Em Linux, o `git pull` roda como root dentro do contêiner e os arquivos novos podem ficar com dono root na pasta do projeto.

## Quinta leva (13/11/2026): pendências, central de notificações, cópia de segurança e planilhas

Plano e contratos em [quinta-leva.md](quinta-leva.md); roteiro geral em [ROTEIRO.md](ROTEIRO.md). Todas as partes aprovadas pelo revisor.

| Parte | Gerador |
|---|---|
| Agendador e notificações no servidor | g15 |
| Avisos nos módulos e e-mail do login sem diferenciar maiúsculas | g16 |
| Cópia de segurança, manifesto dinâmico e infra | g08 |
| Importação por planilha no servidor | g17 |
| Base do cliente (CSV, exportação nas tabelas, sino) | g18 |
| Aba "Cópia de segurança" | g19 |
| Tela de importar planilha e exportação nas listas | g06 |
| Avisos de demonstração | g01 |
| Documentação | g04 |

Testes reais numa instalação temporária em Docker: cópia, download, restauração (com cópia anterior), envio de arquivo, nomes maliciosos e permissões; importação de 500 alunos em cerca de 3 s; exportação de planilha; aviso no sino a partir de um comunicado; login com e-mail em maiúsculas; chat, sino e telas de senha em tamanho de celular. O revisor testou notificações, avisos por evento e importação num banco descartável.

Decisões do main nesta leva: armazenamento de arquivos adiado para a leva 6; fuso horário da API definido por `FUSO_HORARIO` (padrão America/Sao_Paulo), com o cálculo de idade ajustado.

Pontos em aberto:

- A cópia automática diária foi vista rodando na subida do contêiner; a execução na hora marcada, de um dia para o outro, não foi observada.
- A restauração com falha no meio (desfazer a transação) não foi provocada.
- O nome e o ícone do aplicativo instalado passaram a vir das configurações, mas a instalação num celular real não foi testada.

## Sexta leva (13/11/2026): sala de aula

Plano e contratos em [sexta-leva.md](sexta-leva.md). Todas as partes aprovadas pelo revisor.

| Parte | Gerador |
|---|---|
| Armazenamento de arquivos (servidor e infra) | g08 |
| Salas, materiais e plano de aula (servidor) | g15 |
| Tarefas e entregas (servidor) | g16 |
| Provas online (servidor) | g17 |
| Chamada por QR code (servidor) | g05 |
| Base do cliente (envio de arquivos, QR code, ícones) | g18 |
| Sala, materiais e plano (telas) | g19 |
| Tarefas (telas) | g20 |
| Provas (telas) | g21 |
| Chamada (telas) | g06 |
| Dados de demonstração | g01 |
| Documentação | g04 |

Testes reais numa instalação temporária em Docker: envio e download de arquivos com permissão por contexto, material com anexo e aviso no sino, tarefa com entrega e correção, prova inteira com correção automática e correção da dissertativa, chamada por QR code com presença registrada; capturas das telas no computador e no celular (tema escuro). O revisor rodou os módulos do servidor e o seed de demonstração num banco descartável.

Pontos em aberto:

- Os arquivos enviados ficam no volume `dados_arquivos` e não entram na cópia de segurança do banco.
- A leitura do QR code pela câmera de um celular real não foi testada; o código digitado e o link do QR foram.
- O envio automático da prova ao acabar o tempo e as novas tentativas em caso de falha de rede não foram provocados na tela.
- Se a resposta do envio da prova se perder e a nova tentativa receber "já enviada", a tela mostra erro mesmo com a prova gravada; a nota aparece na lista.
