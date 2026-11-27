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
"""Session-owned Exasol instance and per-test owned schemas."""

from contextlib import ExitStack

import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .connector import ExasolContext
from .source import fresh_exasol_instance, fresh_exasol_source


@pytest.fixture(scope="session")
def exasol_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(fresh_exasol_instance())
        yield instance


@pytest.fixture(scope="session")
def exasol_admin_engine(exasol_instance):
    return exasol_instance.admin_engine


@pytest.fixture(scope="session")
def exasol_ingestion_engine(exasol_instance):
    return exasol_instance.ingestion_engine


@pytest.fixture
def exasol_source(exasol_admin_engine):
    with fresh_exasol_source(exasol_admin_engine) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def exasol(exasol_source, service_name, om_server_config, om):
    return ExasolContext(source=exasol_source, service_name=service_name, server=om_server_config, om=om)
