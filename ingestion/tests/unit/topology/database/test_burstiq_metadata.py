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
Test BurstIQ Metadata Ingestion - table/column extraction, filtering, type mapping
"""

from unittest import TestCase
from unittest.mock import Mock

from metadata.generated.schema.entity.data.table import Constraint, ConstraintType
from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.ingestion.source.database.burstiq.models import (
    BurstIQAttribute,
    BurstIQDictionary,
    BurstIQIndex,
)


class TestBurstIQMetadataIngestion(TestCase):
    """Test BurstIQ Metadata Ingestion"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = BurstIQConnection(
            username="test_user",
            password="test_password",
            realmName="test_realm",
            biqSdzName="test_sdz",
            biqCustomerName="test_customer",
        )

        # Sample dictionary data
        self.sample_dictionary = {
            "name": "patient",
            "description": "Patient medical records",
            "attributes": [
                {
                    "name": "patient_id",
                    "description": "Unique patient identifier",
                    "datatype": "STRING",
                    "required": True,
                },
                {
                    "name": "age",
                    "description": "Patient age",
                    "datatype": "INTEGER",
                    "required": False,
                    "min": 0,
                    "max": 150,
                },
                {
                    "name": "diagnosis_codes",
                    "description": "ICD diagnosis codes",
                    "datatype": "STRING_ARRAY",
                    "required": False,
                },
                {
                    "name": "created_at",
                    "datatype": "DATETIME",
                    "required": True,
                },
            ],
            "indexes": [
                {"name": "pk_patient", "type": "PRIMARY", "attributes": ["patient_id"]}
            ],
        }

    def test_datatype_mapping_simple_types(self):
        """Test mapping of BurstIQ simple data types to SQL types"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        # Create a mock source instance
        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )

        # Test simple type mappings
        test_cases = [
            ("STRING", ("VARCHAR", None)),
            ("INTEGER", ("INT", None)),
            ("LONG", ("BIGINT", None)),
            ("DOUBLE", ("DOUBLE", None)),
            ("FLOAT", ("FLOAT", None)),
            ("BOOLEAN", ("BOOLEAN", None)),
            ("DATETIME", ("TIMESTAMP", None)),
            ("DATE", ("DATE", None)),
            ("UUID", ("VARCHAR", None)),
            ("JSON", ("JSON", None)),
            ("OBJECT", ("STRUCT", None)),
        ]

        for burstiq_type, expected_result in test_cases:
            result = source._map_burstiq_datatype(burstiq_type)
            self.assertEqual(result, expected_result, f"Failed for type {burstiq_type}")

    def test_datatype_mapping_array_types(self):
        """Test mapping of BurstIQ array data types"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )

        # Test array type mappings
        test_cases = [
            ("STRING_ARRAY", ("ARRAY", "VARCHAR")),
            ("INTEGER_ARRAY", ("ARRAY", "INT")),
            ("BOOLEAN_ARRAY", ("ARRAY", "BOOLEAN")),
            ("DOUBLE_ARRAY", ("ARRAY", "DOUBLE")),
            ("OBJECT_ARRAY", ("ARRAY", "STRUCT")),
        ]

        for burstiq_type, expected_result in test_cases:
            result = source._map_burstiq_datatype(burstiq_type)
            self.assertEqual(
                result, expected_result, f"Failed for array type {burstiq_type}"
            )

    def test_column_processing_simple_attribute(self):
        """Test processing a simple attribute to column"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )
        source._process_attribute_to_column = (
            Burstiqsource._process_attribute_to_column.__get__(source)
        )

        # Create attribute
        attribute = BurstIQAttribute(
            name="patient_id",
            description="Patient identifier",
            datatype="STRING",
            required=True,
        )

        # Process to column
        column = source._process_attribute_to_column(attribute, "patient")

        # Verify column properties
        self.assertIsNotNone(column)
        self.assertEqual(column.name.root, "patient_id")
        self.assertEqual(column.dataType.value, "VARCHAR")
        self.assertEqual(column.constraint, Constraint.NOT_NULL)
        self.assertIsNotNone(column.description)

    def test_column_processing_array_attribute(self):
        """Test processing an array attribute to column"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )
        source._process_attribute_to_column = (
            Burstiqsource._process_attribute_to_column.__get__(source)
        )

        # Create array attribute
        attribute = BurstIQAttribute(
            name="tags", datatype="STRING_ARRAY", required=False
        )

        # Process to column
        column = source._process_attribute_to_column(attribute, "patient")

        # Verify column properties
        self.assertIsNotNone(column)
        self.assertEqual(column.dataType.value, "ARRAY")
        self.assertEqual(column.arrayDataType.value, "VARCHAR")

    def test_column_processing_nested_object(self):
        """Test processing nested object attributes"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )
        source._process_attribute_to_column = (
            Burstiqsource._process_attribute_to_column.__get__(source)
        )

        # Create nested object attribute
        attribute = BurstIQAttribute(
            name="address",
            datatype="OBJECT",
            nodeAttributes=[
                BurstIQAttribute(name="street", datatype="STRING"),
                BurstIQAttribute(name="city", datatype="STRING"),
                BurstIQAttribute(name="zipcode", datatype="STRING"),
            ],
        )

        # Process to column
        column = source._process_attribute_to_column(attribute, "patient")

        # Verify column has children
        self.assertIsNotNone(column)
        self.assertEqual(column.dataType.value, "STRUCT")
        self.assertIsNotNone(column.children)
        self.assertEqual(len(column.children), 3)
        self.assertEqual(column.children[0].name.root, "street")

    def test_table_constraints_primary_key(self):
        """Test extraction of primary key constraints"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source.get_table_constraints = Burstiqsource.get_table_constraints.__get__(
            source
        )

        # Create dictionary with primary key
        dictionary = BurstIQDictionary(
            name="patient",
            attributes=[],
            indexes=[
                BurstIQIndex(
                    name="pk_patient", type="PRIMARY", attributes=["patient_id"]
                )
            ],
        )

        # Get constraints
        constraints = source.get_table_constraints(dictionary)

        # Verify primary key constraint
        self.assertIsNotNone(constraints)
        self.assertEqual(len(constraints), 1)
        self.assertEqual(constraints[0].constraintType, ConstraintType.PRIMARY_KEY)
        self.assertEqual(constraints[0].columns, ["patient_id"])

    def test_table_constraints_unique(self):
        """Test extraction of unique constraints"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source.get_table_constraints = Burstiqsource.get_table_constraints.__get__(
            source
        )

        # Create dictionary with unique index
        dictionary = BurstIQDictionary(
            name="patient",
            attributes=[],
            indexes=[
                BurstIQIndex(name="uk_email", type="UNIQUE", attributes=["email"])
            ],
        )

        # Get constraints
        constraints = source.get_table_constraints(dictionary)

        # Verify unique constraint
        self.assertIsNotNone(constraints)
        self.assertEqual(len(constraints), 1)
        self.assertEqual(constraints[0].constraintType, ConstraintType.UNIQUE)
        self.assertEqual(constraints[0].columns, ["email"])

    def test_table_constraints_foreign_key(self):
        """Test extraction of foreign key constraints from referenced dictionaries"""
        from unittest.mock import patch

        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source.get_table_constraints = Burstiqsource.get_table_constraints.__get__(
            source
        )

        # Mock metadata and context for FQN building
        source.metadata = Mock()
        source.context = Mock()
        context_data = Mock()
        context_data.database_service = "test_service"
        context_data.database = "test_db"
        context_data.database_schema = "test_schema"
        source.context.get.return_value = context_data

        # Create dictionary with foreign key reference
        dictionary = BurstIQDictionary(
            name="visit",
            attributes=[
                BurstIQAttribute(
                    name="patient_id",
                    datatype="STRING",
                    referenceDictionaryName="patient",
                )
            ],
            indexes=[],
        )

        # Mock fqn.build to return table FQN and fqn._build to return column FQN
        with patch(
            "metadata.ingestion.source.database.burstiq.metadata.fqn.build"
        ) as mock_fqn_build, patch(
            "metadata.ingestion.source.database.burstiq.metadata.fqn._build"
        ) as mock_fqn_private_build:
            mock_fqn_build.return_value = "test_service.test_db.test_schema.patient"
            mock_fqn_private_build.return_value = (
                "test_service.test_db.test_schema.patient.patient_id"
            )

            # Get constraints
            constraints = source.get_table_constraints(dictionary)

            # Verify foreign key constraint
            self.assertIsNotNone(constraints)
            self.assertEqual(len(constraints), 1)
            self.assertEqual(constraints[0].constraintType, ConstraintType.FOREIGN_KEY)
            self.assertEqual(constraints[0].columns, ["patient_id"])
            # Verify the FQN was built and used (it's wrapped in FullyQualifiedEntityName)
            self.assertEqual(len(constraints[0].referredColumns), 1)
            self.assertEqual(
                constraints[0].referredColumns[0].root,
                "test_service.test_db.test_schema.patient.patient_id",
            )
            # Verify fqn._build was called with correct parameters
            mock_fqn_private_build.assert_called_once_with(
                "test_service.test_db.test_schema.patient", "patient_id", quote=False
            )

    def test_table_name_extraction(self):
        """Test table name and type extraction from dictionaries"""
        # All BurstIQ dictionaries are Regular tables
        dictionary = BurstIQDictionary(
            name="patient",
            description="Patient data",
            attributes=[],
            indexes=[],
        )

        self.assertEqual(dictionary.table_name, "patient")

    def test_get_columns_from_dictionary(self):
        """Test column extraction from dictionary attributes"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )
        source._process_attribute_to_column = (
            Burstiqsource._process_attribute_to_column.__get__(source)
        )
        source.get_columns = Burstiqsource.get_columns.__get__(source)

        # Create dictionary with multiple attributes
        dictionary = BurstIQDictionary(
            name="patient",
            attributes=[
                BurstIQAttribute(name="id", datatype="STRING", required=True),
                BurstIQAttribute(name="name", datatype="STRING", required=False),
                BurstIQAttribute(name="age", datatype="INTEGER", required=False),
            ],
            indexes=[],
        )

        # Get columns
        columns = list(source.get_columns("patient", dictionary))

        # Verify all columns were processed
        self.assertEqual(len(columns), 3)
        self.assertEqual(columns[0].name.root, "id")
        self.assertEqual(columns[1].name.root, "name")
        self.assertEqual(columns[2].name.root, "age")

    def test_empty_dictionary_handling(self):
        """Test handling of dictionaries with no attributes"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source.get_columns = Burstiqsource.get_columns.__get__(source)

        # Create empty dictionary
        dictionary = BurstIQDictionary(name="empty_dict", attributes=[], indexes=[])

        # Get columns
        columns = list(source.get_columns("empty_dict", dictionary))

        # Should return empty list
        self.assertEqual(len(columns), 0)

    def test_dictionary_with_precision(self):
        """Test handling of attributes with precision"""
        from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource

        source = Mock(spec=Burstiqsource)
        source._map_burstiq_datatype = Burstiqsource._map_burstiq_datatype.__get__(
            source
        )
        source._process_attribute_to_column = (
            Burstiqsource._process_attribute_to_column.__get__(source)
        )

        # Create attribute with precision
        attribute = BurstIQAttribute(
            name="amount", datatype="DECIMAL", precision=10, required=False
        )

        # Process to column
        column = source._process_attribute_to_column(attribute, "transaction")

        # Verify precision is set
        self.assertIsNotNone(column)
        self.assertEqual(column.precision, 10)
