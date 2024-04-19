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
Test doris using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.doris.metadata import DorisSource

mock_doris_config = {
    "source": {
        "type": "doris",
        "serviceName": "local_doris1",
        "serviceConnection": {
            "config": {
                "username": "root",
                "hostPort": "localhost:3308",
                "password": "test",
                "sslConfig": {
                    "caCertificate": "-----BEGIN CERTIFICATE-----\nCLDQqO0R0Wer+M7+Yj5HL0T4/3euPZf4fEbh1M\n3eqn7h3iR7POOFH9tXksreiYDbDIX60phZVo0jksVSPlONyyaR87InEU4RoxXtV/\n4IGA78xlgtjL7qu6hlkzqizjFv+yQiUXPiwiSalyKx0VXs85hQx71I+3Ga1CipmW\nui+gr91udiVH\n-----END CERTIFICATE-----\n",
                    "sslCertificate": "-----BEGIN CERTIFICATE-----\nbe6xnpPXpCIcVQLgOL3wMwjrR05EWx9D0AYqArtxzJ7myfvHF4wHeu9djR5jjfS9\nZwc9/MuLhy9acck0F8wvuUiW5MoJpDr8FLMbKIiI4PdG6QVCMR0N7doZa7rCqYTq\n/7JvwqYhJezS1XirGsMHVN8Q6AJJW1+jcyl5FOt8eeTAeQRNDFeotMEXxRc3YW2x\ntzqXuATO4ZJmL7kQZnzF2D4HzOWFN4lljj8IL++foy4Lw8osKcz8DF10HYZmmAYt\nqYyGJ/nxi/faPUjp6fFwjDbwBZ65ZjqIpeV7S2JRVSgFR1UK5rQppTboRuvi+inK\nXU6PkBcOvJYVoEHgYgxBG93axr79HhBdi2W7tIcR+CsjLG6E77dxzVLv0e3XDWxu\n27d8lHmtUiHl999QyoNW2VOs5K8jnalWJBVwTK+ItoQOuyEU67HtTmFSS275fJ0V\n-----END CERTIFICATE-----\n",
                    "sslKey": "-----BEGIN PRIVATE KEY-----\nMIIJQgIBADANBgkqhkiG9w0BAQj9HOpQWDBDZHiUo+px\nzS+12L8fWblnZJSZIuoO3KPQWyFzhf7MLhyUp9NKfWECGzR/dcmyXkbYVO1acjR+\nQ05m0CwJZAfRRrLSgkrNzrDV7kZNatXF4C7Gu1+i/ODa9BajyX0UuJ5jwcpxjzxC\n8wKCAQEAnCQ5FyYyM/Ux7fIb9E9zaNh9IEW8OHybE755SOD4K743T68hBtVznk4V\niXA1mmopC7VeFHNTEB1MU4JJwl59XYk/X4W/2dlXmVo4LqKtYx7rOi62iGjR3wHc\nU/Yz1BpkkyWQaGqTw4fvP9Ho2xnurXsZ1x/es64RfxypYApmjyhIHXQNVa98paZD\nJw0ta3gIlmsLkxwSWqpS3erLGt8WUaa8+7w5RyQv5LDhyjPr4WoJcd10VBivSn0z\nZIhhO/gyZLSYyJsGt/aRTXFQyrk95V2jciH0DUId2MojOrtwslZrUzT1VJqHOWY0\nfy6xAoN1ZNv76I0mvly38KRq2ijnVg==\n-----END PRIVATE KEY-----\n",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}


class DorisUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_doris_config)
        self.doris_source = DorisSource.create(
            mock_doris_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.doris_source.close()
