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
Validate workflow configs and filters
"""

import time
import unittest
from copy import deepcopy
from datetime import datetime, timedelta

import pytest
import requests

from metadata.data_insight.api.workflow import DataInsightWorkflow
from metadata.generated.schema.analytics.reportData import ReportDataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.parser import ParsingConfigurationError
from metadata.ingestion.ometa.ometa_api import OpenMetadata

data_insight_config = {
    "source": {
        "type": "dataInsight",
        "serviceName": "dataInsightWorkflow",
        "sourceConfig": {"config": {"type": "dataInsight"}},
    },
    "processor": {"type": "data-insight-processor", "config": {}},
    "sink": {
        "type": "elasticsearch",
        "config": {"es_host": "localhost", "es_port": 9200, "recreate_indexes": True},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"  # pylint: disable=line-too-long
            },
        }
    },
}


class DataInsightWorkflowTests(unittest.TestCase):
    """Test class for data insight workflow validation"""

    @classmethod
    def setUpClass(cls) -> None:
        """Set up om client for the test class"""

        cls.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                data_insight_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

    def test_create_method(self):
        """Test validation of the workflow config is properly happening"""
        DataInsightWorkflow.create(data_insight_config)

        with pytest.raises(ParsingConfigurationError):
            insight = deepcopy(data_insight_config)
            insight["source"]["sourceConfig"]["config"].update({"type": "Foo"})
            DataInsightWorkflow.create(insight)

    def test_execute_method(self):
        """test method excution"""
        workflow: DataInsightWorkflow = DataInsightWorkflow.create(data_insight_config)
        workflow.execute()

        time.sleep(1)  # wait for data to be available
        entity_report_indexes = requests.get(
            "http://localhost:9200/entity_report_data_index/_search", timeout=30
        )
        requests.get(
            "http://localhost:9200/entity_report_data_index/_search", timeout=30
        )
        requests.get(
            "http://localhost:9200/web_analytic_entity_view_report_data/_search",
            timeout=30,
        )
        assert (
            entity_report_indexes.json()["hits"]["total"]["value"] > 0
        )  # check data have been correctly indexed in ES

        report_data = self.metadata.get_data_insight_report_data(
            int((datetime.now() - timedelta(days=1)).timestamp() * 1000),
            int((datetime.now() + timedelta(days=1)).timestamp() * 1000),
            ReportDataType.EntityReportData.value,
        )
        assert report_data.get("data")
