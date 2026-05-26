# Oracle VM Access

## Objetivo

Centralizar o acesso reutilizavel da VM Oracle Cloud usada pelo `Gestao Facil`.

## O que esta salvo no projeto

- `deploy/oracle/oracle_vm.example.json`
- `docs/OCI-SSH-RECOVERY.md`
- `docs/ORACLE-VM-DEPLOY.md`
- `docs/NEW-PC-SETUP.md`

## Configuracao atual conhecida

No arquivo `deploy/oracle/oracle_vm.example.json`:

- region: `sa-saopaulo-1`
- availability_domain: `AD-1`
- instance_name: `vm-masterjefe`
- shape: `VM.Standard.A1.Flex`
- architecture: `aarch64`
- public_ip: `147.15.59.187`
- username: `ubuntu`
- ssh_private_key_path: `C:\Projetos\oci_recuperacao`
- app_root: `/opt/apps/gestaofacil`

## Observacoes

- a VM e `ARM / aarch64`
- a chave SSH nao fica no repositorio, apenas o caminho esperado
- o acesso atual foi recuperado e validado em `2026-05-26`

## Comando principal de acesso

```powershell
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187
```

## Continuidade

Para outro PC, seguir primeiro:

- `docs/NEW-PC-SETUP.md`

Para detalhes de recovery:

- `docs/OCI-SSH-RECOVERY.md`
