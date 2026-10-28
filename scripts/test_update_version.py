"""Release version bump (`make update_all`)."""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "update_version.py"

# Every file `make update_all` rewrites outside Maven, with the targets that rewrite them.
BUMPED_FILES = (
    "openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java",
    "ingestion/pyproject.toml",
    "openmetadata-airflow-apis/pyproject.toml",
    "docker/docker-compose-ingestion/docker-compose-ingestion.yml",
    "docker/docker-compose-openmetadata/docker-compose-openmetadata.yml",
    "docker/docker-compose-quickstart/docker-compose-postgres.yml",
    "docker/docker-compose-quickstart/docker-compose.yml",
    "ingestion/Dockerfile",
    "ingestion/operators/docker/Dockerfile",
    "docker/docker-compose-quickstart/Dockerfile",
)
# A line that names an OpenMetadata version, in any of the files above.
VERSION_LINE = re.compile(r'getcollate\.io/openmetadata/|ARG\s+RI_VERSION=|^version\s*=|^\s*version = "')


def run_script(*args, cwd):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )


def release_tree(tmp_path):
    """The files `make update_all` rewrites, with a `mvn` stub so the Maven step is a no-op."""
    for relative in BUMPED_FILES + ("Makefile",):
        copy = tmp_path / relative
        copy.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, copy)
    (tmp_path / "scripts").symlink_to(ROOT / "scripts")
    (tmp_path / "ingestion" / "Makefile").touch()
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "mvn").write_text("#!/bin/sh\nexit 0\n")
    (bin_dir / "mvn").chmod(0o755)
    return tmp_path


def run_update_all(tree):
    return subprocess.run(
        ["make", "update_all", "RELEASE_VERSION=9.8.7"],
        cwd=tree,
        env={**os.environ, "PATH": f"{tree / 'bin'}{os.pathsep}{os.environ['PATH']}"},
        text=True,
        capture_output=True,
        check=False,
    )


def test_release_bump_rewrites_every_version_line(tmp_path):
    tree = release_tree(tmp_path)

    result = run_update_all(tree)

    assert result.returncode == 0, result.stdout + result.stderr
    for relative in BUMPED_FILES:
        text = (tree / relative).read_text()
        lines = [line for line in text.splitlines() if VERSION_LINE.search(line)]
        assert lines, relative
        stale = [line for line in lines if "9.8.7" not in line]
        assert not stale, f"{relative}: {stale}"


# One file per target, drifted so its pattern no longer matches. Each must fail the whole bump,
# not only the target that rewrites it: the workflow commits whatever `make update_all` leaves.
DRIFTS = {
    "openapi": (BUMPED_FILES[0], '"OpenMetadata APIs"', '"OpenMetadata API"'),
    "pyproject": ("ingestion/pyproject.toml", "\nversion =", "\nversion_ ="),
    "compose": ("docker/docker-compose-ingestion/docker-compose-ingestion.yml", "docker.getcollate.io", "example.io"),
    "ri_version": ("ingestion/Dockerfile", "ARG RI_VERSION=", "ARG RI_VER="),
}


@pytest.mark.parametrize("drift", DRIFTS)
def test_a_drifted_file_fails_update_all(tmp_path, drift):
    tree = release_tree(tmp_path)
    relative, old, new = DRIFTS[drift]
    path = tree / relative
    assert old in path.read_text()
    path.write_text(path.read_text().replace(old, new))

    result = run_update_all(tree)

    assert result.returncode != 0
    assert "matched nothing" in result.stderr


def test_docker_tag_keeps_the_overridable_image_form(tmp_path):
    compose = tmp_path / "docker-compose.yml"
    compose.write_text(
        "    image: ${OPENMETADATA_SERVER_IMAGE:-docker.getcollate.io/openmetadata/server:1.12.0-SNAPSHOT}\n"
        "    image: docker.getcollate.io/openmetadata/ingestion:2.0.0-SNAPSHOT\n"
    )

    result = run_script("update_docker_tag", "-f", str(compose), "-t", "2.1.0", cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert compose.read_text() == (
        "    image: ${OPENMETADATA_SERVER_IMAGE:-docker.getcollate.io/openmetadata/server:2.1.0}\n"
        "    image: docker.getcollate.io/openmetadata/ingestion:2.1.0\n"
    )


def test_openapi_version_replaces_a_snapshot_version(tmp_path):
    relative = "openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java"
    source = tmp_path / relative
    source.parent.mkdir(parents=True)
    source.write_text('@Info(\n    title = "OpenMetadata APIs",\n    version = "2.0.0-SNAPSHOT",\n')

    result = run_script("update_openapi_version", "-v", "2.1.0", cwd=tmp_path)

    assert result.returncode == 0, result.stderr
    assert 'version = "2.1.0",' in source.read_text()


def test_a_pattern_that_matches_nothing_fails_the_bump(tmp_path):
    compose = tmp_path / "docker-compose.yml"
    compose.write_text("    image: postgres:16\n")

    result = run_script("update_docker_tag", "-f", str(compose), "-t", "2.1.0", cwd=tmp_path)

    assert result.returncode == 1
    assert "matched nothing" in result.stderr
    assert compose.read_text() == "    image: postgres:16\n"


def test_an_image_line_in_another_shape_fails_the_bump(tmp_path):
    compose = tmp_path / "docker-compose.yml"
    compose.write_text(
        "    image: docker.getcollate.io/openmetadata/server:2.0.0-SNAPSHOT\n"
        '    image: "docker.getcollate.io/openmetadata/ingestion:2.0.0-SNAPSHOT"\n'
    )

    result = run_script("update_docker_tag", "-f", str(compose), "-t", "2.1.0", cwd=tmp_path)

    assert result.returncode == 1
    assert "matched nothing" in result.stderr
