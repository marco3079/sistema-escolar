# Roteiro das próximas levas

Em 13/11/2026 o usuário marcou as 22 sugestões do popup, sem ordem de prioridade. Este roteiro organiza tudo em levas, na ordem em que uma coisa destrava a outra. Cada leva segue o fluxo do squad (plano e contratos, geradores, revisor, teste real, commit e push) e só começa quando o usuário disser "vai".

## Base que várias levas usam

Três peças aparecem em muitos itens e por isso vêm primeiro:

- **Arquivos**: hoje o sistema só guarda imagens pequenas dentro do banco. Tarefas, materiais, documentos de matrícula, anexos do chat e backups precisam de um armazenamento de arquivos de verdade (pasta em volume do Docker, com limite de tamanho, tipos permitidos e controle de acesso).
- **Notificações**: uma tabela única de avisos por usuário. A central do sino, as notificações no celular e os lembretes automáticos saem dela.
- **Tarefas agendadas**: um agendador simples dentro da API (lembretes, backup diário, limpeza).

## Leva 5: base e pendências (concluída em 13/11/2026)

| Item | Observação |
|---|---|
| Corrigir pendências atuais | E-mail com maiúsculas no login e na recuperação; nome e ícone do app instalado seguindo as configurações; conferir chat e telas de senha no celular |
| Armazenamento de arquivos | **Passou para o início da leva 6**, onde nascem os primeiros usos reais (materiais e tarefas) |
| Central de notificações | O sino reúne chat, suporte, fórum, notas, mensalidades e comunicados |
| Cópia de segurança do banco | Diária e automática, com baixar e restaurar em Configurações |
| Importar e exportar planilhas | Alunos e professores em lote por CSV; exportar qualquer lista |

## Leva 6: sala de aula (concluída em 13/11/2026)

| Item | Observação |
|---|---|
| Armazenamento de arquivos | Veio da leva 5: pasta em volume do Docker, limites, tipos permitidos e controle de acesso por contexto |
| Materiais de aula | Arquivos, links e vídeos por turma |
| Tarefas e entregas | Prazo, entrega em texto ou arquivo, correção, nota opcional no diário |
| Plano de aula e conteúdo ministrado | Registro por aula e acompanhamento pela coordenação |
| Provas online | Objetivas com correção automática e dissertativas, com tempo limite |
| Chamada por QR code | Código que muda a cada poucos segundos, para não valer foto enviada a quem faltou |

## Leva 7: secretaria e famílias (concluída em 13/11/2026)

| Item | Observação |
|---|---|
| Documentos em PDF | Boletim, histórico, declaração de matrícula e ficha, com a logo |
| Ocorrências disciplinares | Na ficha do aluno e visíveis aos responsáveis |
| Portal dos responsáveis | Perfil novo, ligado a um ou mais alunos |
| Matrícula e rematrícula online | Formulário público, documentos e aprovação pela secretaria |

## Leva 8: gestão e segurança

| Item | Observação |
|---|---|
| Relatórios e gráficos | Inadimplência, evasão, desempenho, frequência, com filtros e exportação |
| Lembretes automáticos | Mensalidade, devolução de livro e prazo de tarefa, por e-mail e pela central |
| Verificação em duas etapas | Aplicativo autenticador; opção de obrigar para administradores |
| Permissões personalizadas | Perfis próprios escolhendo o que cada um acessa. É a mudança mais profunda: mexe em todas as rotas |
| Cobrança com Pix e boleto | Depende de conta do usuário num provedor de pagamentos |

## Leva 9: experiência de uso

| Item | Observação |
|---|---|
| Arquivos e áudio no chat | PDF e outros arquivos, áudio gravado e reações |
| Notificações no celular e no navegador | Aviso com o sistema fechado. Exige o site em HTTPS |
| Grade de horários visual | Arrastar aulas numa grade semanal, com aviso de conflito |
| Outros idiomas | Inglês e espanhol, por usuário. Toca em todas as telas |

## Decisões que o usuário precisa tomar (pergunto no popup quando a leva chegar)

- **Pix e boleto**: qual provedor de pagamentos (é preciso ter conta nele e as chaves de acesso). Só dá para testar no ambiente de testes do provedor.
- **Notificações no celular**: funcionam só com o site publicado em HTTPS; em `localhost` dá para testar no navegador do computador.
- **Permissões personalizadas**: se os perfis atuais continuam fixos e os novos são extras, ou se tudo vira configurável.
- **Portal dos responsáveis**: o que os pais podem ver e se podem falar com professores pelo chat.
- **Arquivos**: tamanho máximo por arquivo e por usuário, e quais tipos aceitar.
- **Idiomas**: se os dados cadastrados (nomes de cursos, comunicados) também precisam de tradução ou só a interface.

## Tamanho

São 22 itens. Cada leva é comparável à quarta leva (configurações, e-mail e chat), que levou uma rodada completa com sete geradores. Permissões personalizadas e outros idiomas são os dois itens que tocam no sistema inteiro e têm mais risco de quebrar o que já funciona.
