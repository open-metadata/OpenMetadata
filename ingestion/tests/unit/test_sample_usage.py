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
Query parser utils tests
"""
import json
import os.path
from unittest import TestCase

from metadata.workflow.usage import UsageWorkflow

config = """
{
  "source": {
    "type": "custom-database",
    "serviceName": "sample_data",
    "serviceConnection": {
      "config": {
        "type": "CustomDatabase",
        "sourcePythonClass": "metadata.ingestion.source.database.sample_usage.SampleUsageSource",
        "connectionOptions": {
          "sampleDataFolder": "ingestion/examples/sample_data"
        }
      }
    },
    "sourceConfig": {
      "config":{
        "type": "DatabaseUsage"
      }
    }
  },
  "processor": {
    "type": "query-parser",
    "config": {}
  },
  "stage": {
    "type": "table-usage",
    "config": {
      "filename": "/tmp/sample_usage"
    }
  },
  "bulkSink": {
    "type": "metadata-usage",
    "config": {
      "filename": "/tmp/sample_usage"
    }
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "http://localhost:8585/api",
      "authProvider": "openmetadata",
      "securityConfig": {
        "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
      }
    }
  }
}
"""


class QueryParserTest(TestCase):
    def test_join_count(self):
        """
        Check the join count
        """
        expected_result = {
            "shopify.raw_product_catalog": 6,
            "dim_customer": 4,
            "fact_order": 4,
            "shopify.fact_sale": 5,
            "shopify.raw_customer": 11,
        }
        config_dict = json.loads(config)
        config_dict["source"]["serviceConnection"]["config"]["connectionOptions"][
            "sampleDataFolder"
        ] = (
            os.path.dirname(__file__)
            + "/../../../"
            + config_dict["source"]["serviceConnection"]["config"]["connectionOptions"][
                "sampleDataFolder"
            ]
        )
        workflow = UsageWorkflow.create(config_dict)
        workflow.execute()
        table_usage_map = {}

        # UsageWorkflow has the steps (processor, stage, bulk_sink)
        for key, value in workflow.steps[1].table_usage.items():
            table_usage_map[key[0]] = value.count

        for table_name, expected_count in expected_result.items():
            try:
                self.assertEqual(table_usage_map[table_name], expected_count)
            except KeyError:
                self.assertTrue(False)
        workflow.stop()
