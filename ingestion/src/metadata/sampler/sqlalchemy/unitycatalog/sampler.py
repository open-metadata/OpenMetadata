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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from sqlalchemy import Column, text

from metadata.ingestion.source.database.databricks.connection import (
    get_connection as databricks_get_connection,
)
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.sampler.sqlalchemy.sampler import SQASampler


class UnityCatalogSamplerInterface(SQASampler):
    def __init__(self, *args, **kwargs):
        """Initialize with a single Databricks connection"""
        super().__init__(*args, **kwargs)
        self.connection = databricks_get_connection(self.service_connection_config)

    def get_client(self):
        """client is the session for SQA"""
        client = super().get_client()
        self.set_catalog(client)
        return client

    def _handle_array_column(self, column: Column) -> bool:
        """Check if a column is an array type"""
        return isinstance(column.type, CustomArray)

    def _get_slice_expression(self, column: Column):
        """Generate SQL expression to slice array elements at query level

        Args:
            column_name: Name of the column
            max_elements: Maximum number of elements to extract

        Returns:
            SQL expression string for array slicing
        """
        max_elements = self._get_max_array_elements()
        return text(
            f"""
        CASE 
            WHEN `{column.name}` IS NULL THEN NULL
            ELSE slice(`{column.name}`, 1, {max_elements})
        END AS `{column._label}`
        """
        )
