from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "deploy" / "aws" / "lightsail_vm.json"


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


def get_access_details(config: dict[str, str]) -> dict[str, object]:
    completed = run(
        [
            "aws",
            "lightsail",
            "get-instance-access-details",
            "--region",
            config["region"],
            "--instance-name",
            config["instance_name"],
            "--protocol",
            "ssh",
            "--output",
            "json",
        ],
        capture=True,
    )
    payload = json.loads(completed.stdout)
    return dict(payload["accessDetails"])


def lock_down_windows_file(path: Path) -> None:
    subprocess.run(
        ["icacls", str(path), "/inheritance:r"],
        check=True,
        capture_output=True,
        text=True,
    )
    current_user = os.environ.get("USERNAME") or os.environ.get("USER") or ""
    if current_user:
        subprocess.run(
            ["icacls", str(path), "/grant:r", f"{current_user}:R"],
            check=True,
            capture_output=True,
            text=True,
        )


def ssh_base(config: dict[str, str], key_path: Path, known_hosts_path: Path) -> list[str]:
    return [
        "ssh",
        "-i",
        str(key_path),
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        f"UserKnownHostsFile={known_hosts_path}",
        "-o",
        "StrictHostKeyChecking=yes",
        f"{config['username']}@{config['public_ip']}",
    ]


def scp_base(config: dict[str, str], key_path: Path, known_hosts_path: Path) -> list[str]:
    return [
        "scp",
        "-i",
        str(key_path),
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        f"UserKnownHostsFile={known_hosts_path}",
        "-o",
        "StrictHostKeyChecking=yes",
    ]


def with_temp_credentials(config: dict[str, str], callback) -> int:
    access = get_access_details(config)
    with tempfile.TemporaryDirectory() as tmpdir:
        key_path = Path(tmpdir) / "lightsail"
        cert_path = Path(tmpdir) / "lightsail-cert.pub"
        known_hosts_path = Path(tmpdir) / "known_hosts"

        key_path.write_text(str(access["privateKey"]), encoding="utf-8", newline="\n")
        cert_path.write_text(str(access["certKey"]) + "\n", encoding="utf-8", newline="\n")
        lock_down_windows_file(key_path)
        lock_down_windows_file(cert_path)

        host_keys = access.get("hostKeys") or []
        known_hosts_lines = []
        for item in host_keys:
            if isinstance(item, dict) and item.get("algorithm") and item.get("publicKey"):
                known_hosts_lines.append(
                    f"{config['public_ip']} {item['algorithm']} {item['publicKey']}"
                )
        known_hosts_path.write_text(
            "\n".join(known_hosts_lines) + ("\n" if known_hosts_lines else ""),
            encoding="utf-8",
            newline="\n",
        )
        return callback(key_path, known_hosts_path)


def remote_run(args: argparse.Namespace) -> int:
    config = load_config()

    def callback(key_path: Path, known_hosts_path: Path) -> int:
        cmd = ssh_base(config, key_path, known_hosts_path) + [args.command]
        return subprocess.run(cmd, cwd=str(ROOT), check=False).returncode

    return with_temp_credentials(config, callback)


def remote_host_status(_args: argparse.Namespace) -> int:
    command = "hostname && date -u && uptime && free -h && df -h /"
    return remote_run(argparse.Namespace(command=command))


def remote_docker_status(_args: argparse.Namespace) -> int:
    command = "sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"
    return remote_run(argparse.Namespace(command=command))


def remote_upload(args: argparse.Namespace) -> int:
    config = load_config()

    def callback(key_path: Path, known_hosts_path: Path) -> int:
        local_path = Path(args.local_path).resolve()
        remote_target = f"{config['username']}@{config['public_ip']}:{args.remote_path}"
        cmd = scp_base(config, key_path, known_hosts_path) + [str(local_path), remote_target]
        return subprocess.run(cmd, cwd=str(ROOT), check=False).returncode

    return with_temp_credentials(config, callback)


def show_config(_args: argparse.Namespace) -> int:
    config = load_config()
    print(json.dumps(config, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acesso reutilizável à VM Lightsail usada para o Evolution API.")
    subparsers = parser.add_subparsers(dest="command_name", required=True)

    run_parser = subparsers.add_parser("run", help="Executa um comando remoto na VM.")
    run_parser.add_argument("command", help="Comando shell remoto.")
    run_parser.set_defaults(func=remote_run)

    host_parser = subparsers.add_parser("host-status", help="Mostra um resumo do host.")
    host_parser.set_defaults(func=remote_host_status)

    docker_parser = subparsers.add_parser("docker-status", help="Mostra os containers Docker em execucao.")
    docker_parser.set_defaults(func=remote_docker_status)

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
