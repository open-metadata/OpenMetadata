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
"""Databend connector constants."""

SYSTEM_DATABASES = frozenset({"information_schema", "system", "system_history"})

# Only the default catalog is ingested: databend-sqlalchemy opens a new driver session per cursor,
# so a session-level `USE CATALOG` cannot be relied on for external catalogs yet.
DEFAULT_CATALOG = "default"

# Databend validates the initial database against the default catalog at login, and this
# database always exists there.
DEFAULT_DATABASE = "default"
