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
Validate the names in the registry match the ones of the test definition
"""


import pkgutil
from unittest import TestCase

import metadata.data_quality.validations.column.pandas as pandas_column
import metadata.data_quality.validations.column.sqlalchemy as sqa_column
import metadata.data_quality.validations.table.pandas as pandas_table
import metadata.data_quality.validations.table.sqlalchemy as sqa_table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import \
    OpenMetadataConnection
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.ingestion.ometa.ometa_api import OpenMetadata

test_suite_config = {
    "source": {
        "type": "TestSuite",
        "serviceName": "TestSuiteWorkflow",
        "sourceConfig": {"config": {"type": "TestSuite"}},
    },
    "processor": {
        "type": "orm-test-runner",
        "config": {},
    },
    "sink": {"type": "metadata-rest", "config": {}},
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


class TestRegistryNamesMatchTestDefinition(TestCase):
    """Test the names in the registry match that of the ones in the Test Definition"""

    metadata = OpenMetadata(
        OpenMetadataConnection.parse_obj(
            test_suite_config["workflowConfig"]["openMetadataServerConfig"]
        )
    )

    def test_sqa_tests_match(self):
        """test all the sqa names in the registry match the ones from the test definition"""

        test_definition_names = {
            entity.name.__root__
            for entity in self.metadata.list_all_entities(
                entity=TestDefinition, params={"limit": "100"}
            )
        }

        column_tests = [
            name for _, name, _ in pkgutil.iter_modules(sqa_column.__path__)
        ]
        table_tests = [name for _, name, _ in pkgutil.iter_modules(sqa_table.__path__)]

        registry_test_name = set(column_tests + table_tests)

        assert registry_test_name.issubset(test_definition_names)

    def test_pandas_tests_match(self):
        """test all the sqa names in the registry match the ones from the test definition"""

        test_definition_names = {
            entity.name.__root__
            for entity in self.metadata.list_all_entities(
                entity=TestDefinition, params={"limit": "100"}
            )
        }

        column_tests = [
            name for _, name, _ in pkgutil.iter_modules(pandas_column.__path__)
        ]
        table_tests = [
            name for _, name, _ in pkgutil.iter_modules(pandas_table.__path__)
        ]

        registry_test_name = set(column_tests + table_tests)

        assert registry_test_name.issubset(test_definition_names)
