# Evolution API na Lightsail

Este diretório guarda a stack reproduzível usada para subir a `Evolution API` na VM AWS compartilhada do projeto.

## Arquivos

- `docker-compose.yml`
- `.env.example`

## Premissas

- a stack roda isolada da stack de teste antiga
- a compose sobe com bind configurável por `.env`
- hoje a instância validada neste projeto está publicada em `http://3.91.115.172:8081`
- o app público que recebe webhook está em `https://www.gestaofacilsistemas.com.br`

## Fluxo recomendado

1. copiar `.env.example` para `.env`
2. trocar `AUTHENTICATION_API_KEY` e `POSTGRES_PASSWORD`
3. ajustar `SERVER_URL` e `EVOLUTION_HOST_PORT` se necessário
4. subir com `docker compose up -d`
5. validar com `curl http://127.0.0.1:8081`
6. se for expor publicamente, abrir a porta na Lightsail e ajustar `EVOLUTION_BIND_IP` + `SERVER_URL`

## Próximo encaixe no app

Depois do deploy, o `Gestao Facil` pode apontar para a API via:

- `EVOLUTION_API_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_API_INSTANCE`

## Estado atual validado

- versão ativa: `evoapicloud/evolution-api:v2.3.7`
- endpoint público validado: `http://3.91.115.172:8081`
- instância operacional atual: `ofertas-do-ton`
- webhook validado: `https://www.gestaofacilsistemas.com.br/api/evolution/webhook`
