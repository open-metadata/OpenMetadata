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
"""Offline Redshift ownership gates, credential references and partition seeding."""

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

from ..features.database.pipelines import LineagePipeline, MetadataPipeline, ProfilerPipeline
from ..redshift.baseline import (
    PARTITION_INTERVAL_YEARS,
    PARTITION_YEARS_INSIDE,
    PARTITION_YEARS_OUTSIDE,
    build_redshift_baseline,
    person_birthdates,
)
from ..redshift.connector import owned_schema_pattern, redshift_invocation
from ..redshift.source import RedshiftInstance, RedshiftSource
from ..server import ServerConfig

_REFERENCE_DATE = date(2026, 3, 15)
_SCHEMA = "e2e_rs_owned"
_OTHER = "e2e_rs_other"


def _source(instance, schema):
    return RedshiftSource(
        instance, schema, _REFERENCE_DATE, build_redshift_baseline(schema, reference_date=_REFERENCE_DATE)
    )


@pytest.fixture
def instance(monkeypatch):
    engine = create_engine(
        URL.create("redshift+psycopg2", username="e2e", password="admin", host="127.0.0.1", port=5439, database="e2e")
    )
    monkeypatch.setenv("E2E_REDSHIFT_HOST_PORT", "127.0.0.1:5439")
    monkeypatch.setenv("E2E_REDSHIFT_USERNAME", "e2e")
    monkeypatch.setenv("E2E_REDSHIFT_PASSWORD", "fixture_password")
    monkeypatch.setenv("E2E_REDSHIFT_DB", "e2e")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-token")
    yield RedshiftInstance("e2e", engine)
    engine.dispose()


def _invocation(instance, sources, options=None, filters=None):
    return redshift_invocation(
        service_name="fixture_service",
        sources=sources,
        instance=instance,
        options=MetadataPipeline() if options is None else options,
        filters={} if filters is None else filters,
        server=ServerConfig("http://127.0.0.1:1/api", "synthetic-token", "env"),
    )


@pytest.mark.parametrize(
    "options",
    [
        MetadataPipeline(),
        ProfilerPipeline(),
        LineagePipeline(processQueryLineage=False, processStoredProcedureLineage=False),
    ],
)
def test_every_invocation_scopes_to_exact_owned_schema(instance, options):
    invocation = _invocation(instance, (_source(instance, _SCHEMA),), options)
    config = invocation.config["source"]
    assert config["sourceConfig"]["config"]["schemaFilterPattern"]["includes"] == [f"^{_SCHEMA}$"]
    connection = config["serviceConnection"]["config"]
    assert connection["database"] == "${E2E_REDSHIFT_DB}"
    assert connection["authType"]["password"] == "${E2E_REDSHIFT_PASSWORD}"
    assert "fixture_password" not in str(invocation.config)


@pytest.mark.parametrize(
    "filters",
    [
        {"schemaFilterPattern": {"includes": ["public"]}},
        {"schemaFilterPattern": {"includes": [".*"]}},
        {"schemaFilterPattern": {"includes": []}},
        {"schemaFilterPattern": {"includes": [f"^{_SCHEMA}$"], "excludes": ["^dbt_jaffle$"]}},
        {"schemaFilterPattern": {"includes": [_SCHEMA]}},
        {"databaseFilterPattern": {"includes": [".*"]}},
    ],
)
def test_invocation_rejects_unowned_scopes(instance, filters):
    with pytest.raises(ValueError):
        _invocation(instance, (_source(instance, _SCHEMA),), filters=filters)


def test_invocation_accepts_an_owned_exclusion(instance):
    owned, other = _source(instance, _SCHEMA), _source(instance, _OTHER)
    both = owned_schema_pattern((owned, other))["includes"]
    invocation = _invocation(
        instance,
        (owned, other),
        filters={"schemaFilterPattern": {"includes": both, "excludes": [f"^{_OTHER}$"]}},
    )
    pattern = invocation.config["source"]["sourceConfig"]["config"]["schemaFilterPattern"]
    assert pattern == {"includes": both, "excludes": [f"^{_OTHER}$"]}


def test_invocation_rejects_closed_foreign_and_duplicate_sources(instance):
    source = _source(instance, _SCHEMA)
    with pytest.raises(ValueError, match="nonempty tuple"):
        _invocation(instance, ())
    with pytest.raises(ValueError, match="distinct schemas"):
        _invocation(instance, (source, _source(instance, _SCHEMA)))
    foreign = RedshiftInstance("e2e", instance.admin_engine)
    with pytest.raises(ValueError, match="E2E cluster"):
        _invocation(instance, (_source(foreign, _SCHEMA),))
    source._closed = True
    with pytest.raises(ValueError, match="already been closed"):
        _invocation(instance, (source,))


def test_partition_seeds_straddle_the_configured_window():
    inside, outside = person_birthdates(_REFERENCE_DATE)
    boundary = date(_REFERENCE_DATE.year - PARTITION_INTERVAL_YEARS, _REFERENCE_DATE.month, _REFERENCE_DATE.day)
    assert len(inside) == len(PARTITION_YEARS_INSIDE)
    assert len(outside) == len(PARTITION_YEARS_OUTSIDE)
    assert all(birthdate > boundary for birthdate in inside)
    assert all(birthdate < boundary for birthdate in outside)


def test_leap_day_reference_keeps_the_year_offsets():
    inside, outside = person_birthdates(date(2028, 2, 29))
    assert [birthdate.year for birthdate in inside] == [2028 - years for years in PARTITION_YEARS_INSIDE]
    assert [birthdate.year for birthdate in outside] == [2028 - years for years in PARTITION_YEARS_OUTSIDE]


def test_baseline_ddl_stays_inside_the_owned_schema():
    """Every hand-written statement names the owned schema; nothing reaches an unowned one."""
    baseline = build_redshift_baseline(_SCHEMA, reference_date=_REFERENCE_DATE)
    for statement in baseline.ddl:
        assert f'"{_SCHEMA}".' in statement, statement
        assert "public." not in statement.lower(), statement
