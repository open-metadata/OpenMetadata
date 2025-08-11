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
Test Tableau connector with CLI
"""
from pathlib import Path
from typing import List

import pytest

from metadata.ingestion.api.status import Status

from .base.test_cli import PATH_TO_RESOURCES
from .common.test_cli_dashboard import CliCommonDashboard


class TableauCliTest(CliCommonDashboard.TestSuite):
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
        return "tableau"

    def get_includes_dashboards(self) -> List[str]:
        return [".*Test.*", "Regional"]

    def get_excludes_dashboards(self) -> List[str]:
        return ["Superstore"]

    def get_includes_charts(self) -> List[str]:
        return [".*Sheet", "Economy"]

    def get_excludes_charts(self) -> List[str]:
        return ["Obesity"]

    def get_includes_datamodels(self) -> List[str]:
        return ["Test.*"]

    def get_excludes_datamodels(self) -> List[str]:
        return ["Random.*"]

    def expected_dashboards_and_charts(self) -> int:
        return 22

    def expected_lineage(self) -> int:
        return 4

    def expected_tags(self) -> int:
        return 0

    def expected_datamodel_lineage(self) -> int:
        return 0

    def expected_datamodels(self) -> int:
        return 4

    def expected_filtered_mix(self) -> int:
        return 2

    def expected_filtered_sink_mix(self) -> int:
        return 8

    def expected_dashboards_and_charts_after_patch(self) -> int:
        return 4

    @pytest.mark.order(11)
    def test_lineage(self) -> None:
        pytest.skip("Lineage not configured. Skipping Test")

    # Overriding the method since for Tableau we don't expect lineage to be shown on this assert.
    # This differs from the base case
    def assert_not_including(self, source_status: Status, sink_status: Status):
        """
        Here we can have a diff of 1 element due to the service
        being ingested in the first round.

        This will not happen on subsequent tests or executions
        """
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) == 0)
        # We can have a diff of 1 element if we are counting the service, which is only marked as ingested in the
        # first go
        self.assertTrue(
            self.expected_dashboards_and_charts()
            <= (len(source_status.records) + len(source_status.updated_records))
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertTrue(
            self.expected_dashboards_and_charts()
            <= (len(sink_status.records) + len(sink_status.updated_records))
        )
