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

"""Connections integration tests"""
import uuid

import oracledb
import pytest

from ..containers import (
    MySqlContainerConfigs,
    OracleContainerConfigs,
    get_mysql_container,
    get_oracle_container,
)


@pytest.fixture(scope="package")
def mysql_container():
    with get_mysql_container(
        MySqlContainerConfigs(container_name=str(uuid.uuid4()))
    ) as container:
        yield container


@pytest.fixture(scope="package")
def oracle_container():
    oracle_config = OracleContainerConfigs(container_name=str(uuid.uuid4()))
    with get_oracle_container(oracle_config) as container:
        oracle_config.with_exposed_port(container)
        oracle_config.docker_container = container
        _grant_oracle_privileges(oracle_config)
        yield oracle_config


def _grant_oracle_privileges(config: OracleContainerConfigs) -> None:
    """Grant DBA-level privileges needed by test_connection steps."""
    dsn = oracledb.makedsn("localhost", config.exposed_port, service_name=config.dbname)
    with oracledb.connect(
        user="sys",
        password=config.oracle_password,
        dsn=dsn,
        mode=oracledb.AUTH_MODE_SYSDBA,
    ) as connection:
        with connection.cursor() as cursor:
            for grant in [
                f"GRANT SELECT ANY DICTIONARY TO {config.username}",
                f"GRANT SELECT ON gv_$sql TO {config.username}",
                f"GRANT SELECT ON v_$sql TO {config.username}",
                f"GRANT CREATE TABLE TO {config.username}",
            ]:
                cursor.execute(grant)
        connection.commit()
