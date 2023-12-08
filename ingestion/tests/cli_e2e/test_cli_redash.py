#  Copyright 2022 Collate
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
Test Redash connector with CLI
"""
from typing import List

from .common.test_cli_dashboard import CliCommonDashboard


class RedashCliTest(CliCommonDashboard.TestSuite):
    @staticmethod
    def get_connector_name() -> str:
        return "redash"

    def get_includes_dashboards(self) -> List[str]:
        return [".*Mil.*"]

    def get_excludes_dashboards(self) -> List[str]:
        return ["Test"]

    def get_includes_charts(self) -> List[str]:
        return ["4"]

    def get_excludes_charts(self) -> List[str]:
        return [".*Query.*"]

    # Redash do not ingest datamodels
    def get_includes_datamodels(self) -> List[str]:
        return []

    # Redash do not ingest datamodels
    def get_excludes_datamodels(self) -> List[str]:
        return []

    def expected_dashboards_and_charts(self) -> int:
        return 12

    def expected_lineage(self) -> int:
        return 0

    def expected_tags(self) -> int:
        return 2

    def expected_datamodels(self) -> int:
        return 0

    def expected_datamodel_lineage(self) -> int:
        return 0

    def expected_filtered_mix(self) -> int:
        return 6

    def expected_filtered_sink_mix(self) -> int:
        return 9

    def expected_dashboards_and_charts_after_patch(self) -> int:
        return 2
