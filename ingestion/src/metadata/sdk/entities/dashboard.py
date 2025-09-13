"""
Dashboard entity wrapper with clean API following Java SDK patterns.
"""
from typing import Type

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard as DashboardEntity
from metadata.sdk.entities.base import BaseEntity


class Dashboard(BaseEntity[DashboardEntity, CreateDashboardRequest]):
    """
    Dashboard entity wrapper with static methods for CRUD operations.

    Example usage:
        # Create a dashboard
        create_request = CreateDashboardRequest(
            name="sales-dashboard",
            service="tableau-prod",
            displayName="Sales Dashboard",
            dashboardUrl="https://tableau.company.com/sales"
        )
        dashboard = Dashboard.create(create_request)

        # Retrieve a dashboard
        dashboard = Dashboard.retrieve(dashboard_id)
        dashboard = Dashboard.retrieve_by_name("tableau-prod.sales-dashboard")

        # Update a dashboard
        dashboard.description = "Executive sales dashboard"
        updated = Dashboard.update(dashboard.id, dashboard)

        # Patch a dashboard
        patch = [
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "Department.Sales"}},
            {"op": "replace", "path": "/displayName", "value": "Executive Sales Dashboard"}
        ]
        patched = Dashboard.patch(dashboard.id, patch)

        # Delete a dashboard
        Dashboard.delete(dashboard.id)

        # List dashboards with fields
        dashboards = Dashboard.list(fields=["owner", "tags", "charts"])
    """

    @classmethod
    def entity_type(cls) -> Type[DashboardEntity]:
        """Return the Dashboard entity type"""
        return DashboardEntity
