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
"""Progress counter behaviour for Snowflake's ACCESS_HISTORY lineage path."""

from unittest.mock import MagicMock

from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.snowflake.lineage import SnowflakeLineageSource
from metadata.workflow.progress_render import ProgressReporter


class TestAccessHistoryProgress:
    def test_tracks_lineage_records_without_total_or_eta(self):
        source = SnowflakeLineageSource.__new__(SnowflakeLineageSource)

        edges = [Either(right=MagicMock()) for _ in range(3)]
        source._yield_combined_access_history = lambda: iter(edges)
        source._yield_copy_history_lineage = lambda: iter([Either(right=MagicMock())])

        results = list(SnowflakeLineageSource._yield_access_history_lineage(source))

        assert len(results) == 4
        assert source.progress.global_counters() == [("LineageRecords", 4, None)]
        assert ProgressReporter(source.progress).eta_seconds() is None
