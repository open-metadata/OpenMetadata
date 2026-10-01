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
"""Session-authenticated Snowflake account and per-test owned schemas."""

import uuid
from contextlib import ExitStack

import pytest
import snowflake.sqlalchemy as sf
from sqlalchemy import Column, Table

from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .baseline import quote_identifier
from .connector import SnowflakeContext
from .source import fresh_snowflake_source, snowflake_account


@pytest.fixture(scope="session")
def snowflake_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(snowflake_account())
        yield instance


@pytest.fixture
def snowflake_source(snowflake_instance):
    with fresh_snowflake_source(snowflake_instance) as source:
        yield source


@pytest.fixture
def snowflake_secondary_source(snowflake_instance):
    """A second owned schema, for schema filters and same-name tables in another schema."""
    with fresh_snowflake_source(snowflake_instance) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def snowflake(snowflake_source, snowflake_instance, service_name, om_server_config, om):
    return SnowflakeContext(
        source=snowflake_source, instance=snowflake_instance, service_name=service_name, server=om_server_config, om=om
    )


def _declare(source, name, *columns):
    return Table(name, source.baseline.metadata, *columns)


@pytest.fixture
def snowflake_transient_table(snowflake_source):
    _declare(snowflake_source, "transient_events", Column("id", sf.NUMBER(38, 0)), Column("label", sf.VARCHAR(20)))
    snowflake_source.run(
        f"CREATE TRANSIENT TABLE {snowflake_source.qualified}.transient_events "
        "(id NUMBER(38, 0) NOT NULL, label VARCHAR(20))"
    )
    snowflake_source.run(f"INSERT INTO {snowflake_source.qualified}.transient_events VALUES (1, 'kept'), (2, 'gone')")
    return "TRANSIENT_EVENTS"


@pytest.fixture
def snowflake_dynamic_table(snowflake_source, snowflake_instance):
    snowflake_source.run(
        f"CREATE DYNAMIC TABLE {snowflake_source.qualified}.active_customers "
        f"TARGET_LAG = '1 hour' WAREHOUSE = {quote_identifier(snowflake_instance.warehouse)} AS "
        f"SELECT id, full_name FROM {snowflake_source.qualified}.customers WHERE status = 'active'"
    )
    return "ACTIVE_CUSTOMERS"


@pytest.fixture
def snowflake_stream(snowflake_source):
    snowflake_source.run(
        f"CREATE STREAM {snowflake_source.qualified}.customers_stream ON TABLE {snowflake_source.qualified}.customers"
    )
    return "CUSTOMERS_STREAM"


@pytest.fixture
def snowflake_clustered_table(snowflake_source):
    snowflake_source.run(
        f"CREATE TABLE {snowflake_source.qualified}.clustered_events "
        "(id NUMBER(38, 0) NOT NULL, category VARCHAR(20), created_date DATE) CLUSTER BY (category, created_date)"
    )
    return "CLUSTERED_EVENTS"


@pytest.fixture
def snowflake_partitioned_table(snowflake_source):
    """One row today, one three days ago, and two outside a four-day window, dated by the server's CURRENT_DATE."""
    _declare(snowflake_source, "events", Column("id", sf.NUMBER(38, 0)), Column("event_date", sf.DATE))
    snowflake_source.run(
        f"CREATE TABLE {snowflake_source.qualified}.events (id NUMBER(38, 0) NOT NULL, event_date DATE NOT NULL)"
    )
    # Days 0 and 3 stay inside, and days 5 and 10 outside, a four-day window even across midnight.
    snowflake_source.run(
        f"INSERT INTO {snowflake_source.qualified}.events VALUES "
        "(1, CURRENT_DATE()), "
        "(2, DATEADD('day', -3, CURRENT_DATE())), "
        "(3, DATEADD('day', -5, CURRENT_DATE())), "
        "(4, DATEADD('day', -10, CURRENT_DATE()))"
    )
    return "EVENTS"


@pytest.fixture
def snowflake_profile_table(snowflake_source):
    """An empty table whose only DML the test itself runs, so its system profile is fully known."""
    _declare(snowflake_source, "profile_values", Column("id", sf.NUMBER(38, 0)), Column("score", sf.NUMBER(38, 0)))
    snowflake_source.run(
        f"CREATE TABLE {snowflake_source.qualified}.profile_values (id NUMBER(38, 0) NOT NULL, score NUMBER(38, 0))"
    )
    return "PROFILE_VALUES"


@pytest.fixture
def snowflake_sample_table(snowflake_source):
    """1000 rows, so the persisted sample is bounded by sampleDataCount rather than by table size."""
    _declare(snowflake_source, "sample_rows", Column("id", sf.NUMBER(38, 0)), Column("label", sf.VARCHAR(20)))
    snowflake_source.run(
        f"CREATE TABLE {snowflake_source.qualified}.sample_rows AS "
        "SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS id, 'row-' || id AS label "
        "FROM TABLE(GENERATOR(ROWCOUNT => 1000))"
    )
    return "SAMPLE_ROWS"


@pytest.fixture
def snowflake_tag(request, snowflake_source, om):
    """A tag unique to this test, and removal of the OM classification its ingestion creates."""
    name = f"E2E_SENSITIVITY_{uuid.uuid4().hex[:12].upper()}"
    snowflake_source.run(f"CREATE TAG {snowflake_source.qualified}.{name} ALLOWED_VALUES 'PII', 'PUBLIC'")

    def remove_classification():
        classification = om.get_by_name(entity=Classification, fqn=name)
        if classification is not None:
            om.delete(entity=Classification, entity_id=classification.id, recursive=True, hard_delete=True)

    request.addfinalizer(remove_classification)
    return name
