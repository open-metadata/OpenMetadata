import datetime
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.glue import GlueSource

mock_glue_config = {
    "source": {
        "type": "glue",
        "serviceName": "local_glue",
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
                "storageServiceName": "storage_name",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "no-auth",
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="glue_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="glue_source.118146679784",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="glue_source.118146679784.default",
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

MOCK_DATABASE_PAGINATOR = {
    "DatabaseList": [
        {
            "Name": "default",
            "CreateTime": datetime.datetime(2022, 4, 13, 14, 9, 17),
            "CreateTableDefaultPermissions": [
                {
                    "Principal": {
                        "DataLakePrincipalIdentifier": "IAM_ALLOWED_PRINCIPALS"
                    },
                    "Permissions": ["ALL"],
                }
            ],
            "CatalogId": "118146679784",
        },
        {
            "Name": "mydatabase",
            "CreateTime": datetime.datetime(2022, 4, 13, 14, 9, 17),
            "CreateTableDefaultPermissions": [
                {
                    "Principal": {
                        "DataLakePrincipalIdentifier": "IAM_ALLOWED_PRINCIPALS"
                    },
                    "Permissions": ["ALL"],
                }
            ],
            "CatalogId": "118146679784",
        },
        {
            "Name": "testdatalake_db",
            "LocationUri": "s3://awsdatalake-testing/data",
            "CreateTime": datetime.datetime(2022, 6, 6, 17, 19, 55),
            "CreateTableDefaultPermissions": [
                {
                    "Principal": {
                        "DataLakePrincipalIdentifier": "IAM_ALLOWED_PRINCIPALS"
                    },
                    "Permissions": ["ALL"],
                }
            ],
            "CatalogId": "118146679784",
        },
        {
            "Name": "zipcode-db",
            "LocationUri": "s3://datalake-openmetadata-ohio/zipcode",
            "CreateTime": datetime.datetime(2022, 4, 5, 12, 17, 53),
            "CreateTableDefaultPermissions": [
                {
                    "Principal": {
                        "DataLakePrincipalIdentifier": "IAM_ALLOWED_PRINCIPALS"
                    },
                    "Permissions": ["ALL"],
                }
            ],
            "CatalogId": "118146679784",
        },
    ],
    "ResponseMetadata": {
        "RequestId": "21a5c41c-da65-4531-83cb-e6d3425c4ec7",
        "HTTPStatusCode": 200,
        "HTTPHeaders": {
            "date": "Tue, 26 Jul 2022 16:28:52 GMT",
            "content-type": "application/x-amz-json-1.1",
            "content-length": "1062",
            "connection": "keep-alive",
            "x-amzn-requestid": "21a5c41c-da65-4531-83cb-e6d3425c4ec7",
        },
        "RetryAttempts": 0,
    },
}

MOCK_TABLE_PAGINATOR = {
    "TableList": [
        {
            "Name": "cloudfront_logs",
            "DatabaseName": "default",
            "Owner": "hadoop",
            "CreateTime": datetime.datetime(2022, 5, 13, 17, 2, 17),
            "UpdateTime": datetime.datetime(2022, 5, 13, 17, 2, 17),
            "LastAccessTime": datetime.datetime(1970, 1, 1, 5, 30),
            "Retention": 0,
            "StorageDescriptor": {
                "Columns": [
                    {"Name": "date", "Type": "date"},
                    {"Name": "time", "Type": "string"},
                    {"Name": "location", "Type": "string"},
                    {"Name": "bytes", "Type": "int"},
                    {"Name": "requestip", "Type": "string"},
                    {"Name": "method", "Type": "string"},
                    {"Name": "host1", "Type": "string"},
                    {"Name": "uri1", "Type": "string"},
                    {"Name": "status", "Type": "int"},
                    {"Name": "referrer", "Type": "string"},
                    {"Name": "os", "Type": "string"},
                    {"Name": "browser", "Type": "string"},
                    {"Name": "browserversion", "Type": "string"},
                ],
                "Location": "s3://athena-examples-MyRegion/cloudfront/plaintext",
                "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
                "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                "Compressed": False,
                "NumberOfBuckets": -1,
                "SerdeInfo": {
                    "SerializationLibrary": "org.apache.hadoop.hive.serde2.RegexSerDe",
                    "Parameters": {
                        "input.regex": "^(?!#)([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s ([^ ] )\\s [^(] [(]([^;] ).*\\ ([^/] )[/](.*)$",
                        "serialization.format": "1",
                    },
                },
                "BucketColumns": [],
                "SortColumns": [],
                "Parameters": {},
                "SkewedInfo": {
                    "SkewedColumnNames": [],
                    "SkewedColumnValues": [],
                    "SkewedColumnValueLocationMaps": {},
                },
                "StoredAsSubDirectories": False,
            },
            "PartitionKeys": [],
            "TableType": "EXTERNAL_TABLE",
            "Parameters": {"EXTERNAL": "TRUE", "transient_lastDdlTime": "1652441537"},
            "CreatedBy": "arn:aws:iam::118146679784:user/abhishek-pandey",
            "IsRegisteredWithLakeFormation": False,
            "CatalogId": "118146679784",
        },
        {
            "Name": "cloudfront_logs2",
            "DatabaseName": "default",
            "Description": "TEST DESCRIPTION",
            "Owner": "hadoop",
            "CreateTime": datetime.datetime(2022, 5, 13, 18, 32, 24),
            "UpdateTime": datetime.datetime(2022, 6, 29, 15, 52, 21),
            "LastAccessTime": datetime.datetime(1970, 1, 1, 5, 30),
            "Retention": 0,
            "StorageDescriptor": {
                "Columns": [
                    {"Name": "date", "Type": "date", "Comment": "TEST COMMENT 1"},
                    {"Name": "time", "Type": "string"},
                    {"Name": "location", "Type": "string", "Comment": "NEW LOC"},
                    {"Name": "bytes", "Type": "bigint", "Comment": "TEST BYTES"},
                    {"Name": "request_ip", "Type": "string"},
                    {"Name": "method", "Type": "string"},
                    {"Name": "host", "Type": "string"},
                    {"Name": "uri", "Type": "string"},
                    {"Name": "status", "Type": "int"},
                    {"Name": "referrer", "Type": "string"},
                    {"Name": "user_agent", "Type": "string"},
                    {"Name": "query_string", "Type": "string"},
                    {"Name": "cookie", "Type": "string"},
                    {"Name": "result_type", "Type": "string"},
                    {"Name": "request_id", "Type": "string"},
                    {"Name": "host_header", "Type": "string"},
                    {"Name": "request_protocol", "Type": "string"},
                    {"Name": "request_bytes", "Type": "bigint"},
                    {"Name": "time_taken", "Type": "float"},
                    {"Name": "xforwarded_for", "Type": "string"},
                    {"Name": "ssl_protocol", "Type": "string"},
                    {"Name": "ssl_cipher", "Type": "string"},
                    {"Name": "response_result_type", "Type": "string"},
                    {"Name": "http_version", "Type": "string"},
                    {"Name": "fle_status", "Type": "string"},
                    {"Name": "fle_encrypted_fields", "Type": "int"},
                    {"Name": "c_port", "Type": "int"},
                    {"Name": "time_to_first_byte", "Type": "float"},
                    {"Name": "x_edge_detailed_result_type", "Type": "string"},
                    {"Name": "sc_content_type", "Type": "string"},
                    {"Name": "sc_content_len", "Type": "bigint"},
                    {"Name": "sc_range_start", "Type": "bigint"},
                    {"Name": "sc_range_end", "Type": "bigint"},
                ],
                "Location": "s3://athena-postgres/",
                "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
                "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                "Compressed": False,
                "NumberOfBuckets": -1,
                "SerdeInfo": {
                    "SerializationLibrary": "org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe",
                    "Parameters": {"field.delim": "\t", "serialization.format": "\t"},
                },
                "BucketColumns": [],
                "SortColumns": [],
                "Parameters": {},
                "SkewedInfo": {
                    "SkewedColumnNames": [],
                    "SkewedColumnValues": [],
                    "SkewedColumnValueLocationMaps": {},
                },
                "StoredAsSubDirectories": False,
            },
            "PartitionKeys": [],
            "TableType": "EXTERNAL_TABLE",
            "Parameters": {
                "EXTERNAL": "TRUE",
                "skip.header.line.count": "2",
                "transient_lastDdlTime": "1652446944",
            },
            "CreatedBy": "arn:aws:iam::118146679784:user/abhishek-pandey",
            "IsRegisteredWithLakeFormation": False,
            "CatalogId": "118146679784",
        },
        {
            "Name": "map_table",
            "DatabaseName": "default",
            "Owner": "hadoop",
            "CreateTime": datetime.datetime(2022, 5, 27, 14, 13, 20),
            "UpdateTime": datetime.datetime(2022, 5, 27, 14, 13, 20),
            "LastAccessTime": datetime.datetime(1970, 1, 1, 5, 30),
            "Retention": 0,
            "StorageDescriptor": {
                "Columns": [{"Name": "c1", "Type": "map<string,int>"}],
                "Location": "s3://athena-postgres/map-test",
                "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
                "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                "Compressed": False,
                "NumberOfBuckets": -1,
                "SerdeInfo": {
                    "SerializationLibrary": "org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe",
                    "Parameters": {"serialization.format": "1"},
                },
                "BucketColumns": [],
                "SortColumns": [],
                "Parameters": {},
                "SkewedInfo": {
                    "SkewedColumnNames": [],
                    "SkewedColumnValues": [],
                    "SkewedColumnValueLocationMaps": {},
                },
                "StoredAsSubDirectories": False,
            },
            "PartitionKeys": [],
            "TableType": "EXTERNAL_TABLE",
            "Parameters": {"EXTERNAL": "TRUE", "transient_lastDdlTime": "1653641000"},
            "CreatedBy": "arn:aws:iam::118146679784:user/pere-brull",
            "IsRegisteredWithLakeFormation": False,
            "CatalogId": "118146679784",
        },
    ],
    "ResponseMetadata": {
        "RequestId": "c0524fd8-cba1-44c3-915d-fbeccc9b3334",
        "HTTPStatusCode": 200,
        "HTTPHeaders": {
            "date": "Tue, 26 Jul 2022 17:55:29 GMT",
            "content-type": "application/x-amz-json-1.1",
            "content-length": "5247",
            "connection": "keep-alive",
            "x-amzn-requestid": "c0524fd8-cba1-44c3-915d-fbeccc9b3334",
        },
        "RetryAttempts": 0,
    },
}


EXPECTED_DATABASE_NAMES = ["118146679784"]

EXPECTED_DATABASE_SCHEMA_NAMES = [
    "default",
    "mydatabase",
    "testdatalake_db",
    "zipcode-db",
]

EXPECTED_TABLE_NAMES = ["cloudfront_logs", "cloudfront_logs2", "map_table"]

EXPECTED_TABLE_TYPES = [TableType.External, TableType.Iceberg, TableType.View]


class GlueUnitTest(TestCase):
    def __init__(self, methodName: str = ...) -> None:
        super().__init__(methodName)
        self.init_workflow()

    @patch("metadata.ingestion.source.database.glue.test_connection")
    def init_workflow(self, test_connection):
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_glue_config)
        self.glue_source = GlueSource.create(
            mock_glue_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.glue_source.context.__dict__["database_service"] = MOCK_DATABASE_SERVICE
        self.glue_source.context.__dict__["database"] = MOCK_DATABASE
        self.glue_source.context.__dict__["database_schema"] = MOCK_DATABASE_SCHEMA
        self.glue_source._get_glue_database_and_schemas = lambda: [
            MOCK_DATABASE_PAGINATOR
        ]

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(self.glue_source.get_database_names())

    def test_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.glue_source.get_database_schema_names()
        )

    def test_table_names(self):
        self.glue_source._get_glue_tables = lambda: [MOCK_TABLE_PAGINATOR]
        for table_and_table_type in list(self.glue_source.get_tables_name_and_type()):
            table_and_table_type[0]
            assert table_and_table_type[0] in EXPECTED_TABLE_NAMES
            assert table_and_table_type[1] in EXPECTED_TABLE_TYPES
