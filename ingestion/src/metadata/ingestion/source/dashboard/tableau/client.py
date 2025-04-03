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
Wrapper module of TableauServerConnection client
"""
import math
import traceback
from typing import Any, Callable, Dict, List, Optional

import pandas as pd
import validators
from cached_property import cached_property
from packaging import version
from tableau_api_lib import TableauServerConnection
from tableau_api_lib.utils import extract_pages, flatten_dict_column
from tableau_api_lib.utils.querying import get_views_dataframe

from metadata.ingestion.source.dashboard.tableau import (
    TABLEAU_GET_VIEWS_PARAM_DICT,
    TABLEAU_GET_WORKBOOKS_PARAM_DICT,
)
from metadata.ingestion.source.dashboard.tableau.models import (
    CustomSQLTablesResponse,
    DataSource,
    TableauChart,
    TableauDashboard,
    TableauDatasources,
    TableauDatasourcesConnection,
    TableauOwner,
)
from metadata.ingestion.source.dashboard.tableau.queries import (
    TABLEAU_DATASOURCES_QUERY,
    TALEAU_GET_CUSTOM_SQL_QUERY,
)
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class TableauOwnersNotFound(Exception):
    """
    Raise when Owner information is not retrieved from the Tableau APIs
    """


class TableauDataModelsException(Exception):
    """
    Raise when Data Source information is not retrieved from the Tableau Graphql Query
    """


class TableauClient:
    """
    Wrapper to TableauServerConnection
    """

    _client: TableauServerConnection

    def __init__(
        self,
        tableau_server_config: Dict[str, Dict[str, Any]],
        config,
        env: str,
        ssl_verify: bool,
        pagination_limit: int,
    ):
        # ssl_verify is typed as a `bool` in TableauServerConnection
        # However, it is passed as `verify=self.ssl_verify` in each `requests` call.
        # In requests (https://requests.readthedocs.io/en/latest/user/advanced.html?highlight=ssl#ssl-cert-verification)
        # the param can be None, False to ignore HTTPS certs or a string with the path to the cert.
        self._client = TableauServerConnection(
            config_json=tableau_server_config,
            env=env,
            ssl_verify=ssl_verify,
        )
        self.config = config
        self._client.sign_in().json()
        self.pagination_limit = pagination_limit
        self.custom_sql_table_queries: Dict[str, List[str]] = {}
        self.usage_metrics: Dict[str, int] = {}

    @cached_property
    def server_info(self) -> Callable:
        return self._client.server_info

    @property
    def server_api_version(self) -> str:
        return self.server_info().json()["serverInfo"]["restApiVersion"]

    @property
    def site_id(self) -> str:
        return self._client.site_id

    @property
    def query_workbooks_for_site(self) -> Callable:
        return self._client.query_workbooks_for_site

    @property
    def query_views_for_site(self) -> Callable:
        return self._client.query_views_for_site

    def get_owners(self) -> Optional[List[TableauOwner]]:
        owners = [workbook.owner for workbook in self.get_workbooks()]
        if len(owners) > 0:
            return owners
        raise TableauOwnersNotFound(
            "Unable to fetch Dashboard Owners from tableau\n"
            "Please check if the user has permissions to access the Owner information"
        )

    def get_all_workbook_usage_metrics(self) -> None:
        """
        Get the usage metrics for all workbook and store it in self.usage_metrics
        """
        try:
            views_df = get_views_dataframe(self._client, all_fields=False)
            if views_df.empty:
                logger.debug("No views data found to process usage metrics.")
                return

            if "workbook" not in views_df.columns:
                logger.debug("Expected 'workbook' column not found in views data.")
                return

            usage_views_df = flatten_dict_column(
                df=views_df, keys=["id"], col_name="workbook"
            )

            if (
                "workbook_id" not in usage_views_df.columns
                or "usage_totalViewCount" not in usage_views_df.columns
            ):
                logger.debug(
                    "Expected columns 'workbook_id' or 'usage_totalViewCount' not found after flattening."
                )
                return

            usage_views_df = usage_views_df[["workbook_id", "usage_totalViewCount"]]
            usage_views_df = (
                usage_views_df.groupby("workbook_id", as_index=False)[
                    "usage_totalViewCount"
                ]
                .apply(lambda x: pd.to_numeric(x, errors="coerce").astype(int).sum())
                .reset_index()
            )
            self.usage_metrics.update(
                usage_views_df.set_index("workbook_id")[
                    "usage_totalViewCount"
                ].to_dict()
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing workbook usage metrics: {exc}")

    def get_workbook_view_count_by_id(self, workbook_id: str) -> Optional[int]:
        """
        Get a workbook view count by dashboard_id
        """
        if not self.usage_metrics:
            self.get_all_workbook_usage_metrics()
        return self.usage_metrics.get(workbook_id)

    def get_workbooks(self) -> List[TableauDashboard]:
        return [
            TableauDashboard(**workbook)
            for workbook in extract_pages(
                self.query_workbooks_for_site,
                parameter_dict=TABLEAU_GET_WORKBOOKS_PARAM_DICT,
            )
        ]

    def get_charts(self) -> List[TableauChart]:
        # For charts, we can also pick up usage as a field
        return [
            TableauChart(**chart)
            for chart in extract_pages(
                self.query_views_for_site,
                content_id=self.site_id,
                parameter_dict=TABLEAU_GET_VIEWS_PARAM_DICT,
            )
        ]

    def get_workbook_charts(self, dashboard_id: str) -> Optional[List[TableauChart]]:
        """
        Get the charts for a workbook
        """
        try:
            return [
                TableauChart(**chart)
                for chart in self._client.query_views_for_workbook(
                    workbook_id=dashboard_id,
                    parameter_dict=TABLEAU_GET_VIEWS_PARAM_DICT,
                ).json()["views"]["view"]
            ]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error processing charts for dashboard [{dashboard_id}]: {exc}"
            )
        return None

    def test_api_version(self):
        """
        Method to validate the declared v/s server tableau rest api version
        """
        server_api_version = version.parse(self.server_api_version)
        declared_api_version = version.parse(self.config.apiVersion)
        if declared_api_version > server_api_version:
            raise ValueError(
                f"""
            Your API version of '{declared_api_version}' is too damn high!
            The server you are establishing a connection with is using REST API version '{server_api_version}'.
            """
            )
        if declared_api_version < server_api_version:
            raise ValueError(
                f"""
            The Tableau Server REST API version you specified is lower than the version your server uses.
            Your Tableau Server is on REST API version {server_api_version}.
            The REST API version you specified is {declared_api_version}.
            For optimal results, please change the 'api_version' config variable to {server_api_version}.
            """
            )

    def test_site_url(self):
        """
        Method to test the site url and site name fields
        """
        validation = validators.url(self.config.siteUrl)
        if validation:
            raise ValueError(
                f"""
            The site url "{self.config.siteUrl}" is in incorrect format.
            If "https://xxx.tableau.com/#/site/MarketingTeam/home" represents the homepage url for your tableau site,
            the "MarketingTeam" from the url should be entered in the Site Name and Site Url fields.
            """
            )
        return True

    def test_get_datamodels(self):
        """
        Method to test the datamodels
        """
        workbooks = self.get_workbooks()

        if len(workbooks) == 0:
            raise TableauDataModelsException(
                "Unable to get any workbooks to fetch tableau data sources"
            )

        # Take the 1st workbook's id and pass to the graphql query
        test_workbook = workbooks[0]
        data = self._query_datasources(
            dashboard_id=test_workbook.id, entities_per_page=1, offset=0
        )
        if data:
            return data
        raise TableauDataModelsException(
            "Unable to fetch Data Sources from tableau\n"
            "Please check if the Tableau Metadata APIs are enabled for you Tableau instance\n"
            "For more information on enabling the Tableau Metadata APIs follow the link below\n"
            "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html"
            "#enable-the-tableau-metadata-api-for-tableau-server\n"
        )

    def _query_datasources(
        self, dashboard_id: str, entities_per_page: int, offset: int
    ) -> Optional[TableauDatasources]:
        """
        Method to query the graphql endpoint to get data sources
        """
        try:
            datasources_graphql_result = self._client.metadata_graphql_query(
                query=TABLEAU_DATASOURCES_QUERY.format(
                    workbook_id=dashboard_id, first=entities_per_page, offset=offset
                )
            )
            if datasources_graphql_result:
                resp = datasources_graphql_result.json()
                if resp and resp.get("data"):
                    tableau_datasource_connection = TableauDatasourcesConnection(
                        **resp["data"]["workbooks"][0]
                    )
                    return tableau_datasource_connection.embeddedDatasourcesConnection
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                "\nSomething went wrong while connecting to Tableau Metadata APIs\n"
                "Please check if the Tableau Metadata APIs are enabled for you Tableau instance\n"
                "For more information on enabling the Tableau Metadata APIs follow the link below\n"
                "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html"
                "#enable-the-tableau-metadata-api-for-tableau-server\n"
            )
        return None

    def get_datasources(self, dashboard_id: str) -> Optional[List[DataSource]]:
        """
        Paginate and get the list of all data sources of the workbook
        """
        try:
            # Query the graphql endpoint once to get total count of data sources
            tableau_datasource = self._query_datasources(
                dashboard_id=dashboard_id, entities_per_page=1, offset=1
            )
            entities_per_page = min(50, self.pagination_limit)
            indexes = math.ceil(tableau_datasource.totalCount / entities_per_page)

            # Paginate the results
            data_sources = []
            for index in range(indexes):
                offset = index * entities_per_page
                tableau_datasource = self._query_datasources(
                    dashboard_id=dashboard_id,
                    entities_per_page=entities_per_page,
                    offset=offset,
                )
                if tableau_datasource:
                    data_sources.extend(tableau_datasource.nodes)
            return data_sources
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Unable to fetch Data Sources")
        return None

    def get_custom_sql_table_queries(self, dashboard_id: str) -> Optional[List[str]]:
        """
        Get custom SQL table queries for a specific dashboard/workbook ID
        """
        logger.debug(f"Getting custom SQL table queries for dashboard {dashboard_id}")

        if dashboard_id in self.custom_sql_table_queries:
            logger.debug(f"Found cached queries for dashboard {dashboard_id}")
            return self.custom_sql_table_queries[dashboard_id]

        return None

    def cache_custom_sql_tables(self) -> None:
        """
        Fetch all custom SQL tables and cache their queries by workbook ID
        """
        try:
            result = self._client.metadata_graphql_query(
                query=TALEAU_GET_CUSTOM_SQL_QUERY
            )
            if not result or not (response_json := result.json()):
                logger.debug("No result returned from GraphQL query")
                return

            response = CustomSQLTablesResponse(**response_json)
            if not response.data:
                logger.debug("No data found in GraphQL response")
                return

            for tables in response.data.values():
                for table in tables:
                    if not (table.query and table.downstreamWorkbooks):
                        logger.debug(
                            f"Skipping table {table} - missing query or workbooks"
                        )
                        continue

                    query = table.query
                    for workbook in table.downstreamWorkbooks:
                        self.custom_sql_table_queries.setdefault(
                            workbook.luid, []
                        ).append(query)

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Unable to fetch Custom SQL Tables")

    def sign_out(self) -> None:
        self._client.sign_out()
