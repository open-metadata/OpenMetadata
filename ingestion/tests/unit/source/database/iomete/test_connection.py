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
"""Unit tests for IOMETE connection handling."""

from metadata.generated.schema.entity.services.connections.database.iometeConnection import (
    IometeConnection as IometeConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.iomete.connection import IometeConnection


def test_iomete_connection_is_base_connection():
    assert issubclass(IometeConnection, BaseConnection)


def test_get_connection_url_builds_iomete_dsn():
    connection = IometeConnectionConfig(
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:443",
        catalog="spark_catalog",
        cluster="my_cluster",
        dataPlane="my_dp",
    )
    url = IometeConnection.get_connection_url(connection)
    assert (
        url.render_as_string(hide_password=False) == "iomete://openmetadata_user:openmetadata_password@localhost:443"
        "/spark_catalog?cluster=my_cluster&data_plane=my_dp"
    )
