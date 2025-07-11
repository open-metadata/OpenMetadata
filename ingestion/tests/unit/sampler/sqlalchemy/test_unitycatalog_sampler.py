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
Test Unity Catalog sampler functionality
"""
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.sampler import DEFAULT_MAX_ARRAY_ELEMENTS
from metadata.sampler.sqlalchemy.unitycatalog.sampler import (
    UnityCatalogSamplerInterface,
)

Base = declarative_base()


class _TestTableModel(Base):
    __tablename__ = "test_table"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    array_col = Column(CustomArray(String))


class UnityCatalogSamplerTest(TestCase):
    """Test Unity Catalog sampler functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.table_entity = Table(
            id=uuid4(),
            name="test_table",
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                ),
                EntityColumn(
                    name=ColumnName("name"),
                    dataType=DataType.STRING,
                ),
                EntityColumn(
                    name=ColumnName("array_col"),
                    dataType=DataType.ARRAY,
                ),
            ],
        )

        self.unity_catalog_conn = UnityCatalogConnection(
            hostPort="localhost:443",
            token="test_token",
            httpPath="/sql/1.0/warehouses/test",
            catalog="test_catalog",
        )

    @patch(
        "metadata.sampler.sqlalchemy.unitycatalog.sampler.SQASampler.build_table_orm"
    )
    def test_handle_array_column(self, mock_build_table_orm):
        """Test array column detection"""
        mock_build_table_orm.return_value = _TestTableModel

        sampler = UnityCatalogSamplerInterface(
            service_connection_config=self.unity_catalog_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(),
        )

        # Test with array column
        array_col = _TestTableModel.__table__.c.array_col
        self.assertTrue(sampler._handle_array_column(array_col))

        # Test with non-array column
        name_col = _TestTableModel.__table__.c.name
        self.assertFalse(sampler._handle_array_column(name_col))

    def test_get_max_array_elements_default(self):
        """Test default max array elements from base class"""
        # Create a minimal sampler instance to test the method
        sampler = UnityCatalogSamplerInterface.__new__(UnityCatalogSamplerInterface)
        sampler.sample_config = SampleConfig()

        # Test that it returns the default value from the base class
        self.assertEqual(sampler._get_max_array_elements(), DEFAULT_MAX_ARRAY_ELEMENTS)

    def test_get_slice_expression(self):
        """Test slice expression generation for array columns"""
        # Create a minimal sampler instance to test the method
        sampler = UnityCatalogSamplerInterface.__new__(UnityCatalogSamplerInterface)
        sampler.sample_config = SampleConfig()

        # Create a mock column
        array_col = _TestTableModel.__table__.c.array_col

        # Test the slice expression generation
        expression = sampler._get_slice_expression(array_col)

        # Check that it returns a text() object with the expected SQL
        self.assertIsNotNone(expression)
        # The expression should contain the expected SQL pattern
        sql_str = str(expression.compile(compile_kwargs={"literal_binds": True}))
        self.assertIn("CASE", sql_str)
        self.assertIn("slice", sql_str)
        self.assertIn("array_col", sql_str)
