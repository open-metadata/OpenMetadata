#  Copyright 2021 Schlameel
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
OpenMetadata high-level API Glossary test
"""
import logging
import time
from unittest import TestCase

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str


class OMetaGlossaryTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None
    glossary_entity_id: basic.Uuid = None
    create_glossary: CreateGlossaryRequest = None
    create_glossary_term_1: CreateGlossaryTermRequest = None
    create_glossary_term_2: CreateGlossaryTermRequest = None
    create_glossary_term_3: CreateGlossaryTermRequest = None
    glossary_term_1: GlossaryTerm = None
    glossary_term_2: GlossaryTerm = None
    glossary_term_3: GlossaryTerm = None
    user_1: User = None
    user_2: User = None
    user_3: User = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    @classmethod
    def check_es_index(cls) -> None:
        """
        Wait until the index has been updated with the test user.
        """
        logging.info("Checking ES index status...")
        tries = 0

        res = None
        while not res and tries <= 5:  # Kill in 5 seconds
            res = cls.metadata.es_search_from_fqn(
                entity_type=User,
                fqn_search_string="Levy",
            )
            if not res:
                tries += 1
                time.sleep(1)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.user_1 = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="test.user.1", email="test.user.1@getcollate.io"
            ),
        )

        cls.user_2 = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="test.user.2", email="test.user.2@getcollate.io"
            ),
        )

        cls.user_3 = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="test.user.3", email="test.user.3@getcollate.io"
            ),
        )

        cls.check_es_index()

        cls.create_glossary = CreateGlossaryRequest(
            name="test-glossary",
            displayName="test-glossary",
            description="Description of test glossary",
            owner=EntityReference(
                id=model_str(cls.user_1.id),
                type="user",
            ),
        )

        cls.create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=cls.create_glossary.name,
            name="GT1",
            displayName="Glossary Term 1",
            description="Test glossary term 1",
            owner=EntityReference(
                id=model_str(cls.user_1.id),
                type="user",
            ),
        )

        cls.create_glossary_term_2 = CreateGlossaryTermRequest(
            glossary=cls.create_glossary.name,
            name="GT2",
            displayName="Glossary Term 2",
            description="Test glossary term 2",
            synonyms=["GT2S1", "GT2S2", "GT2S3"],
            owner=EntityReference(
                id=model_str(cls.user_1.id),
                type="user",
            ),
        )

        cls.create_glossary_term_3 = CreateGlossaryTermRequest(
            glossary=cls.create_glossary.name,
            name="GT3",
            displayName="Glossary Term 3",
            description="Test glossary term 3",
            synonyms=["GT3S1", "GT3S2", "GT3S3"],
            owner=EntityReference(
                id=model_str(cls.user_1.id),
                type="user",
            ),
        )

        # Leave some time for indexes to get updated, otherwise this happens too fast
        cls.check_es_index()

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_1.id,
            recursive=True,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_2.id,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_3.id,
            hard_delete=True,
        )

        if cls.glossary_term_3 is not None:
            cls.metadata.delete(
                entity=GlossaryTerm,
                entity_id=cls.glossary_term_3.id,
                hard_delete=True,
            )

        if cls.glossary_term_2 is not None:
            cls.metadata.delete(
                entity=GlossaryTerm,
                entity_id=cls.glossary_term_2.id,
                hard_delete=True,
            )

        if cls.glossary_term_1 is not None:
            cls.metadata.delete(
                entity=GlossaryTerm,
                entity_id=cls.glossary_term_1.id,
                hard_delete=True,
            )

        # glossary: Glossary = cls.metadata.get_by_name(
        #     entity=Glossary,
        #     fqn=model_str(cls.create_glossary.name),
        # )
        if cls.glossary_entity_id is not None:
            cls.metadata.delete(
                entity=Glossary,
                entity_id=cls.glossary_entity_id,
                hard_delete=True,
            )

    def test_create_glossary(self):
        """
        Create a Glossary
        """
        res: Glossary = self.metadata.create_or_update(self.create_glossary)
        self.assertIsNotNone(res)
        self.assertEqual(self.create_glossary.name, res.name)
        if self.glossary_entity_id is None:
            self.glossary_entity_id = res.id

    def test_create_glossary_term(self):
        """
        Test the creation of a glossary term
        """

        if OMetaGlossaryTest.glossary_entity_id is None:
            glossary: Glossary = self.metadata.create_or_update(self.create_glossary)
            OMetaGlossaryTest.glossary_entity_id = glossary.id

        # Create without parent
        res: GlossaryTerm = self.metadata.create_or_update(self.create_glossary_term_1)
        self.assertIsNotNone(res)
        self.assertEqual(self.create_glossary_term_1.name, res.name)
        self.assertEqual(
            f"{self.create_glossary.name.__root__}.{res.name.__root__}",
            res.fullyQualifiedName.__root__,
        )

        # Create with parent
        if OMetaGlossaryTest.glossary_term_1 is None:
            OMetaGlossaryTest.glossary_term_1 = res
        self.create_glossary_term_2.parent = self.glossary_term_1.fullyQualifiedName
        res = self.metadata.create_or_update(self.create_glossary_term_2)
        self.assertIsNotNone(res)
        self.assertEqual(self.create_glossary_term_2.name, res.name)
        self.assertEqual(model_str(self.create_glossary_term_1.name), res.parent.name)
        if OMetaGlossaryTest.glossary_term_2 is None:
            OMetaGlossaryTest.glossary_term_2 = res

    def test_patch_glossary_term_parent(self):
        """
        Update parent via PATCH
        """
        if OMetaGlossaryTest.glossary_entity_id is None:
            glossary: Glossary = self.metadata.create_or_update(self.create_glossary)
            OMetaGlossaryTest.glossary_entity_id = glossary.id
        if self.glossary_term_1 is None:
            OMetaGlossaryTest.glossary_term_1 = self.metadata.create_or_update(
                self.create_glossary_term_1
            )
        if self.glossary_term_2 is None:
            self.create_glossary_term_2.parent = self.glossary_term_1.fullyQualifiedName
            OMetaGlossaryTest.glossary_term_2 = self.metadata.create_or_update(
                self.create_glossary_term_2
            )
        if self.glossary_term_3 is None:
            OMetaGlossaryTest.glossary_term_3 = self.metadata.create_or_update(
                self.create_glossary_term_3
            )

        # Add parent
        res: GlossaryTerm = self.metadata.patch_glossary_term_parent(
            entity_id=self.glossary_term_3.id,
            parent_fqn=self.glossary_term_2.fullyQualifiedName,
        )
        self.assertIsNotNone(res)
        self.assertEqual(self.glossary_term_2.id, res.parent.id)

        # Move parent
        res: GlossaryTerm = self.metadata.patch_glossary_term_parent(
            entity_id=self.glossary_term_3.id,
            parent_fqn=self.glossary_term_1.fullyQualifiedName,
        )
        self.assertIsNotNone(res)
        self.assertEqual(self.glossary_term_1.id, res.parent.id)

        # Delete parent
        res = self.metadata.patch_glossary_term_parent(
            entity_id=self.glossary_term_3.id
        )
        self.assertIsNotNone(res)
        self.assertIsNone(res.parent)

    def test_patch_glossary_term_related_terms(self):
        """
        Update related terms via PATCH
        """
        if OMetaGlossaryTest.glossary_entity_id is None:
            glossary: Glossary = self.metadata.create_or_update(self.create_glossary)
            OMetaGlossaryTest.glossary_entity_id = glossary.id
        if self.glossary_term_1 is None:
            OMetaGlossaryTest.glossary_term_1 = self.metadata.create_or_update(
                self.create_glossary_term_1
            )
        if self.glossary_term_2 is None:
            OMetaGlossaryTest.glossary_term_2 = self.metadata.create_or_update(
                self.create_glossary_term_2
            )
        elif self.glossary_term_2.parent is not None:
            self.metadata.patch_glossary_term_parent(entity_id=self.glossary_term_2.id)
        if self.glossary_term_3 is None:
            OMetaGlossaryTest.glossary_term_3 = self.metadata.create_or_update(
                self.create_glossary_term_3
            )
        elif self.glossary_term_3.parent is not None:
            self.metadata.patch_glossary_term_parent(entity_id=self.glossary_term_3.id)

        # Add related term
        res: GlossaryTerm = self.metadata.patch_glossary_term_related_terms(
            entity_id=self.glossary_term_1.id,
            related_term_id=self.glossary_term_2.id,
        )
        self.assertIsNotNone(res)
        self.assertEqual(1, len(res.relatedTerms.__root__))
        self.assertEqual(self.glossary_term_2.id, res.relatedTerms.__root__[0].id)

    def test_patch_reviewer(self):
        """
        Update reviewers via PATCH
        """
        if OMetaGlossaryTest.glossary_entity_id is None:
            glossary: Glossary = self.metadata.create_or_update(self.create_glossary)
            OMetaGlossaryTest.glossary_entity_id = glossary.id
        if self.glossary_term_1 is None:
            OMetaGlossaryTest.glossary_term_1 = self.metadata.create_or_update(
                self.create_glossary_term_1
            )

        # Add Glossary Reviewer
        res_glossary: Glossary = self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
            reviewer_id=self.user_1.id,
        )
        self.assertIsNotNone(res_glossary)
        self.assertEqual(1, len(res_glossary.reviewers))
        self.assertEqual(self.user_1.id, res_glossary.reviewers[0].id)

        # Remove only Glossary reviewer
        res_glossary = self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
        )
        self.assertIsNotNone(res_glossary)
        self.assertEqual(0, len(res_glossary.reviewers))

        # Try to remove a Glossary reviewer from empty list - fails
        res_glossary = self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
        )
        self.assertIsNone(res_glossary)

        self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
            reviewer_id=self.user_1.id,
        )
        self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
            reviewer_id=self.user_2.id,
        )
        self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
            reviewer_id=self.user_3.id,
        )

        # Remove Glossary reviewer when there are many
        res_glossary = self.metadata.patch_reviewers(
            entity=Glossary,
            entity_id=self.glossary_entity_id,
        )
        self.assertIsNotNone(res_glossary)
        self.assertEqual(2, len(res_glossary.reviewers))
        self.assertEqual(self.user_2.id, res_glossary.reviewers[1].id)

        # Add GlossaryTerm Reviewer
        res_glossary_term: GlossaryTerm = self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
            reviewer_id=self.user_1.id,
        )
        self.assertIsNotNone(res_glossary_term)
        self.assertEqual(1, len(res_glossary_term.reviewers.__root__))
        self.assertEqual(self.user_1.id, res_glossary_term.reviewers.__root__[0].id)

        # Remove only GlossaryTerm reviewer
        res_glossary_term = self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNotNone(res_glossary_term)
        self.assertEqual(0, len(res_glossary_term.reviewers.__root__))

        # Try to remove a GlossaryTerm reviewer from empty list - fails
        res_glossary_term = self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNone(res_glossary_term)

        self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
            reviewer_id=self.user_1.id,
        )
        self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
            reviewer_id=self.user_2.id,
        )
        self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
            reviewer_id=self.user_3.id,
        )

        # Remove GlossaryTerm reviewer when there are many
        res_glossary_term = self.metadata.patch_reviewers(
            entity=GlossaryTerm,
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNotNone(res_glossary_term)
        self.assertEqual(2, len(res_glossary_term.reviewers.__root__))
        self.assertEqual(self.user_2.id, res_glossary_term.reviewers.__root__[1].id)

    def test_patch_glossary_term_synonyms(self):
        """
        Update synonyms via PATCH
        """
        if OMetaGlossaryTest.glossary_entity_id is None:
            glossary: Glossary = self.metadata.create_or_update(self.create_glossary)
            OMetaGlossaryTest.glossary_entity_id = glossary.id
        if self.glossary_term_1 is None:
            OMetaGlossaryTest.glossary_term_1 = self.metadata.create_or_update(
                self.create_glossary_term_1
            )

        # Add GlossaryTerm synonym
        res: GlossaryTerm = self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
            synonym="GT1S1",
        )
        self.assertIsNotNone(res)
        self.assertEqual(1, len(res.synonyms))
        self.assertEqual("GT1S1", model_str(res.synonyms[0]))

        # Remove GlossaryTerm synonym
        res = self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNotNone(res)
        self.assertEqual(0, len(res.synonyms))

        # Remove GlossaryTerm synonym when empty - fails
        res = self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNone(res)

        # Remove GlossaryTerm synonym when there are many
        self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
            synonym="GT1S1",
        )
        self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
            synonym="GT1S2",
        )
        self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
            synonym="GT1S3",
        )
        res = self.metadata.patch_glossary_term_synonyms(
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNotNone(res)
        self.assertEqual(2, len(res.synonyms))
        self.assertEqual("GT1S2", model_str(res.synonyms[1]))

    def test_patch_glossary_term_references(self):
        """
        Update GlossaryTerm references via PATCH
        """

        if OMetaGlossaryTest.glossary_entity_id is None:
            glossary: Glossary = self.metadata.create_or_update(self.create_glossary)
            OMetaGlossaryTest.glossary_entity_id = glossary.id
        if self.glossary_term_1 is None:
            OMetaGlossaryTest.glossary_term_1 = self.metadata.create_or_update(
                self.create_glossary_term_1
            )

        # Add reference
        res: GlossaryTerm = self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
            reference_name="GT1S1",
            reference_endpoint="https://www.getcollate.io",
        )
        self.assertIsNotNone(res)
        self.assertEqual(1, len(res.references))
        self.assertEqual("GT1S1", res.references[0].name)

        # Remove reference
        res = self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNotNone(res)
        self.assertEqual(0, len(res.references))

        # Remove reference when list is empty - fails
        res = self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNone(res)

        # Remove reference when there are many
        self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
            reference_name="GT1S1",
            reference_endpoint="https://www.getcollate.io",
        )
        self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
            reference_name="GT1S2",
            reference_endpoint="https://open-metadata.org/",
        )
        self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
            reference_name="GT1S3",
            reference_endpoint="https://github.com/open-metadata/OpenMetadata",
        )

        res = self.metadata.patch_glossary_term_references(
            entity_id=self.glossary_term_1.id,
        )
        self.assertIsNotNone(res)
        self.assertEqual(2, len(res.references))
        self.assertEqual("GT1S2", res.references[1].name)
