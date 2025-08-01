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
Test Metabase connector with CLI
"""
from pathlib import Path
from typing import List

from .base.test_cli import PATH_TO_RESOURCES
from .common.test_cli_dashboard import CliCommonDashboard


class MetabaseCliTest(CliCommonDashboard.TestSuite):
    # in case we want to do something before running the tests
    def prepare(self) -> None:
        redshift_file_path = str(
            Path(
                PATH_TO_RESOURCES
                + f"/dashboard/{self.get_connector_name()}/redshift.yaml"
            )
        )
        self.run_command(test_file_path=redshift_file_path)

    @staticmethod
    def get_connector_name() -> str:
        return "metabase"

    def get_includes_dashboards(self) -> List[str]:
        return [".*jaffle_shop.*"]

    def get_excludes_dashboards(self) -> List[str]:
        return [".*Delete.*"]

    def get_includes_charts(self) -> List[str]:
        return [".*Query.*"]

    def get_excludes_charts(self) -> List[str]:
        return [".*Question.*"]

    # Metabase do not ingest datamodels
    def get_includes_datamodels(self) -> List[str]:
        return []

    # Metabase do not ingest datamodels
    def get_excludes_datamodels(self) -> List[str]:
        return []

    def expected_datamodels(self) -> int:
        return 0

    def expected_datamodel_lineage(self) -> int:
        return 0

    def expected_dashboards_and_charts(self) -> int:
        return 6

    def expected_lineage(self) -> int:
        return 8

    def expected_tags(self) -> int:
        return 0

    def expected_filtered_mix(self) -> int:
        return 4

    def expected_filtered_sink_mix(self) -> int:
        return 8

    def expected_dashboards_and_charts_after_patch(self) -> int:
        return 0
