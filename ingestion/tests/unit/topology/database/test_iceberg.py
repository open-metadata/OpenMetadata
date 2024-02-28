#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Test iceberg source
"""
import uuid
from copy import deepcopy
from unittest import TestCase
from unittest.mock import patch

import pyiceberg.exceptions
from pyiceberg.catalog.hive import HiveCatalog
from pyiceberg.partitioning import PartitionField
from pyiceberg.schema import Schema
from pyiceberg.table import Table as PyIcebergTable
from pyiceberg.table.metadata import TableMetadataV1
from pyiceberg.transforms import IdentityTransform
from pyiceberg.types import (
    BinaryType,
    BooleanType,
    DateType,
    DecimalType,
    DoubleType,
    FixedType,
    FloatType,
    IntegerType,
    ListType,
    LongType,
    MapType,
    NestedField,
    StringType,
    StructType,
    TimestampType,
    TimestamptzType,
    TimeType,
    UUIDType,
)

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
    TableType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.iceberg.metadata import IcebergSource
from metadata.utils import fqn

MOCK_COLUMN_MAP = {
    "binary": {
        "iceberg": NestedField(
            field_id=1,
            name="binary",
            field_type=BinaryType(),
            required=False,
            doc="Binary",
        ),
        "ometa": Column(
            name="binary",
            description="Binary",
            dataType=DataType.BINARY,
            dataTypeDisplay=str(BinaryType()),
            dataLength=0,
        ),
    },
    "boolean": {
        "iceberg": NestedField(
            field_id=2,
            name="boolean",
            field_type=BooleanType(),
            required=False,
        ),
        "ometa": Column(
            name="boolean",
            dataType=DataType.BOOLEAN,
            dataTypeDisplay=str(BooleanType()),
        ),
    },
    "date": {
        "iceberg": NestedField(
            field_id=3,
            name="date",
            field_type=DateType(),
            required=True,
        ),
        "ometa": Column(
            name="date",
            dataType=DataType.DATE,
            dataTypeDisplay=str(DateType()),
            constraint=Constraint.NOT_NULL,
        ),
    },
    "decimal": {
        "iceberg": NestedField(
            field_id=4,
            name="decimal",
            field_type=DecimalType(9, 3),
            required=False,
        ),
        "ometa": Column(
            name="decimal",
            dataType=DataType.DECIMAL,
            dataTypeDisplay=str(DecimalType(9, 3)),
            precision=9,
            scale=3,
        ),
    },
    "double": {
        "iceberg": NestedField(
            field_id=5,
            name="double",
            field_type=DoubleType(),
            required=False,
        ),
        "ometa": Column(
            name="double",
            dataType=DataType.DOUBLE,
            dataTypeDisplay=str(DoubleType()),
        ),
    },
    "fixed": {
        "iceberg": NestedField(
            field_id=6,
            name="fixed",
            field_type=FixedType(10),
            required=False,
        ),
        "ometa": Column(
            name="fixed",
            dataType=DataType.FIXED,
            dataTypeDisplay=str(FixedType(10)),
        ),
    },
    "float": {
        "iceberg": NestedField(
            field_id=7,
            name="float",
            field_type=FloatType(),
            required=False,
        ),
        "ometa": Column(
            name="float",
            dataType=DataType.FLOAT,
            dataTypeDisplay=str(FloatType()),
        ),
    },
    "integer": {
        "iceberg": NestedField(
            field_id=8,
            name="integer",
            field_type=IntegerType(),
            required=False,
        ),
        "ometa": Column(
            name="integer",
            dataType=DataType.INT,
            dataTypeDisplay=str(IntegerType()),
        ),
    },
    "list": {
        "iceberg": NestedField(
            field_id=9,
            name="list",
            field_type=ListType(
                element_id=1,
                element_type=IntegerType(),
            ),
            required=False,
        ),
        "ometa": Column(
            name="list",
            dataType=DataType.ARRAY,
            dataTypeDisplay=str(
                ListType(
                    element_id=1,
                    element_type=IntegerType(),
                )
            ),
            arrayDataType=DataType.INT,
        ),
    },
    "long": {
        "iceberg": NestedField(
            field_id=10,
            name="long",
            field_type=LongType(),
            required=False,
        ),
        "ometa": Column(
            name="long",
            dataType=DataType.LONG,
            dataTypeDisplay=str(LongType()),
        ),
    },
    "map": {
        "iceberg": NestedField(
            field_id=11,
            name="map",
            field_type=MapType(
                key_id=1,
                key_type=StringType(),
                value_id=2,
                value_type=IntegerType(),
            ),
            required=False,
        ),
        "ometa": Column(
            name="map",
            dataType=DataType.MAP,
            dataTypeDisplay=str(
                MapType(
                    key_id=1,
                    key_type=StringType(),
                    value_id=2,
                    value_type=IntegerType(),
                )
            ),
        ),
    },
    "string": {
        "iceberg": NestedField(
            field_id=12,
            name="string",
            field_type=StringType(),
            required=False,
        ),
        "ometa": Column(
            name="string",
            dataType=DataType.STRING,
            dataTypeDisplay=str(StringType()),
        ),
    },
    "struct": {
        "iceberg": NestedField(
            field_id=13,
            name="struct",
            field_type=StructType(
                fields=(
                    NestedField(
                        field_id=100,
                        name="nested1",
                        field_type=IntegerType(),
                        required=False,
                        doc="nested #1",
                    ),
                    NestedField(
                        field_id=101,
                        name="nested2",
                        field_type=StringType(),
                        required=True,
                    ),
                )
            ),
            required=False,
        ),
        "ometa": Column(
            name="struct",
            dataType=DataType.STRUCT,
            dataTypeDisplay=str(
                StructType(
                    fields=(
                        NestedField(
                            field_id=100,
                            name="nested1",
                            field_type=IntegerType(),
                            required=False,
                            doc="nested #1",
                        ),
                        NestedField(
                            field_id=101,
                            name="nested2",
                            field_type=StringType(),
                            required=True,
                        ),
                    )
                )
            ),
            children=[
                Column(
                    name="nested1",
                    description="nested #1",
                    dataType=DataType.INT,
                    dataTypeDisplay=str(IntegerType()),
                ),
                Column(
                    name="nested2",
                    dataType=DataType.STRING,
                    dataTypeDisplay=str(StringType()),
                    constraint=Constraint.NOT_NULL,
                ),
            ],
        ),
    },
    "time": {
        "iceberg": NestedField(
            field_id=14,
            name="time",
            field_type=TimeType(),
            required=False,
        ),
        "ometa": Column(
            name="time",
            dataType=DataType.TIME,
            dataTypeDisplay=str(TimeType()),
        ),
    },
    "timestamp": {
        "iceberg": NestedField(
            field_id=15,
            name="timestamp",
            field_type=TimestampType(),
            required=False,
        ),
        "ometa": Column(
            name="timestamp",
            dataType=DataType.TIMESTAMP,
            dataTypeDisplay=str(TimestampType()),
        ),
    },
    "timestamptz": {
        "iceberg": NestedField(
            field_id=16,
            name="timestamptz",
            field_type=TimestamptzType(),
            required=False,
        ),
        "ometa": Column(
            name="timestamptz",
            dataType=DataType.TIMESTAMPZ,
            dataTypeDisplay=str(TimestamptzType()),
        ),
    },
    "uuid": {
        "iceberg": NestedField(
            field_id=17,
            name="uuid",
            field_type=UUIDType(),
            required=False,
        ),
        "ometa": Column(
            name="uuid",
            dataType=DataType.UUID,
            dataTypeDisplay=str(UUIDType()),
        ),
    },
}

MOCK_HIVE_CONFIG = {
    "source": {
        "type": "iceberg",
        "serviceName": "test_iceberg",
        "serviceConnection": {
            "config": {
                "type": "Iceberg",
                "catalog": {
                    "name": "Batata",
                    "connection": {"uri": "thrift://localhost:9083"},
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

MOCK_REST_CONFIG = {
    "source": {
        "type": "iceberg",
        "serviceName": "test_iceberg",
        "serviceConnection": {
            "config": {
                "type": "Iceberg",
                "catalog": {
                    "name": "Batata",
                    "connection": {"uri": "http://localhost:8181"},
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

MOCK_GLUE_CONFIG = {
    "source": {
        "type": "iceberg",
        "serviceName": "test_iceberg",
        "serviceConnection": {
            "config": {
                "type": "Iceberg",
                "catalog": {
                    "name": "Batata",
                    "connection": {
                        "awsConfig": {
                            "awsAccessKeyId": "access_key",
                            "awsSecretAccessKey": "secret",
                            "awsRegion": "us-east-2",
                            "awsSessionToken": "token",
                        },
                    },
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

MOCK_DYNAMO_CONFIG = {
    "source": {
        "type": "iceberg",
        "serviceName": "test_iceberg",
        "serviceConnection": {
            "config": {
                "type": "Iceberg",
                "catalog": {
                    "name": "Batata",
                    "connection": {
                        "tableName": "table",
                        "awsConfig": {
                            "awsAccessKeyId": "access_key",
                            "awsSecretAccessKey": "secret",
                            "awsRegion": "us-east-2",
                            "awsSessionToken": "token",
                        },
                    },
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

MOCK_NAMESPACES = [
    ("namespace1",),
    ("namespace2", "foo"),
]

EXPECTED_NAMESPACES_NAMES = [
    "namespace1",
    "namespace2.foo",
]

MOCK_TABLE_LIST = [
    ("namespace1", "table1"),
    ("namespace1", "table2", "foo"),
    ("namespace2", "table3"),
]

EXPECTED_TABLE_LIST = [
    ("table1", TableType.Regular),
    ("table2.foo", TableType.Regular),
    ("table3", TableType.Regular),
]


class IcebergUnitTest(TestCase):
    """
    Validate how we work with the Iceberg connector
    """

    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        for config in [
            MOCK_DYNAMO_CONFIG,
            MOCK_GLUE_CONFIG,
            MOCK_REST_CONFIG,
            MOCK_HIVE_CONFIG,
        ]:
            self.config = parse_workflow_config_gracefully(config)
            self.iceberg = IcebergSource.create(
                config["source"],
                OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
            )

        self.iceberg.context.database_service = "test_iceberg"
        self.iceberg.context.database = "default"
        self.iceberg.context.database_schema = "schema"

    def test_create(self):
        """
        An invalid config raises an error
        """
        not_looker_source = {
            "type": "mysql",
            "serviceName": "mysql_local",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "authType": {"password": "openmetadata_password"},
                    "hostPort": "localhost:3306",
                    "databaseSchema": "openmetadata_db",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                }
            },
        }

        self.assertRaises(
            InvalidSourceException,
            IcebergSource.create,
            not_looker_source,
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_get_database_name(self):
        """
        Asserts 'get_database_name' returns:
            - databaseName when it is set
            - 'default' when it is not set
        """

        # Iceberg connector without databaseName set returns 'default'
        self.assertEqual(next(self.iceberg.get_database_names()), "default")

        # Iceberg connector with databaseName set returns the databaseName
        iceberg_source_with_database_name = deepcopy(self.iceberg)
        iceberg_source_with_database_name.service_connection.catalog.databaseName = (
            "myDatabase"
        )

        self.assertEqual(
            next(iceberg_source_with_database_name.get_database_names()), "myDatabase"
        )

    def test_yield_database(self):
        """
        Assert 'yield_database' returns the proper 'CreateDatabaseRequest'
        """

        database_name = "database"

        expected = CreateDatabaseRequest(
            name="database", service=self.iceberg.context.database_service
        )
        self.assertEqual(
            next(self.iceberg.yield_database(database_name)).right, expected
        )

    def test_get_database_schema_names(self):
        """
        Mock the Catalog and check the namespaces are transformed as expected,
        from tuples to strings.
        """
        with patch.object(HiveCatalog, "list_namespaces", return_value=MOCK_NAMESPACES):
            for i, namespace in enumerate(self.iceberg.get_database_schema_names()):
                self.assertEqual(namespace, EXPECTED_NAMESPACES_NAMES[i])

        def raise_something_bad():
            raise RuntimeError("Something bad")

        with patch.object(
            HiveCatalog, "list_namespaces", side_effect=raise_something_bad
        ):
            self.assertRaises(Exception, IcebergSource.get_database_schema_names)

    def test_yield_database_schema(self):
        """
        Assert 'yield_database_schema' returns the propert 'CreateDatabaseSchemaRequest'
        """
        schema_name = "MySchema"
        fully_qualified_database_name = "FullyQualifiedDatabaseName"

        expected = CreateDatabaseSchemaRequest(
            name=schema_name,
            database=fully_qualified_database_name,
        )

        with patch.object(fqn, "build", return_value=fully_qualified_database_name):
            self.assertEqual(
                next(self.iceberg.yield_database_schema(schema_name)).right, expected
            )

    def test_get_tables_name_and_type(self):
        """
        Assert 'get_tables_name_and_type' returns the proper table name and type.
        """

        # Happy Path scenario
        class LoadTableMock:
            data = iter(MOCK_TABLE_LIST)

            def name(self):
                return next(self.data)

        with patch.object(
            HiveCatalog, "list_tables", return_value=MOCK_TABLE_LIST
        ), patch.object(HiveCatalog, "load_table", return_value=LoadTableMock()):
            for i, table in enumerate(self.iceberg.get_tables_name_and_type()):
                self.assertEqual(table, EXPECTED_TABLE_LIST[i])

        # When pyiceberg.exceptions.NoSuchIcebergTableError is raised
        # Then nothing is yield.
        def raise_no_such_iceberg_table():
            raise pyiceberg.exceptions.NoSuchIcebergTableError()

        with patch.object(
            HiveCatalog, "list_tables", return_value=MOCK_TABLE_LIST
        ), patch.object(
            HiveCatalog, "load_table", side_effect=raise_no_such_iceberg_table
        ):
            self.assertEqual(len(list(self.iceberg.get_tables_name_and_type())), 0)

        # When pyiceberg.exceptions.NoSuchTableError is raised
        # Then nothing is yield.
        def raise_no_such_table():
            raise pyiceberg.exceptions.NoSuchTableError()

        with patch.object(
            HiveCatalog, "list_tables", return_value=MOCK_TABLE_LIST
        ), patch.object(HiveCatalog, "load_table", side_effect=raise_no_such_table):
            self.assertEqual(len(list(self.iceberg.get_tables_name_and_type())), 0)

    def test_get_owner_ref(self):
        """
        Asserts 'get_owner_ref' returns:
            - None if there is no Owner
            - EntityReference if there is an Owner
        """
        table_name = "table"

        # When the Owner is present on the PyIceberg Table
        # Then EntityReference needs to be searched for
        ref = EntityReference(id=uuid.uuid4(), type="user")

        iceberg_table_with_owner = {
            "identifier": (
                self.iceberg.context.database,
                self.iceberg.context.database_schema,
                table_name,
            ),
            "metadata": TableMetadataV1.parse_obj(
                {
                    "location": "foo",
                    "last_column_id": 1,
                    "format_version": 1,
                    "schema": {},
                    "partition_spec": [],
                    "properties": {"owner": "myself"},
                }
            ),
            "metadata_location": "bar",
            "io": "pyiceberg.io.pyarrow.PyArrowFileIO",
            "catalog": self.iceberg.connection_obj,
        }

        self.iceberg.context.iceberg_table = PyIcebergTable(**iceberg_table_with_owner)

        with patch.object(OpenMetadata, "get_reference_by_email", return_value=ref):
            self.assertEqual(
                self.iceberg.get_owner_ref(table_name),
                ref,
            )

        # When the Owner is not present on the PyIceberg Table
        # Then None is returned
        iceberg_table_without_owner = {
            "identifier": (
                self.iceberg.context.database,
                self.iceberg.context.database_schema,
                table_name,
            ),
            "metadata": TableMetadataV1.parse_obj(
                {
                    "location": "foo",
                    "last_column_id": 1,
                    "format_version": 1,
                    "schema": {},
                    "partition_spec": [],
                    "properties": {},
                }
            ),
            "metadata_location": "bar",
            "io": "pyiceberg.io.pyarrow.PyArrowFileIO",
            "catalog": self.iceberg.connection_obj,
        }
        self.iceberg.context.iceberg_table = PyIcebergTable(
            **iceberg_table_without_owner
        )

        self.assertIsNone(
            self.iceberg.get_owner_ref(table_name),
        )

    def test_yield_table(self):
        table_name = "table_name"
        table_type = TableType.Regular

        iceberg_table = {
            "identifier": (
                self.iceberg.context.database,
                self.iceberg.context.database_schema,
                table_name,
            ),
            "metadata": TableMetadataV1.parse_obj(
                {
                    "location": "foo",
                    "last_column_id": 1,
                    "format_version": 1,
                    "schema": Schema(
                        fields=(
                            MOCK_COLUMN_MAP[field]["iceberg"]
                            for field in MOCK_COLUMN_MAP.keys()
                        )
                    ),
                    "partition_spec": [],
                    "partition_specs": [
                        {
                            "fields": (
                                PartitionField(
                                    source_id=1,
                                    field_id=1000,
                                    transform=IdentityTransform(),
                                    name="boolean",
                                ),
                            )
                        }
                    ],
                    "properties": {"owner": "myself", "comment": "Table Description"},
                }
            ),
            "metadata_location": "bar",
            "io": "pyiceberg.io.pyarrow.PyArrowFileIO",
            "catalog": self.iceberg.connection_obj,
        }

        fq_database_schema = "FullyQualifiedDatabaseSchema"

        ref = EntityReference(id=uuid.uuid4(), type="user")
        self.iceberg.context.iceberg_table = PyIcebergTable(**iceberg_table)

        expected = CreateTableRequest(
            name=table_name,
            tableType=table_type,
            description="Table Description",
            owner=ref,
            columns=[
                MOCK_COLUMN_MAP[field]["ometa"] for field in MOCK_COLUMN_MAP.keys()
            ],
            tablePartition=TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName="binary",
                        intervalType=PartitionIntervalTypes.COLUMN_VALUE,
                        interval=None,
                    )
                ]
            ),
            databaseSchema=fq_database_schema,
        )

        with patch.object(
            OpenMetadata, "get_reference_by_email", return_value=ref
        ), patch.object(fqn, "build", return_value=fq_database_schema):
            result = next(self.iceberg.yield_table((table_name, table_type))).right

            self.assertEqual(result, expected)
