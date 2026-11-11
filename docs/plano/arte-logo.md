# Mini-plano de arte: logo do Sistema Escolar

## Objetivo

Criar no Canva a logo do "Sistema Escolar" (app web de gestão escolar, do ensino fundamental ao doutorado) e exportar em PNG para o projeto.

Leia antes: `docs/plano/identidade-visual.md`.

## Descrição visual

- **Nome:** Sistema Escolar.
- **Símbolo:** um **livro aberto** com um **lápis**, combinados numa forma só (por exemplo, o lápis na diagonal sobre o livro, ou a ponta do lápis saindo do meio das páginas). Formas geométricas simples, poucos detalhes, sem sombras, sem degradê, sem contorno fino que suma em tamanho pequeno.
- **Estilo:** moderno e limpo, cara de ícone de aplicativo. Nada de brasão, mascote, ilustração realista ou clip-art.
- **Paleta:** azul `#1d4ed8` (principal), azul escuro `#1e3a8a` (texto), branco `#ffffff`. No máximo um tom de apoio azul claro `#93c5fd`.
- **Tipografia do nome:** sem serifa, peso semi-negrito, limpa (tipo Inter, Poppins ou Montserrat).
- **Legibilidade:** o símbolo precisa continuar reconhecível com 32 x 32 px (vai ser favicon e ícone de menu).

## Arquivos de saída

| Arquivo | Dimensões | Conteúdo |
|---|---|---|
| `assets/artes/logo_simbolo.png` | 512 x 512 px | Quadrado de cantos arredondados em azul `#1d4ed8` ocupando a imagem inteira, com o símbolo (livro aberto + lápis) em **branco**, centralizado, com margem interna de cerca de 18%. **Sem texto.** |
| `client/public/logo-simbolo.png` | 512 x 512 px | Cópia idêntica do arquivo acima. |
| `assets/artes/logo.png` | cerca de 1200 x 400 px | O mesmo símbolo à esquerda e o texto "Sistema Escolar" à direita, em azul escuro `#1e3a8a`, sobre fundo branco. |

O símbolo de `logo.png` tem de ser o mesmo desenho de `logo_simbolo.png`.

## Passos

1. Entre na sala `sistema_escolar` como `arte` e publique o entendimento.
2. Crie o símbolo no Canva (design quadrado de 512 x 512 px). Exporte como PNG.
3. Crie a versão horizontal (cerca de 1200 x 400 px) com o mesmo símbolo e o texto. Exporte como PNG.
4. Salve os três arquivos nos caminhos da tabela (crie as pastas `assets/artes` se não existirem).
5. Abra cada PNG salvo (Read) e confira: dimensões, símbolo reconhecível, texto escrito corretamente ("Sistema Escolar", com as duas maiúsculas), cores da paleta, nenhum texto no símbolo.

## Critérios de aceite

- Os três arquivos existem nos caminhos exatos e são PNG válidos.
- `logo_simbolo.png` e `client/public/logo-simbolo.png` são quadrados (512 x 512) e idênticos.
- O símbolo mostra um livro aberto e um lápis, em branco sobre azul `#1d4ed8`, sem texto.
- `logo.png` traz o texto "Sistema Escolar" sem erro de grafia.
- Nada de marca, nome ou personagem de terceiros.

## Se o Canva não estiver disponível

Não improvise com outra ferramenta nem deixe arquivo de mentira. Publique na sala `@main` dizendo exatamente o que falhou (conector desligado, sem permissão, erro de exportação) e pare.
