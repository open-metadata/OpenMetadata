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

from unittest import TestCase

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType, TableType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagFQN, TagLabel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.processor import PiiProcessor

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
                    source="Tag",
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
                    source="Tag",
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
    databaseSchema=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
        type="databaseSchema",
        name=None,
        fullyQualifiedName=None,
        description=None,
        displayName=None,
        deleted=None,
        href=None,
    ),
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
                source="Tag",
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
                source="Tag",
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
                source="Tag",
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
                source="Tag",
                labelType="Automated",
                state="Suggested",
                href=None,
            ),
            TagLabel(
                tagFQN=TagFQN(__root__="PII.Sensitive"),
                description=None,
                source="Tag",
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
                source="Tag",
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
                source="Tag",
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
        metadata = OpenMetadata(server_config)
        self.processor = PiiProcessor(metadata_config=metadata)

    def test_process(self):
        self.processor.process(MOCK_TABLE)
        assert MOCK_TABLE.columns == EXPECTED_COLUMNS
