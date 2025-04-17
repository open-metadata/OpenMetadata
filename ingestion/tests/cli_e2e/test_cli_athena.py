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
Test Athena connector with CLI
"""
from pathlib import Path
from typing import List

import pytest

from metadata.ingestion.api.status import Status
from metadata.workflow.metadata import MetadataWorkflow

from .base.e2e_types import E2EType
from .base.test_cli import PATH_TO_RESOURCES
from .common.test_cli_db import CliCommonDB


class AthenaCliTest(CliCommonDB.TestSuite):
    @classmethod
    def setUpClass(cls) -> None:
        connector = cls.get_connector_name()
        workflow: MetadataWorkflow = cls.get_workflow(
            test_type=cls.get_test_type(), connector=connector
        )
        cls.openmetadata = workflow.source.metadata
        cls.config_file_path = str(
            Path(PATH_TO_RESOURCES + f"/database/{connector}/{connector}.yaml")
        )
        cls.test_file_path = str(
            Path(PATH_TO_RESOURCES + f"/database/{connector}/test.yaml")
        )

    def create_table_and_view(self):
        pass

    def delete_table_and_view(self):
        pass

    def expected_profiled_tables(self):
        return 2

    def tearDown(self) -> None:
        pass

    @staticmethod
    def get_connector_name() -> str:
        return "athena"

    @staticmethod
    def expected_tables() -> int:
        return 7

    def expected_sample_size(self) -> int:
        return 50

    def view_column_lineage_count(self) -> int:
        pass

    def expected_lineage_node(self) -> str:
        pass

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_athena.database_name.e2e_db.customers"

    @staticmethod
    def fqn_deleted_table() -> None:
        return None

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["e2e_db"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return [".*customers.*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*sales.*"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 8

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 10

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 10

    @staticmethod
    def expected_filtered_mix() -> int:
        return 10

    def retrieve_lineage(self, entity_fqn: str) -> dict:
        pass

    @pytest.mark.order(2)
    def test_create_table_with_profiler(self) -> None:
        # delete table in case it exists
        self.delete_table_and_view()
        # create a table and a view
        self.create_table_and_view()
        # build config file for ingest
        self.build_config_file()
        # run ingest with new tables
        self.run_command()
        # build config file for profiler
        self.build_config_file(
            E2EType.PROFILER,
            # Otherwise the sampling here takes too long
            extra_args={"profileSample": 5, "includes": self.get_includes_schemas()},
        )
        # run profiler with new tables
        result = self.run_command("profile")
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_table_with_profiler(source_status, sink_status)

    @pytest.mark.order(11)
    def test_lineage(self) -> None:
        pytest.skip("Lineage not configured. Skipping Test")

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(source_status.warnings), 0)
        self.assertGreaterEqual(len(source_status.filtered), 6)
        self.assertGreaterEqual(
            len(source_status.records) + len(source_status.updated_records),
            self.expected_tables(),
        )
        self.assertEqual(len(sink_status.failures), 0)
        self.assertEqual(len(sink_status.warnings), 0)
        self.assertGreaterEqual(
            len(sink_status.records) + len(sink_status.updated_records),
            self.expected_tables(),
        )
