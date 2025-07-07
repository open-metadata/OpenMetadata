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
Test unitycatalog using the topology
"""

from typing import List
from unittest import TestCase
from unittest.mock import patch

from databricks.sdk.service.catalog import (
    CatalogInfo,
    CatalogInfoSecurableKind,
    CatalogType,
    ColumnInfo,
    ColumnTypeName,
    DataSourceFormat,
    IsolationMode,
    SchemaInfo,
    TableInfo,
)
from databricks.sdk.service.catalog import TableType as DatabricksTableType

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
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

# pylint: disable=line-too-long
mock_unitycatalog_config = {
    "source": {
        "type": "unitycatalog",
        "serviceName": "local_unitycatalog",
        "serviceConnection": {
            "config": {
                "type": "UnityCatalog",
                "catalog": "hive_metastore",
                "databaseSchema": "default",
                "token": "123sawdtesttoken",
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/abcdedfg",
                "connectionTimeout": 120,
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {"excludes": []},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "unity_catalog"},
        }
    },
}


MOCK_CATALOG_INFO: List[CatalogInfo] = [
    CatalogInfo(
        browse_only=False,
        catalog_type=CatalogType.MANAGED_CATALOG,
        comment=None,
        connection_name=None,
        created_at=1687515910367,
        created_by="test@open-metadata.org",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="demo",
        isolation_mode=IsolationMode.OPEN,
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="demo",
        options=None,
        owner="test@open-metadata.org",
        properties=None,
        provider_name=None,
        provisioning_info=None,
        securable_kind=CatalogInfoSecurableKind.CATALOG_STANDARD,
        securable_type="CATALOG",
        share_name=None,
        storage_location=None,
        storage_root=None,
        updated_at=1687515910367,
        updated_by="test@open-metadata.org",
    ),
    CatalogInfo(
        browse_only=False,
        catalog_type=CatalogType.MANAGED_CATALOG,
        comment="Main catalog (auto-created)",
        connection_name=None,
        created_at=1687515800742,
        created_by="test@open-metadata.org",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="main",
        isolation_mode=IsolationMode.OPEN,
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="main",
        options=None,
        owner="test@open-metadata.org",
        properties=None,
        provider_name=None,
        provisioning_info=None,
        securable_kind=CatalogInfoSecurableKind.CATALOG_STANDARD,
        securable_type="CATALOG",
        share_name=None,
        storage_location=None,
        storage_root=None,
        updated_at=1687515800742,
        updated_by="test@open-metadata.org",
    ),
    CatalogInfo(
        browse_only=False,
        catalog_type=None,
        comment="",
        connection_name="postgres_connection",
        created_at=1722951879190,
        created_by="test@open-metadata.org",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="postgres_catalog",
        isolation_mode=IsolationMode.OPEN,
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="postgres_catalog",
        options={"database": "TESTDB"},
        owner="test@open-metadata.org",
        properties=None,
        provider_name=None,
        provisioning_info=None,
        securable_kind=CatalogInfoSecurableKind.CATALOG_FOREIGN_POSTGRESQL,
        securable_type="CATALOG",
        share_name=None,
        storage_location=None,
        storage_root=None,
        updated_at=1722951879190,
        updated_by="test@open-metadata.org",
    ),
    CatalogInfo(
        browse_only=False,
        catalog_type=CatalogType.SYSTEM_CATALOG,
        comment="System catalog (auto-created)",
        connection_name=None,
        created_at=1687515800756,
        created_by="System user",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="system",
        isolation_mode=IsolationMode.OPEN,
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="system",
        options=None,
        owner="System user",
        properties=None,
        provider_name=None,
        provisioning_info=None,
        securable_kind=CatalogInfoSecurableKind.CATALOG_SYSTEM,
        securable_type="CATALOG",
        share_name=None,
        storage_location=None,
        storage_root=None,
        updated_at=1687515800756,
        updated_by="System user",
    ),
]
MOCK_SCHEMA_INFO = [
    SchemaInfo(
        catalog_name="demo",
        catalog_type="MANAGED_CATALOG",
        comment="Default schema (auto-created)",
        created_at=1687515910369,
        created_by="test@open-metadata.org",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="demo.default",
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="default",
        owner="test@open-metadata.org",
        properties=None,
        storage_location=None,
        storage_root=None,
        updated_at=1687515910369,
        updated_by="test@open-metadata.org",
    ),
    SchemaInfo(
        catalog_name="demo",
        catalog_type="MANAGED_CATALOG",
        comment="Information schema (auto-created)",
        created_at=1687515910373,
        created_by="System user",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="demo.information_schema",
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="information_schema",
        owner="System user",
        properties=None,
        storage_location=None,
        storage_root=None,
        updated_at=1687515910373,
        updated_by="System user",
    ),
    SchemaInfo(
        catalog_name="demo",
        catalog_type="MANAGED_CATALOG",
        comment="",
        created_at=1687518049197,
        created_by="test@open-metadata.org",
        effective_predictive_optimization_flag=None,
        enable_predictive_optimization=None,
        full_name="demo.new_schema",
        metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
        name="new_schema",
        owner="test@open-metadata.org",
        properties={"owner": "root"},
        storage_location=None,
        storage_root=None,
        updated_at=1687518049197,
        updated_by="test@open-metadata.org",
    ),
]

MOCK_CONTEXT_TABLEDATA = TableInfo(full_name="demo.default.complex_data")
MOCK_TABLE_INFO = TableInfo(
    access_point=None,
    catalog_name="demo",
    columns=[
        ColumnInfo(
            comment=None,
            mask=None,
            name="id",
            nullable=True,
            partition_index=None,
            position=0,
            type_interval_type=None,
            type_json='{"name":"id","type":"integer","nullable":true,"metadata":{}}',
            type_name=ColumnTypeName.INT,
            type_precision=0,
            type_scale=0,
            type_text="int",
        ),
        ColumnInfo(
            comment=None,
            mask=None,
            name="array_data",
            nullable=True,
            partition_index=None,
            position=1,
            type_interval_type=None,
            type_json='{"name":"array_data","type":{"type":"array","elementType":"integer","containsNull":true},"nullable":true,"metadata":{}}',
            type_name=ColumnTypeName.ARRAY,
            type_precision=0,
            type_scale=0,
            type_text="array<int>",
        ),
        ColumnInfo(
            comment=None,
            mask=None,
            name="map_data",
            nullable=True,
            partition_index=None,
            position=2,
            type_interval_type=None,
            type_json='{"name":"map_data","type":{"type":"map","keyType":"string","valueType":"integer","valueContainsNull":true},"nullable":true,"metadata":{}}',
            type_name=ColumnTypeName.MAP,
            type_precision=0,
            type_scale=0,
            type_text="map<string,int>",
        ),
        ColumnInfo(
            comment=None,
            mask=None,
            name="struct_data",
            nullable=True,
            partition_index=None,
            position=3,
            type_interval_type=None,
            type_json='{"name":"struct_data","type":{"type":"struct","fields":[{"name":"a","type":"integer","nullable":true,"metadata":{}},{"name":"b","type":"string","nullable":true,"metadata":{}},{"name":"c","type":{"type":"array","elementType":"string","containsNull":true},"nullable":true,"metadata":{}},{"name":"d","type":{"type":"struct","fields":[{"name":"abc","type":"integer","nullable":true,"metadata":{}}]},"nullable":true,"metadata":{}}]},"nullable":true,"metadata":{}}',
            type_name=ColumnTypeName.STRUCT,
            type_precision=0,
            type_scale=0,
            type_text="struct<a:int,b:string,c:array<string>,d:struct<abc:int>>",
        ),
    ],
    comment="this is a description for dataset input",
    created_at=1713519443052,
    created_by="test@open-metadata.org",
    data_access_configuration_id="00000000-0000-0000-0000-000000000000",
    data_source_format=DataSourceFormat.DELTA,
    deleted_at=None,
    delta_runtime_properties_kvpairs=None,
    effective_predictive_optimization_flag=None,
    enable_predictive_optimization=None,
    encryption_details=None,
    full_name="demo.default.complex_data",
    metastore_id="3849887a-24ae-4b8e-a470-9d953589f80e",
    name="complex_data",
    owner="test@open-metadata.org",
    pipeline_id=None,
    properties={
        "delta.lastCommitTimestamp": "1713519423000",
        "delta.lastUpdateVersion": "0",
        "delta.minWriterVersion": "7",
        "delta.enableDeletionVectors": "true",
        "delta.minReaderVersion": "3",
        "delta.checkpoint.writeStatsAsStruct": "true",
        "delta.checkpoint.writeStatsAsJson": "false",
        "delta.feature.deletionVectors": "supported",
    },
    row_filter=None,
    schema_name="default",
    sql_path=None,
    storage_credential_name=None,
    storage_location="s3://awsdatalake-testing/databricks-new-metastore/3849887a-24ae-4b8e-a470-9d953589f80e/tables/fe201793-8483-4edd-90a7-d27332d1418a",
    table_constraints=[],
    table_id="fe201793-8483-4edd-90a7-d27332d1418a",
    table_type=DatabricksTableType.MANAGED,
    updated_at=1713519443052,
    updated_by="test@open-metadata.org",
    view_definition=None,
    view_dependencies=None,
)

MOCK_TABLE = {
    "id": "2d725b6e-1588-4814-9d8b-eff384cd1053",
    "name": "DataSet Input",
    "description": "this is a description for dataset input",
    "rows": 99,
    "columns": 10,
    "schema": {
        "columns": [
            {"type": "DOUBLE", "name": "amount"},
            {"type": "DOUBLE", "name": "bank_transfer_amount"},
            {"type": "DOUBLE", "name": "coupon_amount"},
            {"type": "DOUBLE", "name": "credit_card_amount"},
        ]
    },
    "owner": {"id": 1027954122, "name": "Nihar Doshi"},
    "dataCurrentAt": "2022-10-18T05:30:06Z",
    "createdAt": "2022-10-17T05:52:21Z",
    "updatedAt": "2022-10-18T05:30:07Z",
    "pdpEnabled": False,
    "policies": [
        {
            "id": 17,
            "type": "open",
            "name": "All Rows",
            "filters": [],
            "users": [],
            "virtualUsers": [],
            "groups": [],
        }
    ],
}

MOCK_TABLE_2 = {
    "id": "3df43ed7-5f2f-46bb-9793-384c6374a81d",
    "name": "growth data",
    "description": "company growth data",
    "rows": 5,
    "columns": 2,
    "schema": {
        "columns": [
            {"type": "ARRAY", "name": "quarters.result"},
            {"type": "NUMBER", "name": "profit"},
        ]
    },
    "owner": {"id": 6024954162, "name": "Sam"},
    "dataCurrentAt": "2024-07-15T05:30:06Z",
    "createdAt": "2024-07-15T05:52:21Z",
    "updatedAt": "2024-07-15T05:30:07Z",
}

EXPTECTED_TABLE_2 = [
    CreateTableRequest(
        name="growth data",
        displayName="growth data",
        description="company growth data",
        tableType=TableType.Regular.value,
        columns=[
            Column(
                name="quarters.result",
                dataType=DataType.ARRAY.value,
            ),
            Column(
                name="profit",
                dataType=DataType.NUMBER.value,
            ),
        ],
        databaseSchema=FullyQualifiedEntityName(
            "local_unitycatalog.hive_metastore.do_it_all_with_default_schema"
        ),
    )
]

EXPECTED_DATABASE_NAMES = ["hive_metastore"]
EXPECTED_DATABASE_SCHEMA_NAMES = ["default", "information_schema", "new_schema"]

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="local_unitycatalog",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.UnityCatalog,
)

MOCK_DATABASE = Database(
    id="a4e2f4aa-10af-4d4b-a85b-5daad6f70720",
    name="hive_metastore",
    fullyQualifiedName="local_unitycatalog.hive_metastore",
    displayName="hive_metastore",
    description=Markdown(""),
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="ec5be98f-917c-44be-b178-47b3237ef648",
    name="do_it_all_with_default_schema",
    fullyQualifiedName="domodatabase_source.do_it_all_with_default_config.do_it_all_with_default_schema",
    service=EntityReference(id="ec5be98f-917c-44be-b178-47b3237ef648", type="database"),
    database=EntityReference(
        id="a4e2f4aa-10af-4d4b-a85b-5daad6f70720",
        type="database",
    ),
)


EXPTECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name="do_it_all_with_default_schema",
        displayName=None,
        description=None,
        owners=None,
        database="local_unitycatalog.hive_metastore",
    )
]


EXPTECTED_TABLE = [
    Either(
        right=CreateTableRequest(
            name=EntityName(root="complex_data"),
            displayName=None,
            description="this is a description for dataset input",
            tableType=TableType.Regular,
            columns=[
                Column(
                    name=ColumnName(root="id"),
                    displayName=None,
                    dataType=DataType.INT,
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="int",
                    description=None,
                    fullyQualifiedName=None,
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    profile=None,
                    customMetrics=None,
                ),
                Column(
                    name=ColumnName(root="array_data"),
                    displayName=None,
                    dataType=DataType.ARRAY,
                    arrayDataType=DataType.INT,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="array<int>",
                    description=None,
                    fullyQualifiedName=None,
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    profile=None,
                    customMetrics=None,
                ),
                Column(
                    name=ColumnName(root="map_data"),
                    displayName=None,
                    dataType=DataType.MAP,
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="map<string,int>",
                    description=None,
                    fullyQualifiedName=None,
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=None,
                    profile=None,
                    customMetrics=None,
                ),
                Column(
                    name=ColumnName(root="struct_data"),
                    displayName=None,
                    dataType=DataType.STRUCT,
                    arrayDataType=None,
                    dataLength=1,
                    precision=None,
                    scale=None,
                    dataTypeDisplay="struct<a:int,b:string,c:array<string>,d:struct<abc:int>>",
                    description=None,
                    fullyQualifiedName=None,
                    tags=None,
                    constraint=None,
                    ordinalPosition=None,
                    jsonSchema=None,
                    children=[
                        Column(
                            name=ColumnName(root="a"),
                            displayName=None,
                            dataType=DataType.INT,
                            arrayDataType=None,
                            dataLength=None,
                            precision=None,
                            scale=None,
                            dataTypeDisplay="int",
                            description=None,
                            fullyQualifiedName=None,
                            tags=[],
                            constraint=None,
                            ordinalPosition=None,
                            jsonSchema=None,
                            children=None,
                            profile=None,
                            customMetrics=None,
                        ),
                        Column(
                            name=ColumnName(root="b"),
                            displayName=None,
                            dataType=DataType.STRING,
                            arrayDataType=None,
                            dataLength=None,
                            precision=None,
                            scale=None,
                            dataTypeDisplay="string",
                            description=None,
                            fullyQualifiedName=None,
                            tags=[],
                            constraint=None,
                            ordinalPosition=None,
                            jsonSchema=None,
                            children=None,
                            profile=None,
                            customMetrics=None,
                        ),
                        Column(
                            name=ColumnName(root="c"),
                            displayName=None,
                            dataType=DataType.ARRAY,
                            arrayDataType=DataType.STRING,
                            dataLength=None,
                            precision=None,
                            scale=None,
                            dataTypeDisplay="array<string>",
                            description=None,
                            fullyQualifiedName=None,
                            tags=[],
                            constraint=None,
                            ordinalPosition=None,
                            jsonSchema=None,
                            children=None,
                            profile=None,
                            customMetrics=None,
                        ),
                        Column(
                            name=ColumnName(root="d"),
                            displayName=None,
                            dataType=DataType.STRUCT,
                            arrayDataType=None,
                            dataLength=None,
                            precision=None,
                            scale=None,
                            dataTypeDisplay="struct<abc:int>",
                            description=None,
                            fullyQualifiedName=None,
                            tags=[],
                            constraint=None,
                            ordinalPosition=None,
                            jsonSchema=None,
                            children=[
                                Column(
                                    name=ColumnName(root="abc"),
                                    displayName=None,
                                    dataType=DataType.INT,
                                    arrayDataType=None,
                                    dataLength=None,
                                    precision=None,
                                    scale=None,
                                    dataTypeDisplay="int",
                                    description=None,
                                    fullyQualifiedName=None,
                                    tags=[],
                                    constraint=None,
                                    ordinalPosition=None,
                                    jsonSchema=None,
                                    children=None,
                                    profile=None,
                                    customMetrics=None,
                                )
                            ],
                            profile=None,
                            customMetrics=None,
                        ),
                    ],
                    profile=None,
                    customMetrics=None,
                ),
            ],
            dataModel=None,
            tableConstraints=[],
            tablePartition=None,
            tableProfilerConfig=None,
            owners=None,
            databaseSchema=FullyQualifiedEntityName(
                root="local_unitycatalog.hive_metastore.do_it_all_with_default_schema"
            ),
            tags=None,
            schemaDefinition=None,
            retentionPeriod=None,
            extension=None,
            sourceUrl=None,
            domain=None,
            dataProducts=None,
            fileFormat=None,
            lifeCycle=None,
            sourceHash=None,
        ),
        left=None,
    )
]


class unitycatalogUnitTest(TestCase):
    """
    unitycatalog unit tests
    """

    @patch(
        "metadata.ingestion.source.database.unitycatalog.metadata.UnitycatalogSource.test_connection"
    )
    def __init__(
        self,
        methodName,
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_unitycatalog_config
        )
        self.unitycatalog_source = UnitycatalogSource.create(
            mock_unitycatalog_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.unitycatalog_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.unitycatalog_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root

        self.unitycatalog_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    @patch("databricks.sdk.service.catalog.CatalogsAPI.list")
    def test_get_database_names_raw(self, mock_list):
        mock_list.return_value = MOCK_CATALOG_INFO
        assert ["demo", "main", "postgres_catalog", "system"] == list(
            self.unitycatalog_source.get_database_names_raw()
        )

    @patch("databricks.sdk.service.catalog.SchemasAPI.list")
    def test_database_schema_names(self, mock_schema_list):
        mock_schema_list.return_value = MOCK_SCHEMA_INFO
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.unitycatalog_source.get_database_schema_names()
        )

    @patch("databricks.sdk.service.catalog.TablesAPI.get")
    def test_yield_table(self, mock_data):
        mock_data.return_value = MOCK_TABLE_INFO
        table_list = []
        self.unitycatalog_source.context.get().table_data = MOCK_CONTEXT_TABLEDATA
        for table in self.unitycatalog_source.yield_table(("complex_data", "Regular")):
            if isinstance(table, Either):
                table_list.append(table)

        for _, (expected, original) in enumerate(zip(EXPTECTED_TABLE, table_list)):
            self.assertEqual(expected, original)
