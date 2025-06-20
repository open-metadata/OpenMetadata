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
from typing import Callable, Dict, Iterable, List, Optional, Tuple, Union

import validators
from cached_property import cached_property
from tableauserverclient import (
    Pager,
    PersonalAccessTokenAuth,
    ProjectItem,
    Server,
    TableauAuth,
    ViewItem,
)

from metadata.ingestion.source.dashboard.tableau.models import (
    CustomSQLTablesResponse,
    DataSource,
    TableauBaseModel,
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


class TableauWorkBookException(Exception):
    """
    Raise when Workbooks information is not retrieved from the Tableau APIs
    """


class TableauChartsException(Exception):
    """
    Raise when Charts information is not retrieved from the Tableau APIs
    """


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

    def __init__(
        self,
        tableau_server_auth: Union[PersonalAccessTokenAuth, TableauAuth],
        config,
        verify_ssl: Union[bool, str],
        pagination_limit: int,
    ):
        self.tableau_server = Server(str(config.hostPort), use_server_version=True)
        if config.apiVersion:
            self.tableau_server.version = config.apiVersion
        self.tableau_server.add_http_options({"verify": verify_ssl})
        self.tableau_server.auth.sign_in(tableau_server_auth)
        self.config = config
        self.pagination_limit = pagination_limit
        self.custom_sql_table_queries: Dict[str, List[str]] = {}
        self.owner_cache: Dict[str, TableauOwner] = {}
        self.all_projects: List[ProjectItem] = []

    @cached_property
    def server_info(self) -> Callable:
        return self.tableau_server.server_info.get

    def server_api_version(self) -> str:
        return self.tableau_server.version

    @property
    def site_id(self) -> str:
        return self.tableau_server.site_id

    def get_tableau_owner(self, owner_id: str) -> Optional[TableauOwner]:
        try:
            if owner_id in self.owner_cache:
                return self.owner_cache[owner_id]
            owner = self.tableau_server.users.get_by_id(owner_id) if owner_id else None
            if owner and owner.email:
                owner_obj = TableauOwner(
                    id=owner.id, name=owner.name, email=owner.email
                )
                self.owner_cache[owner_id] = owner_obj
                return owner_obj
        except Exception as err:
            logger.debug(f"Failed to fetch owner details for ID {owner_id}: {str(err)}")
        return None

    def get_workbook_charts_and_user_count(
        self, views: List[ViewItem]
    ) -> Optional[Tuple[Optional[int], Optional[List[TableauChart]]]]:
        """
        Fetches workbook charts and dashboard user view count
        """
        view_count = 0
        charts: Optional[List[TableauChart]] = []
        for view in views or []:
            try:
                charts.append(
                    TableauChart(
                        id=view.id,
                        name=view.name,
                        tags=view.tags,
                        owner=self.get_tableau_owner(view.owner_id),
                        contentUrl=view.content_url,
                        sheetType=view.sheet_type,
                    )
                )
                view_count += view.total_views
            except AttributeError as e:
                logger.debug(
                    f"Failed to process view due to missing attribute: {str(e)}"
                )
                continue
            except Exception as e:
                logger.debug(f"Failed to process view: {str(e)}")
                continue

        return charts, view_count

    def get_all_projects(self) -> None:
        """
        Get all projects from the tableau server
        """
        try:
            logger.debug("Getting all projects from the tableau server")
            all_projects: List[ProjectItem] = []
            for project in Pager(self.tableau_server.projects):
                all_projects.append(project)
            self.all_projects = all_projects
        except Exception as e:
            logger.debug(f"Failed to get all projects: {str(e)}")

    def get_project_parents_by_id(self, project_id: str) -> Optional[str]:
        """
        Get the parents of a project by id
        """
        try:
            parent_projects = []
            current_project_id = project_id

            while current_project_id:
                # Find project with current ID
                project = next(
                    (
                        proj
                        for proj in self.all_projects
                        if str(proj.id) == str(current_project_id)
                    ),
                    None,
                )

                if not project:
                    break

                parent_projects.append(project.name)

                # Get parent ID and continue loop if exists
                current_project_id = (
                    project.parent_id if hasattr(project, "parent_id") else None
                )

            if parent_projects:
                parent_projects = ".".join(reversed(parent_projects))
                return parent_projects
        except Exception as e:
            logger.debug(f"Failed to get project parents by id: {str(e)}")
        return None

    def get_workbooks(self) -> Iterable[TableauDashboard]:
        """
        Fetch all tableau workbooks
        """
        self.get_all_projects()
        self.cache_custom_sql_tables()
        for workbook in Pager(self.tableau_server.workbooks):
            try:
                self.tableau_server.workbooks.populate_views(workbook, usage=True)
                charts, user_views = self.get_workbook_charts_and_user_count(
                    workbook.views
                )
                workbook = TableauDashboard(
                    id=workbook.id,
                    name=workbook.name,
                    project=TableauBaseModel(
                        id=workbook.project_id, name=workbook.project_name
                    ),
                    owner=self.get_tableau_owner(workbook.owner_id),
                    description=workbook.description,
                    tags=workbook.tags,
                    webpageUrl=workbook.webpage_url,
                    charts=charts,
                    user_views=user_views,
                )
                yield workbook
            except AttributeError as err:
                logger.warning(
                    f"Failed to process workbook due to missing attribute: {str(err)}"
                )
                continue
            except Exception as err:
                logger.warning(f"Failed to process workbook: {str(err)}")
                continue

    def test_get_workbooks(self):
        for workbook in Pager(self.tableau_server.workbooks):
            if workbook.id is not None:
                self.tableau_server.workbooks.populate_views(workbook, usage=True)
                return workbook
            break
        raise TableauWorkBookException(
            "Unable to fetch Dashboards from tableau\n"
            "Please check if the user has permissions to access the Dashboards information"
        )

    def test_get_workbook_views(self):
        workbook = self.test_get_workbooks()
        charts, _ = self.get_workbook_charts_and_user_count(workbook.views)
        if charts:
            return True
        raise TableauChartsException(
            "Unable to fetch Charts from tableau\n"
            "Please check if the user has permissions to access the Charts information"
        )

    def test_get_owners(self) -> Optional[List[TableauOwner]]:
        workbook = self.test_get_workbooks()
        owners = self.get_tableau_owner(workbook.owner_id)
        if owners is not None:
            return owners
        raise TableauOwnersNotFound(
            "Unable to fetch Dashboard Owners from tableau\n"
            "Please check if the user has permissions to access the Owner information"
        )

    def test_site_url(self):
        """
        Method to test the site url and site name fields
        """
        validation = validators.url(self.config.siteName)
        if validation:
            raise ValueError(
                f"""
            The site url "{self.config.siteName}" is in incorrect format.
            If "https://xxx.tableau.com/#/site/MarketingTeam/home" represents the homepage url for your tableau site,
            the "MarketingTeam" from the url should be entered in the Site Name and Site Url fields.
            """
            )
        return True

    def test_get_datamodels(self):
        """
        Method to test the datamodels
        """
        workbook = self.test_get_workbooks()

        if workbook.id is None:
            raise TableauDataModelsException(
                "Unable to get any workbooks to fetch tableau data sources"
            )

        # Take the 1st workbook's id and pass to the graphql query
        data = self._query_datasources(
            dashboard_id=workbook.id, entities_per_page=1, offset=0
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
            datasources_graphql_result = self.tableau_server.metadata.query(
                query=TABLEAU_DATASOURCES_QUERY.format(
                    workbook_id=dashboard_id, first=entities_per_page, offset=offset
                )
            )
            if datasources_graphql_result:
                if datasources_graphql_result and datasources_graphql_result.get(
                    "data"
                ):
                    tableau_datasource_connection = TableauDatasourcesConnection(
                        **datasources_graphql_result["data"]["workbooks"][0]
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
        return []

    def get_custom_sql_table_queries(self, datasource_id: str) -> Optional[List[str]]:
        """
        Get custom SQL table queries for a specific dashboard/workbook ID
        """
        logger.debug(f"Getting custom SQL table queries for datasource {datasource_id}")

        if datasource_id in self.custom_sql_table_queries:
            logger.debug(f"Found cached queries for datasource {datasource_id}")
            return self.custom_sql_table_queries[datasource_id]
        logger.debug(f"No cached queries for datasource {datasource_id}")
        return None

    def cache_custom_sql_tables(self) -> None:
        """
        Fetch all custom SQL tables and cache their queries by workbook ID
        """
        try:
            result = self.tableau_server.metadata.query(
                query=TALEAU_GET_CUSTOM_SQL_QUERY
            )
            if not result:
                logger.debug("No result returned from GraphQL query")
                return

            response = CustomSQLTablesResponse(**result)
            if not response.data:
                logger.debug("No data found in GraphQL response")
                return

            for tables in response.data.values():
                for table in tables:
                    if not (table.query and table.downstreamDatasources):
                        logger.debug(
                            f"Skipping table {table} - missing query or workbooks"
                        )
                        continue

                    query = table.query
                    for datasource in table.downstreamDatasources:
                        self.custom_sql_table_queries.setdefault(
                            datasource.id, []
                        ).append(query)

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Unable to fetch Custom SQL Tables")

    def sign_out(self) -> None:
        self.tableau_server.auth.sign_out()
