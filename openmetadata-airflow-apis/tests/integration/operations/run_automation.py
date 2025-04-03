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
Test run automations
"""
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.api.parser import parse_automation_workflow_gracefully
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory

JSON_REQUEST = {
    "id": "6192f18e-5f0c-42e3-8568-0c3ce6e07ac5",
    "name": "test-connection-Mysql-Prmeqo2t",
    "fullyQualifiedName": "test-connection-Mysql-Prmeqo2t",
    "workflowType": "TEST_CONNECTION",
    "request": {
        "connection": {
            "config": {
                "type": "Mysql",
                "scheme": "mysql+pymysql",
                "authType": {"password": "fernet:xyz"},
                "hostPort": "mysql:3306",
                "username": "openmetadata_user",
                "databaseSchema": "openmetadata_db",
            }
        },
        "serviceName": "mysql",
        "serviceType": "Database",
        "connectionType": "Mysql",
    },
    "openMetadataServerConnection": {
        "clusterName": "openmetadata",
        "type": "OpenMetadata",
        "hostPort": "http://localhost:8585/api",
        "authProvider": "openmetadata",
        "securityConfig": {
            "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        },
    },
}


def test_run_automation():
    """Follow the flow in run_automation and validate we're getting the right JWT"""

    automation_workflow = parse_automation_workflow_gracefully(config_dict=JSON_REQUEST)

    # we need to instantiate the secret manager in case secrets are passed
    SecretsManagerFactory(
        automation_workflow.openMetadataServerConnection.secretsManagerProvider,
        automation_workflow.openMetadataServerConnection.secretsManagerLoader,
    )

    metadata = OpenMetadata(config=automation_workflow.openMetadataServerConnection)

    # Check the token is valid
    admin: User = metadata.get_by_name(entity=User, fqn="admin")
    assert admin
