# AWS VM Access

## Objetivo

Este projeto agora tem uma copia local do acesso reutilizavel para a VM AWS Lightsail que hoje tambem hospeda o `Bot-Trader` e que foi validada para hospedar o `Evolution API`.

## Arquivos criados

- `deploy/aws/lightsail_vm.json`
- `scripts/lightsail_vm.py`
- `deploy/evolution/docker-compose.yml`
- `deploy/evolution/.env.example`

## O que esta salvo

No arquivo `deploy/aws/lightsail_vm.json`:

- region: `us-east-1`
- instance_name: `traderjefe-bot-large-dualstack`
- public_ip: `3.91.115.172`
- username: `ubuntu`

Observacao:

- as chaves SSH nao ficam gravadas no repositorio
- o script busca credenciais temporarias via `aws lightsail get-instance-access-details`

## Pre-requisitos locais

- `aws cli` instalado e autenticado
- `ssh` disponivel no Windows
- permissao na conta AWS para consultar `Lightsail`

## Comandos uteis

Mostrar configuracao:

```powershell
python scripts/lightsail_vm.py config
```

Ver estado basico do host:

```powershell
python scripts/lightsail_vm.py host-status
```

Ver containers Docker:

```powershell
python scripts/lightsail_vm.py docker-status
```

Executar comando remoto:

```powershell
python scripts/lightsail_vm.py run "hostname && free -h && df -h /"
```

Enviar arquivo para a VM:

```powershell
python scripts/lightsail_vm.py upload deploy/evolution/docker-compose.yml /home/ubuntu/evolution-api/docker-compose.yml
```

## Contexto atual da VM

Durante a validacao de 2026-05-20 foi confirmado que:

- Docker foi instalado com sucesso
- a VM segue saudavel com o `Bot-Trader`
- a stack reproduzivel do `Evolution API` foi publicada em `/home/ubuntu/evolution-api`
- a API publica responde em `http://3.91.115.172:8081`
- a instancia `gestao-facil-demo` foi criada e entrou em `connecting` apos gerar o pareamento
- o webhook publico do app responde em `https://www.gestaofacilsistemas.com.br/api/evolution/webhook`

## Proximo uso esperado

Concluir o pareamento do WhatsApp da instancia `gestao-facil-demo`, validar envio real de mensagem e depois evoluir a persistencia dos eventos recebidos por webhook.
