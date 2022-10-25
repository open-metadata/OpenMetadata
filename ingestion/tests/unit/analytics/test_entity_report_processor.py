#  Copyright 2021 Collate
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
Validate entity data processor class
"""

import unittest
import uuid
from unittest.mock import MagicMock, patch

from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.data_insight.processor.entity_report_data_processor import (
    EntityReportDataProcessor,
)
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.entityReportData import (
    EntityReportData,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import (
    EntityReference,
    EntityReferenceList,
)

TEAM = Team(id=uuid.uuid4(), href="http://foo", name="marketing", fullyQualifiedName="marketing")  # type: ignore
USER = User(
    id=uuid.uuid4(),
    email="aaron@email.com",
    href="htpps://goo",
    name="aaron_johnson0",
    fullyQualifiedName="aaron_johnson0",
    teams=EntityReferenceList(
        __root__=[
            EntityReference(id=TEAM.id.__root__, type="team", name="sales")  # type: ignore
        ]
    ),
)  # type: ignore


class EntityReportProcessorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chart = Chart(
            id=uuid.uuid4(),
            name="my_chart",
            service=EntityReference(id=uuid.uuid4(), type="dashboad"),  # type: ignore
            owner=EntityReference(
                id=TEAM.id.__root__, type="team", name="marketing"
            ),  # type: ignore
        )  # type: ignore

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata", return_value=MagicMock())
    def test_fetch_owner(self, mocked_ometa):
        """Check fecth owner returns the expected value"""

        processor = DataProcessor.create("EntityReportData", mocked_ometa)
        mocked_ometa.get_by_name.return_value = USER
        owner = processor._get_team(self.chart.owner)
        assert owner == "marketing"
        self.chart.owner = EntityReference(
            id=USER.id.__root__, type="user"
        )  # type: ignore
        owner = processor._get_team(self.chart.owner)
        assert owner == "sales"
        self.chart.owner = None
        owner = processor._get_team(self.chart.owner)
        assert owner is None

    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata", return_value=MagicMock())
    def test__flatten_results(self, mocked_om):
        """test flatten method returns expected results

        Args:
            mocked_om (_type_):
        """
        data = {
            "Chart": {
                "None": {
                    "None": {
                        "missingOwner": 12,
                        "completedDescriptions": 12,
                        "hasOwner": 0,
                        "missingDescriptions": 0,
                    },
                    "Tier.Tier1": {
                        "missingOwner": 5,
                        "completedDescriptions": 1,
                        "hasOwner": 3,
                        "missingDescriptions": 8,
                    },
                },
                "Marketing": {
                    "Tier.Tier1": {
                        "missingOwner": 0,
                        "completedDescriptions": 0,
                        "hasOwner": 7,
                        "missingDescriptions": 5,
                    }
                },
            },
            "Table": {
                "None": {
                    "None": {
                        "missingOwner": 12,
                        "completedDescriptions": 12,
                        "hasOwner": 0,
                        "missingDescriptions": 0,
                    }
                }
            },
        }

        expected = [
            ReportData(
                timestamp=None,
                reportDataType=ReportDataType.EntityReportData.value,
                data=EntityReportData(
                    entityType="Chart",
                    team=None,
                    entityTier=None,
                    missingOwner=12,
                    completedDescriptions=12,
                    hasOwner=0,
                    missingDescriptions=0,
                ),  # type: ignore
            ),
            ReportData(
                timestamp=None,
                reportDataType=ReportDataType.EntityReportData.value,
                data=EntityReportData(
                    entityType="Chart",
                    team=None,
                    entityTier="Tier.Tier1",
                    missingOwner=5,
                    completedDescriptions=1,
                    hasOwner=3,
                    missingDescriptions=8,
                ),  # type: ignore
            ),
            ReportData(
                timestamp=None,
                reportDataType=ReportDataType.EntityReportData.value,
                data=EntityReportData(
                    entityType="Chart",
                    team="Marketing",
                    entityTier="Tier.Tier1",
                    missingOwner=0,
                    completedDescriptions=0,
                    hasOwner=7,
                    missingDescriptions=5,
                ),  # type: ignore
            ),
            ReportData(
                timestamp=None,
                reportDataType=ReportDataType.EntityReportData.value,
                data=EntityReportData(
                    entityType="Table",
                    team=None,
                    entityTier=None,
                    missingOwner=12,
                    completedDescriptions=12,
                    hasOwner=0,
                    missingDescriptions=0,
                ),  # type: ignore
            ),
        ]

        processed = []

        for flat_result in EntityReportDataProcessor(mocked_om)._flatten_results(data):
            flat_result.timestamp = None
            processed.append(flat_result)
            assert all(
                k in flat_result.data.dict()
                for k in [
                    "entityType",
                    "entityTier",
                    "team",
                    "organization",
                    "completedDescriptions",
                    "missingDescriptions",
                    "hasOwner",
                    "missingOwner",
                ]
            )

        self.assertListEqual(expected, processed)
