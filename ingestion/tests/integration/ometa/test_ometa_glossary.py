#  Copyright 2021 Schlameel
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
OpenMetadata high-level API Glossary test
"""
from copy import deepcopy

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import (
    GlossaryTerm,
    TermReference,
)
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.utils import fqn

from ..integration_base import generate_name
from .conftest import _safe_delete


def _glossary_request(name=None):
    """Create a glossary request with a unique name."""
    if name is None:
        name = generate_name()
    return CreateGlossaryRequest(
        name=name,
        displayName=name.root if hasattr(name, "root") else str(name),
        description=Markdown("Description of test glossary"),
    )


class TestOMetaGlossary:
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    def test_create_glossary(self, create_glossary, create_user):
        """
        Create a Glossary
        """
        user = create_user()

        req = _glossary_request()
        req.owners = EntityReferenceList(
            root=[EntityReference(id=user.id, type="user")],
        )

        glossary = create_glossary(req)

        assert glossary is not None
        assert req.name == glossary.name

    def test_create_glossary_term(self, create_glossary, create_glossary_term):
        """
        Test the creation of a glossary term
        """

        glossary = create_glossary(_glossary_request())

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
        glossary = create_glossary(_glossary_request())

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
        glossary = create_glossary(_glossary_request())

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
        glossary = create_glossary(_glossary_request())

        user_1 = create_user()

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

        user_2 = create_user()

        user_3 = create_user()

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
        updated_glossary.reviewers = [
            r for r in updated_glossary.reviewers if r.id != user_3.id
        ]
        patched_glossary = metadata.patch(
            entity=Glossary, source=patched_glossary, destination=updated_glossary
        )

        assert patched_glossary is not None
        assert len(patched_glossary.reviewers) == 2
        reviewer_ids = {str(r.id.root) for r in patched_glossary.reviewers}
        assert reviewer_ids == {str(user_1.id.root), str(user_2.id.root)}

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
            fields=["reviewers"],
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
        glossary = create_glossary(_glossary_request())

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
        glossary = create_glossary(_glossary_request())

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

    def test_get_glossary_term_assets(
        self, metadata, create_glossary, create_glossary_term
    ):
        """We can get assets for a glossary term"""
        glossary = create_glossary(_glossary_request())

        create_glossary_term_1 = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("GT1"),
            displayName="Glossary Term 1",
            description=Markdown("Test glossary term 1"),
        )
        glossary_term_1 = create_glossary_term(create_glossary_term_1)

        service: DashboardService = metadata.create_or_update(
            data=CreateDashboardServiceRequest(
                name=generate_name(),
                serviceType=DashboardServiceType.Looker,
                connection=DashboardConnection(
                    config=LookerConnection(
                        hostPort="http://hostPort", clientId="id", clientSecret="secret"
                    )
                ),
            )
        )

        dashboard: Dashboard = metadata.create_or_update(
            CreateDashboardRequest(
                name=generate_name(),
                service=service.fullyQualifiedName,
            )
        )

        metadata.patch(
            entity=Dashboard,
            source=dashboard,
            destination=Dashboard(
                id=dashboard.id,
                name=dashboard.name,
                service=dashboard.service,
                tags=[
                    TagLabel(
                        tagFQN=glossary_term_1.fullyQualifiedName.root,
                        source=TagSource.Glossary,
                        labelType=LabelType.Manual,
                        state=State.Confirmed,
                    )
                ],
            ),
        )

        try:
            assets_response = metadata.get_glossary_term_assets(
                glossary_term_1.fullyQualifiedName.root, limit=100
            )
            assert len(assets_response["data"]) >= 1
            assert assets_response["data"][0]["id"] == str(dashboard.id.root)
            assert assets_response["data"][0]["type"] == "dashboard"
        finally:
            _safe_delete(
                metadata,
                entity=DashboardService,
                entity_id=service.id,
                recursive=True,
                hard_delete=True,
            )
