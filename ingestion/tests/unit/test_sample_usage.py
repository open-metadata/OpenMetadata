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
Query parser utils tests
"""
import json
from unittest import TestCase

from metadata.ingestion.api.workflow import Workflow

config = """
{
  "source": {
    "type": "sample-usage",
    "serviceName": "sample_data",
    "serviceConnection": {
      "config": {
        "type": "SampleData",
        "sampleDataFolder": "ingestion/examples/sample_data"
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
      "authProvider": "no-auth"
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
            "shopify.raw_product_catalog": 2,
            "dim_customer": 2,
            "fact_order": 2,
            "shopify.fact_sale": 3,
            "shopify.raw_customer": 10,
        }
        workflow = Workflow.create(json.loads(config))
        workflow.execute()
        table_usage_map = {}

        for key, value in workflow.stage.table_usage.items():
            table_usage_map[key[0]] = value.count

        for table_name, expected_count in expected_result.items():
            try:
                self.assertEqual(table_usage_map[table_name], expected_count)
            except KeyError as err:
                self.assertTrue(False)
        workflow.stop()
