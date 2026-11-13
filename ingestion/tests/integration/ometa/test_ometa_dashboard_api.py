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
OpenMetadata high-level API Dashboard test
"""

import pytest

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.utils import model_str


@pytest.fixture
def dashboard_request(dashboard_service):
    """Create dashboard request using the dashboard service from conftest."""
    return CreateDashboardRequest(
        name="test",
        service=dashboard_service.fullyQualifiedName,
    )


@pytest.fixture
def expected_fqn(dashboard_service):
    """Expected fully qualified name for test dashboard."""
    return f"{dashboard_service.name.root}.test"


class TestOMetaDashboardAPI:
    """
    Dashboard API integration tests.
    Tests CRUD operations, versioning, and entity references.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - dashboard_service: DashboardService (module scope)
    - create_user: User factory (function scope)
    - create_dashboard: Dashboard factory (function scope)
    """

    def test_create(
        self,
        metadata,
        dashboard_service,
        dashboard_request,
        expected_fqn,
        create_dashboard,
    ):
        """
        We can create a Dashboard and we receive it back as Entity
        """
        res = create_dashboard(dashboard_request)

        assert res.name.root == "test"
        assert res.service.id == dashboard_service.id
        assert res.owners is None

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=Dashboard, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        dashboard_service,
        dashboard_request,
        create_user,
        create_dashboard,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        # Create dashboard
        res_create = create_dashboard(dashboard_request)

        # Update with owners
        updated = dashboard_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateDashboardRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        # Verify update
        assert res.service.fullyQualifiedName == dashboard_service.fullyQualifiedName.root
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(self, metadata, dashboard_request, expected_fqn, create_dashboard):
        """
        We can fetch a Dashboard by name and get it back as Entity
        """
        created = create_dashboard(dashboard_request)

        res = metadata.get_by_name(entity=Dashboard, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, dashboard_request, expected_fqn, create_dashboard):
        """
        We can fetch a Dashboard by ID and get it back as Entity
        """
        create_dashboard(dashboard_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=Dashboard, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=Dashboard, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, dashboard_request, create_dashboard):
        """
        We can list all our Dashboards
        """
        created = create_dashboard(dashboard_request)

        res = metadata.list_entities(entity=Dashboard, limit=100)

        # Fetch our test Dashboard. We have already inserted it, so we should find it
        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, dashboard_request, expected_fqn, create_dashboard):
        """
        We can delete a Dashboard by ID
        """
        created = create_dashboard(dashboard_request)

        # Delete
        metadata.delete(entity=Dashboard, entity_id=str(created.id.root), recursive=True)

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=Dashboard, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, dashboard_request, create_dashboard):
        """
        Test listing dashboard entity versions
        """
        created = create_dashboard(dashboard_request)

        res = metadata.get_list_entity_versions(entity=Dashboard, entity_id=created.id.root)
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, dashboard_request, create_dashboard):
        """
        Test retrieving a specific dashboard entity version
        """
        created = create_dashboard(dashboard_request)

        res = metadata.get_entity_version(entity=Dashboard, entity_id=created.id.root, version=0.1)

        # Check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, dashboard_request, create_dashboard):
        """
        Test retrieving EntityReference for a dashboard
        """
        created = create_dashboard(dashboard_request)
        entity_ref = metadata.get_entity_reference(entity=Dashboard, fqn=created.fullyQualifiedName)

        assert created.id == entity_ref.id

    def test_get_dashboard_usage(self, metadata, dashboard_request, create_dashboard):
        """
        `days` days ending on `date`, both included, and a usage PUT adds to the day's count:
        the Hex connector's daily usage is computed from both
        (ADR:2026-11-02-hex-daily-usage-follows-its-seven-day-app-views)
        """
        created = create_dashboard(dashboard_request)
        for day, count in (("2026-01-01", 1), ("2026-01-02", 2), ("2026-01-08", 3), ("2026-01-08", 4)):
            metadata.publish_dashboard_usage(created, UsageRequest(date=day, count=count))

        usage = metadata.get_dashboard_usage(created, date="2026-01-08", days=7)

        assert {model_str(day.date): day.dailyStats.count for day in usage} == {"2026-01-02": 2, "2026-01-08": 7}

    def test_zero_usage_ages_out_the_weekly_count(self, metadata, dashboard_request, create_dashboard):
        """
        The usage summary is the latest row's, so only a zero row lets views age out
        (ADR:2026-11-02-hex-daily-usage-follows-its-seven-day-app-views)
        """
        created = create_dashboard(dashboard_request)

        def weekly_count():
            return metadata.get_by_name(
                entity=Dashboard, fqn=created.fullyQualifiedName, fields=["usageSummary"]
            ).usageSummary.weeklyStats.count

        metadata.publish_dashboard_usage(created, UsageRequest(date="2026-01-01", count=10))
        assert weekly_count() == 10

        metadata.publish_dashboard_usage(created, UsageRequest(date="2026-01-09", count=0))
        assert weekly_count() == 0
