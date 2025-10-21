"""
Tests for the OMeta tag MixIn
"""

import unittest
from unittest import TestCase

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

CLASSIFICATION_NAME = "TestTag"
PRIMARY_TAG_NAME = "TestPrimaryTag"
SECONDARY_TAG_NAME = "TestSecondaryTag"
TEST_SPECIAL_CHARS_TAG_NAME = "Test/Sepcial_Chars/Tag"
LONG_CLASSIFICATION_NAME = "A" * 256
LONG_PRIMARY_TAG_NAME = "B" * 256


class OMetaTagMixinPost(TestCase):
    """Class to test the Mixin implementation of the OMeta Tag"""

    unittest.TestLoader.sortTestMethodsUsing = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    def test_a_create_classifications(self):
        """Test POST classification"""

        classification = CreateClassificationRequest(
            description="test tag", name=CLASSIFICATION_NAME
        )

        self.metadata.create_or_update(classification)

    def test_b_create_tag(self):
        """Test POST primary tag Mixin method"""

        create_primary_tag = CreateTagRequest(
            name=PRIMARY_TAG_NAME,
            classification=CLASSIFICATION_NAME,
            description="test tag",
        )

        primary_tag: Tag = self.metadata.create_or_update(create_primary_tag)

        create_secondary_tag = CreateTagRequest(
            name=SECONDARY_TAG_NAME,
            classification=CLASSIFICATION_NAME,
            description="test secondary tag",
            parent=primary_tag.fullyQualifiedName,
        )

        secondary_tag: Tag = self.metadata.create_or_update(create_secondary_tag)

        assert (
            secondary_tag.fullyQualifiedName
            == f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{SECONDARY_TAG_NAME}"
        )

        create_special_char_tag = CreateTagRequest(
            name=TEST_SPECIAL_CHARS_TAG_NAME,
            classification=CLASSIFICATION_NAME,
            description="test special char tag",
            parent=primary_tag.fullyQualifiedName,
        )

        special_char_tag: Tag = self.metadata.create_or_update(create_special_char_tag)

        assert (
            special_char_tag.fullyQualifiedName
            == f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{TEST_SPECIAL_CHARS_TAG_NAME}"
        )

    def test_get_classification(self):
        """Test GET primary tag"""

        classification = self.metadata.get_by_name(
            entity=Classification, fqn=CLASSIFICATION_NAME
        )

        self.assertEqual(classification.name.root, CLASSIFICATION_NAME)

    def test_get_primary_tag(self):
        """Test GET tag by classification"""
        primary_tag = self.metadata.get_by_name(
            entity=Tag,
            fqn=f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}",
        )

        self.assertEqual(primary_tag.name.root, PRIMARY_TAG_NAME)

    def test_get_secondary_tag(self):
        """Test GET secondary"""
        secondary_tag = self.metadata.get_by_name(
            entity=Tag,
            fqn=f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{SECONDARY_TAG_NAME}",
        )

        self.assertEqual(secondary_tag.name.root, SECONDARY_TAG_NAME)

    def test_list_classifications(self):
        """Test GET list categories Mixin method"""

        classifications = self.metadata.list_entities(entity=Classification).entities

        self.assertIsNotNone(classifications)

    def test_list_tag_in_category(self):
        """
        Get tags from a category
        """
        tags = self.metadata.list_entities(
            entity=Tag, params={"parent": CLASSIFICATION_NAME}
        ).entities

        self.assertIsNotNone(tags)

    def test_c_create_classifications(self):
        """Test POST classification for long name"""

        classification = CreateClassificationRequest(
            description="test tag", name=LONG_CLASSIFICATION_NAME
        )

        classification: Classification = self.metadata.create_or_update(classification)
        self.assertEqual(classification.name.root, LONG_CLASSIFICATION_NAME)

    def test_d_create_tag(self):
        """Test POST tag creation with long name"""
        create_primary_tag = CreateTagRequest(
            name=LONG_PRIMARY_TAG_NAME,
            classification=LONG_CLASSIFICATION_NAME,
            description="test tag",
        )

        primary_tag: Tag = self.metadata.create_or_update(create_primary_tag)
        self.assertEqual(primary_tag.name.root, LONG_PRIMARY_TAG_NAME)
        self.assertEqual(
            primary_tag.fullyQualifiedName,
            f"{LONG_CLASSIFICATION_NAME}.{LONG_PRIMARY_TAG_NAME}",
        )

    def test_get_tag_assets(self):
        """We can get assets for a tag"""
        service: DashboardService = self.metadata.create_or_update(
            data=CreateDashboardServiceRequest(
                name="test-service-dashboard-tag-assets",
                serviceType=DashboardServiceType.Looker,
                connection=DashboardConnection(
                    config=LookerConnection(
                        hostPort="http://hostPort", clientId="id", clientSecret="secret"
                    )
                ),
            )
        )

        dashboard: Dashboard = self.metadata.create_or_update(
            CreateDashboardRequest(
                name="test-dashboard-tag-assets",
                service=service.fullyQualifiedName,
            )
        )

        tag_fqn = f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}"
        self.metadata.patch(
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

        assets_response = self.metadata.get_tag_assets(tag_fqn, limit=100)
        self.assertGreaterEqual(len(assets_response["data"]), 1)
        self.assertEqual(assets_response["data"][0]["id"], str(dashboard.id.root))
        self.assertEqual(assets_response["data"][0]["type"], "dashboard")

        self.metadata.delete(
            entity=DashboardService,
            entity_id=service.id,
            recursive=True,
            hard_delete=True,
        )
