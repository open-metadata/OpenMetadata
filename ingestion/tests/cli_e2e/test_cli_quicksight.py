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
Test Quicksight connector with CLI
"""
from typing import List

import pytest

from metadata.ingestion.api.status import Status

from .common.test_cli_dashboard import CliCommonDashboard


class QuicksightCliTest(CliCommonDashboard.TestSuite):
    @staticmethod
    def get_connector_name() -> str:
        return "quicksight"

    def get_includes_dashboards(self) -> List[str]:
        return ["^test$"]

    def get_excludes_dashboards(self) -> List[str]:
        return ["test_redshift_lineage"]

    def get_includes_charts(self) -> List[str]:
        return [".*Sheet 1.*", ".*"]

    def get_excludes_charts(self) -> List[str]:
        return []

    def expected_dashboards_and_charts(self) -> int:
        return 6

    def expected_lineage(self) -> int:
        return 0

    def expected_not_included_entities(self) -> int:
        return 6

    def expected_not_included_sink_entities(self) -> int:
        return 7

    def expected_filtered_mix(self) -> int:
        return 2

    def expected_filtered_sink_mix(self) -> int:
        return 3

    # Quicksight do not ingest tags
    def expected_tags(self) -> int:
        return 0

    # Quicksight do not ingest datamodels
    def get_excludes_datamodels(self) -> List[str]:
        return []

    # Quicksight do not ingest datamodels
    def get_includes_datamodels(self) -> List[str]:
        return []

    def expected_datamodel_lineage(self) -> int:
        return 0

    def expected_datamodels(self) -> int:
        return 0

    def expected_dashboards_and_charts_after_patch(self) -> int:
        return 7

    @pytest.mark.order(11)
    def test_lineage(self) -> None:
        pytest.skip("Lineage not configured. Skipping Test")

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        """
        We are overriding this method because of diff.
        of 1 in source and sink records
        """
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) == 0)
        self.assertEqual(
            (len(source_status.records) + len(source_status.updated_records)),
            self.expected_dashboards_and_charts_after_patch()
            + self.expected_tags()
            + self.expected_lineage()
            + self.expected_datamodels()
            + self.expected_datamodel_lineage(),
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        # We are getting here diff of 1 element in case of the service ingested.
        self.assertTrue(
            (len(sink_status.records) + len(sink_status.updated_records))
            <= self.expected_dashboards_and_charts_after_patch()
            + self.expected_tags()
            + self.expected_lineage()
            + self.expected_datamodels()
            + self.expected_datamodel_lineage(),
        )
