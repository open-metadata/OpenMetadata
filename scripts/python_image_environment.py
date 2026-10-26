#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Export the final image dependency selection from its checked lock."""

import argparse
import email
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

from build_python_artifacts import verify_hashes
from python_environment import uv_version

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "ingestion/images/runtime"
DEPENDENCIES = [
    "openmetadata-ingestion[airflow]",
    "apache-airflow-providers-docker",
    "apache-airflow-providers-cncf-kubernetes",
    "apache-airflow-providers-smtp",
    "python-daemon>=3.0.0",
    "aiomysql>=0.3.2",
    "asyncpg>=0.31.0",
    "psycopg2==2.9.13",
    "pip>=26.2.2,<27",
    "setuptools>=83",
    "uv==0.13.4",
]


def artifact_extras(artifacts):
    """Read the actual setuptools-composed extras from the built ingestion wheel."""
    verify_hashes(artifacts)
    wheels = list(artifacts.glob("openmetadata_ingestion-*.whl"))
    if len(wheels) != 1:
        raise ValueError("Expected exactly one ingestion wheel")
    with zipfile.ZipFile(wheels[0]) as archive:
        names = [name for name in archive.namelist() if name.endswith(".dist-info/METADATA")]
        metadata = email.message_from_bytes(archive.read(names[0]))
    return sorted(metadata.get_all("Provides-Extra", []))


def manifest(extras):
    """Render dependency aliases while preserving setup.py as composition authority."""
    application = tomllib.loads((ROOT / "ingestion/pyproject.toml").read_text())
    dependencies = [*DEPENDENCIES, *application["dependency-groups"]["dialect-compat"]]
    lines = [
        "# Generated aliases: python scripts/python_image_environment.py manifest --artifacts DIR --write",
        "[project]",
        'name = "openmetadata-image-environment"',
        'version = "0.0.0"',
        'requires-python = ">=3.12,<3.13"',
        "dependencies = " + json.dumps(dependencies, indent=4),
        "",
        "[project.optional-dependencies]",
    ]
    lines += [f"{json.dumps(name)} = [{json.dumps('openmetadata-ingestion[' + name + ']')}]" for name in extras]
    lines += [
        "",
        "[dependency-groups]",
        'managed-api = ["openmetadata-managed-apis", "py-spy", "virtualenv>=21.14.12", "mysqlclient==2.1.1"]',
        "",
        "[tool.uv]",
        f'required-version = "=={uv_version()}"',
        "package = false",
        "default-groups = []",
        "environments = [\"sys_platform == 'linux'\"]",
        "required-environments = [\"sys_platform == 'linux' and platform_machine == 'x86_64'\", \"sys_platform == 'linux' and platform_machine == 'aarch64'\"]",
        'exclude-dependencies = ["psycopg2-binary"]',
        "",
        "[tool.uv.sources]",
        'openmetadata-ingestion = {path = "../.."}',
        'openmetadata-managed-apis = {path = "../../../openmetadata-airflow-apis"}',
    ]
    # The Doris PyMySQL adapter replaces mysqlclient only in the image environment.
    for entry in [
        *application["tool"]["uv"]["dependency-metadata"],
        {
            "name": "pydoris",
            "version": "1.2.0",
            "requires-dist": [
                "sqlalchemy>=1.4",
                "sqlalchemy-utils>=0.38.3",
                "requests",
                "pymysql~=1.0",
            ],
        },
    ]:
        lines += ["", "[[tool.uv.dependency-metadata]]"]
        lines += [f"{name} = {json.dumps(value)}" for name, value in entry.items()]
    return "\n".join(lines) + "\n"


def export(artifacts, output, extras, kind, architecture):
    """Produce hash-checked requirements and metadata policy for one image selection."""
    available = artifact_extras(artifacts)
    if (PROJECT / "pyproject.toml").read_text() != manifest(available):
        raise ValueError("Image aliases/policy are stale; refresh the manifest and image lock explicitly")
    selected = sorted({re.sub(r"[-_.]+", "-", name.lower()) for name in extras.split(",") if name})
    canonical_extras = {re.sub(r"[-_.]+", "-", name.lower()) for name in available}
    if set(selected) - canonical_extras:
        raise ValueError(f"Unknown INGESTION_DEPENDENCY selection: {extras}")
    if architecture == "amd64":
        selected = sorted(set(selected) | {"db2"})
    elif "db2" in selected:
        raise ValueError("The DB2 native driver is not supported in the ARM image")
    output.mkdir(parents=True, exist_ok=True)
    data = tomllib.loads((PROJECT / "pyproject.toml").read_text())
    command = [
        shutil.which("uv") or "uv",
        "export",
        "--locked",
        "--project",
        str(PROJECT),
        "--no-emit-local",
        "--no-annotate",
        "--no-header",
    ]
    for name in selected:
        command += ["--extra", name]
    if kind == "airflow":
        command += ["--group", "managed-api"]
    with (output / "requirements.txt").open("w") as stream:
        subprocess.run(command, check=True, stdout=stream, timeout=300, cwd=ROOT)
    requirements = (output / "requirements.txt").read_text()
    if " @ " in requirements or "-e " in requirements:
        raise ValueError("Image export contains a source dependency")
    tools = []
    selected_tool = False
    for line in requirements.splitlines(True):
        if line and not line[0].isspace():
            selected_tool = line.startswith(("pip==", "setuptools=="))
        if selected_tool:
            tools.append(line)
    (output / "bootstrap-tools.txt").write_text("".join(tools))
    roots = [*data["project"]["dependencies"], *[f"openmetadata-ingestion[{name}]" for name in selected]]
    if kind == "airflow":
        roots += data["dependency-groups"]["managed-api"]
    source_psycopg2 = next(
        value.split("==")[1] for value in data["project"]["dependencies"] if value.startswith("psycopg2==")
    )
    policy = {
        "extras": ["airflow", *selected],
        "roots": roots,
        "source-psycopg2": source_psycopg2,
        "lock-sha256": hashlib.sha256((PROJECT / "uv.lock").read_bytes()).hexdigest(),
        "kind": kind,
        "architecture": architecture,
    }
    (output / "policy.json").write_text(json.dumps(policy, indent=2) + "\n")
    shutil.copyfile(ROOT / "ingestion/build-constraints.txt", output / "build-constraints.txt")
    (output / "lock.sha256").write_text(policy["lock-sha256"] + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["manifest", "export"])
    parser.add_argument("--artifacts", required=True, type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--kind", choices=["airflow", "operator"], default="airflow")
    parser.add_argument(
        "--architecture", choices=["amd64", "arm64"], default="amd64" if platform.machine() == "x86_64" else "arm64"
    )
    parser.add_argument("--extras", default=os.environ.get("INGESTION_DEPENDENCY", "all"))
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.command == "manifest":
        expected = manifest(artifact_extras(args.artifacts.resolve()))
        if args.write:
            PROJECT.mkdir(parents=True, exist_ok=True)
            (PROJECT / "pyproject.toml").write_text(expected)
        elif (PROJECT / "pyproject.toml").read_text() != expected:
            raise ValueError("Image manifest is stale")
    else:
        if args.output_dir is None or args.write:
            parser.error("export requires --output-dir and does not accept --write")
        export(args.artifacts.resolve(), args.output_dir.resolve(), args.extras, args.kind, args.architecture)


if __name__ == "__main__":
    main()
