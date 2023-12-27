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

from ..integration_base import int_admin_ometa
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.user import User


class OMetaUserTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    metadata = int_admin_ometa()

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
                name="random.user.es", email="random.user.es@getcollate.io"
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
            self.metadata.get_user_by_email(email="random.user.es@getcollate.io").id,
        )

        # I can get User 2, who has an email not matching the name
        self.assertEqual(
            self.user_2.id,
            self.metadata.get_user_by_email(email="user2.1234@getcollate.io").id,
        )

    def test_es_search_from_name(self):
        """
        We can fetch users by its name
        """
        # No email returns None
        self.assertIsNone(self.metadata.get_user_by_name(name=None))

        # Non existing email returns None
        self.assertIsNone(
            self.metadata.get_user_by_name(name="idonotexist")
        )

        # We can get the user matching its name
        self.assertEqual(
            self.user_1.id,
            self.metadata.get_user_by_name(name="random.user.es").id,
        )

        # Casing does not matter
        self.assertEqual(
            self.user_2.id,
            self.metadata.get_user_by_name(name="levy").id,
        )

        self.assertEqual(
            self.user_2.id,
            self.metadata.get_user_by_name(name="Levy").id,
        )

        self.assertEqual(
            self.user_1.id,
            self.metadata.get_user_by_name(name="Random User Es").id,
        )
