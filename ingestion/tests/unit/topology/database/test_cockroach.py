"""
Test Cockroach using the topology
"""

import types
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import VARCHAR

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    ConstraintType,
    DataType,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.cockroach.metadata import CockroachSource
from metadata.ingestion.source.database.common_pg_mappings import (
    GEOMETRY,
    POINT,
    POLYGON,
)

mock_cockroach_config = {
    "source": {
        "type": "cockroach",
        "serviceName": "local_cockroach1",
        "serviceConnection": {
            "config": {
                "type": "Cockroach",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:26257",
                "database": "cockroach",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "cockroach"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="cockroach_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Cockroach,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="default",
    fullyQualifiedName="cockroach_source.default",
    displayName="default",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="cockroach_source.default.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)


MOCK_COLUMN_VALUE = [
    {
        "name": "username",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "geom_c",
        "type": GEOMETRY(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "geometry",
        "comment": None,
    },
    {
        "name": "point_c",
        "type": POINT(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "point",
        "comment": None,
    },
    {
        "name": "polygon_c",
        "type": POLYGON(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "polygon",
    },
]


EXPECTED_COLUMN_VALUE = [
    Column(
        name="username",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar(50)",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="geom_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="geometry",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="point_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="point",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="polygon_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="polygon",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]


class cockroachUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_cockroach_config)
        self.cockroach_source = CockroachSource.create(
            mock_cockroach_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.cockroach_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.cockroach_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.cockroach_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_datatype(self):
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        inspector.get_pk_constraint = lambda table_name, schema_name: []
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        result, _, _ = self.cockroach_source.get_columns_and_constraints(
            "public", "user", "cockroach", inspector, TableType.Regular
        )
        for i, _ in enumerate(EXPECTED_COLUMN_VALUE):
            self.assertEqual(result[i], EXPECTED_COLUMN_VALUE[i])

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.cockroach_source.close()

    def test_is_hidden_shard_column(self):
        """
        Test that hidden shard columns are correctly identified.

        CockroachDB creates hidden virtual columns for hash-sharded indexes
        with names like 'crdb_internal_id_shard_16'. These columns are marked
        as NOT VISIBLE and should be filtered from constraint columns.

        See: https://www.cockroachlabs.com/docs/stable/hash-sharded-indexes
        """
        # These should be identified as hidden shard columns
        self.assertTrue(
            CockroachSource._is_hidden_shard_column("crdb_internal_id_shard_16")
        )
        self.assertTrue(
            CockroachSource._is_hidden_shard_column("crdb_internal_user_id_shard_8")
        )
        self.assertTrue(
            CockroachSource._is_hidden_shard_column(
                "crdb_internal_my_column_name_shard_32"
            )
        )
        self.assertTrue(
            CockroachSource._is_hidden_shard_column(
                "crdb_internal_start_time_end_time_shard_4"
            )
        )

        # These should NOT be identified as hidden shard columns
        self.assertFalse(CockroachSource._is_hidden_shard_column("id"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("user_id"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("crdb_internal"))
        self.assertFalse(CockroachSource._is_hidden_shard_column("crdb_internal_shard"))
        self.assertFalse(
            CockroachSource._is_hidden_shard_column("crdb_internal_id_shard")
        )
        self.assertFalse(
            CockroachSource._is_hidden_shard_column("my_crdb_internal_id_shard_16")
        )
        self.assertFalse(
            CockroachSource._is_hidden_shard_column("crdb_internal_id_shard_16_extra")
        )

    def test_hidden_shard_columns_filtered_from_pk_constraints(self):
        """
        Test that hidden shard columns are filtered from primary key constraints.

        When a table uses hash-sharded indexes, CockroachDB adds hidden shard
        columns to the primary key. These should be filtered out to prevent
        'Invalid column name found in table constraint' errors.
        """
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        # Simulate a primary key with both regular and hidden shard columns
        inspector.get_pk_constraint = lambda table_name, schema_name: {
            "constrained_columns": [
                "crdb_internal_id_shard_16",  # Hidden shard column - should be filtered
                "username",  # Regular column - should be kept
            ],
            "name": "test_table_pkey",
        }
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        (
            columns,
            table_constraints,
            _,
        ) = self.cockroach_source.get_columns_and_constraints(
            "public", "test_table", "cockroach", inspector, TableType.Regular
        )

        # Find the column named 'username' and check its constraint
        username_col = next(
            (col for col in columns if col.name.root == "username"), None
        )
        self.assertIsNotNone(username_col)
        # Since we now have only one pk_column after filtering, it should be a column-level constraint
        self.assertEqual(username_col.constraint, Constraint.PRIMARY_KEY)

    def test_all_hidden_shard_columns_filtered_results_in_no_pk(self):
        """
        Test edge case where all primary key columns are hidden shard columns.

        If all columns in the primary key are hidden shard columns, the
        resulting pk_columns list should be empty.
        """
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        # All primary key columns are hidden shard columns
        inspector.get_pk_constraint = lambda table_name, schema_name: {
            "constrained_columns": [
                "crdb_internal_id_shard_16",
                "crdb_internal_timestamp_shard_8",
            ],
            "name": "test_table_pkey",
        }
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        (
            columns,
            table_constraints,
            _,
        ) = self.cockroach_source.get_columns_and_constraints(
            "public", "test_table", "cockroach", inspector, TableType.Regular
        )

        # No table-level primary key constraint should be created
        pk_constraints = [
            tc
            for tc in (table_constraints or [])
            if tc.constraintType == ConstraintType.PRIMARY_KEY
        ]
        self.assertEqual(len(pk_constraints), 0)

        # No column should have PRIMARY_KEY constraint
        for col in columns:
            self.assertNotEqual(col.constraint, Constraint.PRIMARY_KEY)

    def test_multi_column_pk_with_hidden_shard_column(self):
        """
        Test that multi-column primary keys with hidden shard columns work correctly.

        When a table has a composite primary key with both regular columns and
        hidden shard columns, only the regular columns should remain in the
        constraint after filtering.
        """
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        # Simulate a composite primary key with hidden shard column
        inspector.get_pk_constraint = lambda table_name, schema_name: {
            "constrained_columns": [
                "crdb_internal_id_shard_16",  # Hidden - should be filtered
                "username",  # Regular column
                "geom_c",  # Regular column
            ],
            "name": "test_table_pkey",
        }
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        (
            columns,
            table_constraints,
            _,
        ) = self.cockroach_source.get_columns_and_constraints(
            "public", "test_table", "cockroach", inspector, TableType.Regular
        )

        # Should have a table-level PRIMARY_KEY constraint with the two visible columns
        pk_constraints = [
            tc
            for tc in (table_constraints or [])
            if tc.constraintType == ConstraintType.PRIMARY_KEY
        ]
        self.assertEqual(len(pk_constraints), 1)
        self.assertEqual(pk_constraints[0].columns, ["username", "geom_c"])
