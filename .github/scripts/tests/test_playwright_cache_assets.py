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

from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
import os
import subprocess
import tarfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / ".github" / "scripts"


def load_script(name: str):
    path = SCRIPTS / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fingerprints = load_script("playwright_cache_fingerprint.py")
auth_rotation = load_script("rotate_playwright_auth_state.py")


def write(root: Path, relative: str, content: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def initialize_repository(root: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "add", "."], cwd=root, check=True)


def test_distribution_fingerprint_ignores_tests_but_tracks_runtime_and_bundle_mode(
    tmp_path: Path,
) -> None:
    write(tmp_path, "pom.xml", "<project />")
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/src/App.tsx",
        "export const App = 1;",
    )
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/src/App.test.tsx",
        "test('app', () => {});",
    )
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/playwright/e2e/App.spec.ts",
        "test('app', () => {});",
    )
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/playwright.config.ts",
        "export default {};",
    )
    initialize_repository(tmp_path)

    regular = fingerprints.fingerprint(
        "distribution", root=tmp_path, bundle_mode="regular", toolchain="maven"
    )
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/src/App.test.tsx",
        "test('changed', () => {});",
    )
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/playwright/e2e/App.spec.ts",
        "test('changed', () => {});",
    )
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/playwright.config.ts",
        "export default { retries: 1 };",
    )
    assert (
        fingerprints.fingerprint(
            "distribution", root=tmp_path, bundle_mode="regular", toolchain="maven"
        )
        == regular
    )

    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/src/App.tsx",
        "export const App = 2;",
    )
    assert (
        fingerprints.fingerprint(
            "distribution", root=tmp_path, bundle_mode="regular", toolchain="maven"
        )
        != regular
    )
    assert (
        fingerprints.fingerprint(
            "distribution", root=tmp_path, bundle_mode="coarse", toolchain="maven"
        )
        != regular
    )


def test_fixture_fingerprint_tracks_compatibility_inputs_without_source_sha(
    tmp_path: Path,
) -> None:
    write(tmp_path, "pom.xml", "<version>1</version>")
    write(tmp_path, "bootstrap/sql/migrations/V1.sql", "select 1;")
    write(tmp_path, "openmetadata-spec/src/main/resources/entity.json", "{}")
    write(tmp_path, "ingestion/examples/sample_data/table.json", "{}")
    write(
        tmp_path,
        "openmetadata-ui/src/main/resources/ui/package.json",
        '{"devDependencies":{"@playwright/test":"1.0.0"}}',
    )
    write(tmp_path, "openmetadata-ui/src/main/resources/ui/yarn.lock", "playwright@1")
    write(tmp_path, "openmetadata-ui/src/main/resources/ui/.nvmrc", "22\n")
    write(tmp_path, "docker/postgresql/Dockerfile_postgres", "FROM postgres:15\n")
    write(tmp_path, "docker/postgresql/postgres-script.sql", "select 1;\n")
    write(tmp_path, "docker/development/Dockerfile", "FROM eclipse-temurin:21\n")
    write(tmp_path, ".dockerignore", "docker/development/docker-volume\n")
    initialize_repository(tmp_path)

    initial = fingerprints.fingerprint("fixture", root=tmp_path)
    write(tmp_path, "bootstrap/sql/migrations/V1.sql", "select 2;")
    assert fingerprints.fingerprint("fixture", root=tmp_path) != initial

    changed_schema = fingerprints.fingerprint("fixture", root=tmp_path)
    write(tmp_path, "pom.xml", "<version>2</version>")
    assert fingerprints.fingerprint("fixture", root=tmp_path) != changed_schema

    fixture_inputs = (
        ("openmetadata-ui/src/main/resources/ui/package.json", "{}"),
        ("openmetadata-ui/src/main/resources/ui/yarn.lock", "playwright@2"),
        ("openmetadata-ui/src/main/resources/ui/.nvmrc", "24\n"),
        ("docker/postgresql/Dockerfile_postgres", "FROM postgres:16\n"),
        ("docker/postgresql/postgres-script.sql", "select 2;\n"),
        ("docker/development/Dockerfile", "FROM eclipse-temurin:22\n"),
        (".dockerignore", "different-volume\n"),
    )
    for relative, content in fixture_inputs:
        before = fingerprints.fingerprint("fixture", root=tmp_path)
        write(tmp_path, relative, content)
        assert fingerprints.fingerprint("fixture", root=tmp_path) != before


def test_fixture_typescript_dependency_scan_follows_dynamic_imports(
    tmp_path: Path,
) -> None:
    entrypoint = "openmetadata-ui/src/main/resources/ui/playwright/e2e/auth.setup.ts"
    helper = "openmetadata-ui/src/main/resources/ui/playwright/e2e/dynamic-helper.ts"
    write(tmp_path, entrypoint, "export const load = () => import('./dynamic-helper');")
    write(tmp_path, helper, "export const value = 1;")

    dependencies = fingerprints.typescript_dependencies([entrypoint], tmp_path)
    assert dependencies == {entrypoint, helper}


def test_fixture_typescript_dependency_scan_appends_extension_to_dotted_basename(
    tmp_path: Path,
) -> None:
    entrypoint = "openmetadata-ui/src/main/resources/ui/playwright/e2e/auth.setup.ts"
    helper = "openmetadata-ui/src/main/resources/ui/playwright/e2e/Entity.interface.ts"
    write(tmp_path, entrypoint, "import type { Entity } from './Entity.interface';")
    write(tmp_path, helper, "export interface Entity { id: string }")

    dependencies = fingerprints.typescript_dependencies([entrypoint], tmp_path)
    assert dependencies == {entrypoint, helper}


def test_fixture_fingerprint_tracks_ui_auth_storage_format(tmp_path: Path) -> None:
    storage_inputs = {
        "openmetadata-ui/src/main/resources/ui/public/app-worker.js": (
            "const DB_NAME = 'AppDataStore';"
        ),
        "openmetadata-ui/src/main/resources/ui/playwright/utils/tokenStorage.ts": (
            "export const DB_NAME = 'AppDataStore';"
        ),
        "openmetadata-ui/src/main/resources/ui/src/utils/OidcTokenStorage.ts": (
            "export const storage = {};"
        ),
        "openmetadata-ui/src/main/resources/ui/src/utils/SwMessenger.ts": (
            "export const send = () => undefined;"
        ),
        "openmetadata-ui/src/main/resources/ui/src/utils/SwTokenStorage.ts": (
            "export const store = {};"
        ),
        "openmetadata-ui/src/main/resources/ui/src/utils/SwTokenStorageUtils.ts": (
            "export const APP_STATE_KEY = 'app_state';"
        ),
    }
    for relative, content in storage_inputs.items():
        write(tmp_path, relative, content)
    initialize_repository(tmp_path)

    for relative, content in storage_inputs.items():
        before = fingerprints.fingerprint("fixture", root=tmp_path)
        write(tmp_path, relative, f"{content}\n// storage format changed")
        assert fingerprints.fingerprint("fixture", root=tmp_path) != before


def test_fixture_fingerprint_tracks_backend_session_contract(tmp_path: Path) -> None:
    session_inputs = {
        "openmetadata-service/src/main/java/org/openmetadata/service/security/jwt/JWTTokenGenerator.java": "class JWTTokenGenerator {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/security/session/SessionCookieUtil.java": "class SessionCookieUtil {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/security/AuthLoginServlet.java": "class AuthLoginServlet {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/security/AuthRefreshServlet.java": "class AuthRefreshServlet {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java": "class JwtFilter {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/security/auth/BasicAuthenticator.java": "class BasicAuthenticator {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/security/auth/BasicAuthServletHandler.java": "class BasicAuthServletHandler {}",
        "openmetadata-service/src/main/java/org/openmetadata/service/auth/JwtResponse.java": "class JwtResponse {}",
    }
    for relative, content in session_inputs.items():
        write(tmp_path, relative, content)
    initialize_repository(tmp_path)

    initial = fingerprints.fingerprint("fixture", root=tmp_path)
    write(
        tmp_path,
        "openmetadata-service/src/main/java/org/openmetadata/service/security/session/SessionCookieUtil.java",
        "class SessionCookieUtil { String cookie = \"OM_SESSION_V2\"; }",
    )
    assert fingerprints.fingerprint("fixture", root=tmp_path) != initial


def test_ingestion_fingerprint_covers_every_dockerfile_ci_copy_input(
    tmp_path: Path,
) -> None:
    inputs = {
        ".dockerignore": "docker/development/docker-volume\n",
        ".github/scripts/playwright_cache_fingerprint.py": "FORMAT_VERSION = 'v1'\n",
        "ingestion/Dockerfile.ci": "COPY ingestion /home/airflow/ingestion\n",
        "ingestion/setup.py": "NAME = 'ingestion'\n",
        "openmetadata-spec/schema.json": "{}",
        "scripts/datamodel_generation.py": "print('generate')\n",
        "openmetadata-airflow-apis/setup.py": "NAME = 'airflow-apis'\n",
    }
    for relative, content in inputs.items():
        write(tmp_path, relative, content)
    initialize_repository(tmp_path)

    for relative in inputs:
        before = fingerprints.fingerprint("ingestion", root=tmp_path)
        write(tmp_path, relative, f"{inputs[relative]}# changed\n")
        assert fingerprints.fingerprint("ingestion", root=tmp_path) != before


def token(email: str, session_id: str, expiry: int = 4_000_000_000) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {"email": email, "sessionId": session_id, "exp": expiry}
        ).encode()
    ).decode().rstrip("=")
    return f"header.{payload}.signature"


def storage_state(email: str) -> dict:
    return {
        "cookies": [
            {
                "name": "OM_SESSION",
                "value": "expired",
                "domain": "localhost",
                "path": "/",
                "expires": 1,
                "httpOnly": True,
                "secure": False,
                "sameSite": "Lax",
            }
        ],
        "origins": [
            {
                "origin": "http://localhost:8585",
                "localStorage": [],
                "indexedDB": [
                    {
                        "name": "AppDataStore",
                        "version": 1,
                        "stores": [
                            {
                                "name": "keyValueStore",
                                "autoIncrement": False,
                                "records": [
                                    {
                                        "key": "app_state",
                                        "value": json.dumps(
                                            {"primary": token(email, "expired")}
                                        ),
                                    }
                                ],
                                "indexes": [],
                            }
                        ],
                    }
                ],
            }
        ],
    }


def test_cached_auth_sessions_are_recreated_for_admin_and_seeded_users(
    tmp_path: Path, monkeypatch
) -> None:
    auth_dir = tmp_path / "auth"
    auth_dir.mkdir()
    states = {
        "admin.json": auth_rotation.ADMIN_EMAIL,
        "dataConsumer.json": "pw-data-consumer-fixture@gmail.com",
    }
    for filename, email in states.items():
        (auth_dir / filename).write_text(json.dumps(storage_state(email)))

    calls = []

    def fake_login(base_url: str, email: str, password: str) -> str:
        calls.append((base_url, email, password))
        return token(email, f"fresh-{email.split('@')[0]}")

    monkeypatch.setattr(auth_rotation, "login", fake_login)
    admin_token = auth_rotation.rotate_auth_state(
        auth_dir, "https://localhost:8585"
    )

    assert json.loads((auth_dir / "admin-api-token.json").read_text()) == {
        "token": admin_token
    }
    assert calls == [
        ("https://localhost:8585", auth_rotation.ADMIN_EMAIL, "admin"),
        (
            "https://localhost:8585",
            "pw-data-consumer-fixture@gmail.com",
            "User@OMD123",
        ),
    ]
    for filename, email in states.items():
        state = json.loads((auth_dir / filename).read_text())
        cookie = next(cookie for cookie in state["cookies"] if cookie["name"] == "OM_SESSION")
        assert cookie["value"] == f"fresh-{email.split('@')[0]}"
        assert cookie["secure"] is True
        fresh_token = json.loads(auth_rotation.app_state_record(state)["value"])["primary"]
        assert auth_rotation.decode_jwt_payload(fresh_token)["email"] == email
        assert oct(os.stat(auth_dir / filename).st_mode & 0o777) == "0o600"


def test_ingestion_sidecar_validator_rejects_archive_tampering(tmp_path: Path) -> None:
    archive = tmp_path / "playwright-ingestion-image.tar.zst"
    archive.write_bytes(b"image archive")
    compatibility = subprocess.check_output(
        [
            "python3",
            str(SCRIPTS / "playwright_cache_fingerprint.py"),
            "--kind",
            "ingestion",
        ],
        cwd=ROOT,
        text=True,
    ).strip()
    manifest = {
        "version": 1,
        "sourceSha": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "createdAt": "2026-07-22T00:00:00Z",
        "compatibilityHash": compatibility,
        "image": f"openmetadata-playwright-ingestion:{compatibility}",
        "imageId": f"sha256:{'1' * 64}",
        "archiveHash": hashlib.sha256(archive.read_bytes()).hexdigest(),
    }
    archive.with_name("playwright-ingestion-image.manifest.json").write_text(
        json.dumps(manifest)
    )
    validator = SCRIPTS / "validate_playwright_ingestion_image.sh"
    subprocess.run([validator, archive, compatibility], cwd=ROOT, check=True)

    archive.write_bytes(b"tampered")
    result = subprocess.run([validator, archive, compatibility], cwd=ROOT)
    assert result.returncode != 0


def test_distribution_cache_validates_manifest_archive_and_bundle_mode(
    tmp_path: Path,
) -> None:
    distribution_root = tmp_path / "openmetadata-test"
    write(distribution_root, "bin/openmetadata-server-start.sh", "#!/bin/sh\n")
    write(distribution_root, "conf/openmetadata.yaml", "server: {}\n")
    write(distribution_root, "libs/openmetadata-service-test.jar", "jar")
    source_archive = tmp_path / "openmetadata-test.tar.gz"
    with tarfile.open(source_archive, "w:gz") as archive:
        archive.add(distribution_root, arcname=distribution_root.name)

    cache_dir = tmp_path / "cache"
    cache_script = SCRIPTS / "playwright_distribution_cache.sh"
    subprocess.run(
        [
            cache_script,
            "package",
            source_archive,
            cache_dir,
            "fixture-fingerprint",
            "coarse",
            "maven-toolchain",
        ],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(
        [
            cache_script,
            "validate",
            cache_dir,
            "fixture-fingerprint",
            "coarse",
            "maven-toolchain",
        ],
        cwd=ROOT,
        check=True,
    )
    wrong_bundle = subprocess.run(
        [
            cache_script,
            "validate",
            cache_dir,
            "fixture-fingerprint",
            "regular",
            "maven-toolchain",
        ],
        cwd=ROOT,
    )
    assert wrong_bundle.returncode != 0


def test_workflow_restores_assets_in_parallel_and_uses_scoped_fallback() -> None:
    workflow = (ROOT / ".github/workflows/playwright-postgresql-e2e.yml").read_text()
    assert "restore-playwright-fixture:\n    needs: [cache-keys, plan-playwright]" in workflow
    assert "build:\n    needs: [check-changes, cache-keys]" in workflow
    assert "actions/cache/restore@v5" in workflow
    assert "actions/cache/save@v5" in workflow
    assert "playwright-golden-fixture-v2-" in workflow
    assert "playwright-ingestion-image-v2-" in workflow
    assert "playwright-distribution-v2-" in workflow
    assert "mvn -DskipTests clean package -pl openmetadata-dist -am" in workflow
    assert "npx playwright test --project=bundle-smoke --reporter=line" in workflow
    assert "COARSE_BUNDLE: ${{ github.event_name != 'workflow_dispatch' || inputs.coarse_bundle }}" in workflow
    assert "PW_E2E_BUNDLE: ${{ needs.cache-keys.outputs.bundle_mode == 'coarse' }}" in workflow
    assert "compression-level: 0" in workflow
    assert "CACHE_KEYS_RESULT: ${{ needs.cache-keys.result }}" in workflow
    assert (
        "FIXTURE_RESTORE_RESULT: ${{ needs.restore-playwright-fixture.result }}"
        in workflow
    )

    restore_job = workflow.split("  restore-playwright-fixture:", 1)[1].split(
        "  prepare-playwright-fixture:", 1
    )[0]
    prepare_job = workflow.split("  prepare-playwright-fixture:", 1)[1].split(
        "  playwright-ci-postgresql:", 1
    )[0]
    assert "if: ${{ steps.validate-fixture.outputs.usable == 'true' }}" in restore_job
    assert "if: ${{ steps.validate-ingestion.outputs.usable == 'true' }}" in restore_job
    assert (
        "if: ${{ needs.restore-playwright-fixture.outputs.fixture_cache_hit != 'true' }}"
        in prepare_job
    )
    assert (
        "needs.restore-playwright-fixture.outputs.ingestion_cache_hit != 'true'"
        in prepare_job
    )
    assert "${{ env.DISTRIBUTION_CACHE_DIR }}/openmetadata-*.tar.gz" in workflow
    assert workflow.count("npx playwright test --project=bundle-smoke --reporter=line") == 2

    fixture_start = (SCRIPTS / "start_playwright_fast_environment.sh").read_text()
    assert 'jq -r .sourceSha "$manifest")" != "$(git rev-parse HEAD)' not in fixture_start
    assert "rotate_playwright_auth_state.py" in fixture_start
