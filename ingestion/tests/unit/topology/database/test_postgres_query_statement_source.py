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
Validation of the Postgres queryStatementSource relation name.

The value names a relation, so it is interpolated into the FROM clause of the
query-history SQL rather than bound as a parameter. It used to be taken verbatim,
which left the rest of the statement open to being rewritten.
"""

import pytest

from metadata.ingestion.source.database.postgres.utils import (
    DEFAULT_QUERY_STATEMENT_SOURCE,
    validate_query_statement_source,
)


class TestValidateQueryStatementSource:
    @pytest.mark.parametrize("empty", [None, ""])
    def test_empty_falls_back_to_the_default(self, empty):
        assert validate_query_statement_source(empty) == DEFAULT_QUERY_STATEMENT_SOURCE

    @pytest.mark.parametrize(
        "relation",
        [
            "pg_stat_statements",
            "pg_stat_monitor",
            "my_schema.custom_pg_stat_statements",
            "_leading_underscore",
            "with_digits_123",
            "with$dollar",
        ],
    )
    def test_identifiers_are_accepted(self, relation):
        assert validate_query_statement_source(relation) == relation

    @pytest.mark.parametrize(
        "payload",
        [
            "pg_stat_statements; DROP TABLE users--",
            "pg_stat_statements UNION SELECT 1,2,3,4--",
            "(SELECT 1)",
            "pg_stat_statements'",
            "pg_stat_statements WHERE 1=1",
            "a.b.c",
            "schema..relation",
            ".relation",
            "1relation",
            "pg_stat_statements\nUNION SELECT 1",
            # "$" in a regex also matches before a trailing newline, so this has to
            # be rejected by fullmatch rather than by anchoring.
            "pg_stat_statements\n",
        ],
    )
    def test_injection_payloads_are_rejected(self, payload):
        with pytest.raises(ValueError, match="Invalid queryStatementSource"):
            validate_query_statement_source(payload)
