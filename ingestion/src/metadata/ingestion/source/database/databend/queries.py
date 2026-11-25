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
"""Databend SQL statements used by the lineage source."""

# Only edges whose both endpoints are tables or views of the default catalog are read: the
# connector does not ingest external catalogs, so their endpoints would never resolve in OM.
DATABEND_LINEAGE_HISTORY = """
SELECT
    lineage_kind,
    source_database,
    source_name,
    target_database,
    target_name,
    column_lineage,
    query_info,
    updated_on
FROM system_history.lineage_history
WHERE source_catalog = 'default'
  AND target_catalog = 'default'
  AND source_object_type IN ('TABLE', 'VIEW')
  AND target_object_type IN ('TABLE', 'VIEW')
  AND {filters}
ORDER BY updated_on
"""

DATABEND_VIEW_LINEAGE_FILTER = "lineage_kind = 'CREATE_VIEW'"

DATABEND_QUERY_LINEAGE_FILTER = (
    "lineage_kind IN ('CTAS', 'DML') AND updated_on >= '{start_time}' AND updated_on < '{end_time}'"
)

# Equality filters on catalog, database and name are pushed down into system.views, so Databend
# fetches only the named views instead of listing every table.
DATABEND_VIEW_VERSIONS = """
SELECT name, updated_on
FROM system.views
WHERE catalog = 'default'
  AND database = :database
  AND name IN :names
"""

DATABEND_LINEAGE_HISTORY_TEST = "SELECT lineage_kind FROM system_history.lineage_history LIMIT 1"
