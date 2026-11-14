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

import os

import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseConnection


@pytest.fixture(scope="module")
def cloudberry_connection():
    host_port = os.getenv("CLOUDBERRY_TEST_HOST_PORT")
    if not host_port:
        pytest.skip("Set CLOUDBERRY_TEST_HOST_PORT for the Cloudberry Docker integration test")
    return DatabaseConnection.model_validate(
        {
            "config": {
                "type": "Cloudberry",
                "hostPort": host_port,
                "username": "om_reader",
                "authType": {"password": os.environ["CLOUDBERRY_TEST_PASSWORD"]},
                "database": "om_cloudberry",
            }
        }
    )


@pytest.fixture
def source_config(cloudberry_connection):
    return {
        "type": "cloudberry",
        "serviceName": "cloudberry_test",
        "serviceConnection": cloudberry_connection.model_dump(),
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }
