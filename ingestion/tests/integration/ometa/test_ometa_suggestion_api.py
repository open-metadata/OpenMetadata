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
OpenMetadata high-level API Suggestion test
"""
from unittest import TestCase

from metadata.generated.schema.api.feed.createSuggestion import CreateSuggestionRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.feed.suggestion import Suggestion, SuggestionType
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import EntityLink
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.utils.entity_link import get_entity_link

from ..integration_base import (
    generate_name,
    get_create_entity,
    get_create_service,
    int_admin_ometa,
)


class OMetaSuggestionTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    metadata = int_admin_ometa()

    service_name = generate_name()
    db_name = generate_name()
    schema_name = generate_name()
    table_name = generate_name()

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients: Pipeline Entity
        """
        create_service = get_create_service(
            entity=DatabaseService, name=cls.service_name
        )
        cls.metadata.create_or_update(create_service)

        create_database = get_create_entity(
            entity=Database, name=cls.schema_name, reference=cls.service_name.__root__
        )
        cls.database: Database = cls.metadata.create_or_update(create_database)

        create_schema = get_create_entity(
            entity=DatabaseSchema,
            name=cls.schema_name,
            reference=cls.database.fullyQualifiedName.__root__,
        )
        cls.schema: DatabaseSchema = cls.metadata.create_or_update(create_schema)

        create_table = get_create_entity(
            entity=Table,
            name=cls.table_name,
            reference=cls.schema.fullyQualifiedName.__root__,
        )
        cls.table: Table = cls.metadata.create_or_update(create_table)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.service_name.__root__
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create_description_suggestion(self):
        """We can create a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                __root__=get_entity_link(
                    Table, fqn=self.table.fullyQualifiedName.__root__
                )
            ),
        )

        # Suggestions only support POST (not PUT)
        self.metadata.create(suggestion_request)

    def test_create_tag_suggestion(self):
        """We can create a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            tagLabels=[
                TagLabel(
                    tagFQN="PII.Sensitive",
                    labelType=LabelType.Automated,
                    state=State.Suggested.value,
                    source=TagSource.Classification,
                )
            ],
            type=SuggestionType.SuggestTagLabel,
            entityLink=EntityLink(
                __root__=get_entity_link(
                    Table, fqn=self.table.fullyQualifiedName.__root__
                )
            ),
        )

        # Suggestions only support POST (not PUT)
        self.metadata.create(suggestion_request)

    def test_list(self):
        """List filtering by creator"""

        admin_user: User = self.metadata.get_by_name(
            entity=User, fqn="admin", nullable=False
        )

        create_table = get_create_entity(
            entity=Table,
            reference=self.schema.fullyQualifiedName.__root__,
        )
        table: Table = self.metadata.create_or_update(create_table)

        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                __root__=get_entity_link(Table, fqn=table.fullyQualifiedName.__root__)
            ),
        )

        # Suggestions only support POST (not PUT)
        self.metadata.create(suggestion_request)

        suggestions = self.metadata.list_all_entities(
            entity=Suggestion,
            params={
                "entityFQN": table.fullyQualifiedName.__root__,
                "userId": str(admin_user.id.__root__),
            },
        )

        self.assertEqual(len(list(suggestions)), 1)

    def test_update_suggestion(self):
        """Update an existing suggestion"""

        create_table = get_create_entity(
            entity=Table,
            name=self.schema_name,
            reference=self.schema.fullyQualifiedName.__root__,
        )
        table: Table = self.metadata.create_or_update(create_table)

        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                __root__=get_entity_link(Table, fqn=table.fullyQualifiedName.__root__)
            ),
        )

        # Suggestions only support POST (not PUT)
        res: Suggestion = self.metadata.create(suggestion_request)
        self.assertEqual(res.description, "something")

        res.description = "new"
        new = self.metadata.update_suggestion(res)
        self.assertEqual(new.description, "new")
