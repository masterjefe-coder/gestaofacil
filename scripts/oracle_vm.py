from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "deploy" / "oracle" / "oracle_vm.json"


def load_config() -> dict[str, str]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def run(cmd: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(ROOT),
        check=True,
        text=True,
        capture_output=capture,
    )


def ssh_base(config: dict[str, str]) -> list[str]:
    return [
        "ssh",
        "-i",
        config["ssh_private_key_path"],
        "-o",
        "StrictHostKeyChecking=accept-new",
        f"{config['username']}@{config['public_ip']}",
    ]


def scp_base(config: dict[str, str]) -> list[str]:
    return [
        "scp",
        "-i",
        config["ssh_private_key_path"],
        "-o",
        "StrictHostKeyChecking=accept-new",
    ]


def remote_run(args: argparse.Namespace) -> int:
    config = load_config()
    cmd = ssh_base(config) + [args.command]
    return subprocess.run(cmd, cwd=str(ROOT), check=False).returncode


def remote_host_status(_args: argparse.Namespace) -> int:
    command = "hostname && date -u && uptime && free -h && df -h / && uname -m"
    return remote_run(argparse.Namespace(command=command))


def remote_app_status(_args: argparse.Namespace) -> int:
    config = load_config()
    app_root = config["app_root"]
    command = (
        f"ls -ld {app_root} {app_root}/repo {app_root}/repo.git {app_root}/shared "
        f"{app_root}/backups {app_root}/runtime"
    )
    return remote_run(argparse.Namespace(command=command))


def remote_upload(args: argparse.Namespace) -> int:
    config = load_config()
    local_path = Path(args.local_path).resolve()
    remote_target = f"{config['username']}@{config['public_ip']}:{args.remote_path}"
    cmd = scp_base(config) + [str(local_path), remote_target]
    return subprocess.run(cmd, cwd=str(ROOT), check=False).returncode


def show_config(_args: argparse.Namespace) -> int:
    config = load_config()
    print(json.dumps(config, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acesso reutilizável à VM Oracle usada pelo Gestao Facil.")
    subparsers = parser.add_subparsers(dest="command_name", required=True)

    run_parser = subparsers.add_parser("run", help="Executa um comando remoto na VM.")
    run_parser.add_argument("command", help="Comando shell remoto.")
    run_parser.set_defaults(func=remote_run)

    host_parser = subparsers.add_parser("host-status", help="Mostra um resumo do host.")
    host_parser.set_defaults(func=remote_host_status)

    app_parser = subparsers.add_parser("app-status", help="Mostra a estrutura remota do Gestao Facil.")
    app_parser.set_defaults(func=remote_app_status)

    upload_parser = subparsers.add_parser("upload", help="Envia um arquivo local para a VM via SCP.")
    upload_parser.add_argument("local_path", help="Caminho local do arquivo.")
    upload_parser.add_argument("remote_path", help="Destino remoto completo.")
    upload_parser.set_defaults(func=remote_upload)

    config_parser = subparsers.add_parser("config", help="Mostra a configuracao local desta VM.")
    config_parser.set_defaults(func=show_config)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
