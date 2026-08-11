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
Test DBT with CLI
"""

from abc import abstractmethod
from typing import List  # noqa: UP035
from unittest import TestCase

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.testDefinition import TestDefinition, TestPlatform
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.utils import model_str

from .test_cli import CliBase  # noqa: TID252


class CliDBTBase(TestCase):
    class TestSuite(TestCase, CliBase):
        dbt_file_path: str

        # 1. deploy vanilla ingestion
        @pytest.mark.order(1)
        def test_connector_ingestion(self) -> None:
            # run ingest with dbt tables
            result = self.run_command(test_file_path=self.config_file_path)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        # 2. deploy dbt ingestion
        @pytest.mark.order(2)
        def test_dbt_ingestion(self) -> None:
            # run the dbt ingestion
            result = self.run_command(test_file_path=self.dbt_file_path)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_dbt_ingestion(source_status, sink_status)

        # 3. run tests on dbt ingestion
        @pytest.mark.order(3)
        def test_entities(self) -> None:
            for table_fqn in self.fqn_dbt_tables():
                table: Table = self.openmetadata.get_by_name(entity=Table, fqn=table_fqn, fields=["*"])
                data_model = table.dataModel
                self.assertTrue(len(data_model.columns) > 0)
                self.assertIsNotNone(data_model.rawSql)
                self.assertIsNotNone(data_model.sql)
                self.assertIsNotNone(data_model.upstream)
                self.assertIsNotNone(data_model.description)
                self.assertIsNotNone(table.description)
                self.assertIsNotNone(data_model.owners)
                self.assertIsNotNone(table.owners)
                self.assertTrue(len(data_model.tags) > 0)
                self.assertTrue(len(table.tags) > 0)

        # 4. run tests on dbt test cases and test results
        @pytest.mark.order(4)
        def test_dbt_test_cases(self) -> None:
            test_case_entity_list = self.openmetadata.list_entities(
                entity=TestDefinition,
                params={"testPlatform": TestPlatform.dbt.value},
                fields=["*"],
                # default limit=100 would silently truncate if this ever grows past it.
            )
            for e in test_case_entity_list.entities:
                print(  # noqa: T201
                    f"[verify] TestDefinition name={model_str(e.name)!r} entityType={e.entityType} "
                    f"displayName={e.displayName!r} description={e.description!r} "
                    f"testPlatforms={e.testPlatforms} parameterDefinition={e.parameterDefinition}"
                )
            # server-reported total vs. what this page actually returned - if these
            # ever diverge, the list above is incomplete and limit needs raising.
            print(  # noqa: T201
                f"[verify] TestDefinition page count={len(test_case_entity_list.entities)} "
                f"server total={test_case_entity_list.total}"
            )
            # ponytail: deliberately wrong on purpose. TestDefinition is now shared per
            # dbt test *type* (#28927, 2026-06-16), so 26 (the old one-per-test-case
            # count) can't be right anymore - but the real number is unconfirmed (doc
            # says 4, a prior commit claimed 5, neither has a surviving log to check).
            # Asserting the known-stale 26 guarantees this fails, which forces pytest to
            # print the [verify] dump above into the CI log. Replace with the real
            # count once a dispatch shows it.
            self.assertEqual(len(test_case_entity_list.entities), 26)

        # 5. test dbt lineage
        @pytest.mark.order(5)
        def test_lineage(self) -> None:
            for table_fqn in self.fqn_dbt_tables():
                lineage = self.retrieve_lineage(table_fqn)
                self.assertTrue(len(lineage["upstreamEdges"]) >= 4)

        @staticmethod
        def get_test_type() -> str:
            return "dbt"

        @staticmethod
        @abstractmethod
        def get_connector_name() -> str:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_tables() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_records() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def fqn_dbt_tables() -> List[str]:  # noqa: UP006
            raise NotImplementedError()

        @abstractmethod
        def assert_for_vanilla_ingestion(self, source_status: Status, sink_status: Status) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_dbt_ingestion(self, source_status: Status, sink_status: Status) -> None:
            raise NotImplementedError()
