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

"""Unit tests for the SQLAlchemy interface mixin"""

from sqlalchemy.sql import coercions, roles

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin


class RecordingSession:
    """Session double that applies SQLAlchemy 2.x statement coercion and records statements."""

    def __init__(self):
        self.statements = []

    def execute(self, statement):
        coercions.expect(roles.StatementRole, statement)
        self.statements.append(statement)


class SnowflakeInterface(SQAInterfaceMixin):
    def __init__(self, service_connection_config):
        self.service_connection_config = service_connection_config


def snowflake_interface(query_tag=None):
    return SnowflakeInterface(
        SnowflakeConnection(username="user", account="account", warehouse="warehouse", queryTag=query_tag)
    )


def test_set_session_tag_statement_is_accepted_by_sqlalchemy_2x():
    session = RecordingSession()

    snowflake_interface(query_tag="my_tag").set_session_tag(session)

    assert [str(statement) for statement in session.statements] == ["ALTER SESSION SET QUERY_TAG='my_tag'"]


def test_set_session_tag_does_not_break_on_a_json_query_tag():
    session = RecordingSession()

    snowflake_interface(query_tag='{"app":"OpenMetadata"}').set_session_tag(session)

    assert [str(statement) for statement in session.statements] == [
        'ALTER SESSION SET QUERY_TAG=\'{"app":"OpenMetadata"}\''
    ]


def test_set_session_tag_is_skipped_without_a_query_tag():
    session = RecordingSession()

    snowflake_interface().set_session_tag(session)

    assert session.statements == []
