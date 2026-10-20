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
    write(
        tmp_path,
        "openmetadata-spec/src/main/resources/json/schema/entity/table.json",
        "{}",
    )
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

    def keys() -> tuple[str, str]:
        return (
            fingerprints.fingerprint("fixture", root=tmp_path),
            fingerprints.fingerprint("fixture-base", root=tmp_path),
        )

    # Upgradable inputs: the exact fixture changes, the base it can be
    # migrated from does not.
    for relative, content in (
        ("bootstrap/sql/migrations/V1.sql", "select 2;"),
        (
            "openmetadata-spec/src/main/resources/json/schema/entity/table.json",
            '{"a":1}',
        ),
    ):
        exact, base = keys()
        write(tmp_path, relative, content)
        assert keys()[0] != exact
        assert keys()[1] == base

    # Dependency pins change libraries, not seeded rows.
    for relative, content in (
        ("pom.xml", "<version>2</version>"),
        ("openmetadata-ui/src/main/resources/ui/package.json", "{}"),
        ("openmetadata-ui/src/main/resources/ui/yarn.lock", "playwright@2"),
    ):
        before = keys()
        write(tmp_path, relative, content)
        assert keys() == before

    for relative, content in (
        ("ingestion/examples/sample_data/table.json", '{"changed":true}'),
        ("openmetadata-ui/src/main/resources/ui/.nvmrc", "24\n"),
        ("docker/postgresql/Dockerfile_postgres", "FROM postgres:16\n"),
        ("docker/postgresql/postgres-script.sql", "select 2;\n"),
        ("docker/development/Dockerfile", "FROM eclipse-temurin:22\n"),
        (".dockerignore", "different-volume\n"),
    ):
        exact, base = keys()
        write(tmp_path, relative, content)
        assert keys()[0] != exact
        assert keys()[1] != base


def test_fixture_fingerprint_tracks_search_mappings(tmp_path: Path) -> None:
    mapping = "openmetadata-spec/src/main/resources/elasticsearch/en/metric_index_mapping.json"
    write(tmp_path, "pom.xml", "<project />")
    write(tmp_path, mapping, '{"mappings":{"properties":{}}}')
    initialize_repository(tmp_path)

    initial = fingerprints.fingerprint("fixture", root=tmp_path)
    write(
        tmp_path,
        mapping,
        '{"mappings":{"properties":{"followers":{"type":"keyword"}}}}',
    )

    assert fingerprints.fingerprint("fixture", root=tmp_path) != initial


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


def test_fixture_fingerprint_ignores_playwright_config_but_tracks_setup_scripts(
    tmp_path: Path,
) -> None:
    """Retry/shard/quarantine edits must not evict the golden fixture.

    playwright.config.ts only reads the seeded auth state; auth.setup.ts writes
    it. Hashing the config made every quarantine edit pay a fixture rebuild.
    """
    config = "openmetadata-ui/src/main/resources/ui/playwright.config.ts"
    setup = "openmetadata-ui/src/main/resources/ui/playwright/e2e/auth.setup.ts"
    write(tmp_path, "pom.xml", "<version>1</version>")
    write(tmp_path, config, "export default { retries: 1 };")
    write(tmp_path, setup, "const adminFile = 'playwright/.auth/admin.json';")
    initialize_repository(tmp_path)

    initial = fingerprints.fingerprint("fixture", root=tmp_path)

    write(tmp_path, config, "export default { retries: 2, grepInvert: /@quarantine/ };")
    assert fingerprints.fingerprint("fixture", root=tmp_path) == initial

    write(tmp_path, setup, "const adminFile = 'playwright/.auth/root.json';")
    assert fingerprints.fingerprint("fixture", root=tmp_path) != initial


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
        'class SessionCookieUtil { String cookie = "OM_SESSION_V2"; }',
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
    payload = (
        base64.urlsafe_b64encode(
            json.dumps(
                {"email": email, "sessionId": session_id, "exp": expiry}
            ).encode()
        )
        .decode()
        .rstrip("=")
    )
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
    admin_token = auth_rotation.rotate_auth_state(auth_dir, "https://localhost:8585")

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
        cookie = next(
            cookie for cookie in state["cookies"] if cookie["name"] == "OM_SESSION"
        )
        assert cookie["value"] == f"fresh-{email.split('@')[0]}"
        assert cookie["secure"] is True
        fresh_token = json.loads(auth_rotation.app_state_record(state)["value"])[
            "primary"
        ]
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


def current_hash(kind: str) -> str:
    return subprocess.check_output(
        ["python3", str(SCRIPTS / "playwright_cache_fingerprint.py"), "--kind", kind],
        cwd=ROOT,
        text=True,
    ).strip()


def build_fixture(tmp_path: Path, **overrides: str) -> Path:
    stage = tmp_path / "stage"
    write(stage, "postgres/PG_VERSION", "15\n")
    write(stage, "opensearch/nodes/0/state", "x")
    for name in (
        "auth/admin.json",
        "auth/admin-api-token.json",
        "entity-response-data.json",
        "lineage-data.json",
        "shared-infra.json",
    ):
        write(stage, f"playwright-state/{name}", "{}")
    state_hash = subprocess.check_output(
        "find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d ' ' -f1",
        cwd=stage / "playwright-state",
        shell=True,
        text=True,
    ).strip()
    seed_version = subprocess.check_output(
        "sed -n 's:.*<version>\\([^<]*\\)</version>.*:\\1:p' pom.xml | head -1",
        cwd=ROOT,
        shell=True,
        text=True,
    ).strip()
    manifest = {
        "version": 2,
        "sourceSha": "a" * 40,
        "createdAt": "2026-10-13T00:00:00Z",
        "compatibilityHash": current_hash("fixture"),
        "baseHash": current_hash("fixture-base"),
        "postgresImage": f"postgres@sha256:{'1' * 64}",
        "opensearchImage": f"opensearch@sha256:{'2' * 64}",
        "searchClusterAlias": "openmetadata",
        "schemaHash": current_hash("schema"),
        "seedHash": current_hash("seed"),
        "seedVersion": seed_version,
        "playwrightStateHash": state_hash,
        **overrides,
    }
    (stage / "fixture-manifest.json").write_text(json.dumps(manifest))
    archive = tmp_path / "playwright-fixture.tar.zst"
    subprocess.run(["tar", "--zstd", "-C", stage, "-cf", archive, "."], check=True)
    return archive


def validate_fixture(archive: Path, allow_upgrade: bool) -> subprocess.CompletedProcess:
    return subprocess.run(
        [SCRIPTS / "validate_playwright_fixture.sh", archive, current_hash("fixture")],
        cwd=ROOT,
        env={**os.environ, "PW_FIXTURE_ALLOW_UPGRADE": str(allow_upgrade).lower()},
        capture_output=True,
        text=True,
    )


def test_fixture_validator_reuses_a_fixture_across_schema_and_migration_changes(
    tmp_path: Path,
) -> None:
    exact = validate_fixture(build_fixture(tmp_path / "exact"), allow_upgrade=False)
    assert exact.returncode == 0, exact.stderr
    assert "fixture-mode=exact" in exact.stdout

    head = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    # Built before a schema/migration change: same base, older exact hashes.
    older = build_fixture(
        tmp_path / "older",
        sourceSha=head,
        compatibilityHash="0" * 64,
        schemaHash="0" * 64,
    )
    upgraded = validate_fixture(older, allow_upgrade=True)
    assert upgraded.returncode == 0, upgraded.stderr
    assert "fixture-mode=upgrade" in upgraded.stdout
    # Main must rebuild the exact fixture rather than keep migrating an old one.
    assert validate_fixture(older, allow_upgrade=False).returncode != 0

    reseeded = build_fixture(
        tmp_path / "reseeded",
        sourceSha=head,
        compatibilityHash="0" * 64,
        baseHash="0" * 64,
    )
    assert validate_fixture(reseeded, allow_upgrade=True).returncode != 0

    # restore-keys can return a fixture from a commit this checkout does not
    # contain (a newer main); migrate cannot move a database backwards, so it
    # must be rebuilt rather than upgraded. An unreferenced commit stands in.
    unrelated = subprocess.check_output(
        ["git", "commit-tree", "HEAD^{tree}", "-m", "fixture from an unrelated commit"],
        cwd=ROOT,
        text=True,
    ).strip()
    newer = build_fixture(
        tmp_path / "newer",
        sourceSha=unrelated,
        compatibilityHash="0" * 64,
        schemaHash="0" * 64,
    )
    rejected = validate_fixture(newer, allow_upgrade=True)
    assert rejected.returncode != 0
    assert "fixture-mode=" not in rejected.stdout


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
    workflow = (ROOT / ".github/workflows/playwright-e2e-reusable.yml").read_text()
    assert (
        "restore-playwright-fixture:\n    needs: [cache-keys, plan-playwright]"
        in workflow
    )
    assert "build:\n    needs: [check-changes, cache-keys]" in workflow
    assert "actions/cache/restore@v6" in workflow
    assert "actions/cache/save@v6" in workflow
    assert "playwright-golden-fixture-v3-" in workflow
    assert "playwright-ingestion-image-v2-" in workflow
    assert "playwright-distribution-v2-" in workflow
    assert "mvn -DskipTests clean package -pl openmetadata-dist -am" in workflow
    assert "npx playwright test --project=bundle-smoke --reporter=line" in workflow
    assert "COARSE_BUNDLE: ${{ inputs.coarse_bundle }}" in workflow
    assert (
        "PW_E2E_BUNDLE: ${{ needs.cache-keys.outputs.bundle_mode == 'coarse' }}"
        in workflow
    )
    assert "compression-level: 0" in workflow
    # CACHE_KEYS_RESULT / FIXTURE_RESTORE_RESULT are consumed by the summary
    # job that now lives in the postgres PR caller. Confirm the reusable
    # surfaces them via workflow_call outputs (which the caller renames to
    # cache_keys_result / restore_playwright_fixture_result).
    assert "cache_keys_result:" in workflow
    assert "restore_playwright_fixture_result:" in workflow

    restore_job = workflow.split("  restore-playwright-fixture:", 1)[1].split(
        "  prepare-playwright-fixture:", 1
    )[0]
    prepare_job = workflow.split("  prepare-playwright-fixture:", 1)[1].split(
        "  prepare-ingestion-image:", 1
    )[0]
    ingestion_job = workflow.split("  prepare-ingestion-image:", 1)[1].split(
        "  playwright-ci:", 1
    )[0]
    assert "if: ${{ steps.validate-fixture.outputs.usable == 'true' }}" in restore_job
    assert "if: ${{ steps.validate-ingestion.outputs.usable == 'true' }}" in restore_job
    assert (
        "if: ${{ (needs.restore-playwright-fixture.outputs.fixture_cache_hit != 'true'"
        " || steps.upgrade-trial.outcome == 'failure') }}" in prepare_job
    )
    # The ingestion image is built off the critical path; a missing image must
    # not force the ~17 min fixture re-seed.
    assert "ingestion_cache_hit" not in prepare_job
    assert (
        "needs.restore-playwright-fixture.outputs.ingestion_cache_hit != 'true'"
        in ingestion_job
    )
    assert "pack_playwright_ingestion_image.sh" in ingestion_job
    # A restored fixture that cannot be migrated falls back to the full rebuild
    # instead of failing every shard.
    trial = prepare_job.split("      - name: Try migrating the restored fixture\n", 1)[
        1
    ].split("\n      - name:", 1)[0]
    assert "id: upgrade-trial" in trial
    assert "continue-on-error: true" in trial
    assert 'fast-mode: "true"' in trial
    seed = prepare_job.split("      - name: Prepare seeded environment\n", 1)[1].split(
        "\n", 1
    )[0]
    assert "steps.upgrade-trial.outcome == 'failure'" in seed
    upload = prepare_job.split("      - name: Upload seeded fixture\n", 1)[1].split(
        "\n      - name:", 1
    )[0]
    assert "overwrite: true" in upload
    assert (
        "plan-playwright:\n" in workflow
        and "    needs: [detect-changes]\n"
        in workflow.split("  plan-playwright:", 1)[1].split(
            "  restore-playwright-fixture:", 1
        )[0]
    )
    assert "restore-keys: |\n            playwright-golden-fixture-v3-" in restore_job
    assert (
        'PW_FIXTURE_ALLOW_UPGRADE: ${{ !contains(fromJSON(\'["push","schedule"]\'), github.event_name) }}'
        in restore_job
    )
    assert "${{ env.DISTRIBUTION_CACHE_DIR }}/openmetadata-*.tar.gz" in workflow
    assert (
        workflow.count("npx playwright test --project=bundle-smoke --reporter=line")
        == 2
    )

    fixture_start = (SCRIPTS / "start_playwright_fast_environment.sh").read_text()
    assert (
        'jq -r .sourceSha "$manifest")" != "$(git rev-parse HEAD)' not in fixture_start
    )
    assert "rotate_playwright_auth_state.py" in fixture_start


def test_no_cache_is_saved_from_an_ephemeral_merge_queue_ref() -> None:
    """Merge-queue refs are deleted on dequeue, so a save there helps nobody.

    Actions scopes a cache to the ref that wrote it. gh-readonly-queue refs are
    unique per entry and short-lived, so those saves are unreadable by every
    future run while still consuming the repo's 10 GB LRU budget and evicting
    the main-scoped copies runs actually restore. Measured before the guard:
    0/13 golden-fixture hits on merge_group, ~17 min rebuilt every time.
    """
    workflow = (ROOT / ".github/workflows/playwright-e2e-reusable.yml").read_text()
    guard = "github.event_name != 'merge_group'"

    writers = workflow.count("uses: actions/cache/save@")
    assert writers == 5, f"cache writer count changed to {writers}; guard each one"
    cache_steps = [
        step
        for step in workflow.split("      - name:")
        if "uses: actions/cache/save@" in step
    ]
    assert len(cache_steps) == writers
    assert all(guard in step for step in cache_steps)

    # cache-ui-dist is the documented exception: it wraps `actions/cache`, whose
    # save is a post-step, so a step-level `if:` would suppress the restore too
    # and cost every queue entry the ~5 min frontend build.
    ui_dist_step = workflow.split("- name: Restore openmetadata-ui dist cache", 1)[
        1
    ].split("- name: Build with Maven", 1)[0]
    assert "uses: ./.github/actions/cache-ui-dist" in ui_dist_step
    assert guard not in ui_dist_step

    # populate-playwright-caches.yml is the SINGLE main-scoped writer that
    # replaces them, and its warm job must stop before the shards.
    warm = (ROOT / ".github/workflows/populate-playwright-caches.yml").read_text()
    assert "warm_caches_only: true" in warm
    assert "uses: ./.github/workflows/playwright-e2e-reusable.yml" in warm
    assert "!inputs.warm_caches_only" in workflow

    # The push trigger must stay unfiltered: the fixture and distribution
    # fingerprints span far more than the apt/yarn/browser key inputs, and a
    # skipped warm costs every queue entry ~17 min.
    #
    # Bound to the `on:` block first. `push:` is the LAST trigger, so slicing
    # forward to a sibling key finds no terminator and silently runs to EOF —
    # the assertions would then be inspecting the jobs, and a `paths:` added
    # anywhere later in the file would trip the check for the wrong reason.
    triggers = warm.split("\non:\n", 1)[1].split("\npermissions:", 1)[0]
    assert "jobs:" not in triggers
    push_trigger = triggers.split("  push:", 1)[1]
    assert "branches:\n      - main" in push_trigger
    assert "paths:" not in push_trigger

    # One writer, not two — a second warmer workflow is the drift the
    # one-writer rule exists to prevent.
    second_writer = ROOT / ".github/workflows/populate-playwright-fixture-cache.yml"
    assert not second_writer.exists()


def test_prune_workflow_only_deletes_caches_on_dead_queue_refs() -> None:
    prune = (ROOT / ".github/workflows/prune-ephemeral-caches.yml").read_text()
    assert "actions: write" in prune
    # Deleting a cache whose ref is still live would force an in-flight queue
    # entry to rebuild it.
    assert 'grep -qxF "$ref" <<<"$live"' in prune
    assert "kept=$((kept + 1))" in prune
    assert "refs/heads/gh-readonly-queue/" in prune
    # `set -e` must abort before the delete loop if the ref listing fails —
    # an empty list must never read as "every queue ref is dead".
    listing = prune.split("live=$(gh api", 1)[0]
    assert "set -euo pipefail" in listing


def test_prune_workflow_only_cancels_runs_on_dead_queue_refs() -> None:
    prune = (ROOT / ".github/workflows/prune-ephemeral-caches.yml").read_text()
    # Rebuilds start new entries via merge_group; the sweep must fire there.
    assert "\n  merge_group:\n" in prune
    cancel = prune.split("  cancel-stale-runs:", 1)[1]
    # Cancelling a run whose ref is still live would kill a real queue check.
    assert 'grep -qxF "$branch" <<<"$live"' in cancel
    assert '[[ "$id" == "$SELF_RUN_ID" ]] && continue' in cancel
    # A merged group's still-running checks are post-merge signal for main.
    assert '[[ "${merged[$pr]}" == "true" ]]' in cancel
    assert "gh-readonly-queue/" in cancel
    assert "  pull_request_target:\n    types: [dequeued]\n" in prune
    listing = cancel.split("live=$(gh api", 1)[0]
    assert "set -euo pipefail" in listing
    # Refs listed after runs, or a just-created entry's runs read as dead.
    assert "actions/runs?event=merge_group" in listing
