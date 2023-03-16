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
Test Processor Class
"""

import datetime
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
    TableData,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
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
from metadata.generated.schema.type.basic import AnyUrl, Href
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.processor.pii import NERScanner

MOCK_TABLE: CreateTableRequest = CreateTableRequest(
    name="DataSet Input",
    displayName="DataSet Input",
    description="this is a description for dataset input",
    tableType=TableType.Regular.value,
    columns=[
        Column(
            name="amount",
            displayName=None,
            dataType=DataType.DOUBLE.value,
            arrayDataType=None,
            dataLength=None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description="This is description for amount",
            fullyQualifiedName=None,
            tags=None,
            constraint=None,
            ordinalPosition=1,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="bank_transfer_amount",
            displayName=None,
            dataType=DataType.DOUBLE.value,
            arrayDataType=None,
            dataLength=None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description="",
            fullyQualifiedName=None,
            tags=None,
            constraint=None,
            ordinalPosition=2,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="coupon_amount",
            displayName=None,
            dataType=DataType.DOUBLE.value,
            arrayDataType=None,
            dataLength=None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description="",
            fullyQualifiedName=None,
            tags=None,
            constraint=None,
            ordinalPosition=3,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="credit_card_amount",
            displayName=None,
            dataType=DataType.DOUBLE.value,
            arrayDataType=None,
            dataLength=None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description="",
            fullyQualifiedName=None,
            tags=[
                TagLabel(
                    tagFQN="PersonalData.Personal",
                    description=None,
                    source="Classification",
                    labelType="Automated",
                    state="Suggested",
                    href=None,
                )
            ],
            constraint=None,
            ordinalPosition=4,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="FirstName",
            displayName=None,
            dataType=DataType.STRING.value,
            arrayDataType=None,
            dataLength=None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description="",
            fullyQualifiedName=None,
            tags=None,
            constraint=None,
            ordinalPosition=4,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name="is_customer",
            displayName=None,
            dataType=DataType.BOOLEAN.value,
            arrayDataType=None,
            dataLength=None,
            precision=None,
            scale=None,
            dataTypeDisplay=None,
            description="",
            fullyQualifiedName=None,
            tags=[
                TagLabel(
                    tagFQN="PersonalData.Personal",
                    description=None,
                    source="Classification",
                    labelType="Automated",
                    state="Suggested",
                    href=None,
                )
            ],
            constraint=None,
            ordinalPosition=4,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
    ],
    tableConstraints=None,
    tablePartition=None,
    tableProfilerConfig=None,
    owner=None,
    databaseSchema="default.default.schema",
    tags=None,
    viewDefinition=None,
    extension=None,
)

EXPECTED_COLUMNS = [
    Column(
        name="amount",
        displayName=None,
        dataType="DOUBLE",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay=None,
        description="This is description for amount",
        fullyQualifiedName=None,
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=1,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="bank_transfer_amount",
        displayName=None,
        dataType="DOUBLE",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay=None,
        description="",
        fullyQualifiedName=None,
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=2,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="coupon_amount",
        displayName=None,
        dataType="DOUBLE",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay=None,
        description="",
        fullyQualifiedName=None,
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=3,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="credit_card_amount",
        displayName=None,
        dataType="DOUBLE",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay=None,
        description="",
        fullyQualifiedName=None,
        tags=[
            TagLabel(
                tagFQN="PersonalData.Personal",
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            ),
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            ),
        ],
        constraint=None,
        ordinalPosition=4,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="FirstName",
        displayName=None,
        dataType="STRING",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay=None,
        description="",
        fullyQualifiedName=None,
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.NonSensitive"),
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=4,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="is_customer",
        displayName=None,
        dataType="BOOLEAN",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay=None,
        description="",
        fullyQualifiedName=None,
        tags=[
            TagLabel(
                tagFQN="PersonalData.Personal",
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=4,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]

table_data = TableData(
    columns=[
        ColumnName(__root__="customer_id"),
        ColumnName(__root__="first_name"),
        ColumnName(__root__="last_name"),
        ColumnName(__root__="first_order"),
        ColumnName(__root__="customer_email"),
        ColumnName(__root__="number_of_orders"),
    ],
    rows=[
        [
            30,
            "Christina",
            "W.",
            datetime.date(2018, 3, 2),
            "christina@hotmail.com",
            2,
        ],
        [73, "Alan", "B.", None, "joshua.alan@yahoo.com", None],
        [71, "Gerald", "C.", datetime.date(2018, 1, 18), "geraldc@gmail.com", 3],
        [35, "Sara", "T.", datetime.date(2018, 2, 21), "saratimithi@godesign.com", 2],
        [22, "Sean", "H.", datetime.date(2018, 1, 26), "heroldsean@google.com", 3],
        [50, "Billy", "L.", datetime.date(2018, 1, 5), "bliam@random.com", 2],
        [
            76,
            "Barbara",
            "W.",
            datetime.date(2018, 3, 23),
            "bmwastin@gmail.co.in",
            1,
        ],
        [5, "Katherine", "R.", None, None, None],
        [31, "Jane", "G.", datetime.date(2018, 2, 17), "gg34jane@hammer.com", 1],
        [45, "Scott", "B.", None, None, None],
        [21, "Willie", "H.", datetime.date(2018, 3, 28), "12hwilliejose@gmail.com", 1],
        [18, "Johnny", "K.", datetime.date(2018, 2, 27), "johnnykk@dexter.com", 1],
        [6, "Sarah", "R.", datetime.date(2018, 2, 19), "rrsarah@britinia.com", 1],
        [56, "Joshua", "K.", None, None, None],
        [79, "Jack", "R.", datetime.date(2018, 2, 28), "jack.mm@people.co.in", 2],
        [94, "Gregory", "H.", datetime.date(2018, 1, 4), "peter.gregory@japer.com", 2],
        [83, "Virginia", "R.", None, None, None],
        [17, "Kimberly", "R.", None, None, None],
        [2, "Shawn", "M.", datetime.date(2018, 1, 11), "shawn344@gmail.com", 1],
        [60, "Norma", "W.", None, None, None],
        [87, "Phillip", "B.", None, None, None],
    ],
)

TABLE_ENTITY = Table(
    id="c6e75645-62e3-4110-8040-faa0e1ae3289",
    name="customers",
    displayName=None,
    fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers",
    description=None,
    version=0.7,
    updatedAt=1676984225597,
    updatedBy="admin",
    href=Href(
        __root__=AnyUrl(
            "http://localhost:8585/api/v1/tables/c6e75645-62e3-4110-8040-faa0e1ae3289",
            scheme="http",
            host="localhost",
            host_type="int_domain",
            port="8585",
            path="/api/v1/tables/c6e75645-62e3-4110-8040-faa0e1ae3289",
        )
    ),
    tableType="Local",
    columns=[
        Column(
            name=ColumnName(__root__="customer_id"),
            displayName=None,
            dataType="INT",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="int",
            description="This is an ID identifing a unique customer",
            fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers.customer_id",
            tags=[
                TagLabel(
                    tagFQN="PII.Sensitive",
                    source=TagSource.Classification.value,
                    labelType=LabelType.Automated.value,
                    state=State.Suggested.value,
                )
            ],
            constraint="NULL",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name=ColumnName(__root__="first_name"),
            displayName=None,
            dataType="VARCHAR",
            arrayDataType=None,
            dataLength=10,
            precision=None,
            scale=None,
            dataTypeDisplay="varchar(10)",
            description=None,
            fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers.first_name",
            tags=None,
            constraint="NULL",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name=ColumnName(__root__="last_name"),
            displayName=None,
            dataType="VARCHAR",
            arrayDataType=None,
            dataLength=2,
            precision=None,
            scale=None,
            dataTypeDisplay="varchar(2)",
            description=None,
            fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers.last_name",
            tags=None,
            constraint="NULL",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name=ColumnName(__root__="first_order"),
            displayName=None,
            dataType="DATE",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="date",
            description=None,
            fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers.first_order",
            tags=None,
            constraint="NULL",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name=ColumnName(__root__="customer_email"),
            displayName=None,
            dataType="DATE",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="date",
            description=None,
            fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers.customer_email",
            tags=None,
            constraint="NULL",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
        Column(
            name=ColumnName(__root__="number_of_orders"),
            displayName=None,
            dataType="BIGINT",
            arrayDataType=None,
            dataLength=1,
            precision=None,
            scale=None,
            dataTypeDisplay="bigint",
            description=None,
            fullyQualifiedName="aws_redshift1.dev.dbt_jaffle.customers.number_of_orders",
            tags=None,
            constraint="NULL",
            ordinalPosition=None,
            jsonSchema=None,
            children=None,
            customMetrics=None,
            profile=None,
        ),
    ],
    tableConstraints=None,
    tablePartition=None,
    owner=None,
    databaseSchema=EntityReference(
        id="9db326f8-c23c-49c5-bc75-865cb8e87981",
        type="databaseSchema",
        name="dbt_jaffle",
        fullyQualifiedName="aws_redshift1.dev.dbt_jaffle",
        description=None,
        displayName=None,
        deleted=False,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/databaseSchemas/9db326f8-c23c-49c5-bc75-865cb8e87981",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/databaseSchemas/9db326f8-c23c-49c5-bc75-865cb8e87981",
            )
        ),
    ),
    database=EntityReference(
        id="f74772d0-2827-442a-8aa4-3dfd136f0c53",
        type="database",
        name="dev",
        fullyQualifiedName="aws_redshift1.dev",
        description=None,
        displayName=None,
        deleted=False,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/databases/f74772d0-2827-442a-8aa4-3dfd136f0c53",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/databases/f74772d0-2827-442a-8aa4-3dfd136f0c53",
            )
        ),
    ),
    service=EntityReference(
        id="31964ed7-8b76-468f-8f1d-d3839792a3b0",
        type="databaseService",
        name="aws_redshift1",
        fullyQualifiedName="aws_redshift1",
        description=None,
        displayName=None,
        deleted=False,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/services/databaseServices/31964ed7-8b76-468f-8f1d-d3839792a3b0",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/31964ed7-8b76-468f-8f1d-d3839792a3b0",
            )
        ),
    ),
    serviceType="Redshift",
    location=None,
    viewDefinition=None,
    tags=None,
    usageSummary=None,
    followers=None,
    joins=None,
    sampleData=None,
    tableProfilerConfig=None,
    profile=None,
    dataModel=None,
    changeDescription=None,
    deleted=False,
    extension=None,
)

UPDATED_TABLE_ENTITY = [
    Column(
        name=ColumnName(__root__="customer_id"),
        displayName=None,
        dataType="INT",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay="int",
        description=None,
        fullyQualifiedName="test-service-table-patch.test-db.test-schema.customers.customer_id",
        tags=[],
        constraint=None,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName(__root__="first_name"),
        displayName=None,
        dataType="VARCHAR",
        arrayDataType=None,
        dataLength=20,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar",
        description=None,
        fullyQualifiedName="test-service-table-patch.test-db.test-schema.customers.first_name",
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=(
                    (
                        "PII which if lost, compromised, or disclosed without authorization, could result in "
                        "substantial harm, embarrassment, inconvenience, or unfairness to an individual."
                    )
                ),
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName(__root__="last_name"),
        displayName=None,
        dataType="VARCHAR",
        arrayDataType=None,
        dataLength=20,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar",
        description=None,
        fullyQualifiedName="test-service-table-patch.test-db.test-schema.customers.last_name",
        tags=[],
        constraint=None,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName(__root__="first_order"),
        displayName=None,
        dataType="DATE",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay="date",
        description=None,
        fullyQualifiedName="test-service-table-patch.test-db.test-schema.customers.first_order",
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.NonSensitive"),
                description=(
                    "PII which is easily accessible from public sources and can include zip code, "
                    "race, gender, and date of birth."
                ),
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName(__root__="customer_email"),
        displayName=None,
        dataType="VARCHAR",
        arrayDataType=None,
        dataLength=20,
        precision=None,
        scale=None,
        dataTypeDisplay="date",
        description=None,
        fullyQualifiedName="test-service-table-patch.test-db.test-schema.customers.customer_email",
        tags=[
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=(
                    (
                        "PII which if lost, compromised, or disclosed without authorization, could result in"
                        " substantial harm, embarrassment, inconvenience, or unfairness to an individual."
                    )
                ),
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        constraint=None,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName(__root__="number_of_orders"),
        displayName=None,
        dataType="BIGINT",
        arrayDataType=None,
        dataLength=None,
        precision=None,
        scale=None,
        dataTypeDisplay="bigint",
        description=None,
        fullyQualifiedName="test-service-table-patch.test-db.test-schema.customers.number_of_orders",
        tags=[],
        constraint=None,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]


class PiiProcessorTest(TestCase):
    """
    Run this integration test with different type of column name
    to attach PII Tags
    """

    def __init__(
        self,
        methodName,
    ) -> None:
        super().__init__(methodName)
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJh"
                "bGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vc"
                "mciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7Hgz"
                "GBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUx"
                "huv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakL"
                "Lzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM"
                "5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            ),
        )
        self.metadata = OpenMetadata(server_config)
        self.nerscanner_processor = NERScanner(self.metadata)

    def test_nerscanner_process(self):
        """
        test function for ner Scanner
        """
        service = CreateDatabaseServiceRequest(
            name="test-service-table-patch",
            serviceType=DatabaseServiceType.Mysql,
            connection=DatabaseConnection(
                config=MysqlConnection(
                    username="username",
                    password="password",
                    hostPort="http://localhost:1234",
                )
            ),
        )
        service_entity = self.metadata.create_or_update(data=service)

        create_db = CreateDatabaseRequest(
            name="test-db",
            service=service_entity.fullyQualifiedName,
        )

        create_db_entity = self.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        create_schema_entity = self.metadata.create_or_update(data=create_schema)

        created_table = CreateTableRequest(
            name="customers",
            columns=[
                Column(name="customer_id", dataType=DataType.INT),
                Column(name="first_name", dataType=DataType.VARCHAR, dataLength=20),
                Column(name="last_name", dataType=DataType.VARCHAR, dataLength=20),
                Column(name="first_order", dataType=DataType.DATE),
                Column(name="customer_email", dataType=DataType.VARCHAR, dataLength=20),
                Column(name="number_of_orders", dataType=DataType.BIGINT),
            ],
            databaseSchema=create_schema_entity.fullyQualifiedName,
        )
        table_entity = self.metadata.create_or_update(data=created_table)
        TABLE_ENTITY.id = table_entity.id

        self.nerscanner_processor.process(
            table_data=table_data, table_entity=TABLE_ENTITY, client=self.metadata
        )
        updated_table_entity = self.metadata.get_by_id(
            entity=Table, entity_id=table_entity.id, fields=["tags"]
        )
        for _, (expected, original) in enumerate(
            zip(UPDATED_TABLE_ENTITY, updated_table_entity.columns)
        ):
            self.assertEqual(expected.tags, original.tags)

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service_entity.id,
            recursive=True,
            hard_delete=True,
        )
