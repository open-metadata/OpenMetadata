"""
Tests for the OMeta tag MixIn
"""

import random
import unittest
from unittest import TestCase

from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
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
        """Test POST classification Mixin method"""

        classification = CreateClassificationRequest(
            description="test tag", name=CLASSIFICATION_NAME
        )

        self.metadata.create_classification(classification)
        assert True

    def test_b_create_tag(self):
        """Test POST primary tag Mixin method"""

        """TODO:9259 parent needs to be fqn of parent tag. Also where is the tag name?"""
        create_tag = CreateTagRequest(
            classification=CLASSIFICATION_NAME,
            description="test tag",
            parent="TODO"
        )

        self.metadata.create_tag(create_tag)
        assert True

    def test_c_create_secondary_tag(self):
        """Test POST secondary tag Mixin method"""

        """TODO:9259 parent needs to be fqn of parent tag"""
        create_tag = CreateTagRequest(
            name=SECONDARY_TAG_NAME,
            classification = CLASSIFICATION_NAME,
            description="test tag",
            parent="TODO"

        )

        self.metadata.create_tag(
            create_tag
        )
        assert True


class OMetaTagMixinGet(TestCase):
    """test GET methods"""

    def setUp(self) -> None:
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            ),
        )
        self.metadata = OpenMetadata(server_config)

    def test_get_classification(self):
        """Test GET primary tag"""

        classification = self.metadata.get_classification(
            entity=Classification, classification_name=CLASSIFICATION_NAME
        )

        self.assertEqual(classification.name.__root__, CLASSIFICATION_NAME)

    def test_get_primary_tag(self):
        """Test GET tag by classification"""

        primary_tag = self.metadata.get_tag(
            entity=Tag,
            tag_fqn=PRIMARY_TAG_NAME, """TODO:9259 needs to be fqn"""
        )

        self.assertEqual(primary_tag.name.__root__, PRIMARY_TAG_NAME)

    def test_get_secondary_tag(self):
        """Test GET secondary"""

        secondary_tag = self.metadata.get_tag(
            entity=Tag,
            secondary_tag_fqn=SECONDARY_TAG_NAME,"""TODO:9259 needs to be fqn"""
        )

        self.assertEqual(secondary_tag.name.__root__, SECONDARY_TAG_NAME)

    def test_list_classifications(self):
        """Test GET list categories Mixin method"""

        classifications = self.metadata.list_classifications(entity=Classification)

        self.assertIsNotNone(classifications)


class OMetaTagMixinPut(TestCase):
    """Test OMeta Tag PUT methods"""

    def setUp(self) -> None:
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            ),
        )
        self.metadata = OpenMetadata(server_config)

    def test_c_update_classification(self):
        """Test put tag classification"""

        rand_name = random.getrandbits(64)
        updated_classification = CreateClassificationRequest(
            description="test tag", name=f"{rand_name}"
        )

        self.metadata.create_or_update_classification(CLASSIFICATION_NAME, updated_classification)

        assert True

    def test_b_update_primary_tag(self):
        """Test put tag classification"""

        rand_name = random.getrandbits(64)
        updated_primary_tag = CreateTagRequest(
            description="test tag", name=f"{rand_name}", classification=CLASSIFICATION_NAME
        )

        self.metadata.create_or_update_tag(
            updated_primary_tag
        )

        assert True

    def test_a_update_secondary_tag(self):
        """Test put tag classification"""

        rand_name = random.getrandbits(64)
        updated_secondary_tag = CreateTagRequest(
            """ TODO:9259 change the parent to fqn of the primary_tag"""
            description="test tag", name=f"{rand_name}", classification=CLASSIFICATION_NAME, parent="TODO"
        )

        self.metadata.create_or_update_tag(
            updated_secondary_tag
        )

        assert True
