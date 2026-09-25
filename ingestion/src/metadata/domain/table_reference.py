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

"""Connector-neutral table references."""

from dataclasses import dataclass


@dataclass(frozen=True)
class TableReference:
    """A parsed table name with optional database and schema context."""

    database: str | None
    schema: str | None
    table: str


def normalize_table_reference(reference: TableReference) -> TableReference:
    """Preserve the standard database/schema/table namespace."""
    return reference
