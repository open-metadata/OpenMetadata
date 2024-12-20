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
Snowflake models
"""
import urllib
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, TypeAdapter, field_validator
from requests.utils import quote
from sqlalchemy import text
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.storedProcedure import Language
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_QUERY_LOG_QUERY,
)
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.utils.dict import ExtendedDict
from metadata.utils.logger import ingestion_logger
from metadata.utils.profiler_utils import QueryResult

logger = ingestion_logger()

STORED_PROC_LANGUAGE_MAP = {
    "PYTHON": Language.Python,
    "SQL": Language.SQL,
    "JAVA": Language.Java,
    "JAVASCRIPT": Language.JavaScript,
}


class SnowflakeStoredProcedure(BaseModel):
    """Snowflake stored procedure list query results"""

    name: str = Field(..., alias="NAME")
    owner: Optional[str] = Field(None, alias="OWNER")
    language: str = Field(..., alias="LANGUAGE")
    definition: Optional[str] = Field(None, alias="DEFINITION")
    signature: Optional[str] = Field(
        None, alias="SIGNATURE", description="Used to build the source URL"
    )
    comment: Optional[str] = Field(None, alias="COMMENT")
    procedure_type: Optional[str] = Field(None, alias="PROCEDURE_TYPE")

    # Update the signature to clean it up on read
    @field_validator("signature")
    def clean_signature(  # pylint: disable=no-self-argument
        cls, signature
    ) -> Optional[str]:
        """
        pylint: keeping the approach from pydantic docs

        A signature may look like `(TABLE_NAME VARCHAR, NAME VARCHAR)`
        We want it to keep only `(VARCHAR, VARCHAR).

        This is needed to build the source URL of the procedure, so we'll
        directly parse the quoted signature
        """
        try:
            clean_signature = signature.replace("(", "").replace(")", "")
            if not clean_signature:
                # If removing the () leaves us with nothing, then just return the parenthesis
                return "()"

            signature_list = clean_signature.split(",")
            clean_signature_list = [elem.split(" ")[-1] for elem in signature_list]

            return f"({quote(', '.join(clean_signature_list))})"
        except Exception as exc:
            logger.warning(f"Error cleaning up Stored Procedure signature - [{exc}]")
            return signature

    def unquote_signature(self) -> Optional[str]:
        return urllib.parse.unquote(self.signature) if self.signature else "()"


class SnowflakeTable(BaseModel):
    """Models the items returned from the Table and View Queries used to get the entities to process.
    :name: Holds the table/view name.
    :deleted: Holds either a datetime if the table was deleted or None.
    """

    name: str
    deleted: Optional[datetime] = None


class SnowflakeTableList(BaseModel):
    """Understands how to return the deleted and not deleted tables/views from a given list."""

    tables: List[SnowflakeTable]

    def get_deleted(self) -> List[SnowflakeTable]:
        return [table for table in self.tables if table.deleted]

    def get_not_deleted(self) -> List[SnowflakeTable]:
        return [table for table in self.tables if not table.deleted]


class SnowflakeQueryLogEntry(BaseModel):
    """Entry for a Snowflake query log at SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
    More info at: https://docs.snowflake.com/en/sql-reference/account-usage/query_history
    """

    query_id: str
    database_name: Optional[str] = None
    schema_name: Optional[str] = None
    query_type: str
    start_time: datetime
    query_text: Optional[str] = None
    rows_inserted: Optional[int] = None
    rows_updated: Optional[int] = None
    rows_deleted: Optional[int] = None

    @staticmethod
    def get_for_table(session: Session, tablename: str):
        rows = session.execute(
            text(
                SNOWFLAKE_QUERY_LOG_QUERY.format(
                    tablename=tablename,  # type: ignore
                    insert=DatabaseDMLOperations.INSERT.value,
                    update=DatabaseDMLOperations.UPDATE.value,
                    delete=DatabaseDMLOperations.DELETE.value,
                    merge=DatabaseDMLOperations.MERGE.value,
                )
            )
        )
        return TypeAdapter(List[SnowflakeQueryLogEntry]).validate_python(
            [ExtendedDict(r).lower_case_keys() for r in rows]
        )


class SnowflakeQueryResult(QueryResult):
    """Snowflake system metric query result"""

    rows_inserted: Optional[int] = None
    rows_updated: Optional[int] = None
    rows_deleted: Optional[int] = None
