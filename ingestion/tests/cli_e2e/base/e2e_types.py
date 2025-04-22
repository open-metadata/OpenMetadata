#  Copyright 2022 Collate
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
E2E test types
"""

from enum import Enum


class E2EType(Enum):
    """
    E2E Type Enum Class
    """

    INGEST = "ingest"
    PROFILER = "profiler"
    LINEAGE = "lineage"
    PROFILER_PROCESSOR = "profiler-processor"
    AUTO_CLASSIFICATION = "auto-classification"
    DATA_QUALITY = "test"
    INGEST_DB_FILTER_SCHEMA = "ingest-db-filter-schema"
    INGEST_DB_FILTER_TABLE = "ingest-db-filter-table"
    INGEST_DB_FILTER_MIX = "ingest-db-filter-mix"
    INGEST_DASHBOARD_FILTER_MIX = "ingest-dashboard-filter-mix"
    INGEST_DASHBOARD_NOT_INCLUDING = "ingest-dashboard-not-including"
