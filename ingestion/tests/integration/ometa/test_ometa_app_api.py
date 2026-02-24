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
OpenMetadata high-level API App test
"""
from metadata.generated.schema.entity.applications.app import App


class TestOMetaAppAPI:
    """
    App API integration tests.
    Tests read-only operations for built-in applications.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_get_app(self, metadata):
        """
        We can GET an app via the client
        """
        app = metadata.get_by_name(entity=App, fqn="SearchIndexingApplication")
        assert app is not None
        assert app.name.root == "SearchIndexingApplication"
