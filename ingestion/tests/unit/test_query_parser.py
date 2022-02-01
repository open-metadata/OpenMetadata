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
import csv
import json
from datetime import datetime
from unittest import TestCase

from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.processor.query_parser import QueryParserProcessor

config = """
{
  "source": {
    "type": "sample-usage",
    "config": {
      "database": "warehouse",
      "service_name": "bigquery_gcp",
      "sample_data_folder": "ingestion/tests/unit/resources"
    }
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
  "bulk_sink": {
    "type": "metadata-usage",
    "config": {
      "filename": "/tmp/sample_usage"
    }
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
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
            "dim_address": 100,
            "dim_shop": 196,
            "dim_customer": 140,
            "dim_location": 75,
            "dim_location.shop_id": 25,
            "dim_shop.shop_id": 105,
            "dim_product": 130,
            "dim_product.shop_id": 80,
            "dim_product_variant": 35,
            "dim_staff": 75,
            "fact_line_item": 100,
            "fact_order": 185,
            "dim_api_client": 85,
            "fact_sale": 400,
            "customer": 4,
            "orders": 2,
            "products": 2,
            "orderdetails": 2,
            "country": 1,
            "city": 1,
            "call": 1,
            "countries": 1,
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
