# Mini-plano g06: tela de login

## Objetivo

Refazer a tela de login no mesmo visual do exemplo do usuário (o exemplo não mostra o login; siga as cores, os cantos, as sombras e a tipografia dele).

Leia antes: `docs/plano/redesenho.md` (seções "Como é o exemplo" e "Contrato visual"); abra a referência `.claude/referencias/exemplo.png` (Read) para absorver o estilo; leia `client/src/layout/Login.tsx` (versão atual), `client/src/lib/auth.tsx` e `client/src/ui/index.tsx`.

## Arquivos que você pode criar ou editar (e só estes)

- `client/src/layout/Login.tsx` (reescrever a parte visual; a lógica de entrar e redirecionar continua a mesma)
- `client/src/layout/login.css` (novo; importado por `Login.tsx`)

## Regras gerais

- Classes novas começam com `entrada-`. Cores, raios e sombras só pelas variáveis do contrato visual. Nenhuma cor fixa em `login.css`, salvo `rgba` em sombras.
- Não mude o comportamento: mesmos campos (e-mail e senha), mesmo `entrar(email, senha)` de `useAuth`, mesmo redirecionamento por perfil, mesmo erro em `<Aviso tipo="erro">`. Mantenha o que `Login.tsx` exporta hoje.

## Passos

1. **Layout em duas colunas a partir de 900 px** (uma coluna abaixo disso), ocupando a altura toda da tela (`min-height: 100dvh`), fundo `var(--cor-fundo)`.
2. **Coluna da esquerda (painel de marca)**: só a partir de 900 px. Fundo `var(--gradiente-primario)`, texto branco, padding de 3rem, com:
   - a logo `/logo-simbolo.png` (56 px, raio 22%) e "Sistema Escolar" (peso 800, 1.4rem);
   - no meio, a frase "Construindo um futuro melhor." (2.2rem, peso 800, largura máxima de 14 caracteres por linha) e o texto "Do ensino fundamental ao doutorado, em um só lugar." (opacidade 0.85);
   - três linhas de destaque com os ícones `alunos`, `boletim` e `calendario` (brancos, 20 px): "Portais do aluno, do professor e administrativo", "Notas, frequência e boletim", "Horários, calendário e comunicados";
   - como fundo, a ilustração `/ilustracoes/capelo.png` no canto inferior direito, com `opacity: 0.18` e `mix-blend-mode: luminosity` (se o arquivo não existir, fica só o degradê).
3. **Coluna da direita (formulário)**: centralizada na vertical; um cartão com largura máxima de 420 px, fundo `var(--cor-superficie)`, borda `var(--cor-borda)`, raio `var(--raio)`, sombra `var(--sombra)` e padding de 2rem, com:
   - no celular (abaixo de 900 px), a logo (56 px) e "Sistema Escolar" no topo do cartão; em telas largas, só o título;
   - título "Entrar" (1.6rem, peso 800) e o texto "Use seu e-mail e sua senha." (suave);
   - os campos com os componentes `Campo` (e-mail com `tipo="email"`, senha com `tipo="password"`, ambos obrigatórios);
   - o botão "Entrar" com `Botao` primário ocupando a largura toda (use uma classe `entrada-botao` num contêiner, sem alterar o componente); enquanto envia, o botão fica desabilitado e mostra "Entrando...";
   - o erro em `<Aviso tipo="erro">` acima do botão.
4. `autocomplete`: se o componente `Campo` não aceitar esse atributo, não altere o componente; deixe como está.
5. Rode a verificação.

## Critérios de aceite

- Login funciona como antes (mesma lógica e mesmos redirecionamentos).
- Duas colunas a partir de 900 px; uma coluna com o cartão centralizado no celular; sem rolagem horizontal em 360 px.
- Legível nos temas claro e escuro.
- Nenhuma cor fixa em `login.css` (salvo `rgba` de sombras).
- `cd client && npx tsc --noEmit` com zero erro em `src/layout/Login.tsx` e `npx vite build` sem erro (apague `client/dist`).

## Verificação

```
cd client
npx tsc --noEmit
npx vite build
```

Não rode `npm install`, não suba Docker nem servidor.
