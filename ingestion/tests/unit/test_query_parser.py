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
    "sourceConfig": {}
  },
  "processor": {
    "type": "query-parser",
    "config": {
      "filter": ""
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
            "shopify.dim_address": 100,
            "shopify.dim_shop": 190,
            "shopify.dim_customer": 125,
            "dim_customer": 9,
            "shopify.dim_location": 75,
            "dim_location.shop_id": 25,
            "dim_shop.shop_id": 105,
            "shopify.dim_product": 130,
            "dim_product.shop_id": 80,
            "shopify.dim_product_variant": 35,
            "dim_shop": 5,
            "shopify.dim_staff": 75,
            "shopify.fact_line_item": 100,
            "shopify.fact_order": 185,
            "shopify.dim_api_client": 85,
            "shopify.fact_sale": 420,
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
