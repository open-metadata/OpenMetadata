#  Copyright 2025 Collate
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
Test Microstrategy using the topology
"""
from datetime import datetime
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.microstrategy.metadata import (
    MicrostrategySource,
)
from metadata.ingestion.source.dashboard.microstrategy.models import (
    MstrDashboard,
    MstrOwner,
    MstrProject,
)

mock_micro_config = {
    "source": {
        "type": "microstrategy",
        "serviceName": "local_stitch_test",
        "serviceConnection": {
            "config": {
                "type": "MicroStrategy",
                "hostPort": "https://demo.microstrategy.com",
                "username": "username",
                "password": "password",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        },
    },
}

MOCK_PROJECT_LIST = [
    MstrProject(
        acg=5,
        id="B7CA92F04B9FAE8D941C3E9B7E0CD754",
        name="MicroStrategy Tutorial",
        status=0,
        alias="",
        description="fun",
        dateCreated=datetime(2015, 6, 30, 21, 55, 35),
        dateModified=datetime(2024, 10, 1, 21, 42, 50),
        owner=MstrOwner(name="Administrator", id="54F3D26011D2896560009A8E67019608"),
    )
]

MOCK_DASHBORD_LIST = [
    MstrDashboard(
        name="Library of Demos",
        id="925FB4A311EA52FF3EA80080EF059105",
        type=55,
        description="abc",
        subtype=14081,
        dateCreated="2020-02-19T10:07:01.000+0000",
        dateModified="2024-11-06T14:14:42.000+0000",
        version="3E367000E84DD4AA9B501EAD892EB2E1",
        acg=199,
        owner=MstrOwner(name="Administrator", id="54F3D26011D2896560009A8E67019608"),
        extType=0,
        viewMedia=1879072805,
        certifiedInfo={"certified": False},
        templateInfo={"template": False, "lastModifiedBy": {}},
        projectId="EC70648611E7A2F962E90080EFD58751",
        projectName="MicroStrategy Tutorial",
    )
]


class MicroStrategyUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    MicroStrategy Unit Testtest_dbt
    """

    @patch(
        "metadata.ingestion.source.dashboard.microstrategy.metadata.MicrostrategySource.test_connection"
    )
    @patch(
        "metadata.ingestion.source.dashboard.microstrategy.connection.get_connection"
    )
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        get_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_micro_config)
        self.microstrategy = MicrostrategySource.create(
            mock_micro_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.microstrategy.client = SimpleNamespace()

    def test_get_dashboards_list(self):
        """
        Get the dashboards
        """
        self.microstrategy.client.is_project_name = lambda *_: False
        self.microstrategy.client.get_projects_list = lambda *_: MOCK_PROJECT_LIST
        self.microstrategy.client.get_dashboards_list = lambda *_: MOCK_DASHBORD_LIST
        fetched_dashboards_list = self.microstrategy.get_dashboards_list()
        self.assertEqual(list(fetched_dashboards_list), MOCK_DASHBORD_LIST)
