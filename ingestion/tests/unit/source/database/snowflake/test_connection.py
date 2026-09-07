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

"""Unit tests for the Snowflake connection."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection as SnowflakeConnectionConfig,
)
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.snowflake.connection import SnowflakeConnection


def _config(**overrides) -> SnowflakeConnectionConfig:
    values = {"username": "user", "account": "account", "warehouse": "warehouse"}
    values.update(overrides)
    return SnowflakeConnectionConfig(**values)


def _owned_client(config: SnowflakeConnectionConfig):
    return SnowflakeConnection(config).client


@pytest.mark.parametrize(
    "query_tag,connection_arguments,expected_tag",
    [
        (
            "dedicated",
            {
                "session_parameters": {
                    "QUERY_TAG": "low-level",
                    "STATEMENT_TIMEOUT_IN_SECONDS": 60,
                }
            },
            "dedicated",
        ),
        (None, {"session_parameters": {"QUERY_TAG": "low-level"}}, "low-level"),
    ],
)
@pytest.mark.parametrize(
    "build_client", [_owned_client, get_connection], ids=["owner", "generic-entrypoint"]
)
def test_query_tag_is_passed_to_every_driver_connection_without_mutating_config(
    query_tag,
    connection_arguments,
    expected_tag,
    build_client,
):
    config = _config(queryTag=query_tag, connectionArguments=connection_arguments)
    configured_arguments = config.connectionArguments.model_copy(deep=True)
    engine = MagicMock()

    with patch(
        "metadata.ingestion.source.database.snowflake.connection.create_generic_db_connection",
        return_value=engine,
    ) as build_engine:
        assert build_client(config) is engine

    connect_args = build_engine.call_args.kwargs["get_connection_args_fn"](config)
    assert connect_args["session_parameters"]["QUERY_TAG"] == expected_tag
    if query_tag:
        assert connect_args["session_parameters"]["STATEMENT_TIMEOUT_IN_SECONDS"] == 60
    assert connect_args["network_timeout"] == 600
    assert config.connectionArguments == configured_arguments


def test_absent_query_tag_does_not_create_session_parameters():
    config = _config()
    engine = MagicMock()

    with patch(
        "metadata.ingestion.source.database.snowflake.connection.create_generic_db_connection",
        return_value=engine,
    ) as build_engine:
        assert SnowflakeConnection(config).client is engine

    connect_args = build_engine.call_args.kwargs["get_connection_args_fn"](config)
    assert "session_parameters" not in connect_args
    assert connect_args["network_timeout"] == 600
    assert config.connectionArguments is None
