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
from abc import abstractmethod
from typing import List
from unittest import TestCase

import pytest

from metadata.ingestion.api.status import Status

from .e2e_types import E2EType
from .test_cli import CliBase


class CliDashboardBase(TestCase):
    """
    CLI Dashboard Base class
    """

    class TestSuite(TestCase, CliBase):  # pylint: disable=too-many-public-methods
        """
        TestSuite class to define test structure
        """

        # 1. deploy without including tags and data models
        @pytest.mark.order(1)
        def test_not_including(self) -> None:
            # do anything need before running first test
            self.prepare()
            # build config file for ingest without including data models and tags
            self.build_config_file(
                E2EType.INGEST_DASHBOARD_NOT_INCLUDING,
                {
                    "includeTags": "False",
                    "includeDataModels": "False",
                },
            )
            # run ingest
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_not_including(source_status, sink_status)

        # 2. deploy vanilla ingestion including lineage, tags and data models
        @pytest.mark.order(2)
        def test_vanilla_ingestion(self) -> None:
            # build config file for ingest
            self.build_config_file(E2EType.INGEST)
            # run ingest
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        # 3. deploy with mixed filter patterns
        @pytest.mark.order(3)
        def test_filter_mix(self) -> None:
            # build config file for ingest with filters
            self.build_config_file(
                E2EType.INGEST_DASHBOARD_FILTER_MIX,
                {
                    "dashboards": {
                        "includes": self.get_includes_dashboards(),
                        "excludes": self.get_excludes_dashboards(),
                    },
                    "charts": {
                        "includes": self.get_includes_charts(),
                        "excludes": self.get_excludes_charts(),
                    },
                    "dataModels": {
                        "includes": self.get_includes_datamodels(),
                        "excludes": self.get_excludes_datamodels(),
                    },
                },
            )
            # run ingest
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_mix(source_status, sink_status)

        @staticmethod
        @abstractmethod
        def get_connector_name() -> str:
            raise NotImplementedError()

        @abstractmethod
        def assert_not_including(self, source_status: Status, sink_status: Status):
            raise NotImplementedError()

        @abstractmethod
        def assert_for_vanilla_ingestion(
            self, source_status: Status, sink_status: Status
        ) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_mix(self, source_status: Status, sink_status: Status):
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_includes_dashboards() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_excludes_dashboards() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_includes_charts() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_excludes_charts() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_includes_datamodels() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_excludes_datamodels() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        def get_test_type() -> str:
            return "dashboard"

        def prepare(self) -> None:
            pass
