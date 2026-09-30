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
"""Session-authenticated BigQuery projects and per-test owned datasets."""

from contextlib import ExitStack

import pytest
import sqlalchemy_bigquery as bq
from sqlalchemy import Column, Table

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .connector import BigQueryContext
from .source import bigquery_account, fresh_bigquery_source


@pytest.fixture(scope="session")
def bigquery_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(bigquery_account())
        yield instance


@pytest.fixture
def bigquery_source(bigquery_instance):
    with fresh_bigquery_source(bigquery_instance.primary, bigquery_instance.location) as source:
        yield source


@pytest.fixture
def bigquery_secondary_source(bigquery_instance):
    """An owned dataset in the second project, for multi-project scenarios."""
    with fresh_bigquery_source(bigquery_instance.secondary, bigquery_instance.location) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def bigquery(bigquery_source, bigquery_instance, service_name, om_server_config, om):
    return BigQueryContext(
        source=bigquery_source, instance=bigquery_instance, service_name=service_name, server=om_server_config, om=om
    )


def _declare(source, name, *columns):
    return Table(name, source.baseline.metadata, *columns)


@pytest.fixture
def bigquery_partitioned_table(bigquery_source):
    """One row in the latest day partition and three older ones, dated by the server's CURRENT_DATE()."""
    _declare(bigquery_source, "events", Column("id", bq.INT64), Column("event_date", bq.DATE))
    bigquery_source.run(
        f"CREATE TABLE {bigquery_source.qualified}.events (id INT64 NOT NULL, event_date DATE NOT NULL) "
        "PARTITION BY event_date"
    )
    # Days 3, 5 and 10 stay outside the default [CURRENT_DATE - 1 DAY, ...) window even across midnight UTC.
    bigquery_source.run(
        f"INSERT INTO {bigquery_source.qualified}.events (id, event_date) VALUES "
        "(1, CURRENT_DATE()), "
        "(2, DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)), "
        "(3, DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY)), "
        "(4, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY))"
    )
    return "events"


@pytest.fixture
def bigquery_profile_table(bigquery_source):
    """An empty table whose only DML the test itself runs, so its system profile is fully known."""
    _declare(bigquery_source, "profile_values", Column("id", bq.INT64), Column("score", bq.INT64))
    bigquery_source.run(f"CREATE TABLE {bigquery_source.qualified}.profile_values (id INT64 NOT NULL, score INT64)")
    return "profile_values"


@pytest.fixture
def bigquery_sample_table(bigquery_source):
    """1000 rows, so the persisted sample is bounded by sampleDataCount rather than by table size."""
    _declare(bigquery_source, "sample_rows", Column("id", bq.INT64), Column("label", bq.STRING))
    bigquery_source.run(
        f"CREATE TABLE {bigquery_source.qualified}.sample_rows AS "
        "SELECT id, CONCAT('row-', CAST(id AS STRING)) AS label FROM UNNEST(GENERATE_ARRAY(1, 1000)) AS id"
    )
    return "sample_rows"
