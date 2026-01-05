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
SQL Queries used during MariaDB ingestion
"""

MARIADB_GET_STORED_PROCEDURES = """
SELECT
    ROUTINE_NAME AS procedure_name,
    ROUTINE_SCHEMA AS schema_name,
    ROUTINE_DEFINITION AS definition,
    ROUTINE_TYPE AS procedure_type,
    ROUTINE_COMMENT AS description,
    EXTERNAL_LANGUAGE AS language
FROM
    information_schema.ROUTINES
WHERE
    ROUTINE_SCHEMA = '{schema_name}'
    AND ROUTINE_TYPE = 'PROCEDURE'
"""

MARIADB_GET_FUNCTIONS = """
SELECT
    ROUTINE_NAME AS procedure_name,
    ROUTINE_SCHEMA AS schema_name,
    ROUTINE_DEFINITION AS definition,
    ROUTINE_TYPE AS procedure_type,
    ROUTINE_COMMENT AS description,
    EXTERNAL_LANGUAGE AS language
FROM
    information_schema.ROUTINES
WHERE
    ROUTINE_SCHEMA = '{schema_name}'
    AND ROUTINE_TYPE = 'FUNCTION'
"""
