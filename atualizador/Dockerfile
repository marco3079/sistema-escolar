# Atualizador do Sistema Escolar: baixa o código novo do GitHub e reconstrói a API e o site.
# Usa o Docker do computador (soquete montado pelo Compose). Não tem dependências npm.
FROM docker:27-cli

RUN apk add --no-cache git nodejs

COPY Dockerfile servidor.mjs /app/

EXPOSE 4000
# A imagem base tem um ponto de entrada que trata o comando como subcomando do docker; por isso ENTRYPOINT.
ENTRYPOINT ["node", "/app/servidor.mjs"]
