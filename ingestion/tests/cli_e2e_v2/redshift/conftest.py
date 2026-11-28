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
"""Session-connected Redshift cluster and per-test owned schemas."""

from contextlib import ExitStack

import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .connector import RedshiftContext
from .source import fresh_redshift_source, redshift_cluster


@pytest.fixture(scope="session")
def redshift_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(redshift_cluster())
        yield instance


@pytest.fixture
def redshift_source(redshift_instance):
    with fresh_redshift_source(redshift_instance) as source:
        yield source


@pytest.fixture
def redshift_secondary_source(redshift_instance):
    """A second owned schema, for schema filters and same-named tables in another schema."""
    with fresh_redshift_source(redshift_instance) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def redshift(redshift_source, redshift_instance, service_name, om_server_config, om):
    return RedshiftContext(
        source=redshift_source, instance=redshift_instance, service_name=service_name, server=om_server_config, om=om
    )
