# Oracle VM Access

## Objetivo

Este projeto agora tem uma copia local do acesso reutilizavel para a VM Oracle Cloud que hoje hospeda o `GarimpeAI` e que foi preparada para futura migracao operacional do `Gestao Facil`.

## Arquivos criados

- `deploy/oracle/oracle_vm.json`
- `scripts/oracle_vm.py`

## O que esta salvo

No arquivo `deploy/oracle/oracle_vm.json`:

- region: `sa-saopaulo-1`
- availability_domain: `AD-1`
- instance_name: `vm-masterjefe`
- shape: `VM.Standard.A1.Flex`
- architecture: `aarch64`
- public_ip: `147.15.59.187`
- username: `ubuntu`
- ssh_private_key_path: `C:\Projetos\ssh-key-2026-05-25.key`
- app_root: `/opt/apps/gestaofacil`

Observacoes:

- a VM e compartilhada com o projeto `GarimpeAI`
- esta maquina usa `ARM / aarch64`, entao qualquer binario nativo novo deve ser validado nela
- a chave SSH nao fica no repositorio, apenas o caminho local dela

## Estado confirmado em 2026-05-25

Durante a validacao de `2026-05-25` foi confirmado que:

- a VM responde via SSH com o usuario `ubuntu`
- o host remoto e `vm-masterjefe`
- a arquitetura da maquina e `aarch64`
- a estrutura base do `Gestao Facil` foi criada em `/opt/apps/gestaofacil`
- as pastas atuais sao:
  - `/opt/apps/gestaofacil/repo.git`
  - `/opt/apps/gestaofacil/repo`
  - `/opt/apps/gestaofacil/shared`
  - `/opt/apps/gestaofacil/backups`
  - `/opt/apps/gestaofacil/runtime`

## Comandos uteis

Mostrar configuracao:

```powershell
python scripts/oracle_vm.py config
```

Ver estado basico do host:

```powershell
python scripts/oracle_vm.py host-status
```

Ver estrutura remota do app:

```powershell
python scripts/oracle_vm.py app-status
```

Executar comando remoto:

```powershell
python scripts/oracle_vm.py run "hostname && free -h && df -h /"
```

Enviar arquivo para a VM:

```powershell
python scripts/oracle_vm.py upload deploy/evolution/docker-compose.yml /opt/apps/gestaofacil/repo/deploy/evolution/docker-compose.yml
```

## Proximo uso esperado

O uso mais provavel desta VM para o `Gestao Facil` e:

- migrar a stack do `Evolution API` que hoje roda na AWS
- decidir se o app principal continuara em `Vercel` com banco no `Neon`, ou se uma parte maior da operacao tambem vai para a Oracle
- preparar um fluxo de deploy proprio do projeto dentro de `/opt/apps/gestaofacil`
