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
"""Session-owned Oracle container and per-test owned source schemas."""

from contextlib import ExitStack

import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .connector import OracleContext
from .source import fresh_oracle_instance, fresh_oracle_source


@pytest.fixture(scope="session")
def oracle_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(fresh_oracle_instance())
        yield instance


@pytest.fixture(scope="session")
def oracle_container(oracle_instance):
    return oracle_instance.container


@pytest.fixture(scope="session")
def oracle_admin_engine(oracle_instance):
    return oracle_instance.admin_engine


@pytest.fixture(scope="session")
def oracle_ingestion_engine(oracle_instance):
    return oracle_instance.ingestion_engine


@pytest.fixture
def oracle_source(oracle_admin_engine):
    with fresh_oracle_source(oracle_admin_engine) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def oracle(oracle_source, service_name, om_server_config, om):
    return OracleContext(source=oracle_source, service_name=service_name, server=om_server_config, om=om)
