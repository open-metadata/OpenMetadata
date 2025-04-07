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
Check context operations
"""
from unittest import TestCase

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import NodeStage, TopologyContext
from metadata.ingestion.source.database.database_service import DatabaseServiceTopology

TABLE_STAGE = NodeStage(
    type_=Table,
    context="table",
    processor="yield_table",
    consumer=["database_service", "database", "database_schema"],
    use_cache=True,
)

TAGS_STAGE = NodeStage(
    type_=OMetaTagAndClassification,
    context="tags",
    processor="yield_table_tag_details",
    nullable=True,
    store_all_in_context=True,
)

PROCEDURES_STAGE = NodeStage(
    type_=StoredProcedure,
    context="stored_procedures",
    processor="yield_stored_procedure",
    consumer=["database_service", "database", "database_schema"],
    store_all_in_context=True,
    store_fqn=True,
    use_cache=True,
)


class TopologyContextTest(TestCase):
    """Validate context ops"""

    # Randomly picked up to test
    db_service_topology = DatabaseServiceTopology()

    def test_upsert(self):
        """We can add a new key and update its value"""
        context = TopologyContext.create(self.db_service_topology)

        context.upsert(key="new_key", value="something")
        self.assertEqual(context.new_key, "something")

        context.upsert(key="new_key", value="new")
        self.assertEqual(context.new_key, "new")

    def test_replace(self):
        """We can append results to a new key. If it does not exist, it'll instantiate a list"""
        context = TopologyContext.create(self.db_service_topology)

        context.append(key="new_key", value=1)
        self.assertEqual(context.new_key, [1])

        context.append(key="new_key", value=2)
        self.assertEqual(context.new_key, [1, 2])

    def test_clear(self):
        """We can clan up the context values"""
        context = TopologyContext.create(self.db_service_topology)

        my_stage = NodeStage(
            type_=Table,
            context="new_key",
            processor="random",
        )

        context.append(key="new_key", value=1)
        self.assertEqual(context.new_key, [1])

        context.clear_stage(stage=my_stage)
        self.assertIsNone(context.new_key)

    def test_fqn_from_stage(self):
        """We build the right fqn at each stage"""
        context = TopologyContext.create(self.db_service_topology)

        context.upsert(key="database_service", value="service")
        context.upsert(key="database", value="database")
        context.upsert(key="database_schema", value="schema")

        table_fqn = context.fqn_from_stage(stage=TABLE_STAGE, entity_name="table")
        self.assertEqual(table_fqn, "service.database.schema.table")

    def test_update_context_value(self):
        """We can update values directly"""
        context = TopologyContext.create(self.db_service_topology)

        classification_and_tag = OMetaTagAndClassification(
            fqn=None,
            classification_request=CreateClassificationRequest(
                name=EntityName("my_classification"),
                description=Markdown("something"),
            ),
            tag_request=CreateTagRequest(
                name=EntityName("my_tag"),
                description=Markdown("something"),
            ),
        )

        context.update_context_value(stage=TAGS_STAGE, value=classification_and_tag)

        self.assertEqual(context.tags, [classification_and_tag])

    def test_update_context_name(self):
        """Check context updates for EntityName and FQN"""
        context = TopologyContext.create(self.db_service_topology)

        context.update_context_name(
            stage=TABLE_STAGE,
            right=CreateTableRequest(
                name=EntityName("table"),
                databaseSchema=FullyQualifiedEntityName("schema"),
                columns=[Column(name=ColumnName("id"), dataType=DataType.BIGINT)],
            ),
        )

        self.assertEqual(context.table, "table")

        context.upsert(key="database_service", value="service")
        context.upsert(key="database", value="database")
        context.upsert(key="database_schema", value="schema")
        context.update_context_name(
            stage=PROCEDURES_STAGE,
            right=CreateStoredProcedureRequest(
                name=EntityName("stored_proc"),
                databaseSchema=FullyQualifiedEntityName("schema"),
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code="SELECT * FROM AWESOME",
                ),
            ),
        )

        self.assertEqual(
            context.stored_procedures, ["service.database.schema.stored_proc"]
        )
