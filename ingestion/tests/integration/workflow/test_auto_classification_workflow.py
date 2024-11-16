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
Validate the initialization of the Auto Classification Workflow
"""
from unittest.mock import patch

import yaml

from metadata.profiler.source.metadata import OpenMetadataSource
from metadata.workflow.classification import AutoClassificationWorkflow


@patch.object(
    OpenMetadataSource,
    "_validate_service_name",
    return_value=True,
)
def test_init_auto_classification(*_) -> None:
    """We can properly instantiate the app"""

    config = """
            source:
              type: mysql
              serviceName: mysql
              serviceConnection:
                config:
                  type: Mysql
                  username: openmetadata_user
                  authType:
                    password: openmetadata_password
                  hostPort: localhost:3306
                  databaseSchema: openmetadata_db
              sourceConfig:
                config:
                  type: AutoClassification
                  storeSampleData: true
                  enableAutoClassification: true
                  tableFilterPattern:
                    includes:
                      - entity
            processor:
              type: orm-profiler
              config: {}
            sink:
              type: metadata-rest
              config: {}
            workflowConfig:
              loggerLevel: DEBUG 
              openMetadataServerConfig:
                enableVersionValidation: false
                hostPort: 'http://localhost:8585/api'
                authProvider: openmetadata
                securityConfig:
                  jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            """

    workflow = AutoClassificationWorkflow.create(yaml.safe_load(config))
    assert isinstance(workflow, AutoClassificationWorkflow)
