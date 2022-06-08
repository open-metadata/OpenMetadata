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
    "config": {
    }
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
            "shopify.dim_address": 200,
            "shopify.shop": 300,
            "shopify.dim_customer": 250,
            "dim_customer": 76,
            "shopify.dim_location": 150,
            "dim_location.shop_id": 50,
            "shop": 56,
            "shop_id": 50,
            "shopify.dim_staff": 150,
            "shopify.fact_line_item": 200,
            "shopify.fact_order": 310,
            "shopify.product": 10,
            "shopify.fact_sale": 520,
            "dim_address": 24,
            "api": 4,
            "dim_location": 8,
            "product": 32,
            "dim_staff": 10,
            "fact_line_item": 34,
            "fact_order": 30,
            "fact_sale": 54,
            "fact_session": 62,
            "raw_customer": 20,
            "raw_order": 26,
            "raw_product_catalog": 12,
        }
        workflow = Workflow.create(json.loads(config))
        workflow.execute()
        for table_name, expected_count in expected_result.items():
            try:
                self.assertEqual(
                    workflow.stage.table_usage[table_name].count, expected_count
                )
            except KeyError as err:
                self.assertTrue(False)
        workflow.stop()
