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
unity catalog usage module
"""

from metadata.ingestion.source.database.databricks.usage import DatabricksUsageSource
from metadata.ingestion.source.database.unitycatalog.query_parser import (
    UnityCatalogQueryParserSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UnitycatalogUsageSource(UnityCatalogQueryParserSource, DatabricksUsageSource):
    """
    UnityCatalog Usage Source

    This class would be inheriting all the methods from
    DatabricksUsageSource as both the sources would call
    the same API for fetching Usage Queries
    """
