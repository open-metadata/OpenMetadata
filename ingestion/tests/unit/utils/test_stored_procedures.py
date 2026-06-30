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
Test Stored Procedures Utils
"""

from metadata.utils.stored_procedures import get_procedure_name_from_call


class TestStoredProcedures:
    """Group stored procedures tests"""

    def test_get_procedure_name_from_call(self):
        """Check that we properly parse CALL queries"""
        assert get_procedure_name_from_call(query_text="CALL db.schema.procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL schema.procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL procedure_name(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="CALL DB.SCHEMA.PROCEDURE_NAME(...)") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN schema.procedure_name; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN procedure_name; END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN schema.procedure_name(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="BEGIN procedure_name(...); END;") == "procedure_name"

        assert get_procedure_name_from_call(query_text="something very random") is None

    def test_get_procedure_name_with_nested_function_args(self):
        """Oracle rewrites literal args as functions (e.g. TO_NUMBER(...)).
        The procedure name must still be parsed without capturing the argument."""
        assert (
            get_procedure_name_from_call(query_text="BEGIN CDC.SP_INSERTA_NUMERO(TO_NUMBER(:1)); END;")
            == "sp_inserta_numero"
        )

        assert (
            get_procedure_name_from_call(query_text="CALL CDC.SP_INSERTA_NUMERO(TO_NUMBER(12345))")
            == "sp_inserta_numero"
        )

        assert (
            get_procedure_name_from_call(query_text="BEGIN SCHEMA.PROC(TO_DATE('2024-01-01'), NVL(x, 0)); END;")
            == "proc"
        )
