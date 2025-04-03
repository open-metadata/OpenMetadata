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
from unittest import TestCase

from metadata.utils.stored_procedures import get_procedure_name_from_call


class StoredProceduresTests(TestCase):
    """Group stored procedures tests"""

    def test_get_procedure_name_from_call(self):
        """Check that we properly parse CALL queries"""
        self.assertEqual(
            get_procedure_name_from_call(
                query_text="CALL db.schema.procedure_name(...)",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="CALL schema.procedure_name(...)",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="CALL procedure_name(...)",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="CALL DB.SCHEMA.PROCEDURE_NAME(...)",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME; END;",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="BEGIN schema.procedure_name; END;",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="BEGIN procedure_name; END;",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="BEGIN DB.SCHEMA.PROCEDURE_NAME(...); END;",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="BEGIN schema.procedure_name(...); END;",
            ),
            "procedure_name",
        )

        self.assertEqual(
            get_procedure_name_from_call(
                query_text="BEGIN procedure_name(...); END;",
            ),
            "procedure_name",
        )

        self.assertIsNone(
            get_procedure_name_from_call(
                query_text="something very random",
            )
        )
