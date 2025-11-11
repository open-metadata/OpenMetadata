#  Copyright 2022 Collate
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
Test Redash connector with CLI
"""
from typing import List

import pytest

from .common.test_cli_dashboard import CliCommonDashboard


class RedashCliTest(CliCommonDashboard.TestSuite):
    @staticmethod
    def get_connector_name() -> str:
        return "redash"

    def get_includes_dashboards(self) -> List[str]:
        return [".*Orders.*"]

    def get_excludes_dashboards(self) -> List[str]:
        return [".*World.*"]

    def get_includes_charts(self) -> List[str]:
        return [".*Orders.*"]

    def get_excludes_charts(self) -> List[str]:
        return ["World Query Data"]

    # Redash do not ingest datamodels
    def get_includes_datamodels(self) -> List[str]:
        return []

    # Redash do not ingest datamodels
    def get_excludes_datamodels(self) -> List[str]:
        return []

    def expected_dashboards_and_charts(self) -> int:
        return 9

    def expected_lineage(self) -> int:
        return 0

    def expected_tags(self) -> int:
        return 1

    def expected_datamodels(self) -> int:
        return 0

    def expected_datamodel_lineage(self) -> int:
        return 0

    def expected_filtered_mix(self) -> int:
        return 3

    def expected_filtered_sink_mix(self) -> int:
        return 4

    def expected_dashboards_and_charts_after_patch(self) -> int:
        return 1

    @pytest.mark.order(11)
    def test_lineage(self) -> None:
        pytest.skip("Lineage not configured. Skipping Test")
