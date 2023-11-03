"""
Tests for the OMeta tag MixIn
"""

import unittest
from unittest import TestCase

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

CLASSIFICATION_NAME = "TestTag"
PRIMARY_TAG_NAME = "TestPrimaryTag"
SECONDARY_TAG_NAME = "TestSecondaryTag"


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

    def test_get_classification(self):
        """Test GET primary tag"""

        classification = self.metadata.get_by_name(
            entity=Classification, fqn=CLASSIFICATION_NAME
        )

        self.assertEqual(classification.name.__root__, CLASSIFICATION_NAME)

    def test_get_primary_tag(self):
        """Test GET tag by classification"""
        primary_tag = self.metadata.get_by_name(
            entity=Tag,
            fqn=f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}",
        )

        self.assertEqual(primary_tag.name.__root__, PRIMARY_TAG_NAME)

    def test_get_secondary_tag(self):
        """Test GET secondary"""
        secondary_tag = self.metadata.get_by_name(
            entity=Tag,
            fqn=f"{CLASSIFICATION_NAME}.{PRIMARY_TAG_NAME}.{SECONDARY_TAG_NAME}",
        )

        self.assertEqual(secondary_tag.name.__root__, SECONDARY_TAG_NAME)

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
