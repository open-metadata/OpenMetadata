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

"""Snowflake identifier quoting helpers."""

from metadata.utils import fqn
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

_IDENTIFIER_PREPARER = SnowflakeDialect(case_sensitive_identifiers=True).identifier_preparer
DEFAULT_ACCOUNT_USAGE_SCHEMA = "SNOWFLAKE.ACCOUNT_USAGE"


def quote_identifier(identifier: str) -> str:
    """Quote one Snowflake identifier without interpreting dots as separators."""
    return _IDENTIFIER_PREPARER.quote_identifier(fqn.unquote_name(identifier))


def qualified_identifier(*identifiers: str | None) -> str:
    """Build a safely quoted Snowflake identifier from individual name parts."""
    return ".".join(quote_identifier(identifier) for identifier in identifiers if identifier is not None)


def quote_qualified_identifier(identifier: str) -> str:
    """Safely prepare a compound Snowflake identifier for SQL."""
    return _IDENTIFIER_PREPARER.quote_schema(identifier)


def quote_account_usage_schema(identifier: str | None) -> str:
    """Safely quote the configured ACCOUNT_USAGE schema or its default."""
    return quote_qualified_identifier(identifier or DEFAULT_ACCOUNT_USAGE_SCHEMA)
