# Mini-plano de arte: ilustrações do redesenho

## Objetivo

Criar no Canva as cinco ilustrações que o exemplo do usuário mostra no painel e exportar em PNG.

Leia antes: `docs/plano/redesenho.md` e abra a referência `.claude/referencias/exemplo.png` (Read). Olhe: o prédio atrás do cabeçalho (canto superior direito), a pilha de livros no cartão "Minha Turma" e o capelo sobre ondas no cartão do rodapé da barra lateral. A metade de cima é o tema claro, a de baixo o escuro.

## Estilo

Ilustração 3D suave e limpa, em tons de azul (`#2563eb`, `#1d4ed8`, `#93c5fd`, `#e8f0fe`) e branco. Sem texto, sem pessoas, sem marcas ou logotipos, sem moldura. As imagens entram como fundo esmaecido, então o fundo de cada uma tem de ser liso e da cor exata indicada, para se misturar com o cartão.

## Arquivos de saída

| Arquivo | Dimensões | Conteúdo |
|---|---|---|
| `client/public/ilustracoes/predio-claro.png` | cerca de 1200 x 500 | Prédio escolar moderno de vidro e concreto, em perspectiva de três quartos, ocupando a metade direita; tons de azul claro e branco, pouco contraste; fundo liso `#f3f6fc`; a metade esquerda fica vazia nessa cor. |
| `client/public/ilustracoes/predio-escuro.png` | idem | O mesmo enquadramento à noite: prédio em azul-marinho com janelas acesas em azul; fundo liso `#070d1a`; metade esquerda vazia nessa cor. |
| `client/public/ilustracoes/livros-claro.png` | cerca de 600 x 400 | Pilha de cinco ou seis livros azuis e brancos em perspectiva, encostada à direita; fundo liso `#e8f0fe`. |
| `client/public/ilustracoes/livros-escuro.png` | idem | A mesma pilha em tons de azul-marinho; fundo liso `#12244a`. |
| `client/public/ilustracoes/capelo.png` | cerca de 480 x 360 | Capelo (chapéu de formatura) azul com borla, sobre duas ou três ondas azuis suaves na base; fundo branco `#ffffff`. |

Salve também uma cópia de cada um em `assets/artes/ilustracoes/` com o mesmo nome.

## Passos

1. Entre na sala `sistema_escolar` como `arte` e publique o entendimento.
2. Gere cada ilustração no Canva nas dimensões pedidas e exporte como PNG.
3. Salve nos dois caminhos (crie as pastas se não existirem).
4. Abra cada PNG salvo (Read) e confira: dimensões, cor do fundo, enquadramento (assunto à direita nos prédios e nos livros), ausência de texto, pessoas e marcas. Refaça o que não cumprir.

## Critérios de aceite

- Os cinco arquivos existem em `client/public/ilustracoes/` e as cinco cópias em `assets/artes/ilustracoes/`, todos PNG válidos.
- Cada PNG tem no máximo 600 KB (são imagens de fundo; reduza a qualidade ou as dimensões se passar).
- Fundos lisos nas cores indicadas; nenhum texto, pessoa ou marca.
- As versões clara e escura de prédio e de livros têm o mesmo enquadramento.

## Se o Canva não estiver disponível ou não gerar a ilustração

Não use outra ferramenta nem deixe arquivo de mentira. Avise o `@main` na sala dizendo exatamente o que falhou e quais arquivos ficaram faltando, e entregue os que conseguiu.
