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
Snowflake view lineage

`IDENTIFIER('<name>')` in a FROM clause names a fixed table, but the SQL parsers read it
as a function call. Plugged into the generic view lineage through
`LineageSource.get_view_lineage_parser_factory`.
"""

import re

import sqlglot
from sqlglot import expressions as exp

from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import QueryParserType
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT, LineageParser
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

logger = ingestion_logger()

IDENTIFIER_TOKEN_PATTERN = re.compile(r"\bidentifier\b", re.IGNORECASE)


def _literal_table_name(table: exp.Table) -> str | None:
    """The table name an `IDENTIFIER('<name>')` table reference spells out, if any"""
    call = table.this
    if not isinstance(call, exp.Anonymous) or call.name.upper() != "IDENTIFIER" or len(call.expressions) != 1:
        return None
    argument = call.expressions[0]
    if not isinstance(argument, exp.Literal) or not argument.is_string:
        return None
    return argument.name


def _resolve_identifier_tables(query: str) -> str | None:
    """
    Rewrite every `IDENTIFIER('<name>')` table reference to the table it names.

    Returns None when the statement has no such table reference.
    """
    statement = sqlglot.parse_one(query, read="snowflake")
    resolved = False
    for table in list(statement.find_all(exp.Table)):
        name = _literal_table_name(table)
        if name is None:
            continue
        named_table = exp.to_table(name, dialect="snowflake")
        for part in ("this", "db", "catalog"):
            table.set(part, named_table.args.get(part))
        resolved = True
    return statement.sql(dialect="snowflake") if resolved else None


def get_view_lineage_parser(
    query: str,
    dialect: Dialect = Dialect.SNOWFLAKE,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    parser_type: QueryParserType = QueryParserType.Auto,
) -> LineageParser:
    """Parse a view with its `IDENTIFIER('<name>')` tables resolved to the tables they name."""
    original = LineageParser(query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
    if not IDENTIFIER_TOKEN_PATTERN.search(query):
        return original
    try:
        resolved_query = timeout(timeout_seconds)(_resolve_identifier_tables)(query)
        if resolved_query is None:
            return original
        parser = LineageParser(resolved_query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
        if parser.parser is None:
            return original
    except Exception as exc:
        # A sqlglot error message quotes the SQL around the failure, unmasked.
        logger.warning(
            "[%s] Cannot resolve IDENTIFIER tables in Snowflake view; retaining native parsing: %s",
            original.query_hash,
            type(exc).__name__,
        )
        return original
    # The graph uses the resolved DDL; lineage consumers must retain the original masked definition.
    parser.query = original.query
    parser.query_hash = original.query_hash
    parser.masked_query = original.masked_query
    return parser
