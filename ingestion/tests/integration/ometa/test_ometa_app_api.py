#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata high-level API App test
"""
from unittest import TestCase

from metadata.generated.schema.entity.applications.app import App

from ..integration_base import int_admin_ometa


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    metadata = int_admin_ometa()

    def test_get_app(self):
        """We can GET an app via the client"""
        app = self.metadata.get_by_name(entity=App, fqn="SearchIndexingApplication")
        self.assertIsNotNone(app)
        self.assertEqual(app.name.__root__, "SearchIndexingApplication")
