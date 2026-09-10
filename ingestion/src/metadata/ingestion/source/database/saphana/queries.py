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

# SYS.OBJECT_DEPENDENCIES is HANA's own dependency catalog, written when objects are
# created, and exists on both on-prem and Cloud. It is the only lineage source on
# Cloud, which has no _SYS_REPO and therefore no calculation views to parse.
#
# DEPENDENCY_TYPE 1 is a direct reference. 2 is transitive and would emit edges that
# bypass the real intermediate object, and 5 is foreign-key referential rather than
# data flow. Only 1 is lineage.
SAPHANA_OBJECT_DEPENDENCIES = """
SELECT
  BASE_SCHEMA_NAME,
  BASE_OBJECT_NAME,
  BASE_OBJECT_TYPE,
  DEPENDENT_SCHEMA_NAME,
  DEPENDENT_OBJECT_NAME,
  DEPENDENT_OBJECT_TYPE
FROM SYS.OBJECT_DEPENDENCIES
WHERE DEPENDENCY_TYPE = 1
  AND BASE_OBJECT_TYPE IN ('TABLE', 'VIEW')
  AND DEPENDENT_OBJECT_TYPE IN ('TABLE', 'VIEW')
  AND BASE_SCHEMA_NAME IS NOT NULL
  AND DEPENDENT_SCHEMA_NAME IS NOT NULL
  AND BASE_SCHEMA_NAME NOT LIKE '\\_SYS%' ESCAPE '\\'
  AND DEPENDENT_SCHEMA_NAME NOT LIKE '\\_SYS%' ESCAPE '\\'
  AND NOT (BASE_SCHEMA_NAME = DEPENDENT_SCHEMA_NAME AND BASE_OBJECT_NAME = DEPENDENT_OBJECT_NAME)
"""
