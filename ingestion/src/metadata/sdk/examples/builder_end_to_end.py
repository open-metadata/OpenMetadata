"""
Builder-style end-to-end example (Python)

This keeps a builder-only style by wrapping the SDK Create*Request
objects with tiny chainable builders in this example file, while the
SDK performs the actual operations.

Run:
  python -m metadata.sdk.examples.builder_end_to_end
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName
from metadata.generated.schema.entity.data.table import DataType as ColumnDataType
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
    MySQLScheme,
    MySQLType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.sdk import OpenMetadata, OpenMetadataConfig
from metadata.sdk.entities.database_services import DatabaseServices
from metadata.sdk.entities.databases import Databases
from metadata.sdk.entities.databaseschemas import DatabaseSchemas
from metadata.sdk.entities.glossaries import Glossaries
from metadata.sdk.entities.tables import Tables

# ------------------------
# Example-local builders
# ------------------------


@dataclass
class DatabaseServiceBuilderPy:
    name_val: Optional[str] = None
    description_val: Optional[str] = None
    type_val: Optional[DatabaseServiceType] = None
    connection_val: Optional[DatabaseConnection] = None

    def name(self, name: str) -> "DatabaseServiceBuilderPy":
        self.name_val = name
        return self

    def description(self, desc: str) -> "DatabaseServiceBuilderPy":
        self.description_val = desc
        return self

    def service_type(self, st: DatabaseServiceType) -> "DatabaseServiceBuilderPy":
        self.type_val = st
        return self

    def mysql_connection(
        self, host_port: str, username: str, database: Optional[str] = None
    ) -> "DatabaseServiceBuilderPy":
        conn = DatabaseConnection(
            config=MysqlConnection(
                type=MySQLType.Mysql,
                scheme=MySQLScheme.mysql_pymysql,
                username=username,
                authType=None,
                hostPort=host_port,
                databaseName=database,
                databaseSchema=None,
                sslConfig=None,
                connectionOptions=None,
                connectionArguments=None,
                schemaFilterPattern=None,
                tableFilterPattern=None,
                databaseFilterPattern=None,
                supportsMetadataExtraction=None,
                supportsDBTExtraction=None,
                supportsProfiler=None,
                supportsQueryComment=None,
                sampleDataStorageConfig=None,
                supportsDataDiff=None,
                supportsUsageExtraction=None,
                supportsLineageExtraction=None,
                useSlowLogs=False,
            )
        )
        self.connection_val = conn
        self.type_val = DatabaseServiceType.Mysql
        return self

    def build(self) -> CreateDatabaseServiceRequest:
        if not self.name_val:
            raise ValueError("Service name is required")
        if not self.type_val:
            raise ValueError("Service type is required")
        return CreateDatabaseServiceRequest(
            name=EntityName(self.name_val),
            description=Markdown(self.description_val)
            if self.description_val
            else None,
            serviceType=self.type_val,
            connection=self.connection_val,
            displayName=None,
            tags=None,
            owners=None,
            dataProducts=None,
            domains=None,
            ingestionRunner=None,
        )

    def create(self):
        return DatabaseServices.create(self.build())


@dataclass
class DatabaseBuilderPy:
    name_val: Optional[str] = None
    description_val: Optional[str] = None
    service_fqn_val: Optional[str] = None

    def name(self, name: str) -> "DatabaseBuilderPy":
        self.name_val = name
        return self

    def description(self, desc: str) -> "DatabaseBuilderPy":
        self.description_val = desc
        return self

    def in_service(self, service_fqn: str) -> "DatabaseBuilderPy":
        self.service_fqn_val = service_fqn
        return self

    def build(self) -> CreateDatabaseRequest:
        if not self.name_val:
            raise ValueError("Database name is required")
        if not self.service_fqn_val:
            raise ValueError("Database service FQN is required")
        return CreateDatabaseRequest(
            name=EntityName(self.name_val),
            description=Markdown(self.description_val)
            if self.description_val
            else None,
            service=FullyQualifiedEntityName(self.service_fqn_val),
            displayName=None,
            tags=None,
            owners=None,
            dataProducts=None,
            default=False,
            retentionPeriod=None,
            extension=None,
            sourceUrl=None,
            domains=None,
            lifeCycle=None,
            sourceHash=None,
        )

    def create(self):
        return Databases.create(self.build())


@dataclass
class SchemaBuilderPy:
    name_val: Optional[str] = None
    description_val: Optional[str] = None
    database_fqn_val: Optional[str] = None

    def name(self, name: str) -> "SchemaBuilderPy":
        self.name_val = name
        return self

    def description(self, desc: str) -> "SchemaBuilderPy":
        self.description_val = desc
        return self

    def in_database(self, database_fqn: str) -> "SchemaBuilderPy":
        self.database_fqn_val = database_fqn
        return self

    def build(self) -> CreateDatabaseSchemaRequest:
        if not self.name_val:
            raise ValueError("Schema name is required")
        if not self.database_fqn_val:
            raise ValueError("Database FQN is required")
        return CreateDatabaseSchemaRequest(
            name=EntityName(self.name_val),
            description=Markdown(self.description_val)
            if self.description_val
            else None,
            database=FullyQualifiedEntityName(self.database_fqn_val),
            displayName=None,
            owners=None,
            dataProducts=None,
            tags=None,
            retentionPeriod=None,
            extension=None,
            sourceUrl=None,
            domains=None,
            lifeCycle=None,
            sourceHash=None,
        )

    def create(self):
        return DatabaseSchemas.create(self.build())


@dataclass
class TableBuilderPy:
    name_val: Optional[str] = None
    description_val: Optional[str] = None
    schema_fqn_val: Optional[str] = None
    columns_val: List[Column] = field(default_factory=list)

    def name(self, name: str) -> "TableBuilderPy":
        self.name_val = name
        return self

    def description(self, desc: str) -> "TableBuilderPy":
        self.description_val = desc
        return self

    def in_schema(self, schema_fqn: str) -> "TableBuilderPy":
        self.schema_fqn_val = schema_fqn
        return self

    def add_column(
        self, name: str, dtype: ColumnDataType, *, length: Optional[int] = None
    ) -> "TableBuilderPy":
        col = Column(
            name=ColumnName(name),
            displayName=None,
            dataType=dtype,
            arrayDataType=None,
            dataLength=length if (dtype == ColumnDataType.VARCHAR and length) else None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description=None,
            fullyQualifiedName=None,
            tags=None,
            constraint=None,
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            profile=None,
            customMetrics=None,
        )
        self.columns_val.append(col)
        return self

    def build(self) -> CreateTableRequest:
        if not self.name_val:
            raise ValueError("Table name is required")
        if not self.schema_fqn_val:
            raise ValueError("Schema FQN is required")
        if not self.columns_val:
            raise ValueError("At least one column is required")
        return CreateTableRequest(
            name=EntityName(self.name_val),
            description=Markdown(self.description_val)
            if self.description_val
            else None,
            databaseSchema=FullyQualifiedEntityName(self.schema_fqn_val),
            columns=self.columns_val,
            displayName=None,
            tableType=None,
            dataModel=None,
            locationPath=None,
            tableConstraints=None,
            tablePartition=None,
            tableProfilerConfig=None,
            owners=None,
            tags=None,
            schemaDefinition=None,
            retentionPeriod=None,
            extension=None,
            sourceUrl=None,
            domains=None,
            dataProducts=None,
            fileFormat=None,
            lifeCycle=None,
            sourceHash=None,
        )

    def create(self):
        return Tables.create(self.build())


def main() -> None:
    config = OpenMetadataConfig(
        server_url="http://localhost:8585",
        jwt_token="YOUR_JWT_OR_API_KEY",
        verify_ssl=False,
    )
    _ = OpenMetadata.initialize(config)

    # 1) Service (builder)
    service = (
        DatabaseServiceBuilderPy()
        .name("mysql_prod")
        .description("Production MySQL")
        .mysql_connection(
            host_port="localhost:3306", username="om_user", database="prod"
        )
        .create()
    )
    service_fqn = (
        service.fullyQualifiedName.root
        if service.fullyQualifiedName
        else str(service.name.root)
    )

    # 2) Database (builder)
    database = (
        DatabaseBuilderPy()
        .name("sales")
        .description("Sales database")
        .in_service(service_fqn)
        .create()
    )
    database_fqn = (
        database.fullyQualifiedName.root
        if database.fullyQualifiedName
        else str(database.name.root)
    )

    # 3) Schema (builder)
    schema = (
        SchemaBuilderPy()
        .name("public")
        .description("Default schema")
        .in_database(database_fqn)
        .create()
    )
    schema_fqn = (
        schema.fullyQualifiedName.root
        if schema.fullyQualifiedName
        else str(schema.name.root)
    )

    # 4) Table (builder)
    table = (
        TableBuilderPy()
        .name("customers")
        .description("Customer master table")
        .in_schema(schema_fqn)
        .add_column("id", ColumnDataType.BIGINT)
        .add_column("email", ColumnDataType.VARCHAR, length=255)
        .create()
    )
    # 5) Update description (builder-like: reuse entity, call SDK update)
    table.description = Markdown(root="Updated description: includes PII columns")
    table = Tables.update(table)

    # Add tag via helper (still chained by intent)
    table = Tables.add_tag(table.id.root, "PII.Sensitive")

    # 6) Glossary export/import using SDK's CSV operations
    glossary_name = "BusinessGlossary"  # adjust to your glossary
    csv_text = Glossaries.export_csv(glossary_name).execute()
    # dry run
    _ = (
        Glossaries.import_csv(glossary_name)
        .set_dry_run(True)
        .with_data(csv_text)
        .execute()
    )
    # apply
    _ = Glossaries.import_csv(glossary_name).with_data(csv_text).execute()

    print("Completed builder-based example successfully.")


if __name__ == "__main__":
    main()
