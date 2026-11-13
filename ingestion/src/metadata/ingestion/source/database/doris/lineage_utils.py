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
Doris view lineage

Doris is parsed with the MySQL dialect, and two parts of the view DDL Doris prints are not MySQL:
- an async materialized view's DDL carries its refresh, key, partition, distribution and PROPERTIES
  clauses between the column list and `AS`, which leaves the whole statement unparsable, and
- a column of a view or materialized view can have a COMMENT in the column list, and with the
  backquoted column names Doris prints from 4.1.5 on, the comment drops that column's lineage.
The DDL is read with sqlglot's Doris dialect and handed to the parsers as the plain CREATE VIEW it
amounts to.

Plugged into the generic view lineage through `LineageSource.get_view_lineage_parser_factory`
(ADR:2026-11-05-connectors-adapt-view-lineage-parsing).
"""

import sqlglot
from sqlglot import expressions as exp

from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import QueryParserType
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LINEAGE_PARSING_TIMEOUT, LineageParser
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

logger = ingestion_logger()


def _plain_view_query(query: str) -> str | None:
    """
    The view DDL with only its name, column names and query, in the MySQL dialect; None when it is not
    the DDL of a view or when it holds nothing the parsers miss, so that it is parsed as it is
    """
    statement = sqlglot.parse_one(query, read="doris")
    if (
        not isinstance(statement, exp.Create)
        or statement.args.get("kind") != "VIEW"
        or not isinstance(statement.expression, exp.Query)
    ):
        return None
    properties = statement.args.get("properties")
    materialized = isinstance(properties, exp.Properties) and any(
        isinstance(prop, exp.MaterializedProperty) for prop in properties.expressions
    )
    columns = statement.this.expressions if isinstance(statement.this, exp.Schema) else []
    comments = [
        constraint
        for column in columns
        for constraint in column.args.get("constraints") or []
        if isinstance(constraint.args.get("kind"), exp.CommentColumnConstraint)
    ]
    if not materialized and not comments:
        return None
    for comment in comments:
        comment.pop()
    statement.set("properties", None)
    return statement.sql(dialect="mysql")


def get_view_lineage_parser(
    query: str,
    dialect: Dialect = Dialect.MYSQL,
    timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    parser_type: QueryParserType = QueryParserType.Auto,
) -> LineageParser:
    """Parse a Doris view or materialized view definition as the plain CREATE VIEW it amounts to"""
    original = LineageParser(query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
    try:
        view_query = timeout(timeout_seconds)(_plain_view_query)(query)
        if view_query is None:
            return original
        parser = LineageParser(view_query, dialect, timeout_seconds=timeout_seconds, parser_type=parser_type)
        if parser.parser is None:
            return original
    except Exception:
        logger.debug("[%s] Cannot normalize Doris view DDL; retaining native parsing", original.query_hash)
        return original
    # The graph uses the plain DDL; lineage consumers must retain the original masked definition.
    parser.query = original.query
    parser.query_hash = original.query_hash
    parser.masked_query = original.masked_query
    return parser
