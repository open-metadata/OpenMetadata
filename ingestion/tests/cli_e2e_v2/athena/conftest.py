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
"""Session-authenticated Athena account and per-test owned Glue databases."""

from contextlib import ExitStack

import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .connector import AthenaContext
from .source import athena_account, fresh_athena_source


@pytest.fixture(scope="session")
def athena_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(athena_account())
        yield instance


@pytest.fixture
def athena_source(athena_instance):
    with fresh_athena_source(athena_instance) as source:
        yield source


@pytest.fixture
def athena_secondary_source(athena_instance):
    """A second owned Glue database, for schema filters."""
    with fresh_athena_source(athena_instance) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def athena(athena_source, athena_instance, service_name, om_server_config, om):
    return AthenaContext(
        source=athena_source, instance=athena_instance, service_name=service_name, server=om_server_config, om=om
    )


@pytest.fixture
def athena_sample_table(athena_source):
    """1000 rows, so the persisted sample is bounded by sampleDataCount rather than by table size."""
    location = athena_source.location.child("sample_rows").uri
    athena_source.run(
        f'CREATE TABLE "{athena_source.database}"."sample_rows" '
        f"WITH (format = 'PARQUET', external_location = '{location}') AS "
        "SELECT id, concat('row-', CAST(id AS varchar)) AS label FROM UNNEST(sequence(1, 1000)) AS t(id)"
    )
    return "sample_rows"
