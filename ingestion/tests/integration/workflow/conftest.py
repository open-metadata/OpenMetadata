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

"""Automations integration tests"""
import uuid

import pytest

from ..containers import MySqlContainerConfigs, get_mysql_container

MYSQL_CONFIG = """
source:
  type: mysql
  serviceName: local_mysql_test
  serviceConnection:
    config:
      type: Mysql
      username: {user}
      authType:
        password: {password}
      hostPort: localhost:{port}
      databaseSchema: {database}
      connectionOptions: {{}}
      connectionArguments: {{}}
  sourceConfig:
    config:
      schemaFilterPattern:
        excludes:
        - mysql.*
        - information_schema.*
        - performance_schema.*
        - sys.*
sink:
  type: metadata-rest
  config: {{}}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
ingestionPipelineFQN: local_mysql_test.test_metadata
pipelineRunId: 948eba5d-94ec-4fc5-b233-29038722db16
"""


@pytest.fixture(scope="session")
def mysql_container():
    with get_mysql_container(
        MySqlContainerConfigs(container_name=str(uuid.uuid4()))
    ) as container:
        yield container


@pytest.fixture(scope="session")
def mysql_config(mysql_container):
    return MYSQL_CONFIG.format(
        user=mysql_container.username,
        password=mysql_container.password,
        port=mysql_container.get_exposed_port(3306),
        database=mysql_container.dbname,
    )
