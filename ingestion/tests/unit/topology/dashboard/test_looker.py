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
Test looker source
"""
import uuid
from datetime import datetime, timedelta
from unittest import TestCase
from unittest.mock import patch

from looker_sdk.error import SDKError
from looker_sdk.sdk.api40.methods import Looker40SDK
from looker_sdk.sdk.api40.models import Dashboard as LookerDashboard
from looker_sdk.sdk.api40.models import (
    DashboardBase,
    DashboardElement,
    LookmlModelExplore,
    Query,
    User,
)

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.usageDetails import UsageDetails, UsageStats
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardUsage
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.utils import fqn

MOCK_LOOKER_CONFIG = {
    "source": {
        "type": "looker",
        "serviceName": "test_looker",
        "serviceConnection": {
            "config": {
                "type": "Looker",
                "clientId": "00000",
                "clientSecret": "abcdefg",
                "hostPort": "https://my-looker.com",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        },
    },
}

MOCK_DASHBOARD_BASE = [
    DashboardBase(
        id="1",
        title="title1",
    ),
    DashboardBase(
        id="2",
        title="title2",
    ),
]


MOCK_DASHBOARD_ELEMENTS = [
    DashboardElement(
        id="chart_id1",
        title="chart_title1",
        subtitle_text="subtitle",
        body_text="Some body text",
        note_text="Some note",
        type="line",
        query=Query(model="model", view="view"),
    )
]

MOCK_LOOKER_DASHBOARD = LookerDashboard(
    id=MOCK_DASHBOARD_BASE[0].id,
    title=MOCK_DASHBOARD_BASE[0].title,
    dashboard_elements=MOCK_DASHBOARD_ELEMENTS,
    description="description",
    user_id="user_id",
)

MOCK_USER = User(email="user@mail.com")

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="quicksight_source_test",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="looker_source_test"),
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Looker,
)


class LookerUnitTest(TestCase):
    """
    Validate how we work with Looker metadata
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(MOCK_LOOKER_CONFIG)

        # This already validates that the source can be initialized
        self.looker: LookerSource = LookerSource.create(
            MOCK_LOOKER_CONFIG["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.looker.context.__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE

    def test_create(self):
        """
        An invalid config raises an error
        """
        not_looker_source = {
            "type": "mysql",
            "serviceName": "mysql_local",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                    "hostPort": "localhost:3306",
                    "databaseSchema": "openmetadata_db",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                }
            },
        }

        self.assertRaises(
            InvalidSourceException,
            LookerSource.create,
            not_looker_source,
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_get_dashboards_list(self):
        """
        Mock the client and check that we get a list and
        raise an exception if needed
        """

        # Check the right return works
        with patch.object(
            Looker40SDK, "all_dashboards", return_value=MOCK_DASHBOARD_BASE
        ):

            self.assertEqual(self.looker.get_dashboards_list(), MOCK_DASHBOARD_BASE)

        # Check What happens if we have an exception
        def raise_something_bad():
            raise RuntimeError("Something bad")

        with patch.object(
            Looker40SDK, "all_dashboards", side_effect=raise_something_bad
        ):
            self.assertRaises(Exception, LookerSource.get_dashboards_list)

    def test_get_dashboard_name(self):
        """
        Validate how we get the dashboard name
        """
        self.assertEqual(
            self.looker.get_dashboard_name(
                DashboardBase(
                    id="1",
                    title="title1",
                )
            ),
            "title1",
        )

        self.assertEqual(
            self.looker.get_dashboard_name(
                DashboardBase(
                    id="1",
                    title="",
                )
            ),
            "1",
        )

        self.assertEqual(
            self.looker.get_dashboard_name(
                DashboardBase(
                    id="1",
                )
            ),
            "1",
        )

    def test_get_dashboard_details(self):
        """
        Check that if the client gives us a dashboard
        we return it.

        No need to handle exceptions here, as they are
        managed in the service abstract
        """
        with patch.object(Looker40SDK, "dashboard", return_value=MOCK_LOOKER_DASHBOARD):
            self.assertEqual(
                self.looker.get_dashboard_details(MOCK_DASHBOARD_BASE[0]),
                MOCK_LOOKER_DASHBOARD,
            )

    def test_get_owner_details(self):
        """
        Check how we pick or not the owner
        """
        ref = EntityReference(id=uuid.uuid4(), type="user")

        with patch.object(Looker40SDK, "user", return_value=MOCK_USER), patch.object(
            # This does not really return a ref, but for simplicity
            OpenMetadata,
            "get_user_by_email",
            return_value=ref,
        ):
            self.assertEqual(self.looker.get_owner_details(MOCK_LOOKER_DASHBOARD), ref)

        def raise_something_bad():
            raise RuntimeError("Something bad")

        with patch.object(Looker40SDK, "user", side_effect=raise_something_bad):
            self.assertRaises(Exception, LookerSource.get_owner_details)

    def test_yield_dashboard(self):
        """
        Check that we are building properly
        the Dashboard Request
        """
        # If we don't have context, then charts are empty
        # We already tested the ownership, mocking as None for simplicity
        with patch.object(LookerSource, "get_owner_details", return_value=None):
            create_dashboard_request = CreateDashboardRequest(
                name="1",
                displayName="title1",
                description="description",
                charts=[],
                dashboardUrl="https://my-looker.com/dashboards/1",
                service=self.looker.context.dashboard_service.fullyQualifiedName.__root__,
                owner=None,
            )

            self.assertEqual(
                next(self.looker.yield_dashboard(MOCK_LOOKER_DASHBOARD)),
                create_dashboard_request,
            )

    def test_clean_table_name(self):
        """
        Check table cleaning
        """
        self.assertEqual(self.looker._clean_table_name("MY_TABLE"), "my_table")

        self.assertEqual(self.looker._clean_table_name("  MY_TABLE  "), "my_table")

        self.assertEqual(self.looker._clean_table_name("  my_table"), "my_table")

        self.assertEqual(self.looker._clean_table_name("TABLE AS ALIAS"), "table")

    def test_get_dashboard_sources(self):
        """
        Check how we are building the sources
        """
        with patch.object(
            Looker40SDK,
            "lookml_model_explore",
            return_value=LookmlModelExplore(
                sql_table_name="MY_TABLE", model_name="model2", view_name="view"
            ),
        ):
            dashboard_sources = self.looker.get_dashboard_sources(MOCK_LOOKER_DASHBOARD)
            # Picks it up from the chart, not here
            self.assertEqual(dashboard_sources, {"model_view"})

    def test_build_lineage_request(self):
        """
        We properly build lineage
        """

        source = "db.schema.table"
        db_service_name = "service"
        to_entity = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        )

        # If no from_entity, return none
        with patch.object(fqn, "build", return_value=None), patch.object(
            OpenMetadata, "get_by_name", return_value=None
        ):
            self.assertIsNone(
                self.looker.build_lineage_request(source, db_service_name, to_entity)
            )

        # If from_entity, return a single AddLineageRequest
        table = Table(
            id=uuid.uuid4(),
            name="dashboard_name",
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        with patch.object(fqn, "build", return_value=None), patch.object(
            OpenMetadata, "get_by_name", return_value=table
        ):
            self.assertEqual(
                self.looker.build_lineage_request(source, db_service_name, to_entity),
                AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=table.id.__root__, type="table"),
                        toEntity=EntityReference(
                            id=to_entity.id.__root__, type="dashboard"
                        ),
                    )
                ),
            )

    def test_yield_dashboard_chart(self):
        """
        Check how we are building charts
        """

        create_chart_request = CreateChartRequest(
            name="chart_id1",
            displayName="chart_title1",
            description="subtitle; Some body text; Some note",
            chartType=ChartType.Line,
            chartUrl="https://my-looker.com/dashboard_elements/chart_id1",
            service=self.looker.context.dashboard_service.fullyQualifiedName.__root__,
        )

        self.assertEqual(
            next(self.looker.yield_dashboard_chart(MOCK_LOOKER_DASHBOARD)),
            create_chart_request,
        )

        # We don't blow up if the chart cannot be built.
        # Let's mock a random function exploding
        def something_bad():
            raise Exception("something bad")

        with patch.object(
            LookerSource, "build_chart_description", side_effect=something_bad
        ):
            self.looker.yield_dashboard_chart(MOCK_LOOKER_DASHBOARD)

    def test_yield_dashboard_usage(self):
        """
        Validate the logic for existing or new usage
        """

        # Start checking dashboard without usage
        # and a view count
        self.looker.context.__dict__["dashboard"] = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        )
        MOCK_LOOKER_DASHBOARD.view_count = 10

        self.assertEqual(
            next(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD)),
            DashboardUsage(
                dashboard=self.looker.context.dashboard,
                usage=UsageRequest(date=self.looker.today, count=10),
            ),
        )

        # Now check what happens if we already have some summary data for today
        self.looker.context.__dict__["dashboard"] = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=10), date=self.looker.today
            ),
        )

        # Nothing is returned
        self.assertEqual(
            len(list(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD))), 0
        )

        # But if we have usage for today but the count is 0, we'll return the details
        self.looker.context.__dict__["dashboard"] = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=0), date=self.looker.today
            ),
        )
        self.assertEqual(
            next(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD)),
            DashboardUsage(
                dashboard=self.looker.context.dashboard,
                usage=UsageRequest(date=self.looker.today, count=10),
            ),
        )

        # But if we have usage for another day, then we do the difference
        self.looker.context.__dict__["dashboard"] = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=5),
                date=datetime.strftime(datetime.now() - timedelta(1), "%Y-%m-%d"),
            ),
        )
        self.assertEqual(
            next(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD)),
            DashboardUsage(
                dashboard=self.looker.context.dashboard,
                usage=UsageRequest(date=self.looker.today, count=5),
            ),
        )

        # If the past usage is higher than what we have today, something weird is going on
        # we don't return usage but don't explode
        self.looker.context.__dict__["dashboard"] = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=1000),
                date=datetime.strftime(datetime.now() - timedelta(1), "%Y-%m-%d"),
            ),
        )

        self.assertEqual(
            len(list(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD))), 0
        )
