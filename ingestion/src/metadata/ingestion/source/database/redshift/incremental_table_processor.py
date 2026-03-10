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
Incremental Processor for Redshift
"""
import re
from datetime import datetime
from typing import Dict, FrozenSet, Iterable, List, Optional, Tuple

from sqlalchemy.engine import Connection
from sqlalchemy.sql import text

from metadata.ingestion.source.database.redshift.models import (
    RedshiftTable,
    RedshiftTableChangeQueryRegex,
    RedshiftTableMap,
    SchemaName,
    TableName,
)
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_TABLE_CHANGES_QUERY,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Pre-built translation table for _clean_statement.
# Computed once at import time; str.translate() performs a single C-level pass
# instead of four chained str.replace() calls that each create an intermediate
# string object.  None as a value deletes the character.
_CLEAN_TABLE: dict = str.maketrans({"\n": " ", "\t": " ", "\v": " ", '"': None})

# ---- Regex Definitions
TABLE_NAME_RE = r"(\w+\.){0,2}\w+"

CREATE_TABLE = rf"^.*CREATE\s+(LOCAL\s+|EXTERNAL\s+)?(TEMPORARY\s+|TEMP\s+)?TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?P<table>{TABLE_NAME_RE}).*$"

ALTER_TABLE = rf"^.*(ALTER\s+TABLE)\s+(?P<table>{TABLE_NAME_RE}).*$"

DROP_TABLE = rf"^.*DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(?P<table>{TABLE_NAME_RE}).*$"

CREATE_VIEW = rf"^.*CREATE\s+(OR\s+REPLACE\s+)?(EXTERNAL\s+|MATERIALIZED\s+)?VIEW\s+(?P<table>{TABLE_NAME_RE}).*$"

ALTER_VIEW = rf"^.*ALTER\s+(EXTERNAL\s+)?VIEW\s+(?P<table>{TABLE_NAME_RE}).*$"

DROP_VIEW = rf"^.*DROP\s+(EXTERNAL\s+|MATERIALIZED\s+)?VIEW\s+(IF\s+EXISTS\s+)?(?P<table>{TABLE_NAME_RE}).*$"

# Not supporting Comment changes on Constraint
COMMENT = rf"^.*COMMENT\s+ON\s+(TABLE|COLUMN|VIEW)\s+(?P<table>{TABLE_NAME_RE}).*$"

# Named instances so _KW_TO_CANDIDATES can reference them without fragile indexing.
_ALTER_TABLE_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(ALTER_TABLE, re.IGNORECASE), deleted=False
)
_CREATE_TABLE_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(CREATE_TABLE, re.IGNORECASE), deleted=False
)
_DROP_TABLE_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(DROP_TABLE, re.IGNORECASE), deleted=True
)
_ALTER_VIEW_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(ALTER_VIEW, re.IGNORECASE), deleted=False
)
_CREATE_VIEW_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(CREATE_VIEW, re.IGNORECASE), deleted=False
)
_DROP_VIEW_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(DROP_VIEW, re.IGNORECASE), deleted=True
)
_COMMENT_RE = RedshiftTableChangeQueryRegex(
    regex=re.compile(COMMENT, re.IGNORECASE), deleted=False
)

REGEX_LIST = [
    _ALTER_TABLE_RE,
    _CREATE_TABLE_RE,
    _DROP_TABLE_RE,
    _ALTER_VIEW_RE,
    _CREATE_VIEW_RE,
    _DROP_VIEW_RE,
    _COMMENT_RE,
]

# Keyword pre-filter: extracts the first DDL keyword from a statement in one
# search call, then dispatches only to the 1-2 candidate patterns for that
# keyword.  Reduces worst-case regex attempts from 7 to 2 (e.g. ALTER →
# ALTER_TABLE or ALTER_VIEW).  Python's re module uses a backtracking engine
# (not Thompson NFA), so alternation in a combined pattern does not give a
# single-pass; keyword dispatch achieves the same reduction more predictably.
_FIRST_KW_RE = re.compile(r"\b(ALTER|CREATE|DROP|COMMENT)\b", re.IGNORECASE)

_KW_TO_CANDIDATES: Dict[str, List[RedshiftTableChangeQueryRegex]] = {
    "ALTER": [_ALTER_TABLE_RE, _ALTER_VIEW_RE],
    "CREATE": [_CREATE_TABLE_RE, _CREATE_VIEW_RE],
    "DROP": [_DROP_TABLE_RE, _DROP_VIEW_RE],
    "COMMENT": [_COMMENT_RE],
}


class RedshiftIncrementalTableProcessor:
    """Incremental Table Processor class.

    Responsible for the Incremental Extraction flow."""

    def __init__(
        self,
        table_map: RedshiftTableMap,
        table_changes_query: str,
        regex_list: List[RedshiftTableChangeQueryRegex],
        connection: Connection,
        default_schema: SchemaName,
    ):
        self.table_map = table_map
        self.table_changes_query = table_changes_query
        self.regex_list = regex_list
        self.connection = connection
        self.default_schema = default_schema

    @classmethod
    def create(
        cls, connection: Connection, default_schema: SchemaName
    ) -> "RedshiftIncrementalTableProcessor":
        """Creates a new instance based on a connection and the default schema."""
        return cls(
            table_map=RedshiftTableMap.default(),
            table_changes_query=REDSHIFT_TABLE_CHANGES_QUERY,
            regex_list=REGEX_LIST,
            connection=connection,
            default_schema=default_schema,
        )

    def _query_for_changes(self, database: str, start_date: datetime) -> Iterable[str]:
        """Queries the Redshift database for the Table Changes."""
        for row in (
            self.connection.execute(
                text(
                    self.table_changes_query.format(
                        database=database, start_date=start_date
                    )
                )
            )
            or []
        ):
            yield row[0]

    def _clean_statement(self, statement: str) -> str:
        """Normalise whitespace and strip double-quotes for regex matching.

        Uses a module-level str.translate() table built once at import time.
        A single C-level pass replaces \\n/\\t/\\v with spaces and deletes
        double-quote characters — equivalent to four chained str.replace()
        calls but without the intermediate string allocations.
        """
        return statement.translate(_CLEAN_TABLE)

    def _get_schema_and_table(
        self, full_table_name: str, statement: str
    ) -> Tuple[SchemaName, TableName]:
        """From the full table name, retrieves the Schema and Table Name.
        If no Schema is present, falls back to the default schema."""
        full_table_name_as_list = full_table_name.split(".")

        # Check if Schema is present
        if len(full_table_name_as_list) >= 2:
            schema = full_table_name_as_list[-2]
        else:
            schema = self.default_schema
            logger.debug(
                "Schema not present for statement %s. TableName: %s",
                statement,
                full_table_name,
            )
            logger.debug("Falling back to the Default Schema: %s", self.default_schema)

        table_name = full_table_name_as_list[-1]

        return schema, table_name

    def set_table_map(self, database: str, start_date: datetime):
        """Sets the RedshiftTableMap for the given database, filtering by the given start_date.

        Uses a two-stage matching strategy:
        1. A fast keyword search (_FIRST_KW_RE) extracts the leading DDL verb
           (ALTER / CREATE / DROP / COMMENT) in a single pass.
        2. Only the 1-2 candidate patterns for that verb are then tried, reducing
           worst-case regex attempts from 7 to 2.
        Falls back to the full self.regex_list when no keyword is found (edge
        case: statement has been heavily mangled or starts with an unknown verb).
        """
        for statement in self._query_for_changes(database, start_date):
            statement = self._clean_statement(statement)

            kw_match = _FIRST_KW_RE.search(statement)
            if kw_match:
                candidates = _KW_TO_CANDIDATES.get(
                    kw_match.group(1).upper(), self.regex_list
                )
            else:
                candidates = self.regex_list

            match_found = False
            for possible_match in candidates:
                match = possible_match.regex.match(statement)
                if not match:
                    continue

                match_found = True
                schema, table_name = self._get_schema_and_table(
                    match.group("table"), statement
                )
                self.table_map.update(
                    schema,
                    RedshiftTable(name=table_name, deleted=possible_match.deleted),
                )
                break

            if not match_found:
                logger.debug("Match not found for %s", statement)

    def get_deleted(
        self, schema_name: Optional[SchemaName] = None
    ) -> List[Tuple[SchemaName, TableName]]:
        """Returns the deleted table names present in the table_map for a given schema."""
        return self.table_map.get_deleted(schema_name)

    def get_not_deleted(self, schema_name: SchemaName) -> FrozenSet[TableName]:
        """Returns the not deleted table names present in the table_map for a given schema."""
        return self.table_map.get_not_deleted(schema_name)
