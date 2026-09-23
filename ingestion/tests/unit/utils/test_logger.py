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

import json
import logging
from copy import deepcopy

import pytest

from metadata.cli.ingest import run_ingest
from metadata.utils.logger import redacted_config, sanitize_url_credentials


def test_redacted_config_masks_nested_credentials_without_mutating_input():
    example_obj = {
        "serviceConnection": {"config": {"password": "synthetic-db-password"}},
        "securityConfig": {"jwtToken": "synthetic-jwt-token"},
        "serviceName": "demo_service",
        "nested": {
            "serviceConnection": {"config": {"privateKey": "synthetic-private-key"}},
            "list": [
                {"serviceConnection": {"config": {"password": "synthetic-list-password"}}},
                {"databaseName": "demo_db"},
                [{"securityConfig": {"clientSecret": "synthetic-client-secret"}}],
                "include_tables",
                None,
                3,
            ],
        },
    }
    original = deepcopy(example_obj)

    result = redacted_config(example_obj)

    expected = {
        "serviceConnection": "REDACTED",
        "securityConfig": "REDACTED",
        "serviceName": "demo_service",
        "nested": {
            "serviceConnection": "REDACTED",
            "list": [
                {"serviceConnection": "REDACTED"},
                {"databaseName": "demo_db"},
                [{"securityConfig": "REDACTED"}],
                "include_tables",
                None,
                3,
            ],
        },
    }
    assert result == expected
    assert example_obj == original


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        (
            "Authentication failed: https://synthetic-pat@dev.azure.com/org/repo",
            "Authentication failed: https://****@dev.azure.com/org/repo",
        ),
        (
            "Clone failed: https://x-oauth-basic:synthetic-token@github.com/owner/repo.git",
            "Clone failed: https://****@github.com/owner/repo.git",
        ),
        (
            "Clone failed: https://x-token-auth:synthetic-secret@gitlab.com/owner/repo.git",
            "Clone failed: https://****@gitlab.com/owner/repo.git",
        ),
        (
            "Could not fetch https://synthetic-first@example.com/repo.git; "
            "retry https://demo-user:synthetic-second@example.org/repo.git?ref=main failed",
            "Could not fetch https://****@example.com/repo.git; "
            "retry https://****@example.org/repo.git?ref=main failed",
        ),
        (
            "Repository unavailable: https://example.com/owner/repo.git?ref=main",
            "Repository unavailable: https://example.com/owner/repo.git?ref=main",
        ),
        ("no url here", "no url here"),
    ],
)
def test_sanitize_url_credentials_preserves_error_context(message, expected):
    assert sanitize_url_credentials(message) == expected


def test_ingest_debug_config_redacts_credentials_before_workflow_validation(tmp_path, caplog):
    config = {
        "source": {
            "serviceName": "demo_service",
            "serviceConnection": {"config": {"password": "synthetic-db-password"}},
        },
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "securityConfig": {"jwtToken": "synthetic-jwt-token"},
            }
        },
    }
    config_path = tmp_path / "workflow.json"
    config_path.write_text(json.dumps(config), encoding="utf-8")

    with caplog.at_level(logging.DEBUG, logger="metadata.Metadata"), pytest.raises(SystemExit) as exc:
        run_ingest(config_path)

    assert exc.value.code == 1
    config_messages = [
        record.getMessage() for record in caplog.records if "Using workflow config:" in record.getMessage()
    ]
    assert len(config_messages) == 1
    message = config_messages[0]
    assert "synthetic-db-password" not in message
    assert "synthetic-jwt-token" not in message
    assert "demo_service" in message
    assert "http://localhost:8585/api" in message
    assert json.loads(config_path.read_text(encoding="utf-8")) == config
