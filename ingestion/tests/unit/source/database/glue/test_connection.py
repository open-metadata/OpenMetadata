#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Glue test-connection: its checks match its shipped definition (non-Engine: boto3 client)."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection as GlueConnectionConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.glue.connection import (
    GLUE_ERRORS,
    GlueChecks,
    GlueConnection,
    list_databases,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.glue.connection"

_SEED = (
    Path(__file__).parents[6]
    / "openmetadata-service/src/main/resources/json/data"
    / "testConnections/database/glue.json"
)


def _config() -> GlueConnectionConfig:
    return GlueConnectionConfig(awsConfig=AWSCredentials(awsRegion="us-east-1"))


def _client(pages: dict[str, list[dict]] | None = None) -> MagicMock:
    """A Glue client whose paginators yield one page per operation."""
    responses = pages or {}
    client = MagicMock()
    client.get_paginator.side_effect = lambda operation: _paginator(responses.get(operation, [{}]))
    return client


def _paginator(pages: list[dict]) -> MagicMock:
    paginator = MagicMock()
    paginator.paginate.return_value = pages
    return paginator


def _checks(client=None) -> GlueChecks:
    return GlueChecks(connect=lambda: client)


def _check_names() -> set[str]:
    return {step.value for step in collect_checks(_checks())}


def _client_error(code: str, operation: str = "GetDatabases") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": "denied"}}, operation)


def test_glue_connection_is_base_connection():
    assert issubclass(GlueConnection, BaseConnection)


def test_get_client_builds_the_glue_client():
    with patch(f"{CONNECTION_MODULE}.AWSClient") as mock_aws:
        client = GlueConnection(_config()).client

    mock_aws.return_value.get_glue_client.assert_called_once_with()
    assert client is mock_aws.return_value.get_glue_client.return_value


def test_glue_checks_cover_expected_steps():
    assert _check_names() == {"GetDatabases", "GetTables"}


def test_glue_checks_match_definition_seed():
    definition_steps = {step["name"] for step in json.loads(_SEED.read_text())["steps"]}
    assert _check_names() == definition_steps


def test_get_databases_is_the_connection_gate():
    steps = json.loads(_SEED.read_text())["steps"]
    assert steps[0]["name"] == "GetDatabases"
    assert steps[0]["category"] == "ConnectionGate"


def test_building_checks_does_not_build_the_client():
    with patch.object(GlueConnection, "_get_client") as mock_build:
        GlueConnection(_config()).checks()

    mock_build.assert_not_called()


def test_get_databases_enumerates_the_catalog():
    client = _client({"get_databases": [{"DatabaseList": [{"Name": "a"}, {"Name": "b"}]}]})

    evidence = _checks(client).get_databases()

    assert evidence.summary == "2 databases enumerated"
    assert evidence.command == "glue:GetDatabases"
    assert evidence.caveat is None


def test_get_databases_caps_reported_count_and_flags_more():
    paginator = _paginator([{"DatabaseList": [{"Name": "a"}, {"Name": "b"}, {"Name": "c"}]}])
    client = MagicMock()
    client.get_paginator.return_value = paginator

    evidence = list_databases(client, limit=2)

    assert evidence.summary == "2 databases enumerated (showing first 2; more exist)"
    client.get_paginator.assert_called_once_with("get_databases")
    paginator.paginate.assert_called_once_with(PaginationConfig={"MaxItems": 3})


def test_get_databases_warns_when_catalog_is_empty():
    client = _client({"get_databases": [{"DatabaseList": []}]})

    evidence = _checks(client).get_databases()

    assert evidence.summary == "0 databases enumerated"
    assert evidence.caveat is not None
    assert "No databases visible" in evidence.caveat.title


def test_get_databases_failure_reports_the_command_it_ran():
    client = _client()
    cause = _client_error("AccessDeniedException")
    client.get_paginator.side_effect = cause

    with pytest.raises(CheckError) as failure:
        _checks(client).get_databases()

    assert failure.value.cause is cause
    assert failure.value.evidence.command == "glue:GetDatabases"


def test_get_tables_probes_the_first_database():
    client = _client(
        {
            "get_databases": [{"DatabaseList": [{"Name": "sales"}]}],
            "get_tables": [{"TableList": [{"Name": "orders"}]}],
        }
    )

    evidence = _checks(client).get_tables()

    assert evidence.summary == "1 table in database 'sales'"
    assert evidence.command == "glue:GetTables (DatabaseName=sales)"


def test_get_tables_reports_a_caveat_when_no_database_can_be_probed():
    client = _client({"get_databases": [{"DatabaseList": []}]})

    evidence = _checks(client).get_tables()

    assert evidence.command == "glue:GetDatabases"
    assert evidence.caveat is not None
    assert "No tables probed" in evidence.caveat.title


def test_get_tables_failure_names_the_database_it_probed():
    cause = _client_error("EntityNotFoundException", "GetTables")
    client = _client({"get_databases": [{"DatabaseList": [{"Name": "sales"}]}]})
    tables_paginator = MagicMock()
    tables_paginator.paginate.side_effect = cause
    client.get_paginator.side_effect = lambda operation: (
        tables_paginator if operation == "get_tables" else _paginator([{"DatabaseList": [{"Name": "sales"}]}])
    )

    with pytest.raises(CheckError) as failure:
        _checks(client).get_tables()

    assert failure.value.cause is cause
    assert failure.value.evidence.command == "glue:GetTables (DatabaseName=sales)"


def test_error_pack_access_denied():
    diagnosis = GLUE_ERRORS.classify(
        ClientError(
            {
                "Error": {
                    "Code": "AccessDeniedException",
                    "Message": "User is not authorized to perform: glue:GetDatabases",
                }
            },
            "GetDatabases",
        )
    )
    assert diagnosis is not None
    assert "authorized" in diagnosis.title.lower()


def test_error_pack_entity_not_found():
    diagnosis = GLUE_ERRORS.classify(_client_error("EntityNotFoundException", "GetTables"))
    assert diagnosis is not None
    assert "not found" in diagnosis.title.lower()


def test_error_pack_inherits_the_shared_aws_diagnoses():
    # Authentication, region and endpoint failures are identical across AWS
    # services; GLUE_ERRORS gets them by folding in AWS_ERRORS.
    diagnosis = GLUE_ERRORS.classify(_client_error("ExpiredTokenException"))
    assert diagnosis is not None
    assert "expired" in diagnosis.title.lower()


def test_error_pack_inherits_the_network_pack_through_aws_errors():
    diagnosis = GLUE_ERRORS.classify(ConnectionRefusedError("refused"))
    assert diagnosis is not None
    assert "refused" in diagnosis.title.lower()


def test_error_pack_unmatched_returns_none():
    assert GLUE_ERRORS.classify(Exception("novel error")) is None
