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
"""Tests for Looker column-level lineage extraction."""

import uuid

import pytest

from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.ingestion.source.dashboard.looker.models import LookMlField, LookMlView


@pytest.fixture
def looker_source() -> LookerSource:
    return object.__new__(LookerSource)


@pytest.mark.parametrize(
    ("sql", "expected_source_column"),
    [
        ("${TABLE}.CUSTOMER_ID", "CUSTOMER_ID"),
        ('${TABLE}."CUSTOMER_ID"', "CUSTOMER_ID"),
        ('${TABLE}."Customer Id"', "Customer Id"),
        ("${TABLE}.`Customer Id`", "Customer Id"),
        ("${TABLE}.[Customer Id]", "Customer Id"),
    ],
)
def test_extracts_table_column_references(
    looker_source: LookerSource,
    sql: str,
    expected_source_column: str,
) -> None:
    view = LookMlView(
        name="orders",
        dimensions=[LookMlField(name="customer_id", sql=sql)],
    )

    assert looker_source._extract_column_lineage(view) == [(expected_source_column, "customer_id")]


def test_resolves_indirect_field_references(looker_source: LookerSource) -> None:
    view = LookMlView(
        name="orders",
        dimensions=[
            LookMlField(name="customer_id", sql='${TABLE}."Customer Id"'),
            LookMlField(name="customer_label", sql="${customer_id}"),
        ],
    )

    assert set(looker_source._extract_column_lineage(view)) == {
        ("Customer Id", "customer_id"),
        ("Customer Id", "customer_label"),
    }


def test_maps_source_column_to_looker_field(looker_source: LookerSource) -> None:
    source_column_fqn = 'snowflake.db.schema.orders."Customer Id"'
    target_column_fqn = "looker.orders_view.customer_id"
    source_table = Table(
        id=uuid.uuid4(),
        name="orders",
        databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        columns=[
            Column(
                name="Customer Id",
                dataType=DataType.STRING,
                fullyQualifiedName=source_column_fqn,
            )
        ],
    )
    target_data_model = DashboardDataModel(
        id=uuid.uuid4(),
        name="orders_view",
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        dataModelType=DataModelType.LookMlView,
        columns=[
            Column(
                name="customer_id",
                dataType=DataType.STRING,
                fullyQualifiedName=target_column_fqn,
            )
        ],
    )

    result = looker_source._process_and_validate_column_lineage(
        [("Customer Id", "customer_id")],
        source_table,
        target_data_model,
    )

    assert result == [
        ColumnLineage(
            fromColumns=[source_column_fqn],
            toColumn=target_column_fqn,
        )
    ]
