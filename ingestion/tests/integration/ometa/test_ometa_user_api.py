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
OMeta User Mixin integration tests. The API needs to be up
"""
import logging
import time
from unittest import TestCase

from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaUserTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

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

        cls.user_1: User = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="random.user", email="random.user@getcollate.io"
            ),
        )

        cls.user_2: User = cls.metadata.create_or_update(
            data=CreateUserRequest(name="Levy", email="user2.1234@getcollate.io"),
        )

        cls.user_3: User = cls.metadata.create_or_update(
            data=CreateUserRequest(name="Lima", email="random.lima@getcollate.io"),
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
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_2.id,
            hard_delete=True,
        )

    def test_es_search_from_email(self):
        """
        We can fetch users by its email
        """

        # No email returns None
        self.assertIsNone(self.metadata.get_user_by_email(email=None))

        # Non existing email returns None
        self.assertIsNone(
            self.metadata.get_user_by_email(email="idonotexist@random.com")
        )

        # Non existing email returns, even if they have the same domain
        # To get this fixed, we had to update the `email` field in the
        # index as a `keyword` and search by `email.keyword` in ES.
        self.assertIsNone(
            self.metadata.get_user_by_email(email="idonotexist@getcollate.io")
        )

        # I can get User 1, who has the name equal to its email
        self.assertEqual(
            self.user_1.id,
            self.metadata.get_user_by_email(email="random.user@getcollate.io").id,
        )

        # I can get User 2, who has an email not matching the name
        self.assertEqual(
            self.user_2.id,
            self.metadata.get_user_by_email(email="user2.1234@getcollate.io").id,
        )
