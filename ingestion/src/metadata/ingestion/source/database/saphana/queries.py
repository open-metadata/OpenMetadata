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
SAP Hana DB queries for metadata extraction
"""

SAPHANA_LINEAGE = """
SELECT
  PACKAGE_ID,
  OBJECT_NAME,
  OBJECT_SUFFIX,
  CDATA
FROM _SYS_REPO.ACTIVE_OBJECT
WHERE OBJECT_SUFFIX IN ('analyticview', 'attributeview', 'calculationview');
"""

SAPHANA_SCHEMA_MAPPING = """
SELECT
  PHYSICAL_SCHEMA
FROM _SYS_BI.M_SCHEMA_MAPPING
WHERE AUTHORING_SCHEMA = :authoring_schema
"""

SAPHANA_TABLE_FUNCTIONS = """
SELECT
  FUNCTION_NAME,
  SCHEMA_NAME,
  DEFINITION
FROM SYS.FUNCTIONS
WHERE FUNCTION_USAGE_TYPE = 'TABLE'
  AND UPPER(SCHEMA_NAME) = UPPER(:schema_name)
"""

# The plan cache is the only record of a statement that moved data between tables.
# It holds execution plans, so DDL never enters it and CREATE TABLE ... AS SELECT
# lineage cannot be recovered on HANA by any route.
SAPHANA_QUERY_HISTORY_STATEMENT = """
SELECT
  NULL AS user_name,
  NULL AS database_name,
  SCHEMA_NAME AS schema_name,
  NULL AS aborted,
  STATEMENT_STRING AS query_text,
  LAST_EXECUTION_TIMESTAMP AS start_time,
  TOTAL_EXECUTION_TIME / 1000000 AS duration,
  LAST_EXECUTION_TIMESTAMP AS end_time
FROM SYS.M_SQL_PLAN_CACHE
WHERE IS_VALID = 'TRUE'
  AND LAST_EXECUTION_TIMESTAMP IS NOT NULL
  {filters}
  AND STATEMENT_STRING NOT LIKE '/* {{"app": "OpenMetadata", %}} */%'
  AND STATEMENT_STRING NOT LIKE '/* {{"app": "dbt", %}} */%'
  AND LAST_EXECUTION_TIMESTAMP >= TO_TIMESTAMP('{start_time}', 'YYYY-MM-DD HH24:MI:SS')
  AND LAST_EXECUTION_TIMESTAMP < TO_TIMESTAMP('{end_time}', 'YYYY-MM-DD HH24:MI:SS')
ORDER BY LAST_EXECUTION_TIMESTAMP DESC
LIMIT {result_limit}
"""
