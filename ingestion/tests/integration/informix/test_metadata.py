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
"""What the JDBC driver loses, and the connector puts back.

Informix hands JDBC a VARCHAR(2147483647) for all four of its large-object types
and no length at all for its string types. Both are corrected from the server's
own catalogue, and both corrections are invisible in unit tests: they only show
up once a real workflow has written a real entity.
"""

import pytest

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import (
    Constraint,
    ConstraintType,
    DataType,
    Table,
    TableType,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.metadata import MetadataWorkflow

# The four types that arrive indistinguishable from a short text column, and the
# OM type each must end up as. CLOB and BLOB are what is_blob() keys on, which is
# what stops the profiler issuing SQL Informix rejects.
LARGE_OBJECT_COLUMNS = {
    "c_text": (DataType.TEXT, "text"),
    "c_byte": (DataType.BYTES, "byte"),
    "c_clob": (DataType.CLOB, "clob"),
    "c_blob": (DataType.BLOB, "blob"),
}

# Declared width -> what must reach the catalogue. Every one of these was 1
# before the fix, so a CHAR(300) claimed to hold a single byte.
DECLARED_WIDTHS = {
    "a_char": 10,
    "b_char": 300,
    "c_vchar": 50,
    "d_vchar": 50,
    "e_lvchar": 1000,
    "f_nchar": 20,
    "g_nvarchar": 60,
}


@pytest.fixture(scope="module")
def ingested_tables(patch_passwords_for_db_services, run_workflow, ingestion_config, metadata, db_service):
    run_workflow(MetadataWorkflow, ingestion_config)

    def _get(table_name: str) -> Table:
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.{table_name}"
        table = metadata.get_by_name(entity=Table, fqn=fqn)
        assert table is not None, f"{fqn} was not ingested"
        return table

    return _get


@pytest.fixture(scope="module")
def ingested_procedures(ingested_tables, metadata, db_service) -> set[str]:
    """Names of the stored procedures the workflow wrote (depends on the run)."""
    schema_fqn = f"{db_service.fullyQualifiedName.root}.itest.informix"
    listed = metadata.list_entities(entity=StoredProcedure, params={"databaseSchema": schema_fqn}, limit=1000).entities
    return {model_str(procedure.name) for procedure in listed}


def _column(table: Table, name: str):
    column = next((col for col in table.columns if col.name.root == name), None)
    assert column is not None, f"{name} missing from {table.fullyQualifiedName.root}"
    return column


class TestLargeObjectTypes:
    @pytest.mark.parametrize(("column_name", "expected"), LARGE_OBJECT_COLUMNS.items())
    def test_large_object_keeps_its_real_type(self, ingested_tables, column_name, expected):
        expected_type, expected_display = expected
        column = _column(ingested_tables("lob_types"), column_name)
        assert column.dataType == expected_type
        assert column.dataTypeDisplay == expected_display

    def test_boolean_is_not_mistaken_for_a_large_object(self, ingested_tables):
        """BOOLEAN shares coltype 41 with CLOB and BLOB.

        Matching on the code alone would silently make every boolean column in a
        catalogue unprofilable, which is invisible until someone asks why a
        column has no metrics.
        """
        assert _column(ingested_tables("lob_types"), "c_bool").dataType == DataType.BOOLEAN

    def test_ordinary_columns_are_left_alone(self, ingested_tables):
        table = ingested_tables("lob_types")
        assert _column(table, "id").dataType == DataType.INT
        assert _column(table, "c_char").dataType == DataType.CHAR
        assert _column(table, "c_vchar").dataType == DataType.VARCHAR


class TestIntervalType:
    def test_interval_is_not_catalogued_as_char(self, ingested_tables):
        column = _column(ingested_tables("driver_types"), "d_span")
        assert column.dataType == DataType.INTERVAL
        assert column.dataTypeDisplay == "interval hour to minute"


class TestDeclaredWidths:
    @pytest.mark.parametrize(("column_name", "expected_length"), DECLARED_WIDTHS.items())
    def test_declared_width_reaches_the_catalogue(self, ingested_tables, column_name, expected_length):
        assert _column(ingested_tables("char_widths"), column_name).dataLength == expected_length

    def test_the_two_collength_encodings_are_told_apart(self, ingested_tables):
        """One field, two meanings, and masking the wrong one corrupts silently.

        VARCHAR(50,10) stores 50 + 10*256; masking recovers the 50. CHAR(300)
        stores 300 outright, and masking it would yield 44 -- a plausible-looking
        width that no one would question.
        """
        table = ingested_tables("char_widths")
        assert _column(table, "d_vchar").dataLength == 50
        assert _column(table, "b_char").dataLength == 300


class TestViewsAndRoutines:
    """Informix's own catalogue objects look exactly like user objects.

    sysdomains and sysindexes are views with the same owner and type as anything
    a user creates, and sysprocedures carries roughly 560 built-in routines on a
    stock database. Both filters key off things that are invisible unless you look
    at the catalogue: tabid below 100 is reserved, and Informix's own routines
    carry a lower-case mode where a user's carry upper case.
    """

    def test_user_view_is_ingested_as_a_view(self, ingested_tables):
        view = ingested_tables("lob_view")
        assert view.tableType == TableType.View

    def test_view_carries_its_definition(self, ingested_tables, metadata, db_service):
        """Without get_view_definition the view arrives with no SQL at all.

        schemaDefinition is not returned by default, so it has to be asked for --
        fetching without it returns None whether or not the connector stored one.
        """
        ingested_tables("lob_view")  # ensure the workflow has run
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.lob_view"
        view = metadata.get_by_name(entity=Table, fqn=fqn, fields=["schemaDefinition"])
        assert view.schemaDefinition is not None
        assert "lob_types" in model_str(view.schemaDefinition)

    @pytest.mark.parametrize("system_view", ["sysdomains", "sysindexes"])
    def test_catalogue_views_are_not_ingested(self, metadata, db_service, system_view):
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.{system_view}"
        assert metadata.get_by_name(entity=Table, fqn=fqn) is None

    def test_user_routines_are_ingested(self, ingested_procedures):
        assert {"add_two", "triple", "tagged_probe_out"} <= ingested_procedures

    def test_builtin_routines_are_not_ingested(self, ingested_procedures):
        """A stock database has ~560 of them; they would bury the user's own."""
        assert len(ingested_procedures) == 3, sorted(ingested_procedures)

    def test_routine_carries_its_code(self, metadata, db_service):
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.add_two"
        procedure = metadata.get_by_name(entity=StoredProcedure, fqn=fqn)
        assert procedure is not None
        assert "RETURN a + b" in model_str(procedure.storedProcedureCode.code)


class TestObjectKindsInformixAlsoHas:
    """systables holds more than tables and views.

    A synonym (tabtype S) and a sequence (tabtype Q) sit in the same catalogue,
    in the same tabid range as user tables, owned by the same user. Neither has an
    OpenMetadata entity type, and Oracle -- the other engine here with synonyms --
    does not ingest them either. These guard against a future widening of the
    table or view filters quietly pulling them in.
    """

    @pytest.mark.parametrize("object_name", ["lob_syn", "probe_seq"])
    def test_synonyms_and_sequences_are_not_catalogued(self, ingested_tables, metadata, db_service, object_name):
        ingested_tables("lob_types")  # ensure the workflow has run
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.{object_name}"
        assert metadata.get_by_name(entity=Table, fqn=fqn) is None


class TestConstraintsAndComments:
    """Relationships between tables, and a feature Informix does not have."""

    def test_primary_key_is_recorded(self, ingested_tables):
        assert _column(ingested_tables("lob_types"), "id").constraint == Constraint.PRIMARY_KEY

    def test_foreign_key_reaches_the_catalogue(self, ingested_tables, metadata, db_service):
        """supportsDatabase connectors resolve foreign keys via referred_database.

        SQLAlchemy's reflection does not produce that key, and without it the
        referred table is looked up as "service.None.schema.table" -- which never
        matches, so the key is dropped with no error, because a failed lookup is
        also how the code defers a constraint whose target is not ingested yet.
        """
        ingested_tables("lob_children")
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.lob_children"
        table = metadata.get_by_name(entity=Table, fqn=fqn, fields=["tableConstraints"])
        foreign_keys = [c for c in (table.tableConstraints or []) if c.constraintType == ConstraintType.FOREIGN_KEY]
        assert len(foreign_keys) == 1
        assert foreign_keys[0].columns == ["parent_id"]
        assert model_str(foreign_keys[0].referredColumns[0]).endswith("informix.lob_types.id")
