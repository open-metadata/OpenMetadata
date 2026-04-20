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
Supabase queries — reuses Postgres queries since Supabase is standard Postgres.
"""
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_DB_NAMES as SUPABASE_GET_DB_NAMES,
    POSTGRES_GET_DATABASE as SUPABASE_GET_DATABASE,
    POSTGRES_GET_TABLE_NAMES as SUPABASE_GET_TABLE_NAMES,
    POSTGRES_SCHEMA_COMMENTS as SUPABASE_SCHEMA_COMMENTS,
    POSTGRES_TEST_GET_QUERIES as SUPABASE_TEST_GET_QUERIES,
    POSTGRES_TEST_GET_TAGS as SUPABASE_TEST_GET_TAGS,
    TEST_COLUMN_METADATA as SUPABASE_TEST_COLUMN_METADATA,
    TEST_INFORMATION_SCHEMA_COLUMNS as SUPABASE_TEST_INFORMATION_SCHEMA_COLUMNS,
    TEST_TABLE_COMMENTS as SUPABASE_TEST_TABLE_COMMENTS,
)

# Supabase system schemas that are not user data — excluded by default guidance.
SUPABASE_SYSTEM_SCHEMAS = (
    "auth",
    "storage",
    "realtime",
    "extensions",
    "graphql",
    "graphql_public",
    "supabase_functions",
    "supabase_migrations",
    "pg_catalog",
    "information_schema",
)
