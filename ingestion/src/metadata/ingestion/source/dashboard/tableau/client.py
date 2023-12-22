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
Wrapper module of TableauServerConnection client
"""
import math
import traceback
from typing import Any, Callable, Dict, List, Optional

from cached_property import cached_property
from tableau_api_lib import TableauServerConnection
from tableau_api_lib.utils import extract_pages

from metadata.ingestion.source.dashboard.tableau import (
    TABLEAU_GET_VIEWS_PARAM_DICT,
    TABLEAU_GET_WORKBOOKS_PARAM_DICT,
)
from metadata.ingestion.source.dashboard.tableau.models import (
    DataSource,
    TableauChart,
    TableauDashboard,
    TableauDatasources,
    TableauDatasourcesConnection,
    TableauOwner,
)
from metadata.ingestion.source.dashboard.tableau.queries import (
    TABLEAU_DATASOURCES_QUERY,
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
        config: Dict[str, Dict[str, Any]],
        env: str,
        ssl_verify: bool,
        pagination_limit: int,
    ):
        # ssl_verify is typed as a `bool` in TableauServerConnection
        # However, it is passed as `verify=self.ssl_verify` in each `requests` call.
        # In requests (https://requests.readthedocs.io/en/latest/user/advanced.html?highlight=ssl#ssl-cert-verification)
        # the param can be None, False to ignore HTTPS certs or a string with the path to the cert.
        self._client = TableauServerConnection(
            config_json=config,
            env=env,
            ssl_verify=ssl_verify,
        )
        self._client.sign_in().json()
        self.pagination_limit = pagination_limit

    @cached_property
    def server_info(self) -> Callable:
        return self._client.server_info

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

    def test_get_datamodels(self):
        """
        Method to test the datamodels
        """
        data = self._query_datasources(entities_per_page=1, offset=0)
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
        self, entities_per_page: int, offset: int
    ) -> Optional[TableauDatasources]:
        """
        Method to query the graphql endpoint to get data sources
        """
        try:
            datasources_graphql_result = self._client.metadata_graphql_query(
                query=TABLEAU_DATASOURCES_QUERY.format(
                    first=entities_per_page, offset=offset
                )
            )
            if datasources_graphql_result:
                resp = datasources_graphql_result.json()
                if resp and resp.get("data"):
                    tableau_datasource_connection = TableauDatasourcesConnection(
                        **resp.get("data")
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

    def get_datasources(self) -> Optional[List[DataSource]]:
        """
        Paginate and get the list of all data sources
        """
        try:
            # Query the graphql endpoint once to get total count of data sources
            tableau_datasource = self._query_datasources(entities_per_page=1, offset=1)
            entities_per_page = min(50, self.pagination_limit)
            indexes = math.ceil(tableau_datasource.totalCount / entities_per_page)

            # Paginate the results
            data_sources = []
            for index in range(indexes):
                offset = index * entities_per_page
                tableau_datasource = self._query_datasources(
                    entities_per_page=entities_per_page, offset=offset
                )
                if tableau_datasource:
                    data_sources.extend(tableau_datasource.nodes)
            return data_sources
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Unable to fetch Data Sources")
        return None

    def sign_out(self) -> None:
        self._client.sign_out()
