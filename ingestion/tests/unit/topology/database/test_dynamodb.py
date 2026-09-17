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

"""
Test that the DynamoDB source turns the table key schema into primary key metadata
"""

from typing import Dict, Tuple
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import (
    Constraint,
    ConstraintType,
    DataType,
    TableConstraint,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.dynamodb.metadata import DynamodbSource

MOCK_DYNAMODB_CONFIG = {
    "source": {
        "type": "dynamodb",
        "serviceName": "local_dynamodb",
        "serviceConnection": {
            "config": {
                "type": "DynamoDB",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-1",
                },
            },
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "dynamodb"},
        }
    },
}

# A user_id declared as a string but holding digits is the case pandas gets wrong: it reads
# "1001" back as an int. created_at is a genuine DynamoDB number.
COMPOSITE_KEY_SCHEMA = [
    {"AttributeName": "user_id", "KeyType": "HASH"},
    {"AttributeName": "created_at", "KeyType": "RANGE"},
]
COMPOSITE_ATTRIBUTE_DEFINITIONS = [
    {"AttributeName": "user_id", "AttributeType": "S"},
    {"AttributeName": "created_at", "AttributeType": "N"},
]
COMPOSITE_ITEMS = [
    {"user_id": "1001", "created_at": 1700000000, "email": "alice@example.com"},
    {"user_id": "1002", "created_at": 1700000001, "email": "bob@example.com"},
]


class StubTable:
    """
    Stands in for a boto3 DynamoDB Table resource. Reading key_schema is what triggers the
    DescribeTable call on the real resource, so it also counts how often we describe.
    """

    def __init__(self, key_schema, attribute_definitions, items, describe_error=None):
        self._key_schema = key_schema
        self._attribute_definitions = attribute_definitions
        self._items = items
        self._describe_error = describe_error
        self.describe_calls = 0

    @property
    def key_schema(self):
        self.describe_calls += 1
        if self._describe_error:
            raise self._describe_error
        return self._key_schema

    @property
    def attribute_definitions(self):
        return self._attribute_definitions

    def scan(self, **_):
        return {"Items": self._items, "LastEvaluatedKey": None}


def build_source(
    key_schema=None,
    attribute_definitions=None,
    items=None,
    describe_error=None,
) -> Tuple[DynamodbSource, StubTable]:
    """Build a DynamodbSource whose boto3 resource hands back the given table."""
    table = StubTable(
        key_schema if key_schema is not None else COMPOSITE_KEY_SCHEMA,
        (
            attribute_definitions
            if attribute_definitions is not None
            else COMPOSITE_ATTRIBUTE_DEFINITIONS
        ),
        items if items is not None else COMPOSITE_ITEMS,
        describe_error=describe_error,
    )
    resource = MagicMock()
    resource.Table.return_value = table

    workflow_config = OpenMetadataWorkflowConfig.model_validate(MOCK_DYNAMODB_CONFIG)
    with (
        patch(
            "metadata.ingestion.source.database.dynamodb.metadata.DynamodbSource.test_connection"
        ),
        patch(
            "metadata.ingestion.source.database.dynamodb.connection.get_connection",
            return_value=resource,
        ),
    ):
        source = DynamodbSource.create(
            MOCK_DYNAMODB_CONFIG["source"],
            OpenMetadata(workflow_config.workflowConfig.openMetadataServerConfig),
        )

    source.context.get().__dict__["database_service"] = "local_dynamodb"
    source.context.get().__dict__["database"] = "default"
    source.context.get().__dict__["database_schema"] = "default"
    return source, table


def columns_by_name(columns) -> Dict:
    return {column.name.root: column for column in columns}


def assert_server_would_accept(table_request):
    """
    Mirror of DatabaseUtil.validateConstraints, which TableMapper.validateNewTable runs over every
    CreateTableRequest. Both of its rules are easy to trip from the ingestion side and neither is
    visible without a live server, so assert them here.
    """
    column_names = [column.name.root for column in table_request.columns]
    primary_key_columns = [
        column
        for column in table_request.columns
        if column.constraint == Constraint.PRIMARY_KEY
    ]
    assert (
        len(primary_key_columns) <= 1
    ), "Multiple columns tagged with primary key constraints"

    for constraint in table_request.tableConstraints or []:
        assert not (
            constraint.constraintType == ConstraintType.PRIMARY_KEY
            and primary_key_columns
        ), "A column already tagged as a primary key and table constraint also includes primary key"
        for column_name in constraint.columns:
            assert (
                column_name in column_names
            ), "Invalid column name found in table constraint"


def yield_one_table(source):
    requests = [either.right for either in source.yield_table(("users", "Regular"))]
    assert len(requests) == 1, "expected the table to be yielded, not an error"
    return requests[0]


def test_composite_key_is_ingested_as_a_table_level_primary_key():
    source, _ = build_source()

    table_request = yield_one_table(source)

    assert table_request.tableConstraints == [
        # DynamoDB's primary key is the partition key together with the sort key
        TableConstraint(
            constraintType=ConstraintType.PRIMARY_KEY,
            columns=["user_id", "created_at"],
        ),
        TableConstraint(constraintType=ConstraintType.SORT_KEY, columns=["created_at"]),
    ]
    # a composite key lives on the table constraint only: the server refuses a table whose
    # columns carry more than one primary key tag
    assert all(column.constraint is None for column in table_request.columns)


def test_partition_key_alone_is_tagged_on_the_column():
    source, _ = build_source(
        key_schema=[{"AttributeName": "id", "KeyType": "HASH"}],
        attribute_definitions=[{"AttributeName": "id", "AttributeType": "S"}],
        items=[{"id": "a", "name": "Alice"}],
    )

    table_request = yield_one_table(source)

    # the server rejects a table constraint that repeats a primary key already on a column
    assert table_request.tableConstraints is None
    columns = columns_by_name(table_request.columns)
    assert columns["id"].constraint == Constraint.PRIMARY_KEY
    assert columns["name"].constraint is None


@pytest.mark.parametrize(
    ("key_schema", "attribute_definitions", "items"),
    [
        pytest.param(
            [{"AttributeName": "id", "KeyType": "HASH"}],
            [{"AttributeName": "id", "AttributeType": "S"}],
            [{"id": "a", "name": "Alice"}],
            id="partition-key-only",
        ),
        pytest.param(
            COMPOSITE_KEY_SCHEMA,
            COMPOSITE_ATTRIBUTE_DEFINITIONS,
            COMPOSITE_ITEMS,
            id="composite-key",
        ),
        pytest.param(
            COMPOSITE_KEY_SCHEMA,
            COMPOSITE_ATTRIBUTE_DEFINITIONS,
            [],
            id="composite-key-empty-table",
        ),
    ],
)
def test_emitted_table_passes_server_constraint_validation(
    key_schema, attribute_definitions, items
):
    source, _ = build_source(
        key_schema=key_schema, attribute_definitions=attribute_definitions, items=items
    )

    assert_server_would_accept(yield_one_table(source))


def test_key_column_types_come_from_the_table_definition_not_the_sample():
    source, _ = build_source()

    columns = columns_by_name(source.get_table_columns("default", "users"))

    # pandas reads the digits in "1001" back as an int; the table says the key is a string
    assert columns["user_id"].dataType == DataType.STRING
    assert columns["user_id"].dataTypeDisplay == DataType.STRING.value
    assert columns["created_at"].dataType == DataType.NUMBER
    # non-key columns keep whatever the sample inferred
    assert columns["email"].dataType == DataType.STRING


def test_empty_table_still_reports_its_key_columns():
    source, _ = build_source(items=[])

    columns = source.get_table_columns("default", "users")

    # Without this the primary key would point at columns the table does not have and the
    # server would reject it.
    assert [column.name.root for column in columns] == ["user_id", "created_at"]
    assert [column.dataType for column in columns] == [DataType.STRING, DataType.NUMBER]


def test_describe_failure_leaves_the_table_ingestible():
    source, table = build_source(describe_error=RuntimeError("AccessDeniedException"))

    table_request = yield_one_table(source)

    assert table_request.tableConstraints is None
    assert sorted(columns_by_name(table_request.columns)) == [
        "created_at",
        "email",
        "user_id",
    ]
    # the failure is cached as well, so a table we cannot describe is not described twice
    assert table.describe_calls == 1


def test_a_table_is_described_only_once():
    source, table = build_source()

    source.get_table_columns("default", "users")
    source.get_table_constraints(
        db_name="default", schema_name="default", table_name="users"
    )

    assert table.describe_calls == 1
