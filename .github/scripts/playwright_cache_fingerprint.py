#!/usr/bin/env python3

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

"""Build content-addressed keys for reusable Playwright CI assets."""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
from pathlib import Path
from typing import Iterable, Sequence


FORMAT_VERSION = "playwright-cache-v2"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

SCHEMA_PREFIXES = ("bootstrap/sql/", "openmetadata-spec/")
SEED_PREFIXES = (
    "ingestion/examples/sample_data/",
    "ingestion/examples/extended_sample_data/",
    "ingestion/pipelines/sample_data.yaml",
    "ingestion/pipelines/extended_sample_data.yaml",
)

FIXTURE_PREFIXES = (
    "pom.xml",
    *SCHEMA_PREFIXES,
    *SEED_PREFIXES,
    "openmetadata-service/src/main/java/org/openmetadata/service/initialization/",
    "openmetadata-service/src/main/java/org/openmetadata/service/migration/",
    "openmetadata-service/src/main/java/org/openmetadata/service/search/",
    "openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/searchIndex/",
    "openmetadata-service/src/main/java/org/openmetadata/service/resources/search/",
    "openmetadata-service/src/main/java/org/openmetadata/service/resources/searchindex/",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/jwt/",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/session/",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/AuthLoginServlet.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/AuthRefreshServlet.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/auth/BasicAuthenticator.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/security/auth/BasicAuthServletHandler.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/auth/JwtResponse.java",
    "openmetadata-service/src/main/resources/",
    "ingestion/src/metadata/ingestion/source/database/sample_data/",
    "ingestion/src/metadata/ingestion/source/database/extended_sample_data/",
    "ingestion/examples/airflow/dags/airflow_sample_data.py",
    "ingestion/examples/airflow/dags/airflow_extended_sample_data.py",
    "docker/development/docker-compose-postgres.yml",
    "docker/development/docker-compose-playwright-fast.yml",
    "docker/development/Dockerfile",
    "docker/postgresql/",
    "docker/run_local_docker.sh",
    "docker/run_local_docker_common.sh",
    ".dockerignore",
    "conf/openmetadata.yaml",
    "openmetadata-ui/src/main/resources/ui/.npmrc",
    "openmetadata-ui/src/main/resources/ui/.nvmrc",
    "openmetadata-ui/src/main/resources/ui/package.json",
    "openmetadata-ui/src/main/resources/ui/public/app-worker.js",
    "openmetadata-ui/src/main/resources/ui/playwright/utils/tokenStorage.ts",
    "openmetadata-ui/src/main/resources/ui/src/utils/OidcTokenStorage.ts",
    "openmetadata-ui/src/main/resources/ui/src/utils/SwMessenger.ts",
    "openmetadata-ui/src/main/resources/ui/src/utils/SwTokenStorage.ts",
    "openmetadata-ui/src/main/resources/ui/src/utils/SwTokenStorageUtils.ts",
    "openmetadata-ui/src/main/resources/ui/yarn.lock",
    ".github/actions/setup-openmetadata-test-environment/",
    ".github/scripts/create_playwright_fixture.sh",
    ".github/scripts/start_playwright_fast_environment.sh",
    ".github/scripts/rotate_playwright_auth_state.py",
    ".github/scripts/playwright_cache_fingerprint.py",
)

DISTRIBUTION_PREFIXES = (
    "pom.xml",
    "Makefile",
    ".mvn/",
    "bin/",
    "bootstrap/",
    "conf/",
    "common/pom.xml",
    "common/src/main/",
    "openmetadata-spec/pom.xml",
    "openmetadata-spec/src/main/",
    "openmetadata-shaded-deps/",
    "openmetadata-service/pom.xml",
    "openmetadata-service/src/main/",
    "openmetadata-mcp/pom.xml",
    "openmetadata-mcp/src/main/",
    "openmetadata-ui/pom.xml",
    "openmetadata-ui/src/main/",
    "openmetadata-ui-core-components/pom.xml",
    "openmetadata-ui-core-components/src/main/",
    "openmetadata-dist/pom.xml",
    "openmetadata-dist/src/",
    ".github/scripts/playwright_cache_fingerprint.py",
    ".github/scripts/playwright_distribution_cache.sh",
)

INGESTION_PREFIXES = (
    "pom.xml",
    ".dockerignore",
    "ingestion/",
    "openmetadata-spec/",
    "openmetadata-airflow-apis/",
    "scripts/datamodel_generation.py",
    "docker/development/Dockerfile",
    "docker/development/docker-compose-postgres.yml",
    "docker/run_local_docker.sh",
    "docker/run_local_docker_common.sh",
)

FIXTURE_TYPESCRIPT_ENTRYPOINTS = (
    "openmetadata-ui/src/main/resources/ui/playwright.config.ts",
    "openmetadata-ui/src/main/resources/ui/playwright/e2e/auth.setup.ts",
    "openmetadata-ui/src/main/resources/ui/playwright/e2e/entity-data.setup.ts",
)

TEST_PATH_PARTS = ("/src/test/", "/tests/", "/__tests__/", "/playwright/")
TEST_FILE_PATTERN = re.compile(r"(?:^|/)[^/]+\.(?:test|spec|stories)\.[^.]+$")
IMPORT_PATTERN = re.compile(
    r"(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"](\.[^'\"]+)['\"]"
    r"|require\(\s*['\"](\.[^'\"]+)['\"]\s*\)"
    r"|import\(\s*['\"](\.[^'\"]+)['\"]\s*\)"
)


def tracked_files(root: Path = REPOSITORY_ROOT) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    return sorted(path for path in result.stdout.decode().split("\0") if path)


def matches_prefix(path: str, prefixes: Sequence[str]) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in prefixes)


def is_runtime_distribution_file(path: str) -> bool:
    if any(part in f"/{path}" for part in TEST_PATH_PARTS):
        return False
    if Path(path).name.startswith("playwright."):
        return False
    if "/docs/" in f"/{path}" or path.endswith((".md", ".mdx")):
        return False
    return TEST_FILE_PATTERN.search(path) is None


def is_runtime_ingestion_file(path: str) -> bool:
    if path.startswith("ingestion/") and (
        "/tests/" in f"/{path}" or path.startswith("ingestion/tests/")
    ):
        return False
    return "/docs/" not in f"/{path}" and not path.startswith("ingestion/docs/")


def resolve_typescript_import(source: Path, specifier: str) -> Path | None:
    unresolved = source.parent / specifier
    candidates = (
        unresolved,
        Path(f"{unresolved}.ts"),
        Path(f"{unresolved}.tsx"),
        Path(f"{unresolved}.js"),
        Path(f"{unresolved}.jsx"),
        unresolved / "index.ts",
        unresolved / "index.tsx",
        unresolved / "index.js",
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    return None


def typescript_dependencies(
    entrypoints: Iterable[str], root: Path = REPOSITORY_ROOT
) -> set[str]:
    pending = [(root / entrypoint).resolve() for entrypoint in entrypoints]
    discovered: set[Path] = set()
    while pending:
        source = pending.pop()
        if source in discovered or not source.is_file():
            continue
        try:
            source.relative_to(root.resolve())
        except ValueError:
            continue
        discovered.add(source)
        for match in IMPORT_PATTERN.finditer(source.read_text(errors="replace")):
            specifier = next(group for group in match.groups() if group is not None)
            imported = resolve_typescript_import(source, specifier)
            if imported is not None and imported not in discovered:
                pending.append(imported)
    return {path.relative_to(root.resolve()).as_posix() for path in discovered}


def select_files(kind: str, files: Sequence[str], root: Path) -> list[str]:
    if kind == "schema":
        selected = {path for path in files if matches_prefix(path, SCHEMA_PREFIXES)}
    elif kind == "seed":
        selected = {path for path in files if matches_prefix(path, SEED_PREFIXES)}
    elif kind == "fixture":
        selected = {path for path in files if matches_prefix(path, FIXTURE_PREFIXES)}
        selected.update(typescript_dependencies(FIXTURE_TYPESCRIPT_ENTRYPOINTS, root))
    elif kind == "distribution":
        selected = {
            path
            for path in files
            if matches_prefix(path, DISTRIBUTION_PREFIXES)
            and is_runtime_distribution_file(path)
        }
    elif kind == "ingestion":
        selected = {
            path
            for path in files
            if matches_prefix(path, INGESTION_PREFIXES)
            and is_runtime_ingestion_file(path)
        }
    else:
        raise ValueError(f"Unknown fingerprint kind: {kind}")

    # Include these scripts before they are staged while developing the cache format.
    explicit_inputs = {
        "fixture": (
            ".github/scripts/playwright_cache_fingerprint.py",
            ".github/scripts/rotate_playwright_auth_state.py",
        ),
        "distribution": (
            ".github/scripts/playwright_cache_fingerprint.py",
            ".github/scripts/playwright_distribution_cache.sh",
        ),
        "ingestion": (".github/scripts/playwright_cache_fingerprint.py",),
    }
    for explicit in explicit_inputs.get(kind, ()):
        if (root / explicit).is_file():
            selected.add(explicit)
    return sorted(selected)


def fingerprint(
    kind: str,
    *,
    root: Path = REPOSITORY_ROOT,
    bundle_mode: str = "regular",
    toolchain: str = "",
) -> str:
    files = select_files(kind, tracked_files(root), root)
    if not files:
        raise RuntimeError(f"No tracked files selected for {kind} fingerprint")

    digest = hashlib.sha256()
    parameters = {"format": FORMAT_VERSION, "kind": kind}
    if kind == "distribution":
        parameters.update(
            {
                "bundleMode": bundle_mode,
                "buildCommand": "mvn -DskipTests clean package -pl openmetadata-dist -am",
                "java": "temurin-21",
                "toolchain": toolchain,
            }
        )
    for name, value in sorted(parameters.items()):
        digest.update(f"{name}={value}\0".encode())
    for relative in files:
        digest.update(relative.encode())
        digest.update(b"\0")
        digest.update((root / relative).read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--kind",
        required=True,
        choices=("fixture", "distribution", "ingestion", "schema", "seed"),
    )
    parser.add_argument(
        "--bundle-mode", choices=("regular", "coarse"), default="regular"
    )
    parser.add_argument("--toolchain", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print(
        fingerprint(
            args.kind,
            bundle_mode=args.bundle_mode,
            toolchain=args.toolchain,
        )
    )


if __name__ == "__main__":
    main()
