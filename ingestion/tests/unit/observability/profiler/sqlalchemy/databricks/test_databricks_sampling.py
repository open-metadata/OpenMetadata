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
"""Validate Databricks sampling SQL for nested STRUCT fields."""

from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from databricks.sqlalchemy.base import DatabricksDialect
from sqlalchemy import quoted_name
from sqlalchemy.orm import scoped_session, sessionmaker

from metadata.sampler.sqlalchemy.databricks.sampler import (
    DatabricksSamplerInterface,
)


@pytest.mark.parametrize(
    "parent_name,expected_selection,expected_metric",
    [
        (
            "address",
            "my_schema.my_table.address AS address",
            "count(`address`.`city`)",
        ),
        (
            "Address",
            "my_schema.my_table.`Address` AS `Address`",
            "count(`Address`.`city`)",
        ),
    ],
)
def test_nested_field_sampling_keeps_parent_struct_in_cte(
    parent_name: str,
    expected_selection: str,
    expected_metric: str,
) -> None:
    nested_name = quoted_name(f"`{parent_name}`.`city`", False)
    table = sa.Table(
        "my_table",
        sa.MetaData(),
        sa.Column(parent_name, sa.JSON),
        sa.Column(nested_name, sa.String),
        schema="my_schema",
    )
    sampler = object.__new__(DatabricksSamplerInterface)
    sampler.session_factory = scoped_session(sessionmaker())
    sampler.partition_details = None
    sampler.connection = MagicMock()

    sampled = sampler._base_sample_query(
        table,
        table.c[nested_name],
        sa.literal(1).label("random"),
    ).cte("sample_rnd")
    query = sa.select(sa.func.count(sa.literal_column(str(nested_name)))).select_from(sampled)

    compiled = str(query.compile(dialect=DatabricksDialect()))

    assert f"SELECT {expected_selection}" in compiled
    assert f"AS {nested_name}" not in compiled
    assert expected_metric in compiled
