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
Structural tests for DatabaseServiceSource — guards against re-introducing
progress-projection responsibilities that now live in the topology runner
and connector-specific modules.
"""

from metadata.ingestion.source.database.database_service import DatabaseServiceSource


class TestDatabaseServiceHasNoProgressProjection:
    def test_no_container_expected_count(self):
        assert "container_expected_count" not in vars(DatabaseServiceSource)

    def test_no_progress_snapshot(self):
        assert "progress_snapshot" not in vars(DatabaseServiceSource)
