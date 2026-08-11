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
"""SQL constants for Snowflake semantic-view catalog access.

Column naming differs between INFORMATION_SCHEMA.SEMANTIC_VIEWS (``SCHEMA``,
``NAME``) and the child catalogs (``SEMANTIC_VIEW_SCHEMA``,
``SEMANTIC_VIEW_NAME``). Primary path is one query per catalog per schema —
fallback (per-view) exists only for errno 90030 ("information schema query
returned too much data") which the primary can hit on very large schemas."""

from __future__ import annotations

SNOWFLAKE_GET_SEMANTIC_VIEWS = """
SELECT NAME FROM information_schema.semantic_views WHERE SCHEMA = '{schema}'
"""

SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA = """
SELECT SEMANTIC_VIEW_NAME, TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS
FROM information_schema.{catalog_view}
WHERE SEMANTIC_VIEW_SCHEMA = '{schema}'
"""

SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW = """
SELECT SEMANTIC_VIEW_NAME, TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS
FROM information_schema.{catalog_view}
WHERE SEMANTIC_VIEW_SCHEMA = '{schema}' AND SEMANTIC_VIEW_NAME = '{semantic_view}'
"""

SNOWFLAKE_GET_SEMANTIC_TABLES_IN_SCHEMA = """
SELECT SEMANTIC_VIEW_NAME, NAME, BASE_TABLE_CATALOG, BASE_TABLE_SCHEMA, BASE_TABLE_NAME
FROM information_schema.semantic_tables
WHERE SEMANTIC_VIEW_SCHEMA = '{schema}'
"""

SNOWFLAKE_GET_SEMANTIC_VIEW_DEFINITION = """
SELECT GET_DDL('SEMANTIC_VIEW','{fqn}') AS "text"
"""

_CATALOG_DIMENSIONS = "semantic_dimensions"
_CATALOG_FACTS = "semantic_facts"
_CATALOG_METRICS = "semantic_metrics"

# Errno raised by INFORMATION_SCHEMA when the result set is too large.
SNOWFLAKE_INFO_SCHEMA_TOO_LARGE_ERRNO = 90030
