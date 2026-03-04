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
Test TimescaleDB Pydantic models and utility functions
"""

from unittest import TestCase

from metadata.ingestion.source.database.timescale.models import (
    CompressionSettings,
    HypertableInfo,
)


class TimescaleModelsTest(TestCase):
    """Test TimescaleDB Pydantic models"""

    def test_hypertable_info_model_time_based(self):
        """Test HypertableInfo model with time-based partitioning"""
        hypertable_data = {
            "hypertable_schema": "public",
            "hypertable_name": "sensor_data",
            "compression_enabled": True,
            "column_name": "time",
            "interval_length": 86400000000,
            "integer_interval": None,
            "integer_now_func": None,
            "num_dimensions": 1,
        }
        hypertable = HypertableInfo.model_validate(hypertable_data)

        self.assertEqual(hypertable.hypertable_schema, "public")
        self.assertEqual(hypertable.hypertable_name, "sensor_data")
        self.assertTrue(hypertable.compression_enabled)
        self.assertEqual(hypertable.column_name, "time")
        self.assertEqual(hypertable.interval_length, 86400000000)
        self.assertIsNone(hypertable.integer_interval)
        self.assertEqual(hypertable.num_dimensions, 1)

    def test_hypertable_info_model_integer_based(self):
        """Test HypertableInfo model with integer-based partitioning"""
        hypertable_data = {
            "hypertable_schema": "public",
            "hypertable_name": "metrics",
            "compression_enabled": False,
            "column_name": "id",
            "interval_length": None,
            "integer_interval": 1000,
            "integer_now_func": "get_current_id",
            "num_dimensions": 1,
        }
        hypertable = HypertableInfo.model_validate(hypertable_data)

        self.assertEqual(hypertable.hypertable_name, "metrics")
        self.assertFalse(hypertable.compression_enabled)
        self.assertEqual(hypertable.column_name, "id")
        self.assertIsNone(hypertable.interval_length)
        self.assertEqual(hypertable.integer_interval, 1000)
        self.assertEqual(hypertable.integer_now_func, "get_current_id")

    def test_hypertable_info_model_no_compression(self):
        """Test HypertableInfo model without compression"""
        hypertable_data = {
            "hypertable_schema": "public",
            "hypertable_name": "events",
            "compression_enabled": False,
            "column_name": "timestamp",
            "interval_length": 604800000000,
            "integer_interval": None,
            "integer_now_func": None,
            "num_dimensions": 1,
        }
        hypertable = HypertableInfo.model_validate(hypertable_data)

        self.assertFalse(hypertable.compression_enabled)
        self.assertEqual(hypertable.interval_length, 604800000000)

    def test_compression_settings_model(self):
        """Test CompressionSettings model"""
        compression_data = {
            "segment_by_columns": ["device_id", "location"],
            "order_by_columns": ["time", "sensor_id"],
        }
        compression = CompressionSettings.model_validate(compression_data)

        self.assertEqual(compression.segment_by_columns, ["device_id", "location"])
        self.assertEqual(compression.order_by_columns, ["time", "sensor_id"])

    def test_compression_settings_model_empty(self):
        """Test CompressionSettings model with empty lists"""
        compression_data = {
            "segment_by_columns": [],
            "order_by_columns": [],
        }
        compression = CompressionSettings.model_validate(compression_data)

        self.assertEqual(compression.segment_by_columns, [])
        self.assertEqual(compression.order_by_columns, [])

    def test_compression_settings_model_defaults(self):
        """Test CompressionSettings model with None values"""
        compression_data = {
            "segment_by_columns": None,
            "order_by_columns": None,
        }
        compression = CompressionSettings.model_validate(compression_data)

        self.assertIsNone(compression.segment_by_columns)
        self.assertIsNone(compression.order_by_columns)
