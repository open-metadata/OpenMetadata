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

from enum import Enum, IntEnum

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


class MssqlStoredProcedure(BaseModel):
    """MSSQL stored procedure list query results"""

    name: str = Field(...)
    owner: str | None = Field(None)
    language: str = Field(Language.SQL)
    definition: str | None = Field(None)


class SynonymUnresolvedReason(str, Enum):
    """Why a discovered synonym could not be attached to a canonical table"""

    UNRESOLVED = "Unresolved"
    UNSUPPORTED_TARGET_TYPE = "UnsupportedTargetType"
    REMOTE_TARGET_UNMAPPED = "RemoteTargetUnmapped"


class MssqlSynonym(BaseModel):
    """A row from sys.synonyms joined to sys.schemas"""

    synonym_schema: str = Field(...)
    synonym_name: str = Field(...)
    base_object_name: str = Field(...)


class MssqlSynonymTarget(BaseModel):
    """The parsed three-part target a synonym resolves to"""

    database: str = Field(...)
    schema_name: str = Field(...)
    table: str = Field(...)
