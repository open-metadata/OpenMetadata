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
Test looker source
"""
import uuid
from datetime import datetime, timedelta
from unittest import TestCase
from unittest.mock import patch

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
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageDetails import UsageDetails, UsageStats
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import Dialect
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
                "includeOwners": True,
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
        query=Query(
            model="model", view="view", share_url="https://my-looker.com/hello"
        ),
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
    fullyQualifiedName=FullyQualifiedEntityName("looker_source_test"),
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Looker,
)

EXPECTED_PARSED_VIEWS = {
    "v1": "table1",
    "v2": "select * from v2",
    "v3": "select * from (select * from v2)",
    "v4": "select * from (select * from (select * from v2)) inner join (table1)",
}


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
        self.config = OpenMetadataWorkflowConfig.model_validate(MOCK_LOOKER_CONFIG)

        # This already validates that the source can be initialized
        self.looker: LookerSource = LookerSource.create(
            MOCK_LOOKER_CONFIG["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )

        self.looker.context.get().__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root

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
                    "authType": {"password": "openmetadata_password"},
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

    def test_get_owner_ref(self):
        """
        Check how we pick or not the owner
        """
        ref = EntityReference(id=uuid.uuid4(), type="user")

        with patch.object(Looker40SDK, "user", return_value=MOCK_USER), patch.object(
            OpenMetadata,
            "get_reference_by_email",
            return_value=ref,
        ):
            self.assertEqual(self.looker.get_owner_ref(MOCK_LOOKER_DASHBOARD), ref)

        def raise_something_bad():
            raise RuntimeError("Something bad")

        with patch.object(Looker40SDK, "user", side_effect=raise_something_bad):
            self.assertRaises(Exception, LookerSource.get_owner_ref)

    def test_yield_dashboard(self):
        """
        Check that we are building properly
        the Dashboard Request
        """
        # If we don't have context, then charts are empty
        # We already tested the ownership, mocking as None for simplicity
        with patch.object(LookerSource, "get_owner_ref", return_value=None):
            create_dashboard_request = CreateDashboardRequest(
                name="1",
                displayName="title1",
                description="description",
                charts=[],
                sourceUrl="https://my-looker.com/dashboards/1",
                service=self.looker.context.get().dashboard_service,
                owners=None,
            )

            self.assertEqual(
                next(self.looker.yield_dashboard(MOCK_LOOKER_DASHBOARD)).right,
                create_dashboard_request,
            )

    def test_clean_table_name(self):
        """
        Check table cleaning
        """
        self.assertEqual(
            self.looker._clean_table_name("MY_TABLE", Dialect.MYSQL), "my_table"
        )

        self.assertEqual(
            self.looker._clean_table_name("  MY_TABLE  ", Dialect.REDSHIFT), "my_table"
        )

        self.assertEqual(
            self.looker._clean_table_name("  my_table", Dialect.SNOWFLAKE), "my_table"
        )

        self.assertEqual(
            self.looker._clean_table_name("TABLE AS ALIAS", Dialect.BIGQUERY), "table"
        )

        self.assertEqual(
            self.looker._clean_table_name(
                "`project_id.dataset_id.table_id` AS ALIAS", Dialect.BIGQUERY
            ),
            "project_id.dataset_id.table_id",
        )

        self.assertEqual(
            self.looker._clean_table_name("`db.schema.table`", Dialect.POSTGRES),
            "`db.schema.table`",
        )

    def test_render_table_name(self):
        """
        Check that table is rendered correctly if "openmetadata" or default condition apply, or no templating is present
        """
        tagged_table_name_template = """
        {%- if openmetadata -%}
        `BQ-project.dataset.sample_data`
        {%- elsif prod -%}
        `BQ-project.dataset.sample_data`
        {%- elsif dev -%}
        `BQ-project.{{_user_attributes['dbt_dev_schema']}}.sample_data`
        {%- endif -%}
        """
        default_table_name_template = """
        {%- if prod -%}
        `BQ-project.dataset.sample_data`
        {%- elsif dev -%}
        `BQ-project.{{_user_attributes['dbt_dev_schema']}}.sample_data`
        {%- else -%}
        `BQ-project.dataset.sample_data`
        {%- endif -%}
        """
        untagged_table_name_template = """
        {%- if prod -%}
        `BQ-project.dataset.sample_data`
        {%- elsif dev -%}
        `BQ-project.{{_user_attributes['dbt_dev_schema']}}.sample_data`
        {%- endif -%}
        """
        table_name_plain = "`BQ-project.dataset.sample_data`"
        self.assertEqual(
            self.looker._render_table_name(tagged_table_name_template),
            "`BQ-project.dataset.sample_data`",
        )
        self.assertEqual(
            self.looker._render_table_name(default_table_name_template),
            "`BQ-project.dataset.sample_data`",
        )
        self.assertNotEqual(
            self.looker._render_table_name(untagged_table_name_template),
            "`BQ-project.dataset.sample_data`",
        )
        self.assertEqual(
            self.looker._render_table_name(table_name_plain),
            "`BQ-project.dataset.sample_data`",
        )

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
            original_lineage = self.looker.build_lineage_request(
                source, db_service_name, to_entity
            ).right
            expected_lineage = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=table.id.root, type="table"),
                    toEntity=EntityReference(id=to_entity.id.root, type="dashboard"),
                    lineageDetails=LineageDetails(
                        source=LineageSource.DashboardLineage, columnsLineage=[]
                    ),
                )
            )
            self.assertEqual(original_lineage, expected_lineage)

    def test_yield_dashboard_chart(self):
        """
        Check how we are building charts
        """

        create_chart_request = CreateChartRequest(
            name="chart_id1",
            displayName="chart_title1",
            description="subtitle; Some body text; Some note",
            chartType=ChartType.Line,
            sourceUrl="https://my-looker.com/hello",
            service=self.looker.context.get().dashboard_service,
        )

        self.assertEqual(
            next(self.looker.yield_dashboard_chart(MOCK_LOOKER_DASHBOARD)).right,
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

        self.looker.context.get().__dict__["dashboard"] = "dashboard_name"
        MOCK_LOOKER_DASHBOARD.view_count = 10

        # Start checking dashboard without usage
        # and a view count
        return_value = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            self.assertEqual(
                next(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD)).right,
                DashboardUsage(
                    dashboard=return_value,
                    usage=UsageRequest(date=self.looker.today, count=10),
                ),
            )

        # Now check what happens if we already have some summary data for today
        return_value = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=10), date=self.looker.today
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            # Nothing is returned
            self.assertEqual(
                len(list(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD))), 0
            )

        # But if we have usage for today but the count is 0, we'll return the details
        return_value = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=0), date=self.looker.today
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            self.assertEqual(
                next(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD)).right,
                DashboardUsage(
                    dashboard=return_value,
                    usage=UsageRequest(date=self.looker.today, count=10),
                ),
            )

        # But if we have usage for another day, then we do the difference
        return_value = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=5),
                date=datetime.strftime(datetime.now() - timedelta(1), "%Y-%m-%d"),
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            self.assertEqual(
                next(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD)).right,
                DashboardUsage(
                    dashboard=return_value,
                    usage=UsageRequest(date=self.looker.today, count=5),
                ),
            )

        # If the past usage is higher than what we have today, something weird is going on
        # we don't return usage but don't explode
        return_value = Dashboard(
            id=uuid.uuid4(),
            name="dashboard_name",
            fullyQualifiedName="dashboard_service.dashboard_name",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=1000),
                date=datetime.strftime(datetime.now() - timedelta(1), "%Y-%m-%d"),
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            self.assertEqual(
                len(list(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD))), 1
            )

            self.assertIsNotNone(
                list(self.looker.yield_dashboard_usage(MOCK_LOOKER_DASHBOARD))[0].left
            )

    def test_derived_view_references(self):
        """
        Validate if we can find derived references in a SQL query
        and replace them with their actual values
        """
        # pylint: disable=protected-access
        self.looker._parsed_views.update(
            {
                "v1": "table1",
                "v2": "select * from v2",
            }
        )
        self.looker._unparsed_views.update(
            {
                "v3": "select * from ${v2.SQL_TABLE_NAME}",
                "v4": "select * from ${v3.SQL_TABLE_NAME} inner join ${v1.SQL_TABLE_NAME}",
            }
        )
        self.looker._derived_dependencies.add_edges_from(
            [
                ("v3", "v2"),
                ("v4", "v3"),
                ("v4", "v1"),
            ]
        )
        list(self.looker.build_lineage_for_unparsed_views())

        self.assertEqual(self.looker._parsed_views, EXPECTED_PARSED_VIEWS)
        self.assertEqual(self.looker._unparsed_views, {})

    def test_include_owners_flag_enabled(self):
        """
        Test that when includeOwners is True, owner information is processed
        """
        # Mock the source config to have includeOwners = True
        self.looker.source_config.includeOwners = True

        # Mock a user with email
        mock_user = User(email="test@example.com")

        # Mock the client.user method to return our mock user
        with patch.object(self.looker.client, "user", return_value=mock_user):
            # Mock the metadata.get_reference_by_email method
            with patch.object(
                self.looker.metadata, "get_reference_by_email"
            ) as mock_get_ref:
                mock_get_ref.return_value = EntityReferenceList(
                    root=[
                        EntityReference(id=uuid.uuid4(), name="Test User", type="user")
                    ]
                )

                # Test get_owner_ref with includeOwners = True
                result = self.looker.get_owner_ref(MOCK_LOOKER_DASHBOARD)

                # Should return owner reference
                self.assertIsNotNone(result)
                self.assertEqual(len(result.root), 1)
                self.assertEqual(result.root[0].name, "Test User")

                # Should have called get_reference_by_email
                mock_get_ref.assert_called_once_with("test@example.com")

    def test_include_owners_flag_disabled(self):
        """
        Test that when includeOwners is False, owner information is not processed
        """
        # Mock the source config to have includeOwners = False
        self.looker.source_config.includeOwners = False

        # Test get_owner_ref with includeOwners = False
        result = self.looker.get_owner_ref(MOCK_LOOKER_DASHBOARD)

        # Should return None when includeOwners is False
        self.assertIsNone(result)

    def test_include_owners_flag_with_no_user_id(self):
        """
        Test that when includeOwners is True but dashboard has no user_id, returns None
        """
        # Mock the source config to have includeOwners = True
        self.looker.source_config.includeOwners = True

        # Create a dashboard with no user_id
        dashboard_no_user = LookerDashboard(
            id="no_user_dashboard",
            title="No User Dashboard",
            dashboard_elements=[],
            description="Dashboard without user",
            user_id=None,  # No user_id
        )

        # Test get_owner_ref with no user_id
        result = self.looker.get_owner_ref(dashboard_no_user)

        # Should return None when there's no user_id
        self.assertIsNone(result)

    def test_include_owners_flag_with_exception(self):
        """
        Test that when includeOwners is True but an exception occurs, it's handled gracefully
        """
        # Mock the source config to have includeOwners = True
        self.looker.source_config.includeOwners = True

        # Mock the client.user method to raise an exception
        with patch.object(
            self.looker.client, "user", side_effect=Exception("API Error")
        ):
            # Test get_owner_ref with exception
            result = self.looker.get_owner_ref(MOCK_LOOKER_DASHBOARD)

            # Should return None when exception occurs
            self.assertIsNone(result)

    def test_build_lineage_for_view(self):
        """
        Test that SQL queries in sql_table_name are correctly parsed to extract table names
        """
        from metadata.ingestion.lineage.parser import LineageParser

        sql_query_sample = """
        (SELECT distinct mapped_dimension,
            dim1_key,  dim1_value,
            dim2_key,  dim2_value,
            dim3_key,  dim3_value,
            friendly_name,
            friendly_name_group,
            display_in_lm,
            CASE WHEN mapped_dimension="page_type" THEN friendly_name END as mapped_page_type_suggestions,
            CASE WHEN mapped_dimension="module" THEN friendly_name END as mapped_module_suggestions
            from `maw-bigquery.maw_views.v_dim_friendly_names`
            ) ;;
        """

        lineage_parser = LineageParser(
            f"create view test_view as {sql_query_sample}",
            Dialect.BIGQUERY,
            timeout_seconds=30,
        )

        self.assertIsNotNone(lineage_parser.source_tables)
        self.assertGreater(len(lineage_parser.source_tables), 0)

        table_names = [str(table) for table in lineage_parser.source_tables]
        self.assertIn("maw-bigquery.maw_views.v_dim_friendly_names", table_names)

    def test_is_sql_query(self):
        """
        Test the _is_sql_query method correctly identifies SQL queries vs table names
        """
        test_query_with_template = """
            (select *
                ,license_name as content_license_name,licensor_id as content_licensor_id
                ,licensor_name as content_licensor_name,provider_name as content_provider_name
                ,content_headline as content_title,uri as content_canonical_url
            from
            {% if _explore._name == 'v_content_rt' or _explore._name == 'sketch_lm_content_fact' %}
                `maw-bigquery.maw.spanner_dim_content`
            {% else %}
                `maw-bigquery.maw_views.v_dim_content`
            {% endif %}
            a
            where {% condition content_uuid %} content_uuid {% endcondition %}
            and {% condition content_title %} REGEXP_REPLACE(content_headline, r"&apos;|&#39;|&#039;", "'") {% endcondition %}
            and {% condition content_byline %} REGEXP_REPLACE(content_byline, r"&apos;|&#39;|&#039;", "'") {% endcondition %}
            and {% condition content_category_cap %} content_category_cap {% endcondition %}
            and {% condition content_category_label %} content_category_label {% endcondition %}
            and {% condition content_canonical_url %} uri {% endcondition %}
            and {% condition content_editor %} content_editor {% endcondition %}
            and {% condition content_language %} content_language {% endcondition %}
            and {% condition content_license_name %} license_name {% endcondition %}
            and {% condition content_licensor_id %} licensor_id {% endcondition %}
            and {% condition content_licensor_name %} licensor_name {% endcondition %}
            and {% condition content_provider_category %} TRIM(provider_category, ' ') {% endcondition %}
            and {% condition content_provider_guid %} content_provider_guid {% endcondition %}
            and {% condition content_provider_id %} provider_id {% endcondition %}
            and {% condition content_provider_name %} provider_name {% endcondition %}
            and {% condition content_provider_url %} provider_url {% endcondition %}
            and {% condition content_region %} CASE WHEN upper(content_region)='GB' THEN 'UK' ELSE upper(content_region) END {% endcondition %}
            and {% condition content_salesforce_id %} content_salesforce_id {% endcondition %}
            and {% condition content_source_url %} content_source_url {% endcondition %}
            and {% condition content_summary %} content_summary {% endcondition %}
            and {% condition content_tags_nested %} lower(ARRAY_TO_STRING(content_tags, '||')) {% endcondition %}
            and {% condition content_thumbnail_url %} content_thumbnail_url {% endcondition %}
            and {% condition editorial_tags_nested %} ARRAY_TO_STRING(ARRAY(select distinct lower(value) from UNNEST(editorial_tags) as value order by 1), "||") {% endcondition %}
            and {% condition secondary_types_nested %} lower(ARRAY_TO_STRING(SPLIT(secondary_types, ''), '||')) {% endcondition %}
            and {% condition editorial_team %} lower(editorial_team) {% endcondition %}
            and {% condition series_name %} series_name {% endcondition %}
            and {% condition subsite %} subsite {% endcondition %}
            and {% condition content_type_raw %} a.content_type {% endcondition %}
            and {% condition content_type %} CASE WHEN length(a.content_type)=2 OR a.content_type='ca_st' OR a.content_type='nca' OR a.content_type='story' THEN 'story'
                        WHEN a.content_type='cluster' THEN NULL
                        WHEN a.content_type='ca_ss' OR a.content_type='slideshow' THEN 'slideshow'
                        WHEN a.content_type IN ('cavideo', 'ca_vd', 'video') THEN 'video'
                        WHEN a.content_type='ca_bp' THEN 'blogpost'
                        WHEN a.content_type='offnet' THEN 'offnet (unknown type)'
                        WHEN a.content_type IS NULL THEN 'unknown'
                        ELSE a.content_type END {% endcondition %}
            and {% condition is_ai_srl %} is_ai_srl {% endcondition %}
            and {% condition provider_site %} provider_site {% endcondition %}
            and {% condition provider_region %} provider_region {% endcondition %}
            and {% condition provider_lang %} is_ai_srl {% endcondition %}
            and {% condition gc_reason %} gc_reason {% endcondition %}
            and {% condition gc_confidence_score %} gc_confidence_score {% endcondition %}
            and {% condition gc_model %} gc_model {% endcondition %}
            and {% condition gc_site %} gc_site {% endcondition %}
            and {% condition gc_region %} gc_region {% endcondition %}
            and {% condition gc_lang %} gc_lang {% endcondition %}
            and {% condition gc_prompt %} gc_prompt {% endcondition %}
            and {% condition commerce_article_type %} commerce_article_type {% endcondition %}
            and {% condition is_commerce_article %} case when commerce_article_type is not null then true else false end {% endcondition %}
            {% if _explore._name == 'v_content_daily' %}
            and {% condition v_content_daily.content_uuid %} content_uuid {% endcondition %}
            {% endif %}
            {% if _view._name == 'v_merged_video' %}
            and {% condition v_merged_video.content_uuid %} content_uuid {% endcondition %}
            and a.content_type IN ("cavideo", "video", "ca_vd")
            {% endif %}
            ) ;;
            """
        rendered_table_name = self.looker._render_table_name(test_query_with_template)
        self.assertTrue(self.looker._is_sql_query(rendered_table_name))
        self.assertTrue(
            self.looker._is_sql_query(
                """
            (SELECT distinct mapped_dimension,
                dim1_key,  dim1_value,
                dim2_key,  dim2_value,
                dim3_key,  dim3_value,
                friendly_name,
                friendly_name_group,
                display_in_lm,
                CASE WHEN mapped_dimension="page_type" THEN friendly_name END as mapped_page_type_suggestions,
                CASE WHEN mapped_dimension="module" THEN friendly_name END as mapped_module_suggestions
                from `maw-bigquery.maw_views.v_dim_friendly_names`
                ) ;;
            """
            )
        )
        self.assertTrue(self.looker._is_sql_query("(SELECT * FROM table)"))
        self.assertTrue(self.looker._is_sql_query("  (SELECT * FROM table)  "))
        self.assertTrue(self.looker._is_sql_query("SELECT * FROM table"))
        self.assertTrue(self.looker._is_sql_query("select * from table"))

        self.assertFalse(self.looker._is_sql_query("my_schema.my_table"))
        self.assertFalse(self.looker._is_sql_query("`project.dataset.table`"))
        self.assertFalse(self.looker._is_sql_query("table_name"))
        self.assertFalse(self.looker._is_sql_query(""))
