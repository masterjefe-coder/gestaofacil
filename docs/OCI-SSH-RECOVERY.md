# OCI SSH Recovery

## VM principal

- instancia: `vm-masterjefe`
- IP publico validado em `2026-05-26`: `147.15.59.187`
- usuario: `ubuntu`
- shape: `VM.Standard.A1.Flex`
- configuracao validada: `4 OCPU / 24 GB RAM`
- sistema: `Ubuntu 24.04 Minimal aarch64`

## Chaves de acesso configuradas

As chaves privadas nao ficam neste repositorio.

Chave principal:

- arquivo privado local: `C:\Projetos\oci_recuperacao`
- fingerprint: `SHA256:0sp5/+ZbdbAkIu2pZZKSH0JnegoUntT4YrLLXK8xGwM`
- comentario publico: `recuperacao-oci`

Chave reserva:

- arquivo privado local: `C:\Projetos\oci_reserva_recuperacao`
- fingerprint: `SHA256:shJKIKOfck91ivW2rss5XVL99xEooiMeh3E4L4H3BGI`
- comentario publico: `oci-reserva-recuperacao`

## Comandos de acesso

Principal:

```powershell
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187
```

Reserva:

```powershell
ssh -i C:\Projetos\oci_reserva_recuperacao ubuntu@147.15.59.187
```

## OCI CLI local

- executavel validado neste PC: `C:\Program Files (x86)\Oracle\oci_cli\oci.exe`
- versao validada em `2026-05-26`: `3.83.0`
- config local: `C:\Users\mta999998\.oci\config`
- a chave privada da API da OCI fica fora do repositorio

Comandos uteis:

```powershell
& "C:\Program Files (x86)\Oracle\oci_cli\oci.exe" --version
& "C:\Program Files (x86)\Oracle\oci_cli\oci.exe" iam region-subscription list --all
& "C:\Program Files (x86)\Oracle\oci_cli\oci.exe" compute instance get --instance-id ocid1.instance.oc1.sa-saopaulo-1.antxeljr6hlhm5ycb3vlqsh6astyagyto75frakss2vvnbxekmncecud72bq
```

## Estado operacional validado

Validado por SSH em `2026-05-26`:

- `ssh.service` ativo
- `caddy.service` ativo
- `postgresql@16-main.service` ativo
- `docker.service` ativo
- `gestaofacil-web.service` ativo
- stack local da `Evolution API` ativa em Docker

Topologia observada:

- app `Gestao Facil` via `systemd`
- diretorio de trabalho: `/opt/apps/gestaofacil/web`
- arquivo de ambiente: `/opt/apps/gestaofacil/shared/app.env`
- app ouvindo em `127.0.0.1:3002`
- `Caddy` publicando `https://www.gestaofacilsistemas.com.br`
- `Evolution API` local em `127.0.0.1:8081`

Comandos uteis de verificacao:

```powershell
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187 "systemctl status gestaofacil-web --no-pager"
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187 "docker ps"
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187 "curl -I http://127.0.0.1:3002"
ssh -i C:\Projetos\oci_recuperacao ubuntu@147.15.59.187 "curl -I https://www.gestaofacilsistemas.com.br"
```

## Recovery por boot volume

Fluxo validado quando a chave antiga foi perdida:

1. criar uma VM Ubuntu de resgate com acesso SSH
2. parar a VM principal
3. desanexar o boot volume da VM principal
4. anexar esse boot volume na VM de resgate como `Paravirtualized` e `Read/write`
5. na VM de resgate, localizar o disco com `lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT`
6. montar a particao raiz em `/mnt/rescue`
7. corrigir `authorized_keys`, owner e permissoes do usuario correto
8. desmontar o volume com seguranca
9. desanexar da VM de resgate
10. recolocar como boot volume da VM principal
11. subir a VM principal e validar o SSH

Observacao importante:

- nesta recuperacao, o usuario `ubuntu` da VM principal usava `UID/GID 1001`
- o diretorio `/home/ubuntu/.ssh` estava com owner incorreto
- sem owner e permissoes corretos, o `sshd` rejeita a chave mesmo com o `authorized_keys` correto

## Observacao final

Nao versionar nem subir chaves privadas para Git, pasta compartilhada, drive publico ou dentro da propria VM.
