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

"""
OpenMetadata API initialization
"""

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    ExtraHeaders,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class TestOMetaConnectionDefinitionAPI:
    """
    Connection Definition API integration tests.
    Tests health check, connection definition retrieval, and extra headers.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_init_ometa(self, metadata):
        assert metadata.health_check()

    def test_get_connection_def(self, metadata):
        """Test Connection Definitions can only be GET"""
        res: TestConnectionDefinition = metadata.get_by_name(
            entity=TestConnectionDefinition, fqn="Mysql.testConnectionDefinition"
        )
        assert len(res.steps) == 5
        assert res.name.root == "Mysql"

    def test_init_ometa_with_extra_headers(self, metadata):
        config = metadata.config.model_copy(deep=True)
        config.extraHeaders = ExtraHeaders({"User-Agent": "OpenMetadata Python Client"})
        client = OpenMetadata(config)
        assert client.health_check()
