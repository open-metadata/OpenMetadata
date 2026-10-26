#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def assert_airflow_cache_repair(root: Path, profile: str) -> None:
    """Verify synchronization repairs installed files shared with a corrupt wheel cache."""
    for name in (
        ".github/scripts/python_ci.py",
        "scripts/python_environment.py",
        "ingestion/scripts/check_python_environment.py",
    ):
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)

    project = root / "ingestion"
    wheel = project / "apache_airflow_core-0.0.0-py3-none-any.whl"
    # The dependency fixture owns the same import path as Airflow core; uv and CI sync are real.
    files = {
        "airflow/__init__.py": "",
        "airflow/models/__init__.py": "class Connection:\n    value = 'healthy'\n",
        "apache_airflow_core-0.0.0.dist-info/METADATA": (
            "Metadata-Version: 2.1\nName: apache-airflow-core\nVersion: 0.0.0\n"
        ),
        "apache_airflow_core-0.0.0.dist-info/WHEEL": ("Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n"),
    }
    record = "apache_airflow_core-0.0.0.dist-info/RECORD"
    files[record] = "".join(f"{name},,\n" for name in (*files, record))
    with zipfile.ZipFile(wheel, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    config = (ROOT / "ingestion/pyproject.toml").read_text()
    pin = next(line for line in config.splitlines() if line.startswith("required-version ="))
    (project / "pyproject.toml").write_text(
        '[project]\nname = "ci-cache-repair-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.10"\n'
        f"[tool.uv]\n{pin}\npackage = false\n"
        '[tool.uv.sources]\napache-airflow-core = {path = "apache_airflow_core-0.0.0-py3-none-any.whl"}\n'
        "[dependency-groups]\n"
        'environment-check = ["packaging", "pip", "tomli>=2; python_version < \'3.11\'"]\n'
        'test = [{include-group = "environment-check"}, "apache-airflow-core==0.0.0"]\n'
        'api = [{include-group = "test"}]\n'
        "[tool.openmetadata.python-environments.profiles.test]\n"
        'groups = ["test"]\nextras = []\ninstall-project = false\n'
        "[tool.openmetadata.python-environments.profiles.api]\n"
        'groups = ["api"]\nextras = []\ninstall-project = false\n'
    )
    environment = os.environ.copy()
    for name in ("OM_PYTHON_SYNCED", "OM_GENERATION_PREPARED", "UV_PROJECT_ENVIRONMENT", "PYTHONPATH", "UV_NO_CACHE"):
        environment.pop(name, None)
    environment.update(
        OM_PYTHON_ENVIRONMENT=str(root / "env"),
        UV_CACHE_DIR=str(root / "cache"),
        UV_LINK_MODE="hardlink",
        PYTHONDONTWRITEBYTECODE="1",
    )

    def run(*command: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            command, cwd=root, env=environment, capture_output=True, text=True, check=False, timeout=120
        )

    def succeeds(*command: str) -> subprocess.CompletedProcess:
        result = run(*command)
        assert result.returncode == 0, result.stdout + result.stderr
        return result

    uv = shutil.which("uv")
    assert uv is not None, "Run from a locked development or test environment with uv installed"
    succeeds(uv, "lock", "--project", str(project), "--python", sys.executable)
    lock = (project / "uv.lock").read_bytes()
    command = (sys.executable, str(root / ".github/scripts/python_ci.py"), "sync", "--profile", profile)
    succeeds(*command)
    python = str(root / "env/bin/python")
    probe = (
        "from airflow.models import Connection; from importlib.metadata import version; "
        "assert Connection.value == 'healthy'; assert version('apache-airflow-core') == '0.0.0'"
    )
    succeeds(python, "-I", "-c", probe)
    installed = next((root / "env/lib").glob("python*/site-packages/airflow/models/__init__.py"))
    cached = [path for path in (root / "cache").rglob("airflow/models/__init__.py") if path.samefile(installed)]
    assert cached, "Fixture must exercise the installed-file/wheel-cache hardlink collision"
    installed.write_text("raise ImportError('corrupt cached Airflow fixture')\n")
    assert run(python, "-I", "-c", probe).returncode != 0

    succeeds(*command)

    succeeds(python, "-I", "-c", probe)
    assert (project / "uv.lock").read_bytes() == lock


def test_full_dependency_install_repairs_and_validates_airflow() -> None:
    for profile in ("test", "api"):
        with tempfile.TemporaryDirectory(prefix="om-airflow-cache-") as directory:
            assert_airflow_cache_repair(Path(directory), profile)


if __name__ == "__main__":
    test_full_dependency_install_repairs_and_validates_airflow()
