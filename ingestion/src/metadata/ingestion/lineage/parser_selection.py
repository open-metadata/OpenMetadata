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
Parser Selection Enums for Lineage Extraction
"""
from enum import Enum


class LineageParserType(str, Enum):
    """
    Enum for supported lineage parsers.

    - SQLGLOT: Uses SQLGlot parser (recommended, 100% parse success, schema-aware)
    - SQLFLUFF: Uses SQLFluff parser (collate-sqllineage with SQLFluff backend)
    - SQLPARSE: Uses sqlparse parser (generic ANSI SQL parser)
    - AUTO: Automatically selects best parser (tries SQLGlot first, falls back to sqlparse)
    """

    SQLGLOT = "sqlglot"  # Default - recommended
    SQLFLUFF = "sqlfluff"  # Available as fallback option
    SQLPARSE = "sqlparse"  # Generic fallback
    AUTO = "auto"  # SQLGlot -> sqlparse fallback
