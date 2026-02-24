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
OpenMetadata high-level API Chart test
"""
import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList


@pytest.fixture
def chart_request(dashboard_service):
    """Create chart request using the dashboard service from conftest."""
    return CreateChartRequest(
        name="test",
        service=dashboard_service.fullyQualifiedName,
    )


@pytest.fixture
def expected_fqn(dashboard_service):
    """Expected fully qualified name for test chart."""
    return f"{dashboard_service.name.root}.test"


class TestOMetaChartAPI:
    """
    Chart API integration tests.
    Tests CRUD operations, versioning, and entity references.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - dashboard_service: DashboardService (module scope)
    - create_user: User factory (function scope)
    - create_chart: Chart factory (function scope)
    """

    def test_create(
        self, metadata, dashboard_service, chart_request, expected_fqn, create_chart
    ):
        """
        We can create a Chart and we receive it back as Entity
        """
        res = create_chart(chart_request)

        assert res.name.root == "test"
        assert res.service.id == dashboard_service.id
        assert res.owners is None

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=Chart, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        dashboard_service,
        chart_request,
        create_user,
        create_chart,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        # Create chart
        res_create = create_chart(chart_request)

        # Update with owners
        updated = chart_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateChartRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        # Verify update
        assert (
            res.service.fullyQualifiedName == dashboard_service.fullyQualifiedName.root
        )
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(self, metadata, chart_request, expected_fqn, create_chart):
        """
        We can fetch a Chart by name and get it back as Entity
        """
        created = create_chart(chart_request)

        res = metadata.get_by_name(entity=Chart, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, chart_request, expected_fqn, create_chart):
        """
        We can fetch a Chart by ID and get it back as Entity
        """
        create_chart(chart_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=Chart, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=Chart, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, chart_request, create_chart):
        """
        We can list all our Charts
        """
        created = create_chart(chart_request)

        res = metadata.list_entities(entity=Chart, limit=100)

        # Fetch our test Chart. We have already inserted it, so we should find it
        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, chart_request, expected_fqn, create_chart):
        """
        We can delete a Chart by ID
        """
        created = create_chart(chart_request)

        # Delete
        metadata.delete(entity=Chart, entity_id=str(created.id.root))

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=Chart, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, chart_request, create_chart):
        """
        Test listing chart entity versions
        """
        created = create_chart(chart_request)

        res = metadata.get_list_entity_versions(entity=Chart, entity_id=created.id.root)
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, chart_request, create_chart):
        """
        Test retrieving a specific chart entity version
        """
        created = create_chart(chart_request)

        res = metadata.get_entity_version(
            entity=Chart, entity_id=created.id.root, version=0.1
        )

        # Check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, chart_request, create_chart):
        """
        Test retrieving EntityReference for a chart
        """
        created = create_chart(chart_request)
        entity_ref = metadata.get_entity_reference(
            entity=Chart, fqn=created.fullyQualifiedName
        )

        assert created.id == entity_ref.id
