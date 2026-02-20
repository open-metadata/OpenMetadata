"""
Tests for the OMeta tag MixIn
"""
import uuid

import pytest

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)

from ..integration_base import generate_name, get_create_service
from .conftest import _safe_delete

_RUN_ID = uuid.uuid4().hex[:8]
CLASSIFICATION_NAME = f"TestTag{_RUN_ID}"
PRIMARY_TAG_NAME = f"TestPrimaryTag{_RUN_ID}"
SECONDARY_TAG_NAME = f"TestSecondaryTag{_RUN_ID}"
TEST_SPECIAL_CHARS_TAG_NAME = f"Test/Sepcial_Chars/Tag{_RUN_ID}"
LONG_CLASSIFICATION_NAME = "A" * 256
LONG_PRIMARY_TAG_NAME = "B" * 256


@pytest.fixture(scope="module")
def tag_classification(metadata):
    """Module-scoped classification for tag tests."""
    classification = metadata.create_or_update(
        CreateClassificationRequest(description="test tag", name=CLASSIFICATION_NAME)
    )
    yield classification

    _safe_delete(
        metadata,
        entity=Classification,
        entity_id=classification.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def primary_tag(metadata, tag_classification):
    """Module-scoped primary tag."""
    return metadata.create_or_update(
        CreateTagRequest(
            name=PRIMARY_TAG_NAME,
            classification=CLASSIFICATION_NAME,
            description="test tag",
        )
    )


@pytest.fixture(scope="module")
def secondary_tag(metadata, primary_tag):
    """Module-scoped secondary tag (child of primary)."""
    return metadata.create_or_update(
        CreateTagRequest(
            name=SECONDARY_TAG_NAME,
            classification=CLASSIFICATION_NAME,
            description="test secondary tag",
            parent=primary_tag.fullyQualifiedName,
        )
    )


@pytest.fixture(scope="module")
def special_char_tag(metadata, primary_tag):
    """Module-scoped tag with special characters in name."""
    return metadata.create_or_update(
        CreateTagRequest(
            name=TEST_SPECIAL_CHARS_TAG_NAME,
            classification=CLASSIFICATION_NAME,
            description="test special char tag",
            parent=primary_tag.fullyQualifiedName,
        )
    )


@pytest.fixture(scope="module")
def long_tag_classification(metadata):
    """Module-scoped classification with long name."""
    classification = metadata.create_or_update(
        CreateClassificationRequest(
            description="test tag", name=LONG_CLASSIFICATION_NAME
        )
    )
    yield classification

    _safe_delete(
        metadata,
        entity=Classification,
        entity_id=classification.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def long_primary_tag(metadata, long_tag_classification):
    """Module-scoped tag with long name."""
    return metadata.create_or_update(
        CreateTagRequest(
            name=LONG_PRIMARY_TAG_NAME,
            classification=LONG_CLASSIFICATION_NAME,
            description="test tag",
        )
    )


class TestOMetaTagMixin:
    """
    Tag Mixin integration tests.
    Tests classification and tag CRUD operations.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_create_classification(self, tag_classification):
        """Test POST classification"""
        assert tag_classification is not None

    def test_create_tags(self, primary_tag, secondary_tag, special_char_tag):
        """Test POST tag creation including nested and special chars"""
        assert (
            secondary_tag.fullyQualifiedName
            == f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{SECONDARY_TAG_NAME}"
        )
        assert (
            special_char_tag.fullyQualifiedName
            == f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{TEST_SPECIAL_CHARS_TAG_NAME}"
        )

    def test_get_classification(self, metadata, tag_classification):
        """Test GET classification by name"""
        classification = metadata.get_by_name(
            entity=Classification, fqn=CLASSIFICATION_NAME
        )
        assert classification.name.root == CLASSIFICATION_NAME

    def test_get_primary_tag(self, metadata, primary_tag):
        """Test GET tag by classification"""
        tag = metadata.get_by_name(
            entity=Tag,
            fqn=f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}",
        )
        assert tag.name.root == PRIMARY_TAG_NAME

    def test_get_secondary_tag(self, metadata, secondary_tag):
        """Test GET secondary tag"""
        tag = metadata.get_by_name(
            entity=Tag,
            fqn=f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{SECONDARY_TAG_NAME}",
        )
        assert tag.name.root == SECONDARY_TAG_NAME

    def test_list_classifications(self, metadata, tag_classification):
        """Test GET list classifications"""
        classifications = metadata.list_entities(entity=Classification).entities
        assert classifications is not None

    def test_list_tag_in_category(self, metadata, primary_tag):
        """Get tags from a category"""
        tags = metadata.list_entities(
            entity=Tag, params={"parent": CLASSIFICATION_NAME}
        ).entities
        assert tags is not None

    def test_create_long_classification(self, long_tag_classification):
        """Test POST classification with long name"""
        assert long_tag_classification.name.root == LONG_CLASSIFICATION_NAME

    def test_create_long_tag(self, long_primary_tag):
        """Test POST tag creation with long name"""
        assert long_primary_tag.name.root == LONG_PRIMARY_TAG_NAME
        assert (
            long_primary_tag.fullyQualifiedName
            == f"{LONG_CLASSIFICATION_NAME}.{LONG_PRIMARY_TAG_NAME}"
        )

    def test_get_tag_assets(self, metadata, primary_tag):
        """We can get assets for a tag"""
        service_name = generate_name()
        create_service = get_create_service(entity=DashboardService, name=service_name)
        service = metadata.create_or_update(data=create_service)

        try:
            dashboard: Dashboard = metadata.create_or_update(
                CreateDashboardRequest(
                    name="test-dashboard-tag-assets",
                    service=service.fullyQualifiedName,
                )
            )

            tag_fqn = f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}"
            metadata.patch(
                entity=Dashboard,
                source=dashboard,
                destination=Dashboard(
                    id=dashboard.id,
                    name=dashboard.name,
                    service=dashboard.service,
                    tags=[
                        TagLabel(
                            tagFQN=tag_fqn,
                            source=TagSource.Classification,
                            labelType=LabelType.Manual,
                            state=State.Confirmed,
                        )
                    ],
                ),
            )

            assets_response = metadata.get_tag_assets(tag_fqn, limit=100)
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
