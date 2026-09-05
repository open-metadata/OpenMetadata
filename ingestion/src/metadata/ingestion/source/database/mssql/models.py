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
"""MSSQL models"""

from enum import IntEnum

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.storedProcedure import Language

STORED_PROC_LANGUAGE_MAP = {
    "SQL": Language.SQL,
    "EXTERNAL": Language.External,
}


class QueryStoreState(IntEnum):
    """Values of sys.database_query_store_options.actual_state."""

    OFF = 0
    READ_ONLY = 1
    READ_WRITE = 2
    ERROR = 3


# sys.database_query_store_options.readonly_reason value that means the database is
# a readable Availability Group secondary (SQL Server < 2025).  On such a replica the
# Query Store contains the *primary*'s captured workload, not this node's, so we must
# fall back to the plan-cache DMVs to see the secondary's actual query traffic.
QUERY_STORE_READONLY_REASON_AG_SECONDARY = 8


class MssqlStoredProcedure(BaseModel):
    """MSSQL stored procedure list query results"""

    name: str = Field(...)
    owner: str | None = Field(None)
    language: str = Field(Language.SQL)
    definition: str | None = Field(None)
