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
Test dashboard connectors with CLI
"""
from abc import ABC, abstractmethod
from pathlib import Path

from metadata.ingestion.api.status import Status
from metadata.workflow.metadata import MetadataWorkflow

from ..base.test_cli import PATH_TO_RESOURCES
from ..base.test_cli_dashboard import CliDashboardBase


class CliCommonDashboard:
    """
    CLI Dashboard Common class
    """

    class TestSuite(
        CliDashboardBase.TestSuite, ABC
    ):  # pylint: disable=too-many-public-methods
        """
        TestSuite class to define test structure
        """

        @classmethod
        def setUpClass(cls) -> None:
            connector = cls.get_connector_name()
            workflow: MetadataWorkflow = cls.get_workflow(
                connector, cls.get_test_type()
            )
            cls.openmetadata = workflow.source.metadata
            cls.config_file_path = str(
                Path(PATH_TO_RESOURCES + f"/dashboard/{connector}/{connector}.yaml")
            )
            cls.test_file_path = str(
                Path(PATH_TO_RESOURCES + f"/dashboard/{connector}/test.yaml")
            )

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
            self.assertGreaterEqual(
                (len(source_status.records) + len(source_status.updated_records)),
                self.expected_dashboards_and_charts() + self.expected_lineage(),
            )
            self.assertTrue(len(sink_status.failures) == 0)
            self.assertTrue(len(sink_status.warnings) == 0)
            self.assertGreaterEqual(
                (len(sink_status.records) + len(sink_status.updated_records)),
                self.expected_dashboards_and_charts(),
            )

        def assert_for_vanilla_ingestion(
            self, source_status: Status, sink_status: Status
        ) -> None:
            self.assertTrue(len(source_status.failures) == 0)
            self.assertTrue(len(source_status.warnings) == 0)
            self.assertTrue(len(source_status.filtered) == 0)
            self.assertGreaterEqual(
                (len(source_status.records) + len(source_status.updated_records)),
                self.expected_dashboards_and_charts_after_patch()
                + self.expected_tags()
                + self.expected_lineage()
                + self.expected_datamodels()
                + self.expected_datamodel_lineage(),
            )
            self.assertTrue(len(sink_status.failures) == 0)
            self.assertTrue(len(sink_status.warnings) == 0)
            self.assertGreaterEqual(
                (len(sink_status.records) + len(sink_status.updated_records)),
                self.expected_dashboards_and_charts_after_patch()
                + self.expected_tags()
                + self.expected_datamodels(),
            )

        def assert_filtered_mix(self, source_status: Status, sink_status: Status):
            self.assertTrue(len(source_status.failures) == 0)
            self.assertTrue(len(source_status.warnings) == 0)
            self.assertGreaterEqual(
                len(source_status.filtered), self.expected_filtered_mix()
            )
            self.assertTrue(len(sink_status.failures) == 0)
            self.assertTrue(len(sink_status.warnings) == 0)
            self.assertGreaterEqual(
                self.expected_filtered_sink_mix(),
                (len(sink_status.records) + len(sink_status.updated_records)),
            )

        @staticmethod
        @abstractmethod
        def expected_dashboards_and_charts() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_tags() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_lineage() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_datamodels() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_datamodel_lineage() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_mix() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_sink_mix() -> int:
            raise NotImplementedError()

        # We need to update the counts in the subsequent run of ingestion for same service
        # Since we only patch the entities if we find any change at the source
        @staticmethod
        @abstractmethod
        def expected_dashboards_and_charts_after_patch() -> int:
            raise NotImplementedError()
