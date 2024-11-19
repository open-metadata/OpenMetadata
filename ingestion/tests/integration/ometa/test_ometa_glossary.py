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
from copy import deepcopy

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import (
    GlossaryTerm,
    TermReference,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import (
    Email,
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.utils import fqn


class TestOMetaGlossary:
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    # service_entity_id = None
    # glossary_entity_id: basic.Uuid = None
    # create_glossary: CreateGlossaryRequest = None
    # create_glossary_term_1: CreateGlossaryTermRequest = None
    # create_glossary_term_2: CreateGlossaryTermRequest = None
    # create_glossary_term_3: CreateGlossaryTermRequest = None
    # glossary: Glossary = None
    # glossary_term_1: GlossaryTerm = None
    # glossary_term_2: GlossaryTerm = None
    # glossary_term_3: GlossaryTerm = None
    # user_1: User = None
    # user_2: User = None
    # user_3: User = None
    #
    # server_config = OpenMetadataConnection(
    #     hostPort="http://localhost:8585/api",
    #     authProvider="openmetadata",
    #     securityConfig=OpenMetadataJWTClientConfig(
    #         jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
    #     ),
    # )
    # metadata = OpenMetadata(server_config)

    # assert metadata.health_check()

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

    # @classmethod
    # def setUpClass(cls) -> None:
    #     """
    #     Prepare ingredients
    #     """
    #
    #     cls.user_1 = cls.metadata.create_or_update(
    #         data=CreateUserRequest(
    #             name=EntityName("test.user.1"),
    #             email=Email(root="test.user.1@getcollate.io"),
    #         ),
    #     )
    #
    #     cls.user_2 = cls.metadata.create_or_update(
    #         data=CreateUserRequest(
    #             name=EntityName("test.user.2"),
    #             email=Email(root="test.user.2@getcollate.io"),
    #         ),
    #     )
    #
    #     cls.user_3 = cls.metadata.create_or_update(
    #         data=CreateUserRequest(
    #             name=EntityName("test.user.3"),
    #             email=Email(root="test.user.3@getcollate.io"),
    #         ),
    #     )
    #
    #     cls.check_es_index()
    #
    #     cls.create_glossary = CreateGlossaryRequest(
    #         name=EntityName("test-glossary"),
    #         displayName="test-glossary",
    #         description=Markdown("Description of test glossary"),
    #         owners=EntityReferenceList(
    #             root=[
    #                 EntityReference(
    #                     id=cls.user_1.id,
    #                     type="user",
    #                 )
    #             ],
    #         ),
    #     )
    #
    #     cls.create_glossary_term_1 = CreateGlossaryTermRequest(
    #         glossary=FullyQualifiedEntityName(cls.create_glossary.name.root),
    #         name=EntityName("GT1"),
    #         displayName="Glossary Term 1",
    #         description=Markdown("Test glossary term 1"),
    #         owners=EntityReferenceList(
    #             root=[
    #                 EntityReference(
    #                     id=cls.user_1.id,
    #                     type="user",
    #                 )
    #             ],
    #         ),
    #     )
    #
    # cls.create_glossary_term_2 = CreateGlossaryTermRequest(
    #     glossary=FullyQualifiedEntityName(cls.create_glossary.name.root),
    #     name=EntityName("GT2"),
    #     displayName="Glossary Term 2",
    #     description=Markdown("Test glossary term 2"),
    #     synonyms=[
    #         EntityName("GT2S1"),
    #         EntityName("GT2S2"),
    #         EntityName("GT2S3"),
    #     ],
    #     owners=EntityReferenceList(
    #         root=[
    #             EntityReference(
    #                 id=cls.user_1.id,
    #                 type="user",
    #             )
    #         ],
    #     ),
    # )
    #
    # cls.create_glossary_term_3 = CreateGlossaryTermRequest(
    #     glossary=FullyQualifiedEntityName(cls.create_glossary.name.root),
    #     name=EntityName("GT3"),
    #     displayName="Glossary Term 3",
    #     description=Markdown("Test glossary term 3"),
    #     synonyms=[
    #         EntityName("GT2S1"),
    #         EntityName("GT2S2"),
    #         EntityName("GT2S3"),
    #     ],
    #     owners=EntityReferenceList(
    #         root=[
    #             EntityReference(
    #                 id=cls.user_1.id,
    #                 type="user",
    #             )
    #         ],
    #     ),
    # )
    #
    # Leave some time for indexes to get updated, otherwise this happens too fast
    # cls.check_es_index()

    # @classmethod
    # def tearDownClass(cls) -> None:
    #     """
    #     Clean up
    #     """
    #
    #     cls.metadata.delete(
    #         entity=User,
    #         entity_id=cls.user_1.id,
    #         recursive=True,
    #         hard_delete=True,
    #     )
    #
    #     cls.metadata.delete(
    #         entity=User,
    #         entity_id=cls.user_2.id,
    #         hard_delete=True,
    #     )
    #
    #     cls.metadata.delete(
    #         entity=User,
    #         entity_id=cls.user_3.id,
    #         hard_delete=True,
    #     )
    #
    #     if cls.glossary_term_3 is not None:
    #         cls.metadata.delete(
    #             entity=GlossaryTerm,
    #             entity_id=cls.glossary_term_3.id,
    #             hard_delete=True,
    #         )
    #
    #     if cls.glossary_term_2 is not None:
    #         cls.metadata.delete(
    #             entity=GlossaryTerm,
    #             entity_id=cls.glossary_term_2.id,
    #             hard_delete=True,
    #         )
    #
    #     if cls.glossary_term_1 is not None:
    #         cls.metadata.delete(
    #             entity=GlossaryTerm,
    #             entity_id=cls.glossary_term_1.id,
    #             hard_delete=True,
    #         )
    #
    #     # glossary: Glossary = cls.metadata.get_by_name(
    #     #     entity=Glossary,
    #     #     fqn=model_str(cls.create_glossary.name),
    #     # )
    #     if cls.glossary_entity_id is not None:
    #         cls.metadata.delete(
    #             entity=Glossary,
    #             entity_id=cls.glossary_entity_id,
    #             hard_delete=True,
    #         )
    #

    def test_create_glossary(self, create_glossary, create_user):
        """
        Create a Glossary
        """
        create_user_request = CreateUserRequest(
            name=EntityName("test.user.1"),
            email=Email(root="test.user.1@getcollate.io"),
        )

        user = create_user(create_user_request)

        create_glossary_request = CreateGlossaryRequest(
            name=EntityName("test-glossary"),
            displayName="test-glossary",
            description=Markdown("Description of test glossary"),
            owners=EntityReferenceList(
                root=[
                    EntityReference(
                        id=user.id,
                        type="user",
                    )
                ],
            ),
        )

        glossary = create_glossary(create_glossary_request)

        assert glossary is not None
        assert create_glossary_request.name == glossary.name

    def test_create_glossary_term(self, create_glossary, create_glossary_term):
        """
        Test the creation of a glossary term
        """

        glossary = create_glossary(
            CreateGlossaryRequest(
                name=EntityName("test-glossary"),
                displayName="test-glossary",
                description=Markdown("Description of test glossary"),
            )
        )

        # Create Glossary Term without Parent
        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        assert glossary_term_1 is not None
        assert glossary_term_1.name == create_glossary_term_1.name
        assert (
            glossary_term_1.fullyQualifiedName.root
            == f"{glossary.name.root}.{glossary_term_1.name.root}"
        )

        # Create Glossary Term with Parent
        create_glossary_term_2 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT2"),
            displayName="Glossary Term 2",
            description=Markdown("Test glossary term 2"),
            parent=glossary_term_1.fullyQualifiedName,
        )

        glossary_term_2 = create_glossary_term(create_glossary_term_2)

        assert glossary_term_2 is not None
        assert glossary_term_2.name == create_glossary_term_2.name
        assert glossary_term_2.parent.name == glossary_term_1.name.root

    def test_patch_glossary_term_parent(
        self, metadata, create_glossary, create_glossary_term
    ):
        """
        Update parent via PATCH
        """
        glossary = create_glossary(
            CreateGlossaryRequest(
                name=EntityName("test-glossary"),
                displayName="test-glossary",
                description=Markdown("Description of test glossary"),
            )
        )

        # Create Glossary Term without Parent
        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        # Create Glossary Term with Parent
        create_glossary_term_2 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT2"),
            displayName="Glossary Term 2",
            description=Markdown("Test glossary term 2"),
            parent=glossary_term_1.fullyQualifiedName,
        )
        glossary_term_2 = create_glossary_term(create_glossary_term_2)

        create_glossary_term_3 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT3"),
            displayName="Glossary Term 3",
            description=Markdown("Test glossary term 3"),
        )
        glossary_term_3 = create_glossary_term(create_glossary_term_3)

        updated_glossary_term_3 = deepcopy(glossary_term_3)
        updated_glossary_term_3.parent = EntityReference(
            id=glossary_term_2.id, type="glossaryTerm"
        )

        # Add parent
        patched_glossary_term_3 = metadata.patch(
            entity=GlossaryTerm,
            source=glossary_term_3,
            destination=updated_glossary_term_3,
        )

        assert patched_glossary_term_3 is not None
        assert patched_glossary_term_3.parent.id == glossary_term_2.id

        # Move parent
        updated_glossary_term_3.parent = EntityReference(
            id=glossary_term_1.id, type="glossaryTerm"
        )

        patched_glossary_term_3 = metadata.patch(
            entity=GlossaryTerm,
            source=glossary_term_3,
            destination=updated_glossary_term_3,
        )

        assert patched_glossary_term_3 is not None
        assert patched_glossary_term_3.parent.id == glossary_term_1.id

        # Delete parent
        updated_glossary_term_3.parent = None
        patched_glossary_term_3 = metadata.patch(
            entity=GlossaryTerm,
            source=patched_glossary_term_3,
            destination=updated_glossary_term_3,
        )

        assert patched_glossary_term_3 is not None
        assert patched_glossary_term_3.parent is None

    def test_patch_glossary_term_related_terms(
        self, metadata, create_glossary, create_glossary_term
    ):
        """
        Update related terms via PATCH
        """
        glossary = create_glossary(
            CreateGlossaryRequest(
                name=EntityName("test-glossary"),
                displayName="test-glossary",
                description=Markdown("Description of test glossary"),
            )
        )

        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        create_glossary_term_2 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT2"),
            displayName="Glossary Term 2",
            description=Markdown("Test glossary term 2"),
        )
        glossary_term_2 = create_glossary_term(create_glossary_term_2)

        # Add related term
        updated_glossary_term_1 = deepcopy(glossary_term_1)
        updated_glossary_term_1.relatedTerms = EntityReferenceList(
            root=[EntityReference(id=glossary_term_2.id, type="glossaryTerm")]
        )

        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.relatedTerms.root) == 1
        assert patched_glossary_term_1.relatedTerms.root[0].id == glossary_term_2.id

    def test_patch_reviewer(
        self, metadata, create_glossary, create_glossary_term, create_user
    ):
        """
        Update reviewers via PATCH
        """
        glossary = create_glossary(
            CreateGlossaryRequest(
                name=EntityName("test-glossary"),
                displayName="test-glossary",
                description=Markdown("Description of test glossary"),
            )
        )

        user_1 = create_user(
            CreateUserRequest(
                name=EntityName("test.user.1"),
                email=Email(root="test.user.1@getcollate.io"),
            ),
        )

        # Add Glossary Reviewer
        updated_glossary = deepcopy(glossary)
        if updated_glossary.reviewers is None:
            updated_glossary.reviewers = []
        updated_glossary.reviewers.append(EntityReference(id=user_1.id, type="user"))
        patched_glossary = metadata.patch(
            entity=Glossary, source=glossary, destination=updated_glossary
        )

        assert patched_glossary is not None
        assert len(patched_glossary.reviewers) == 1
        assert patched_glossary.reviewers[0].id == user_1.id

        # Remove only Glossary reviewer
        updated_glossary = deepcopy(patched_glossary)
        updated_glossary.reviewers.pop(0)
        patched_glossary = metadata.patch(
            entity=Glossary, source=patched_glossary, destination=updated_glossary
        )

        assert patched_glossary is not None
        assert len(patched_glossary.reviewers) == 0

        user_2 = create_user(
            CreateUserRequest(
                name=EntityName("test.user.2"),
                email=Email(root="test.user.2@getcollate.io"),
            ),
        )

        user_3 = create_user(
            CreateUserRequest(
                name=EntityName("test.user.3"),
                email=Email(root="test.user.3@getcollate.io"),
            ),
        )

        # Add Reviewers
        updated_glossary = deepcopy(patched_glossary)
        updated_glossary.reviewers.append(EntityReference(id=user_1.id, type="user"))
        updated_glossary.reviewers.append(EntityReference(id=user_2.id, type="user"))
        updated_glossary.reviewers.append(EntityReference(id=user_3.id, type="user"))
        patched_glossary = metadata.patch(
            entity=Glossary, source=patched_glossary, destination=updated_glossary
        )

        # Remove one Glossary reviewer when there are many
        # delete user_3
        updated_glossary = deepcopy(patched_glossary)
        updated_glossary.reviewers.pop(2)
        patched_glossary = metadata.patch(
            entity=Glossary, source=patched_glossary, destination=updated_glossary
        )

        assert patched_glossary is not None
        assert len(patched_glossary.reviewers) == 2
        assert patched_glossary.reviewers[0].id == user_1.id
        assert patched_glossary.reviewers[1].id == user_2.id

        # Add GlossaryTerm Reviewer
        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        updated_glossary_term_1 = deepcopy(glossary_term_1)
        updated_glossary_term_1.reviewers.root.append(
            EntityReference(id=user_1.id, type="user")
        )
        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.reviewers.root) == 2
        assert any(
            reviewer.id == user_1.id
            for reviewer in patched_glossary_term_1.reviewers.root
        )

        updated_glossary_term_1 = deepcopy(patched_glossary_term_1)
        updated_glossary_term_1.reviewers.root.pop(0)
        metadata.patch(
            entity=GlossaryTerm,
            source=patched_glossary_term_1,
            destination=updated_glossary_term_1,
        )

        patched_glossary_term_1 = metadata.get_by_name(
            entity=GlossaryTerm,
            fqn=fqn._build(
                glossary.name.root,
                glossary_term_1.name.root,
            ),
        )

        assert patched_glossary_term_1 is not None

        # inherited reviewers from glossary
        assert len(patched_glossary_term_1.reviewers.root) == 2

    def test_patch_glossary_term_synonyms(
        self, metadata, create_glossary, create_glossary_term
    ):
        """
        Update synonyms via PATCH
        """
        glossary = create_glossary(
            CreateGlossaryRequest(
                name=EntityName("test-glossary"),
                displayName="test-glossary",
                description=Markdown("Description of test glossary"),
            )
        )

        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        # Add GlossaryTerm synonym
        updated_glossary_term_1 = deepcopy(glossary_term_1)
        if updated_glossary_term_1.synonyms is None:
            updated_glossary_term_1.synonyms = []

        if updated_glossary_term_1.synonyms is None:
            updated_glossary_term_1.synonyms = []

        updated_glossary_term_1.synonyms.append(EntityName("GT1S1"))

        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.synonyms) == 1
        assert patched_glossary_term_1.synonyms[0].root == "GT1S1"
        #     self.glossary_term_1 = self.metadata.get_by_id(
        #         entity=GlossaryTerm, entity_id=self.glossary_term_1.id, fields=["*"]
        #     )

        # Remove GlossaryTerm synonym
        updated_glossary_term_1 = deepcopy(patched_glossary_term_1)
        updated_glossary_term_1.synonyms.pop(0)
        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=patched_glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.synonyms) == 0

        updated_glossary_term_1 = deepcopy(patched_glossary_term_1)
        updated_glossary_term_1.synonyms.append(EntityName("GT1S1"))
        updated_glossary_term_1.synonyms.append(EntityName("GT1S2"))
        updated_glossary_term_1.synonyms.append(EntityName("GT1S3"))
        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=patched_glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.synonyms) == 3
        assert patched_glossary_term_1.synonyms[1].root == "GT1S2"

    def test_patch_glossary_term_references(
        self, metadata, create_glossary, create_glossary_term
    ):
        """
        Update GlossaryTerm references via PATCH
        """
        glossary = create_glossary(
            CreateGlossaryRequest(
                name=EntityName("test-glossary"),
                displayName="test-glossary",
                description=Markdown("Description of test glossary"),
            )
        )

        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        # Add reference
        updated_glossary_term_1 = deepcopy(glossary_term_1)
        if updated_glossary_term_1.references is None:
            updated_glossary_term_1.references = []
        updated_glossary_term_1.references.append(
            TermReference(name="GT1S1", endpoint="https://www.getcollate.io")
        )
        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.references) == 1
        assert patched_glossary_term_1.references[0].name == "GT1S1"

        # Remove reference
        updated_glossary_term_1 = deepcopy(patched_glossary_term_1)
        updated_glossary_term_1.references = []

        metadata.patch(
            entity=GlossaryTerm,
            source=patched_glossary_term_1,
            destination=updated_glossary_term_1,
        )

        patched_glossary_term_1 = metadata.get_by_name(
            entity=GlossaryTerm,
            fqn=fqn._build(
                glossary.name.root,
                glossary_term_1.name.root,
            ),
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.references) == 0

        # Add  many references
        updated_glossary_term_1 = deepcopy(patched_glossary_term_1)
        updated_glossary_term_1.references.append(
            TermReference(name="GT1S1", endpoint="https://www.getcollate.io")
        )
        updated_glossary_term_1.references.append(
            TermReference(name="GT1S2", endpoint="https://open-metadata.org/")
        )
        updated_glossary_term_1.references.append(
            TermReference(
                name="GT1S3", endpoint="https://github.com/open-metadata/OpenMetadata"
            )
        )

        patched_glossary_term_1 = metadata.patch(
            entity=GlossaryTerm,
            source=patched_glossary_term_1,
            destination=updated_glossary_term_1,
        )

        assert patched_glossary_term_1 is not None
        assert len(patched_glossary_term_1.references) == 3
        assert patched_glossary_term_1.references[1].name == "GT1S2"
