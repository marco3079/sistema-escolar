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
