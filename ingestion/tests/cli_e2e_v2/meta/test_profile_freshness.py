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
"""Freshness scenarios keep row counts independent and wait for complete profiles."""

import sys
from itertools import chain, repeat
from types import SimpleNamespace

import pytest
from sqlalchemy import Column, Integer, MetaData, create_engine, select
from sqlalchemy import Table as SqlTable

from metadata.generated.schema.entity.data.table import Table

from ..features.database.entities import table_query
from ..features.database.pipelines import pipeline_spec
from ..features.database.profiles import profile_query
from ..mysql.test_profiles import test_profile_column_freshness as column_freshness_scenario
from ..mysql.test_profiles import test_profile_row_freshness as row_freshness_scenario
from ..runtime.cli import CliRunner, WorkflowInvocation
from .support import CLI_PROBE


def _profile(*, updated=False, missing=None):
    metrics = (
        {
            "valuesCount": 4,
            "nullCount": 1,
            "distinctCount": 3,
            "uniqueCount": 2,
            "min": 10,
            "max": 40,
            "sum": 90,
            "mean": 22.5,
        }
        if updated
        else {
            "valuesCount": 3,
            "nullCount": 1,
            "distinctCount": 2,
            "uniqueCount": 1,
            "min": 10,
            "max": 20,
            "sum": 50,
            "mean": 16.6667,
        }
    )
    timestamp = 2 if updated else 1
    return Table.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "profile_values",
            "profile": None if missing == "table" else {"timestamp": timestamp, "rowCount": 5 if updated else 4},
            "columns": [
                {
                    "name": "score",
                    "dataType": "INT",
                    "profile": None if missing == "column" else {"name": "score", "timestamp": timestamp, **metrics},
                }
            ],
        }
    )


@pytest.fixture
def run_scenario(tmp_path, polling_clock):
    engine = create_engine("sqlite:///:memory:")
    table = SqlTable("profile_values", MetaData(), Column("id", Integer, primary_key=True), Column("score", Integer))
    table.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            table.insert(), [{"id": index, "score": score} for index, score in enumerate((10, 20, 20, None), 1)]
        )
    script = tmp_path / "probe.py"
    script.write_text(CLI_PROBE)
    cli = CliRunner(tmp_path / "cli", command=(sys.executable, str(script)))

    def invocation(options, *, filters):
        subcommand = pipeline_spec(options).cli_subcommand
        return WorkflowInvocation(subcommand, {"probe": {"subcommand": subcommand}})

    def run(scenario, snapshots):
        responses = chain(snapshots, repeat(snapshots[-1]))
        om = SimpleNamespace(
            get_by_name=lambda **kwargs: _profile(),
            get_latest_table_profile=lambda fqn: next(responses),
        )
        scenario(
            cli=cli,
            mysql=SimpleNamespace(
                source=SimpleNamespace(admin_engine=engine, schema="my_schema"),
                invocation=invocation,
                table_query=lambda name: table_query(om, f"my_service.default.my_schema.{name}"),
                profile_query=lambda name: profile_query(om, f"my_service.default.my_schema.{name}"),
            ),
            mysql_profile_table=table,
        )
        with engine.connect() as connection:
            assert connection.execute(select(table.c.score).order_by(table.c.id)).scalars().all() == [
                10,
                20,
                20,
                None,
                40,
            ]

    try:
        yield run
    finally:
        engine.dispose()


def test_row_freshness_does_not_require_column_profiles(run_scenario):
    run_scenario(row_freshness_scenario, [_profile(missing="column"), _profile(updated=True, missing="column")])


@pytest.mark.parametrize("missing", ["table", "column"])
@pytest.mark.parametrize("phase", ["initial", "updated"])
def test_column_freshness_waits_for_required_profiles(run_scenario, missing, phase):
    snapshots = [_profile(), _profile(updated=True)]
    index = 0 if phase == "initial" else 1
    snapshots.insert(index, _profile(updated=phase == "updated", missing=missing))
    run_scenario(column_freshness_scenario, snapshots)


@pytest.mark.parametrize("stale", ["table", "column"])
def test_column_freshness_rejects_stale_timestamps(run_scenario, stale):
    updated = _profile(updated=True)
    profile = updated.profile if stale == "table" else updated.columns[0].profile
    profile.timestamp.root = 1
    with pytest.raises(AssertionError, match="no match after"):
        run_scenario(column_freshness_scenario, [_profile(), updated])


def test_row_freshness_rejects_stale_row_count(run_scenario):
    updated = _profile(updated=True, missing="column")
    updated.profile.rowCount = 4
    with pytest.raises(AssertionError, match="row count: expected 5, got 4"):
        run_scenario(row_freshness_scenario, [_profile(missing="column"), updated])
