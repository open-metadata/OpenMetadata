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
import csv
import json
import os.path
import time
from unittest import TestCase

from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
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
        Check the join count with comprehensive LineageParser performance measurement
        """
        expected_result = {
            "shopify.raw_product_catalog": 6,
            "dim_customer": 4,
            "fact_order": 4,
            "shopify.fact_sale": 5,
            "shopify.raw_customer": 11,
        }
        config_dict = json.loads(config)

        # PART 1: LineageParser Performance Test on ALL queries
        print(f"\n{'='*80}")
        print("PART 1: LineageParser Performance Test - ALL QUERIES")
        print(f"{'='*80}\n")

        sample_data_folder = (
            os.path.dirname(__file__)
            + "/../../../"
            + config_dict["source"]["serviceConnection"]["config"]["connectionOptions"][
                "sampleDataFolder"
            ]
        )
        query_log_path = os.path.join(sample_data_folder, "datasets/query_log")

        print(f"Loading queries from: {query_log_path}")

        with open(query_log_path, "r", encoding="utf-8") as fin:
            import csv as csv_module

            query_logs = [dict(i) for i in csv_module.DictReader(fin)]

        print(f"Loaded {len(query_logs)} queries from CSV\n")

        total_queries = len(query_logs)
        successful_parses = 0
        timeout_parses = 0
        failed_parses = 0
        total_parse_time = 0.0

        print("Processing ALL queries (no filtering):\n")

        for idx, query_record in enumerate(query_logs, start=1):
            query = query_record.get("query", "")
            query_len = len(query)
            query_preview = query[:80].replace("\n", " ")

            print(f"Query #{idx}/{total_queries}:")
            print(f"  Length: {query_len:,} chars")
            print(f"  Preview: {query_preview}...")

            start_time = time.time()

            try:
                parser = LineageParser(
                    query, dialect=Dialect.MYSQL, timeout_seconds=300
                )
                parse_duration = time.time() - start_time
                total_parse_time += parse_duration

                if parser.parser is None:
                    status = "TIMEOUT"
                    timeout_parses += 1
                    tables = []
                else:
                    status = "SUCCESS"
                    successful_parses += 1
                    tables = parser.involved_tables or []

                throughput = query_len / parse_duration if parse_duration > 0 else 0

                print(f"  Result: {status}")
                print(f"  Duration: {parse_duration:.2f}s")
                print(f"  Throughput: {throughput:,.0f} chars/s")
                print(f"  Tables found: {len(tables)}")
                if tables:
                    print(f"  Table names: {[str(t) for t in tables]}")

            except Exception as e:
                parse_duration = time.time() - start_time
                total_parse_time += parse_duration
                failed_parses += 1
                status = "ERROR"

                print(f"  Result: {status}")
                print(f"  Duration: {parse_duration:.2f}s")
                print(f"  Error: {type(e).__name__}: {str(e)[:100]}")

            print("")  # Blank line between queries

        print(f"{'='*80}")
        print("LineageParser Performance Summary")
        print(f"{'='*80}")
        print(f"Total queries: {total_queries}")
        print(
            f"Successful: {successful_parses} ({successful_parses*100/total_queries:.1f}%)"
        )
        print(f"Timeouts: {timeout_parses} ({timeout_parses*100/total_queries:.1f}%)")
        print(f"Errors: {failed_parses} ({failed_parses*100/total_queries:.1f}%)")
        print(f"Total parse time: {total_parse_time:.2f}s")
        print(f"Average per query: {total_parse_time/total_queries:.2f}s")

        if successful_parses == total_queries:
            print("\n✓ All queries parsed successfully!")
        else:
            print(f"\n⚠ {timeout_parses + failed_parses} queries had issues")

        print(f"{'='*80}\n")

        # PART 2: Original UsageWorkflow Test
        print(f"\n{'='*80}")
        print("PART 2: UsageWorkflow Test")
        print(f"{'='*80}\n")

        config_dict = json.loads(config)

        # DEBUG: Print the sample data folder path
        sample_data_folder = (
            os.path.dirname(__file__)
            + "/../../../"
            + config_dict["source"]["serviceConnection"]["config"]["connectionOptions"][
                "sampleDataFolder"
            ]
        )
        print(f"\n{'='*80}")
        print(f"DEBUG: Sample data folder path: {sample_data_folder}")

        # DEBUG: Print git information
        try:
            repo_root = os.path.dirname(__file__) + "/../../.."
            git_branch = (
                os.popen(
                    f"cd {repo_root} && git rev-parse --abbrev-ref HEAD 2>/dev/null"
                )
                .read()
                .strip()
            )
            git_commit = (
                os.popen(f"cd {repo_root} && git rev-parse --short HEAD 2>/dev/null")
                .read()
                .strip()
            )
            print(f"DEBUG: Git branch: {git_branch}")
            print(f"DEBUG: Git commit: {git_commit}")
        except Exception as e:
            print(f"DEBUG: Could not get git info: {e}")

        # DEBUG: Check if query_log file exists and print its details
        query_log_path = os.path.join(sample_data_folder, "datasets/query_log")
        print(f"DEBUG: Query log file path: {query_log_path}")
        print(f"DEBUG: Query log file exists: {os.path.exists(query_log_path)}")

        if os.path.exists(query_log_path):
            with open(query_log_path, "r") as f:
                lines = f.readlines()
                print(f"DEBUG: Total lines in query_log: {len(lines)}")

                # Count occurrences of each table
                raw_product_catalog_count = sum(
                    1 for line in lines if "raw_product_catalog" in line.lower()
                )
                raw_customer_count = sum(
                    1 for line in lines if "raw_customer" in line.lower()
                )
                dim_customer_count = sum(
                    1 for line in lines if "dim_customer" in line.lower()
                )
                fact_order_count = sum(
                    1 for line in lines if "fact_order" in line.lower()
                )
                fact_sale_count = sum(
                    1 for line in lines if "fact_sale" in line.lower()
                )

                print("DEBUG: Raw counts from file:")
                print(f"  - raw_product_catalog: {raw_product_catalog_count}")
                print(f"  - raw_customer: {raw_customer_count}")
                print(f"  - dim_customer: {dim_customer_count}")
                print(f"  - fact_order: {fact_order_count}")
                print(f"  - fact_sale: {fact_sale_count}")

                # Print first 50 lines with raw_product_catalog
                print("\nDEBUG: Sample queries with raw_product_catalog:")
                count = 0
                for i, line in enumerate(lines):
                    if "raw_product_catalog" in line.lower() and count < 50:
                        print(f"  Line {i+1}: {line[:100]}...")
                        count += 1

        print(f"{'='*80}\n")

        config_dict["source"]["serviceConnection"]["config"]["connectionOptions"][
            "sampleDataFolder"
        ] = sample_data_folder

        # DEBUG: Load and inspect the CSV data like the workflow does
        query_log_path = os.path.join(sample_data_folder, "datasets/query_log")
        with open(query_log_path, "r", encoding="utf-8") as fin:
            query_logs = [dict(i) for i in csv.DictReader(fin)]

        print("DEBUG: CSV parsing results:")
        print(f"  - Total queries loaded from CSV: {len(query_logs)}")

        # Count queries containing raw_product_catalog in the parsed CSV
        raw_product_queries = [
            q for q in query_logs if "raw_product_catalog" in q.get("query", "").lower()
        ]
        print(
            f"  - Queries with raw_product_catalog after CSV parse: {len(raw_product_queries)}"
        )

        if len(raw_product_queries) > 0:
            print("\nDEBUG: First 50 parsed queries with raw_product_catalog:")
            for idx, q in enumerate(raw_product_queries[:50]):
                query_preview = q.get("query", "")[:150].replace("\n", " ")
                print(f"  {idx+1}. {query_preview}...")

        print(f"{'='*80}\n")

        workflow = UsageWorkflow.create(config_dict)
        workflow.execute()
        table_usage_map = {}

        # UsageWorkflow has the steps (processor, stage, bulk_sink)
        for key, value in workflow.steps[1].table_usage.items():
            table_usage_map[key[0]] = value.count

        print(f"\n{'='*80}")
        print("DEBUG: Test Results Comparison:")
        print(f"{'='*80}")
        for table_name, expected_count in expected_result.items():
            actual_count = table_usage_map.get(table_name, "NOT FOUND")
            status = "✓ PASS" if actual_count == expected_count else "✗ FAIL"
            print(
                f"{status} | Table: {table_name:30} | Expected: {expected_count:3} | Actual: {actual_count}"
            )
            try:
                self.assertEqual(table_usage_map[table_name], expected_count)
            except KeyError:
                print(f"ERROR: Table '{table_name}' not found in table_usage_map!")
                print(f"Available tables: {list(table_usage_map.keys())}")
                self.assertTrue(False)
        print(f"{'='*80}\n")
        workflow.stop()
