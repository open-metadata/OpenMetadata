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
Validate conversion between OpenMetadata and SQLAlchemy ORM
"""
from unittest import TestCase

import sqlalchemy

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.orm.converter import ometa_to_sqa_orm


class ProfilerWorkflowTest(TestCase):
    """
    Run the end to end workflow and validate
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    def test_no_db_conversion(self):
        """
        Check that we can convert simple tables
        """

        connection = DatabaseConnection(
            config=MysqlConnection(
                username="username",
                password="password",
                hostPort="http://localhost:1234",
            )
        )

        service = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name="test-orm-service",
                serviceType=DatabaseServiceType.Mysql,
                connection=connection,
            )
        )

        database = self.metadata.create_or_update(
            CreateDatabaseRequest(
                name="one-db",
                service=service.fullyQualifiedName,
            )
        )

        schema = self.metadata.create_or_update(
            CreateDatabaseSchemaRequest(
                name="one-schema",
                database=database.fullyQualifiedName,
            )
        )

        table = self.metadata.create_or_update(
            CreateTableRequest(
                name="table1",
                databaseSchema=schema.fullyQualifiedName,
                columns=[
                    Column(name="id", dataType=DataType.BIGINT),
                    Column(name="name", dataType=DataType.STRING),
                    Column(name="age", dataType=DataType.INT),
                    Column(name="last_updated", dataType=DataType.TIMESTAMP),
                    Column(name="created_date", dataType=DataType.DATE),
                    Column(name="group", dataType=DataType.CHAR, dataLength=10),
                    Column(name="savings", dataType=DataType.DECIMAL),
                ],
            )
        )

        orm_table = ometa_to_sqa_orm(table=table, metadata=self.metadata)

        assert orm_table.__tablename__ == "table1"
        assert orm_table.__table_args__.get("schema") == "one-schema"

        assert isinstance(orm_table.id.type, sqlalchemy.BIGINT)
        assert isinstance(orm_table.name.type, sqlalchemy.String)
        assert isinstance(orm_table.age.type, sqlalchemy.INTEGER)
        assert isinstance(orm_table.last_updated.type, sqlalchemy.TIMESTAMP)
        assert isinstance(orm_table.created_date.type, sqlalchemy.DATE)
        assert isinstance(orm_table.group.type, sqlalchemy.CHAR)
        assert isinstance(orm_table.savings.type, sqlalchemy.DECIMAL)
        assert isinstance(orm_table.savings.type, sqlalchemy.DECIMAL)
        assert orm_table.id.compile().string == '"one-schema".table1.id'

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service.id,
            recursive=True,
            hard_delete=True,
        )

    def test_db_conversion(self):
        """
        Check that we can convert simple tables
        """

        connection = DatabaseConnection(
            config=SnowflakeConnection(
                username="username",
                password="password",
                account="account",
                warehouse="warehouse",
            )
        )

        service = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name="test-orm-service",
                serviceType=DatabaseServiceType.Snowflake,
                connection=connection,
            )
        )

        database = self.metadata.create_or_update(
            CreateDatabaseRequest(
                name="one-db",
                service=service.fullyQualifiedName,
            )
        )

        schema = self.metadata.create_or_update(
            CreateDatabaseSchemaRequest(
                name="one-schema",
                database=database.fullyQualifiedName,
            )
        )

        table = self.metadata.create_or_update(
            CreateTableRequest(
                name="table1-snflk",
                databaseSchema=schema.fullyQualifiedName,
                columns=[
                    Column(name="id", dataType=DataType.BIGINT),
                ],
            )
        )

        orm_table = ometa_to_sqa_orm(table=table, metadata=self.metadata)

        assert orm_table.__tablename__ == "table1-snflk"
        assert (
            orm_table.__table_args__.get("schema") == "one-schema"
        )  # Schema gets generated correctly
        assert orm_table.id.compile().string == '"one-schema"."table1-snflk"."id"'

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service.id,
            recursive=True,
            hard_delete=True,
        )
