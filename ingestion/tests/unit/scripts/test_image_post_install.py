#  Copyright 2021 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Behavioral checks for runtime-image post-install dependency handling."""

import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
POST_INSTALL_DIR = REPO_ROOT / "ingestion" / "scripts" / "image_post_install"
DOCKERFILES = (
    REPO_ROOT / "ingestion" / "Dockerfile",
    REPO_ROOT / "ingestion" / "Dockerfile.ci",
    REPO_ROOT / "ingestion" / "operators" / "docker" / "Dockerfile",
    REPO_ROOT / "ingestion" / "operators" / "docker" / "Dockerfile.ci",
)


def run_script(script: Path, site_packages: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["IMAGE_POST_INSTALL_PYTHON"] = sys.executable
    env["PYTHONPATH"] = str(site_packages)
    return subprocess.run(
        ["bash", str(script)],
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )


def test_apply_is_a_noop_when_optional_packages_are_absent(tmp_path: Path) -> None:
    result = run_script(POST_INSTALL_DIR / "apply.sh", tmp_path)

    assert result.returncode == 0, result.stderr
    assert "adbc-driver-flightsql not installed" in result.stdout
    assert "teradatasql not installed" in result.stdout


def test_flightsql_override_rejects_an_unreviewed_wrapper_version(
    tmp_path: Path,
) -> None:
    dist_info = tmp_path / "adbc_driver_flightsql-1.12.1.dist-info"
    dist_info.mkdir()
    (dist_info / "METADATA").write_text(
        "Metadata-Version: 2.1\nName: adbc-driver-flightsql\nVersion: 1.12.1\n",
        encoding="utf-8",
    )

    result = run_script(POST_INSTALL_DIR / "install_flightsql_registry_override.sh", tmp_path)

    assert result.returncode != 0
    assert "expected adbc-driver-flightsql 1.12.0, found 1.12.1" in result.stderr
    assert "remove this temporary override" in result.stderr


def test_teradata_pruner_keeps_runtime_libraries(tmp_path: Path) -> None:
    if platform.system() != "Linux" or platform.machine() not in {"x86_64", "amd64"}:
        return

    package_dir = tmp_path / "teradatasql"
    package_dir.mkdir()
    libc = Path("/lib/x86_64-linux-gnu/libc.so.6")
    if not libc.exists():
        libc = Path("/usr/lib/x86_64-linux-gnu/libc.so.6")
    assert libc.exists()

    shutil.copy2(libc, package_dir / "teradatasql.so")
    (package_dir / "teradatasql.fips.so").write_bytes(b"fips")
    (package_dir / "teradatasql.arm.so").write_bytes(b"arm")
    (package_dir / "teradatasql.aix.so").write_bytes(b"aix")

    result = run_script(POST_INSTALL_DIR / "prune_teradatasql_platform_libs.sh", tmp_path)

    assert result.returncode == 0, result.stderr
    assert (package_dir / "teradatasql.so").exists()
    assert (package_dir / "teradatasql.fips.so").exists()
    assert not (package_dir / "teradatasql.arm.so").exists()
    assert not (package_dir / "teradatasql.aix.so").exists()


def test_release_images_use_only_the_central_post_install_entrypoint() -> None:
    for dockerfile in DOCKERFILES:
        contents = dockerfile.read_text(encoding="utf-8")
        last_ingestion_install = max(
            contents.rfind("openmetadata-ingestion["),
            contents.rfind('pip install ".['),
        )
        central_apply = contents.find("image_post_install/apply.sh")
        invoked_scripts = set(re.findall(r"/tmp/image_post_install/[A-Za-z0-9_.-]+", contents))

        assert central_apply > last_ingestion_install, dockerfile
        assert contents.count("image_post_install/apply.sh") == 1, dockerfile
        assert invoked_scripts == {"/tmp/image_post_install/apply.sh"}, dockerfile
        assert "ingestion/scripts/image_post_install/" not in contents, dockerfile
        assert "strip_spacy_test_fixture.sh" not in contents, dockerfile
        assert "strip_teradatasql_arch_libs.sh" not in contents, dockerfile
