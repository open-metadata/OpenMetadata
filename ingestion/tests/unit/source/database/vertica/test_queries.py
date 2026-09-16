#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Validate the SQL templates the Vertica source renders for column reads."""

import pytest

from metadata.ingestion.source.database.vertica.queries import (
    VERTICA_GET_COLUMNS,
    VERTICA_GET_COLUMNS_WITHOUT_COMMENTS,
    VERTICA_SUPPORTS_COLUMN_COMMENTS,
)

# The aliases get_columns reads off each row, whichever template was selected.
EXPECTED_COLUMNS = (
    "column_name",
    "data_type",
    "column_default",
    "is_nullable",
    "comment",
)


@pytest.mark.parametrize("selected_field", EXPECTED_COLUMNS)
def test_both_column_templates_expose_the_same_fields(selected_field: str):
    """The probe picks between these two at runtime, so they have to stay
    interchangeable for the caller reading rows by attribute.
    """
    assert selected_field in VERTICA_GET_COLUMNS
    assert selected_field in VERTICA_GET_COLUMNS_WITHOUT_COMMENTS


@pytest.mark.parametrize("unsupported_reference", ["child_object", "v_catalog.comments"])
def test_fallback_template_avoids_the_unsupported_column(unsupported_reference: str):
    """This template exists precisely because child_object is absent before
    Vertica 10, so it must not reach for it or for the table holding it.
    """
    assert unsupported_reference not in VERTICA_GET_COLUMNS_WITHOUT_COMMENTS


def test_both_column_templates_accept_the_same_parameters():
    """get_columns formats whichever template the probe returns with the same
    two values, so a missing placeholder would raise only on older servers.
    """
    rendered = {
        template.format(table="orders", schema_condition="lower(table_schema) = 'omd_test'")
        for template in (VERTICA_GET_COLUMNS, VERTICA_GET_COLUMNS_WITHOUT_COMMENTS)
    }

    assert len(rendered) == 2
    for statement in rendered:
        assert "orders" in statement
        assert "omd_test" in statement
        assert "{" not in statement


def test_support_probe_reads_the_column_it_is_checking_for():
    """v_catalog.columns lists user tables only, so looking the system catalog
    up there reports absent on every version. The column has to be referenced
    directly for the probe to mean anything.
    """
    assert "child_object" in VERTICA_SUPPORTS_COLUMN_COMMENTS
    assert "v_catalog.comments" in VERTICA_SUPPORTS_COLUMN_COMMENTS
    assert "v_catalog.columns" not in VERTICA_SUPPORTS_COLUMN_COMMENTS
