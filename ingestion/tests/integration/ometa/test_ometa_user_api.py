#  Copyright 2025 Collate
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
OMeta User Mixin integration tests. The API needs to be up
"""
import logging
import time
from unittest import TestCase

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.teams.team import Team, TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList


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

        cls.team: Team = cls.metadata.create_or_update(
            data=CreateTeamRequest(
                teamType=TeamType.Group, name="ops.team", email="ops.team@getcollate.io"
            )
        )

        cls.user_1: User = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="random.user.es",
                email="random.user.es@getcollate.io",
                description="test",
            ),
        )

        cls.user_2: User = cls.metadata.create_or_update(
            data=CreateUserRequest(name="Levy", email="user2.1234@getcollate.io"),
        )

        cls.user_3: User = cls.metadata.create_or_update(
            data=CreateUserRequest(name="Lima", email="random.lima@getcollate.io"),
        )

        cls.service: DashboardService = cls.metadata.create_or_update(
            data=CreateDashboardServiceRequest(
                name="test-service-dashboard-user-assets",
                serviceType=DashboardServiceType.Looker,
                connection=DashboardConnection(
                    config=LookerConnection(
                        hostPort="http://hostPort", clientId="id", clientSecret="secret"
                    )
                ),
            )
        )

        cls.dashboard: Dashboard = cls.metadata.create_or_update(
            CreateDashboardRequest(
                name="test-dashboard-user-assets",
                service=cls.service.fullyQualifiedName,
            )
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

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_3.id,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=Team,
            entity_id=cls.team.id,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=DashboardService,
            entity_id=cls.service.id,
            recursive=True,
            hard_delete=True,
        )

    def test_es_search_from_email(self):
        """
        We can fetch users by its email
        """

        # No email returns None
        self.assertIsNone(self.metadata.get_reference_by_email(email=None))

        # Non existing email returns None
        self.assertIsNone(
            self.metadata.get_reference_by_email(email="idonotexist@random.com")
        )

        # Non existing email returns, even if they have the same domain
        # To get this fixed, we had to update the `email` field in the
        # index as a `keyword` and search by `email.keyword` in ES.
        self.assertIsNone(
            self.metadata.get_reference_by_email(email="idonotexist@getcollate.io")
        )

        # I can get User 1, who has the name equal to its email
        self.assertEqual(
            self.user_1.id,
            self.metadata.get_reference_by_email(email="random.user.es@getcollate.io")
            .root[0]
            .id,
        )

        # I can get User 2, who has an email not matching the name
        self.assertEqual(
            self.user_2.id,
            self.metadata.get_reference_by_email(email="user2.1234@getcollate.io")
            .root[0]
            .id,
        )

        # I can get the team by its mail
        self.assertEqual(
            self.team.id,
            self.metadata.get_reference_by_email(email="ops.team@getcollate.io")
            .root[0]
            .id,
        )

    def test_es_search_from_name(self):
        """
        We can fetch users by its name
        """
        # No email returns None
        self.assertIsNone(self.metadata.get_reference_by_name(name=None))

        # Non existing email returns None
        self.assertIsNone(self.metadata.get_reference_by_name(name="idonotexist"))

        # when searching for "data" user we should not get DataInsightsApplicationBot in result
        team_data = self.metadata.get_reference_by_name(name="data").root[0]
        self.assertEqual(team_data.name, "Data")
        self.assertEqual(team_data.type, "team")

        # We can get the user matching its name
        self.assertEqual(
            self.user_1.id,
            self.metadata.get_reference_by_name(name="random.user.es").root[0].id,
        )

        # Casing does not matter
        self.assertEqual(
            self.user_2.id,
            self.metadata.get_reference_by_name(name="levy").root[0].id,
        )

        self.assertEqual(
            self.user_2.id,
            self.metadata.get_reference_by_name(name="Levy").root[0].id,
        )

        self.assertEqual(
            self.user_1.id,
            self.metadata.get_reference_by_name(name="Random User Es").root[0].id,
        )

        # I can get the team by its name
        self.assertEqual(
            self.team.id,
            self.metadata.get_reference_by_name(name="OPS Team").root[0].id,
        )

        # if team is not group, return none
        self.assertIsNone(
            self.metadata.get_reference_by_name(name="Organization", is_owner=True)
        )

        # description should not affect in search
        self.assertIsNone(
            self.metadata.get_reference_by_name(name="test", is_owner=True)
        )

    def test_get_user_assets(self):
        """We can get assets for a user"""
        owners_ref = EntityReferenceList(
            root=[EntityReference(id=self.user_1.id, type="user")]
        )
        self.metadata.patch(
            entity=Dashboard,
            source=self.dashboard,
            destination=Dashboard(
                id=self.dashboard.id,
                name=self.dashboard.name,
                service=self.dashboard.service,
                owners=owners_ref,
            ),
        )

        assets_response = self.metadata.get_user_assets(
            self.user_1.name.root, limit=100
        )
        self.assertGreaterEqual(len(assets_response["data"]), 1)
        self.assertEqual(assets_response["data"][0]["id"], str(self.dashboard.id.root))
        self.assertEqual(assets_response["data"][0]["type"], "dashboard")

    def test_get_team_assets(self):
        """We can get assets for a team"""
        owners_ref = EntityReferenceList(
            root=[EntityReference(id=self.team.id, type="team")]
        )
        self.metadata.patch(
            entity=Dashboard,
            source=self.dashboard,
            destination=Dashboard(
                id=self.dashboard.id,
                name=self.dashboard.name,
                service=self.dashboard.service,
                owners=owners_ref,
            ),
        )

        assets_response = self.metadata.get_team_assets(self.team.name.root, limit=100)
        self.assertGreaterEqual(len(assets_response["data"]), 1)
        self.assertEqual(assets_response["data"][0]["id"], str(self.dashboard.id.root))
        self.assertEqual(assets_response["data"][0]["type"], "dashboard")
