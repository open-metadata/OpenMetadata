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
Test Redshift connector with CLI
"""
from pathlib import Path
from typing import List

from sqlalchemy.engine import Engine

from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.workflow import Workflow

from .test_cli_dbt_base import PATH_TO_RESOURCES, CliDBTBase


class DbtCliTest(CliDBTBase.TestSuite):
    engine: Engine

    @classmethod
    def setUpClass(cls) -> None:
        connector = cls.get_connector_name()
        workflow: Workflow = cls.get_workflow(connector)
        cls.engine = workflow.source.engine
        cls.openmetadata = workflow.source.metadata
        cls.config_file_path = str(
            Path(PATH_TO_RESOURCES + f"/dbt/{connector}/{connector}.yaml")
        )
        cls.dbt_file_path = str(Path(PATH_TO_RESOURCES + f"/dbt/{connector}/dbt.yaml"))

    def tearDown(self) -> None:
        self.engine.dispose()

    @staticmethod
    def get_connector_name() -> str:
        return "redshift"

    @staticmethod
    def expected_tables() -> int:
        return 9

    @staticmethod
    def expected_records() -> int:
        return 72

    @staticmethod
    def fqn_dbt_tables() -> List[str]:
        return [
            "local_redshift.dev.dbt_jaffle.customers",
            "local_redshift.dev.dbt_jaffle.orders",
        ]

    def assert_for_vanilla_ingestion(
        self, source_status: SourceStatus, sink_status: SinkStatus
    ) -> None:
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) == 8)
        self.assertTrue(len(source_status.records) >= self.expected_tables())
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertTrue(len(sink_status.records) > self.expected_tables())

    def assert_for_dbt_ingestion(
        self, source_status: SourceStatus, sink_status: SinkStatus
    ) -> None:
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) == 0)
        self.assertTrue(len(source_status.records) >= 0)
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertTrue(len(sink_status.records) >= self.expected_records())
