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

from _openmetadata_testutils.ometa import int_admin_ometa
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
    TableData,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import TagFQN, TagLabel
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.pii.processor import PIIProcessor
from metadata.sampler.models import SampleData, SamplerResponse

table_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="customer_id"),
            ColumnName(root="first_name"),
            ColumnName(root="last_name"),
            ColumnName(root="first_order"),
            # Apply a random name to force the NER scanner execution here
            ColumnName(root="random"),
            ColumnName(root="number_of_orders"),
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
            [
                35,
                "Sara",
                "T.",
                datetime.date(2018, 2, 21),
                "saratimithi@godesign.com",
                2,
            ],
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
            [
                21,
                "Willie",
                "H.",
                datetime.date(2018, 3, 28),
                "12hwilliejose@gmail.com",
                1,
            ],
            [18, "Johnny", "K.", datetime.date(2018, 2, 27), "johnnykk@dexter.com", 1],
            [6, "Sarah", "R.", datetime.date(2018, 2, 19), "rrsarah@britinia.com", 1],
            [56, "Joshua", "K.", None, None, None],
            [79, "Jack", "R.", datetime.date(2018, 2, 28), "jack.mm@people.co.in", 2],
            [
                94,
                "Gregory",
                "H.",
                datetime.date(2018, 1, 4),
                "peter.gregory@japer.com",
                2,
            ],
            [83, "Virginia", "R.", None, None, None],
            [17, "Kimberly", "R.", None, None, None],
            [2, "Shawn", "M.", datetime.date(2018, 1, 11), "shawn344@gmail.com", 1],
            [60, "Norma", "W.", None, None, None],
            [87, "Phillip", "B.", None, None, None],
        ],
    ),
    store=True,
)


EXPECTED_COLUMN_TAGS = [
    ColumnTag(
        column_fqn="test-service-table-patch.test-db.test-schema.customers.first_name",
        tag_label=TagLabel(
            tagFQN=TagFQN("General.Person"),
            source="Classification",
            labelType="Automated",
            state="Suggested",
        ),
    ),
    ColumnTag(
        column_fqn="test-service-table-patch.test-db.test-schema.customers.first_name",
        tag_label=TagLabel(
            tagFQN=TagFQN("PII.Sensitive"),
            source="Classification",
            labelType="Automated",
            state="Suggested",
        ),
    ),
    ColumnTag(
        column_fqn="test-service-table-patch.test-db.test-schema.customers.first_order",
        tag_label=TagLabel(
            tagFQN=TagFQN("General.DateTime"),
            source="Classification",
            labelType="Automated",
            state="Suggested",
        ),
    ),
    ColumnTag(
        column_fqn="test-service-table-patch.test-db.test-schema.customers.first_order",
        tag_label=TagLabel(
            tagFQN=TagFQN("PII.NonSensitive"),
            source="Classification",
            labelType="Automated",
            state="Suggested",
        ),
    ),
    ColumnTag(
        column_fqn="test-service-table-patch.test-db.test-schema.customers.random",
        tag_label=TagLabel(
            tagFQN=TagFQN("General.Email"),
            source="Classification",
            labelType="Automated",
            state="Suggested",
        ),
    ),
    ColumnTag(
        column_fqn="test-service-table-patch.test-db.test-schema.customers.random",
        tag_label=TagLabel(
            tagFQN=TagFQN("PII.Sensitive"),
            source="Classification",
            labelType="Automated",
            state="Suggested",
        ),
    ),
]


class PiiProcessorTest(TestCase):
    """
    Run this integration test with different type of column name
    to attach PII Tags
    """

    metadata = int_admin_ometa()

    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type="mysql",
            serviceName="test",
            sourceConfig=SourceConfig(
                config=DatabaseServiceAutoClassificationPipeline(
                    enableAutoClassification=True,
                )
            ),
        ),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )

    pii_processor = PIIProcessor(config=workflow_config, metadata=metadata)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-table-patch"
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        service = CreateDatabaseServiceRequest(
            name="test-service-table-patch",
            serviceType=DatabaseServiceType.Mysql,
            connection=DatabaseConnection(
                config=MysqlConnection(
                    username="username",
                    authType=BasicAuth(
                        password="password",
                    ),
                    hostPort="http://localhost:1234",
                )
            ),
        )
        service_entity = cls.metadata.create_or_update(data=service)

        create_db = CreateDatabaseRequest(
            name="test-db",
            service=service_entity.fullyQualifiedName,
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        created_table = CreateTableRequest(
            name="customers",
            columns=[
                Column(name="customer_id", dataType=DataType.INT),
                Column(name="first_name", dataType=DataType.VARCHAR, dataLength=20),
                Column(name="last_name", dataType=DataType.VARCHAR, dataLength=20),
                Column(name="first_order", dataType=DataType.DATE),
                Column(name="random", dataType=DataType.VARCHAR, dataLength=20),
                Column(name="number_of_orders", dataType=DataType.BIGINT),
            ],
            databaseSchema=create_schema_entity.fullyQualifiedName,
        )
        cls.table_entity = cls.metadata.create_or_update(data=created_table)

    def test_ner_scanner_process(self):
        """
        test function for ner Scanner
        """

        record = SamplerResponse(
            table=self.table_entity,
            sample_data=table_data,
        )

        updated_record: SamplerResponse = self.pii_processor.run(record)

        updated_tags = updated_record.column_tags
        col_fqns = {col.column_fqn for col in EXPECTED_COLUMN_TAGS}

        for col_fqn in col_fqns:
            with self.subTest(col_fqn=col_fqn):
                expected_tags = [
                    expected.tag_label.tagFQN.root
                    for expected in EXPECTED_COLUMN_TAGS
                    if expected.column_fqn == col_fqn
                ]
                actual_tags = [
                    actual.tag_label.tagFQN.root
                    for actual in updated_tags
                    if actual.column_fqn == col_fqn
                ]
                self.assertTrue(
                    set(expected_tags).issubset(
                        set(actual_tags)
                    )  ## all expected tags are present in actual tags
                )
