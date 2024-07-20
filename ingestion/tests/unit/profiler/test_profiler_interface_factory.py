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
Factory class for creating profiler interface objects
"""

from typing import Dict
from unittest import TestCase

from metadata.profiler.interface.profiler_interface_factory import (
    profiler_class_mapping,
)


class TestProfilerClassMapping(TestCase):
    def setUp(self):
        self.expected_mapping: Dict[str, str] = {
            "DatabaseConnection": "metadata.profiler.interface.sqlalchemy.profiler_interface.SQAProfilerInterface",
            "BigQueryConnection": "metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface.BigQueryProfilerInterface",
            "SingleStoreConnection": "metadata.profiler.interface.sqlalchemy.single_store.profiler_interface.SingleStoreProfilerInterface",
            "DatalakeConnection": "metadata.profiler.interface.pandas.profiler_interface.PandasProfilerInterface",
            "MariaDBConnection": "metadata.profiler.interface.sqlalchemy.mariadb.profiler_interface.MariaDBProfilerInterface",
            "SnowflakeConnection": "metadata.profiler.interface.sqlalchemy.snowflake.profiler_interface.SnowflakeProfilerInterface",
            "TrinoConnection": "metadata.profiler.interface.sqlalchemy.trino.profiler_interface.TrinoProfilerInterface",
            "UnityCatalogConnection": "metadata.profiler.interface.sqlalchemy.unity_catalog.profiler_interface.UnityCatalogProfilerInterface",
            "DatabricksConnection": "metadata.profiler.interface.sqlalchemy.databricks.profiler_interface.DatabricksProfilerInterface",
            "Db2Connection": "metadata.profiler.interface.sqlalchemy.db2.profiler_interface.DB2ProfilerInterface",
            "MongoDBConnection": "metadata.profiler.interface.nosql.profiler_interface.NoSQLProfilerInterface",
            "DynamoDBConnection": "metadata.profiler.interface.nosql.profiler_interface.NoSQLProfilerInterface",
        }

    def test_profiler_class_mapping(self):
        self.assertEqual(len(profiler_class_mapping), len(self.expected_mapping))
        self.assertEqual(profiler_class_mapping, self.expected_mapping)
