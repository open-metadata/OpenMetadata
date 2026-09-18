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
Glue source utils.
"""

import base64
import json
import re
import traceback

from metadata.ingestion.source.database.glue.models import GlueTable
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The Hive Metastore, and so Glue, stores a Presto/Trino view as a comment wrapping a base64
# JSON document rather than as SQL. Athena writes "Presto View" and Trino writes either
# spelling, so accept both. The colon is the discriminator: with it the comment carries a
# payload, without it the comment is the bare marker Glue puts in ViewExpandedText.
PRESTO_VIEW_PATTERN = re.compile(
    r"^/\*\s*(?:presto|trino)\s+(?:materialized\s+)?view\s*:\s*(?P<payload>.*?)\s*\*/$",
    re.IGNORECASE | re.DOTALL,
)
SQL_COMMENT_PATTERN = re.compile(r"/\*.*?\*/", re.DOTALL)
# Anchored to the head of the statement, the way the SAP HANA and ClickHouse readers do it.
# An unanchored search would read the CREATE VIEW inside a string literal as a header already
# being there and leave a bare SELECT unwrapped, which costs the lineage parser its target.
# Leading comments are stepped over one at a time rather than by a repeated group: a group
# whose body can also match the "*/" that ends it backtracks exponentially on input like
# "/*" + "*//*" * n, which a view definition is free to contain.
LEADING_COMMENT_PATTERN = re.compile(r"\s*(?:/\*.*?\*/|--[^\n]*)", re.DOTALL)
CREATE_VIEW_PATTERN = re.compile(r"\s*CREATE\s+(OR\s+REPLACE\s+)?(EXTERNAL\s+|MATERIALIZED\s+)?VIEW\b", re.IGNORECASE)
SIMPLE_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def get_schema_definition(table: GlueTable, schema_name: str, table_name: str) -> str | None:
    """Return the CREATE VIEW statement for a Glue view, or None when Glue holds no text for it.

    ViewOriginalText is the SQL the user wrote and ViewExpandedText is Hive's fully qualified
    rewrite of it, so the original is preferred and the expanded text is only a fallback for
    the views where Hive left the original empty.

    table_name is the name the entity is stored under, which the source truncates, rather than
    table.Name: a statement naming a target the catalog does not hold resolves to no lineage.
    """
    for candidate in (table.ViewOriginalText, table.ViewExpandedText):
        definition = _read_definition(candidate, table_name)
        if definition:
            return _as_create_view(definition, schema_name, table_name)
    logger.debug("Glue holds no view definition for [%s.%s]", schema_name, table_name)
    return None


def _read_definition(candidate: str | None, table_name: str) -> str | None:
    text = (candidate or "").strip()
    if not text:
        return None
    presto_view = PRESTO_VIEW_PATTERN.match(text)
    if presto_view:
        return _decode_presto_view(presto_view.group("payload"), table_name)
    # A candidate made of nothing but comments is a marker, not a definition. Matching on the
    # shape rather than on "/* Presto View */" covers the Trino and materialized spellings too.
    if not SQL_COMMENT_PATTERN.sub("", text).strip():
        return None
    return text


def _decode_presto_view(payload: str, table_name: str) -> str | None:
    encoded = "".join(payload.split())
    # Some writers drop the trailing padding, which b64decode refuses rather than infers.
    encoded += "=" * (-len(encoded) % 4)
    try:
        # binascii.Error, UnicodeDecodeError and JSONDecodeError are all ValueError subclasses.
        view_data = json.loads(base64.b64decode(encoded, validate=True).decode("utf-8"))
    except ValueError as exc:
        logger.warning("Could not read the Presto/Trino view payload for [%s]: %s", table_name, exc)
        logger.debug(traceback.format_exc())
        return None
    original_sql = view_data.get("originalSql") if isinstance(view_data, dict) else None
    if not isinstance(original_sql, str) or not original_sql.strip():
        logger.warning("The Presto/Trino view payload for [%s] holds no 'originalSql'", table_name)
        return None
    return original_sql.strip()


def _starts_with_create_view(definition: str) -> bool:
    """Whether the statement already opens with a CREATE VIEW header, past any leading comment."""
    position = 0
    while (comment := LEADING_COMMENT_PATTERN.match(definition, position)) is not None:
        position = comment.end()
    return CREATE_VIEW_PATTERN.match(definition, position) is not None


def _as_create_view(definition: str, schema_name: str, table_name: str) -> str:
    if _starts_with_create_view(definition):
        return definition
    # The Glue database is an AWS catalog id rather than a SQL catalog, so it is left out.
    return f"CREATE VIEW {_quote(schema_name)}.{_quote(table_name)} AS {definition}"


def _quote(identifier: str) -> str:
    if SIMPLE_IDENTIFIER_PATTERN.match(identifier):
        return identifier
    escaped = identifier.replace('"', '""')
    return f'"{escaped}"'
