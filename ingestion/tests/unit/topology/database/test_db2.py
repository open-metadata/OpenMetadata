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
Test DB2 using the topology
"""
import types
from unittest import TestCase
from unittest.mock import MagicMock, patch

from sqlalchemy.sql import sqltypes as sa_types
from sqlalchemy.types import INTEGER, VARCHAR

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    TableType,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import (
    ColumnTypeParser,
    create_sqlalchemy_type,
)
from metadata.ingestion.source.database.db2.metadata import Db2Source
from metadata.ingestion.source.database.db2.utils import get_columns_os390

mock_db2_config = {
    "source": {
        "type": "db2",
        "serviceName": "test_db2",
        "serviceConnection": {
            "config": {
                "type": "Db2",
                "scheme": "db2+ibm_db",
                "username": "username",
                "password": "password",
                "hostPort": "localhost:50000",
                "database": "testdb",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "db2"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="db2_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Db2,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="sample_database",
    fullyQualifiedName="db2_source_test.sample_database",
    displayName="sample_database",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="sample_schema",
    fullyQualifiedName="db2_source_test.sample_database.sample_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_COLUMN_VALUE = [
    {
        "name": "col_varchar",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
    },
    {
        "name": "col_integer",
        "type": INTEGER(),
        "nullable": False,
        "default": None,
        "autoincrement": False,
        "comment": None,
    },
    {
        "name": "col_xml",
        "type": create_sqlalchemy_type("XMLVARCHAR")(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
    },
    {
        "name": "col_unknown",
        "type": sa_types.NullType(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
    },
]

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName("sample_database"),
        service=FullyQualifiedEntityName("db2_source_test"),
        default=False,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("sample_schema"),
        database=FullyQualifiedEntityName("db2_source_test.sample_database"),
    )
]

EXPECTED_TABLE = [
    CreateTableRequest(
        name=EntityName("sample_table"),
        tableType=TableType.Regular.name,
        columns=[
            Column(
                name=ColumnName("col_varchar"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="VARCHAR(1)",
                constraint="NULL",
            ),
            Column(
                name=ColumnName("col_integer"),
                dataType=DataType.INT.name,
                dataLength=1,
                dataTypeDisplay="INT",
                constraint="NOT_NULL",
            ),
            Column(
                name=ColumnName("col_xml"),
                dataType=DataType.XML.name,
                dataLength=1,
                dataTypeDisplay="XML",
                constraint="NULL",
            ),
            Column(
                name=ColumnName("col_unknown"),
                dataType=DataType.NULL.name,
                dataLength=1,
                dataTypeDisplay="NULL",
                constraint="NULL",
            ),
        ],
        tableConstraints=[],
        databaseSchema=FullyQualifiedEntityName(
            "db2_source_test.sample_database.sample_schema"
        ),
    )
]


class Db2UnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Db2 Unit Test
    """

    @patch("metadata.ingestion.source.database.common_db_source.get_connection")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(
        self,
        methodName,
        test_connection,
        get_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        get_connection.return_value = MagicMock()
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_db2_config)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.model_validate(
                mock_db2_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )
        self.db2 = Db2Source.create(
            mock_db2_config["source"],
            self.metadata,
        )
        self.db2.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.thread_id = self.db2.context.get_current_thread_id()
        self.db2._inspector_map[self.thread_id] = types.SimpleNamespace()
        self.db2._inspector_map[
            self.thread_id
        ].get_columns = (
            lambda table_name, schema_name, db_name, table_type=None: MOCK_COLUMN_VALUE
        )
        self.db2._inspector_map[
            self.thread_id
        ].get_pk_constraint = lambda table_name, schema_name: []
        self.db2._inspector_map[
            self.thread_id
        ].get_unique_constraints = lambda table_name, schema_name: []
        self.db2._inspector_map[
            self.thread_id
        ].get_foreign_keys = lambda table_name, schema_name: []
        self.db2._inspector_map[
            self.thread_id
        ].get_table_comment = lambda table_name, schema_name: {"text": None}

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [
            either.right for either in self.db2.yield_database(MOCK_DATABASE.name.root)
        ]
        self.db2.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    def test_yield_schema(self):
        assert EXPECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.db2.yield_database_schema(MOCK_DATABASE_SCHEMA.name.root)
        ]
        self.db2.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root


class Db2ColumnTypeParserTest(TestCase):
    """
    Tests for DB2-specific column type mappings
    in ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE
    """

    DB2_TYPE_MAPPINGS = {
        # DB2 XML Extender types
        "XMLVARCHAR": "XML",
        "XMLCLOB": "XML",
        "XMLFILE": "XML",
        # DB2 specific types
        "TIMESTMP": "TIMESTAMP",
        "LONGVARCHAR": "VARCHAR",
        "GRAPHIC": "CHAR",
        "VARGRAPHIC": "VARCHAR",
        "LONGVARGRAPHIC": "VARCHAR",
        "DBCLOB": "CLOB",
        "DECFLOAT": "DOUBLE",
        "CHARACTER": "CHAR",
    }

    def test_db2_type_mappings_exist(self):
        for db2_type, expected_om_type in self.DB2_TYPE_MAPPINGS.items():
            self.assertIn(
                db2_type,
                ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE,
                f"DB2 type '{db2_type}' missing from _SOURCE_TYPE_TO_OM_TYPE",
            )

    def test_db2_type_mappings_correct(self):
        for db2_type, expected_om_type in self.DB2_TYPE_MAPPINGS.items():
            actual = ColumnTypeParser._SOURCE_TYPE_TO_OM_TYPE[db2_type]
            self.assertEqual(
                actual,
                expected_om_type,
                f"DB2 type '{db2_type}' maps to '{actual}', expected '{expected_om_type}'",
            )

    def test_db2_get_column_type(self):
        for db2_type, expected_om_type in self.DB2_TYPE_MAPPINGS.items():
            result = ColumnTypeParser.get_column_type(db2_type)
            self.assertEqual(
                result,
                expected_om_type,
                f"get_column_type('{db2_type}') returned '{result}', expected '{expected_om_type}'",
            )

    def test_db2_xml_extender_types_map_to_xml(self):
        xml_types = ["XMLVARCHAR", "XMLCLOB", "XMLFILE"]
        for xml_type in xml_types:
            result = ColumnTypeParser.get_column_type(xml_type)
            self.assertEqual(result, "XML")

    def test_db2_types_already_in_parser(self):
        """Types that ibm_db_sa registers and already existed in the parser"""
        existing_types = {
            "BOOLEAN": "BOOLEAN",
            "BLOB": "BLOB",
            "CHAR": "CHAR",
            "CLOB": "CLOB",
            "DATE": "DATE",
            "DATETIME": "DATETIME",
            "INTEGER": "INT",
            "SMALLINT": "SMALLINT",
            "BIGINT": "BIGINT",
            "DECIMAL": "DECIMAL",
            "NUMERIC": "NUMERIC",
            "FLOAT": "FLOAT",
            "TIME": "TIME",
            "TIMESTAMP": "TIMESTAMP",
            "VARCHAR": "VARCHAR",
            "XML": "XML",
            "BINARY": "BINARY",
            "VARBINARY": "VARBINARY",
            "REAL": "FLOAT",
            "DOUBLE": "DOUBLE",
        }
        for db2_type, expected_om_type in existing_types.items():
            result = ColumnTypeParser.get_column_type(db2_type)
            self.assertEqual(
                result,
                expected_om_type,
                f"Existing type '{db2_type}' returned '{result}', expected '{expected_om_type}'",
            )


class Db2GetColumnsOS390Test(TestCase):
    """
    Tests for the get_columns_os390 override that handles
    empty and unrecognized column types from DB2 z/OS.
    """

    ISCHEMA_NAMES = {
        "CHAR": sa_types.CHAR,
        "VARCHAR": sa_types.VARCHAR,
        "INTEGER": sa_types.INTEGER,
        "SMALLINT": sa_types.SMALLINT,
        "BIGINT": sa_types.BIGINT,
        "DECIMAL": sa_types.DECIMAL,
        "NUMERIC": sa_types.NUMERIC,
        "FLOAT": sa_types.FLOAT,
        "DOUBLE": sa_types.Float,
        "DATE": sa_types.DATE,
        "TIME": sa_types.TIME,
        "TIMESTAMP": sa_types.TIMESTAMP,
        "BOOLEAN": sa_types.BOOLEAN,
        "BLOB": sa_types.BLOB,
        "CLOB": sa_types.CLOB,
        "CHARACTER": sa_types.CHAR,
        "GRAPHIC": sa_types.CHAR,
        "VARGRAPHIC": sa_types.VARCHAR,
        "XML": sa_types.Text,
        "XMLVARCHAR": create_sqlalchemy_type("XMLVARCHAR"),
        "XMLCLOB": create_sqlalchemy_type("XMLCLOB"),
        "XMLFILE": create_sqlalchemy_type("XMLFILE"),
        "DECFLOAT": create_sqlalchemy_type("DECFLOAT"),
        "ROWID": create_sqlalchemy_type("ROWID"),
        "BINARY": sa_types.BINARY,
        "VARBINARY": sa_types.VARBINARY,
    }

    def _run_get_columns(self, rows):
        mock_self = MagicMock()
        mock_self.denormalize_name = lambda x: x
        mock_self.normalize_name = lambda x: x.lower() if x else x
        mock_self.default_schema_name = "DEFAULT_SCHEMA"
        mock_self.ischema_names = self.ISCHEMA_NAMES

        mock_connection = MagicMock()
        mock_connection.execute.return_value = rows

        with patch(
            "metadata.ingestion.source.database.db2.utils.sql.select"
        ) as mock_select:
            mock_query = MagicMock()
            mock_select.return_value = mock_query
            mock_query.where.return_value = mock_query
            mock_query.order_by.return_value = mock_query

            return get_columns_os390.__wrapped__(
                mock_self, mock_connection, "TEST_TABLE"
            )

    def test_varchar_column(self):
        rows = [("COL1", "VARCHAR", None, "Y", 100, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "col1")
        self.assertIsInstance(result[0]["type"], sa_types.VARCHAR)
        self.assertTrue(result[0]["nullable"])

    def test_decimal_column(self):
        rows = [("PRICE", "DECIMAL", None, "N", 10, 2, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "price")
        self.assertIsInstance(result[0]["type"], sa_types.DECIMAL)
        self.assertFalse(result[0]["nullable"])

    def test_xmlvarchar_column(self):
        rows = [("ORDER_DATA", "XMLVARCHAR", None, "Y", 0, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "order_data")
        self.assertNotEqual(result[0]["type"], sa_types.NULLTYPE)

    def test_empty_type_column(self):
        rows = [("POLICY_NUMBER", "", None, "Y", 0, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "policy_number")
        self.assertEqual(result[0]["type"], sa_types.NULLTYPE)

    def test_none_type_column(self):
        rows = [("MYSTERY_COL", None, None, "Y", 0, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["type"], sa_types.NULLTYPE)

    def test_unrecognized_type_column(self):
        rows = [("CUSTOM_COL", "SOMECUSTOMTYPE", None, "Y", 0, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["type"], sa_types.NULLTYPE)

    def test_whitespace_type_stripped(self):
        rows = [("COL1", "  VARCHAR  ", None, "Y", 50, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0]["type"], sa_types.VARCHAR)

    def test_lowercase_type_uppercased(self):
        rows = [("COL1", "integer", None, "Y", 0, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["type"], sa_types.INTEGER)

    def test_multiple_columns_mixed_types(self):
        rows = [
            ("ID", "INTEGER", None, "N", 0, 0, " ", None),
            ("NAME", "VARCHAR", None, "Y", 255, 0, " ", "Customer name"),
            ("ORDER_XML", "XMLVARCHAR", None, "Y", 0, 0, " ", None),
            ("POLICY_NUM", "", None, "Y", 0, 0, " ", None),
            ("AMOUNT", "DECIMAL", None, "N", 18, 4, " ", None),
        ]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 5)
        self.assertEqual(result[0]["type"], sa_types.INTEGER)
        self.assertIsInstance(result[1]["type"], sa_types.VARCHAR)
        self.assertNotEqual(result[2]["type"], sa_types.NULLTYPE)
        self.assertEqual(result[3]["type"], sa_types.NULLTYPE)
        self.assertIsInstance(result[4]["type"], sa_types.DECIMAL)

    def test_column_comment_preserved(self):
        rows = [("COL1", "INTEGER", None, "Y", 0, 0, " ", "A test column")]
        result = self._run_get_columns(rows)

        self.assertEqual(result[0]["comment"], "A test column")

    def test_nullable_flag(self):
        rows = [
            ("COL1", "INTEGER", None, "Y", 0, 0, " ", None),
            ("COL2", "INTEGER", None, "N", 0, 0, " ", None),
        ]
        result = self._run_get_columns(rows)

        self.assertTrue(result[0]["nullable"])
        self.assertFalse(result[1]["nullable"])

    def test_graphic_column_with_length(self):
        rows = [("GCOL", "GRAPHIC", None, "Y", 200, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0]["type"], sa_types.CHAR)

    def test_vargraphic_column_with_length(self):
        rows = [("VGCOL", "VARGRAPHIC", None, "Y", 500, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0]["type"], sa_types.VARCHAR)

    def test_decfloat_column(self):
        rows = [("DFCOL", "DECFLOAT", None, "Y", 0, 0, " ", None)]
        result = self._run_get_columns(rows)

        self.assertEqual(len(result), 1)
        self.assertNotEqual(result[0]["type"], sa_types.NULLTYPE)
