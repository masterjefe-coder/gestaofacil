# New PC Setup

## Objetivo

Deixar outro PC pronto para continuar a operacao do `Gestao Facil` com:

- acesso SSH a VM Oracle
- OCI CLI autenticada
- repositorio local funcional
- deploy web via Git para a Oracle

## O que fica fora do Git

Estes arquivos nao devem ser versionados:

- chave SSH principal da VM Oracle
- chave SSH reserva da VM Oracle
- chave privada da API da OCI
- arquivo real `~/.oci/config`

No PC atual, os caminhos usados sao:

- `C:\Projetos\oci_recuperacao`
- `C:\Projetos\oci_reserva_recuperacao`
- `C:\Projetos\oci-api\oci_api_key.pem`
- `C:\Users\mta999998\.oci\config`

## Ordem recomendada

1. instalar `Git`
2. instalar `Node.js` LTS
3. instalar a `OCI CLI`
4. clonar o repositorio
5. copiar as chaves privadas para uma pasta local segura
6. recriar `~/.oci/config`
7. validar `SSH`
8. validar `OCI CLI`
9. validar o deploy via Git

## Clonar o projeto

```powershell
git clone https://github.com/masterjefe-coder/gestaofacil.git "C:\Projetos\Gestão Fácil"
cd "C:\Projetos\Gestão Fácil"
npm install
```

## SSH da VM Oracle

Chave principal:

```powershell
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187
```

Chave reserva:

```powershell
ssh -i C:\Projetos\oci_reserva_recuperacao ubuntu@147.15.59.187
```

## OCI CLI

Validar instalacao:

```powershell
& "C:\Program Files (x86)\Oracle\oci_cli\oci.exe" --version
```

Recriar o config:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-oci-cli.ps1 `
  -UserOcid "ocid1.user.oc1...." `
  -TenancyOcid "ocid1.tenancy.oc1...." `
  -Fingerprint "xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx" `
  -KeyFile "C:\Projetos\oci-api\oci_api_key.pem"
```

Validar autenticacao:

```powershell
& "C:\Program Files (x86)\Oracle\oci_cli\oci.exe" iam region-subscription list --all
```

## Deploy via Git para a Oracle

Fluxo recomendado:

1. trabalhar localmente
2. commitar no branch desejado
3. publicar no GitHub
4. publicar o mesmo commit na VM Oracle via Git
5. buildar na propria VM

Se quiser fazer push para GitHub e deploy Oracle em sequencia:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\push-and-deploy-web.ps1 -Remote origin -Branch main
```

Se o commit local ja estiver pronto e voce quiser apenas publicar na Oracle:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-web-oracle.ps1 -Branch main
```

## Arquivos para continuidade

- `README.md`
- `docs/OCI-SSH-RECOVERY.md`
- `docs/ORACLE-VM-DEPLOY.md`
- `ORACLE-MIGRATION.md`
- `ORACLE-VM-ACCESS.md`
- `deploy/oracle/README.md`
- `deploy/oracle/oracle_vm.example.json`
