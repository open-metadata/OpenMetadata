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

import pytest

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.teams.team import Team, TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

from .conftest import _safe_delete


def check_es_index(metadata) -> None:
    """
    Wait until the index has been updated with the test user.
    """
    logging.info("Checking ES index status...")
    tries = 0

    res = None
    while not res and tries <= 5:  # Kill in 5 seconds
        res = metadata.es_search_from_fqn(
            entity_type=User,
            fqn_search_string="Levy",
        )
        if not res:
            tries += 1
            time.sleep(1)


@pytest.fixture(scope="module")
def test_team(metadata):
    """Create a test team for user API tests."""
    team = metadata.create_or_update(
        data=CreateTeamRequest(
            teamType=TeamType.Group, name="ops.team", email="ops.team@getcollate.io"
        )
    )

    yield team

    _safe_delete(
        metadata,
        entity=Team,
        entity_id=team.id,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_user_1(metadata):
    """Create first test user."""
    user = metadata.create_or_update(
        data=CreateUserRequest(
            name="random.user.es",
            email="random.user.es@getcollate.io",
            description="desc_only_marker",
        ),
    )

    yield user

    _safe_delete(
        metadata,
        entity=User,
        entity_id=user.id,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_user_2(metadata):
    """Create second test user."""
    user = metadata.create_or_update(
        data=CreateUserRequest(name="Levy", email="user2.1234@getcollate.io"),
    )

    yield user

    _safe_delete(
        metadata,
        entity=User,
        entity_id=user.id,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_user_3(metadata):
    """Create third test user."""
    user = metadata.create_or_update(
        data=CreateUserRequest(name="Lima", email="random.lima@getcollate.io"),
    )

    yield user

    _safe_delete(
        metadata,
        entity=User,
        entity_id=user.id,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_dashboard_for_assets(metadata, dashboard_service):
    """Create a test dashboard for asset ownership tests."""
    dashboard = metadata.create_or_update(
        CreateDashboardRequest(
            name="test-dashboard-user-assets",
            service=dashboard_service.fullyQualifiedName,
        )
    )

    # Wait for ES index to update
    check_es_index(metadata)

    return dashboard


class TestOMetaUserAPI:
    """
    User API integration tests.
    Tests ES search functionality and asset ownership.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - dashboard_service: DashboardService (module scope)

    Local fixtures:
    - test_team: Team for ownership tests
    - test_user_1, test_user_2, test_user_3: Test users
    - test_dashboard_for_assets: Dashboard for asset tests
    """

    def test_es_search_from_email(self, metadata, test_user_1, test_user_2, test_team):
        """
        We can fetch users by its email
        """
        # No email returns None
        assert metadata.get_reference_by_email(email=None) is None

        # Non existing email returns None
        assert metadata.get_reference_by_email(email="idonotexist@random.com") is None

        # Non existing email returns, even if they have the same domain
        # To get this fixed, we had to update the `email` field in the
        # index as a `keyword` and search by `email.keyword` in ES.
        assert (
            metadata.get_reference_by_email(email="idonotexist@getcollate.io") is None
        )

        # I can get User 1, who has the name equal to its email
        assert (
            test_user_1.id
            == metadata.get_reference_by_email(email="random.user.es@getcollate.io")
            .root[0]
            .id
        )

        # I can get User 2, who has an email not matching the name
        assert (
            test_user_2.id
            == metadata.get_reference_by_email(email="user2.1234@getcollate.io")
            .root[0]
            .id
        )

        # I can get the team by its mail
        assert (
            test_team.id
            == metadata.get_reference_by_email(email="ops.team@getcollate.io")
            .root[0]
            .id
        )

    def test_es_search_from_name(self, metadata, test_user_1, test_user_2, test_team):
        """
        We can fetch users by its name
        """
        # No email returns None
        assert metadata.get_reference_by_name(name=None) is None

        # Non existing email returns None
        assert metadata.get_reference_by_name(name="idonotexist") is None

        # when searching for "data" user we should not get DataInsightsApplicationBot in result
        team_data = metadata.get_reference_by_name(name="data").root[0]
        assert team_data.name == "Data"
        assert team_data.type == "team"

        # We can get the user matching its name
        assert (
            test_user_1.id
            == metadata.get_reference_by_name(name="random.user.es").root[0].id
        )

        # Casing does not matter
        assert test_user_2.id == metadata.get_reference_by_name(name="levy").root[0].id

        assert test_user_2.id == metadata.get_reference_by_name(name="Levy").root[0].id

        assert (
            test_user_1.id
            == metadata.get_reference_by_name(name="Random User Es").root[0].id
        )

        # I can get the team by its name
        assert (
            test_team.id == metadata.get_reference_by_name(name="OPS Team").root[0].id
        )

        # if team is not group, return none
        assert (
            metadata.get_reference_by_name(name="Organization", is_owner=True) is None
        )

        # description should not affect in search
        assert (
            metadata.get_reference_by_name(name="desc_only_marker", is_owner=True)
            is None
        )

    def test_get_user_assets(self, metadata, test_user_1, test_dashboard_for_assets):
        """We can get assets for a user"""
        owners_ref = EntityReferenceList(
            root=[EntityReference(id=test_user_1.id, type="user")]
        )
        metadata.patch(
            entity=Dashboard,
            source=test_dashboard_for_assets,
            destination=Dashboard(
                id=test_dashboard_for_assets.id,
                name=test_dashboard_for_assets.name,
                service=test_dashboard_for_assets.service,
                owners=owners_ref,
            ),
        )

        assets_response = metadata.get_user_assets(test_user_1.name.root, limit=100)
        assert len(assets_response["data"]) >= 1
        assert assets_response["data"][0]["id"] == str(
            test_dashboard_for_assets.id.root
        )
        assert assets_response["data"][0]["type"] == "dashboard"

    def test_get_team_assets(self, metadata, test_team, test_dashboard_for_assets):
        """We can get assets for a team"""
        owners_ref = EntityReferenceList(
            root=[EntityReference(id=test_team.id, type="team")]
        )
        metadata.patch(
            entity=Dashboard,
            source=test_dashboard_for_assets,
            destination=Dashboard(
                id=test_dashboard_for_assets.id,
                name=test_dashboard_for_assets.name,
                service=test_dashboard_for_assets.service,
                owners=owners_ref,
            ),
        )

        assets_response = metadata.get_team_assets(test_team.name.root, limit=100)
        assert len(assets_response["data"]) >= 1
        assert assets_response["data"][0]["id"] == str(
            test_dashboard_for_assets.id.root
        )
        assert assets_response["data"][0]["type"] == "dashboard"
