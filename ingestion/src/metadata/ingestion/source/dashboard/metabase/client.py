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
REST Auth & Client for Metabase
"""
import json
import traceback
from typing import Dict, List, Optional

import requests

from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.metabase.models import (
    MetabaseChart,
    MetabaseCollection,
    MetabaseCollectionList,
    MetabaseDashboard,
    MetabaseDashboardDetails,
    MetabaseDashboardList,
    MetabaseDatabase,
    MetabaseTable,
    MetabaseUser,
)
from metadata.utils.constants import (
    AUTHORIZATION_HEADER,
    DEFAULT_DASHBAORD,
    NO_ACCESS_TOKEN,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

USERNAME_HEADER = "username"
PASSWORD_HEADER = "password"
SESSION_HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}
DEFAULT_TIMEOUT = 30
METABASE_SESSION_HEADER = "X-Metabase-Session"
API_VERSION = "api"


class MetabaseClient:
    """
    Client Handling API communication with Metabase
    """

    def _get_metabase_session(self) -> str:
        try:
            params = {USERNAME_HEADER: self.config.username}
            if self.config.password:
                params[PASSWORD_HEADER] = self.config.password.get_secret_value()
            self.resp = requests.post(
                f"{self.config.hostPort}{API_VERSION}/session/",
                data=json.dumps(params),
                headers=SESSION_HEADERS,
                timeout=DEFAULT_TIMEOUT,
            )
            return self.resp.json()["id"]

        except KeyError as exe:
            msg = "Failed to fetch metabase session, please validate credentials"
            raise SourceConnectionException(msg) from exe

        except Exception as exc:
            msg = f"Unknown error in connection: {exc}."
            raise SourceConnectionException(msg) from exc

    def __init__(
        self,
        config: MetabaseConnection,
    ):
        self.config = config
        session_token = self._get_metabase_session()
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(str(self.config.hostPort)),
            api_version=API_VERSION,
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (NO_ACCESS_TOKEN, 0),
            extra_headers={METABASE_SESSION_HEADER: session_token},
        )
        self.client = REST(client_config)

    def get_dashboards_list(
        self, collections: List[MetabaseCollection]
    ) -> List[MetabaseDashboard]:
        """
        Get List of all dashboards
        """
        dashboards = []
        for collection in collections or []:
            try:
                resp_dashboards = self.client.get(
                    f"/collection/{collection.id}/items?models=dashboard"
                )
                if resp_dashboards:
                    dashboard_list = MetabaseDashboardList(**resp_dashboards)
                    dashboards.extend(dashboard_list.data)
            except Exception:
                logger.debug(traceback.format_exc())
                logger.warning("Failed to fetch the dashboard list")
        return dashboards

    def get_dashboards_list_test_conn(
        self, collections: List[MetabaseCollection]
    ) -> List[MetabaseDashboard]:
        """
        Get List of all dashboards
        """
        for collection in collections or []:
            resp_dashboards = self.client.get(
                f"/collection/{collection.id}/items?models=dashboard"
            )
            if resp_dashboards:
                dashboard_list = MetabaseDashboardList(**resp_dashboards)
                return dashboard_list.data
        return []

    def get_collections_list_test_conn(self) -> List[MetabaseCollection]:
        """
        Get List of all collections
        """
        resp_collections = self.client.get("/collection")
        if resp_collections:
            collection_list = MetabaseCollectionList(collections=resp_collections)
            return collection_list.collections
        return []

    def get_collections_list(self) -> List[MetabaseCollection]:
        """
        Get List of all collections
        """
        try:
            resp_collections = self.client.get("/collection")
            if resp_collections:
                collection_list = MetabaseCollectionList(collections=resp_collections)
                return collection_list.collections
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the collections list")
        return []

    def get_charts_dict(self) -> Dict:
        charts_dict = {}
        try:
            resp_charts = self.client.get("/card")
            if resp_charts:
                for chart_data in resp_charts:
                    chart = MetabaseChart.model_validate(chart_data)
                    charts_dict[chart.id] = chart
            return charts_dict
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the cards")
        return {}

    def _create_default_dashboard_details(
        self, orphan_charts_id: List
    ) -> MetabaseDashboardDetails:
        """
        Returns:
            MetabaseDashboardDetails object representing the default dashboard containing orphaned charts
        """
        return MetabaseDashboardDetails(
            id=DEFAULT_DASHBAORD,
            card_ids=orphan_charts_id,
        )

    def _process_dashboard_response(
        self, resp_dashboard: Dict, charts_dict: Dict, dashboard_id: str
    ) -> MetabaseDashboardDetails:
        """
        Process dashboard response and create MetabaseDashboardDetails object
        """
        if "ordered_cards" in resp_dashboard:
            resp_dashboard["dashcards"] = resp_dashboard["ordered_cards"]

        card_ids = []
        for card in resp_dashboard.get("dashcards", []):
            if card.get("card") and card["card"].get("id"):
                card_id = str(card["card"]["id"])
                card_ids.append(card_id)
                if card_id in charts_dict:
                    charts_dict[card_id].dashboard_ids.append(dashboard_id)

        return MetabaseDashboardDetails(
            description=resp_dashboard.get("description"),
            name=resp_dashboard.get("name"),
            id=resp_dashboard.get("id"),
            creator_id=resp_dashboard.get("creator_id"),
            collection_id=resp_dashboard.get("collection_id"),
            card_ids=card_ids,
        )

    def get_dashboard_details(
        self, dashboard_id: str, charts_dict: Dict, orphan_charts_id: List
    ) -> Optional[MetabaseDashboardDetails]:
        """
        Get Dashboard Details
        """
        if not dashboard_id:
            return None  # don't call api if dashboard_id is None
        if dashboard_id == DEFAULT_DASHBAORD:
            return self._create_default_dashboard_details(orphan_charts_id)
        try:
            resp_dashboard = self.client.get(f"/dashboard/{dashboard_id}")
            if resp_dashboard:
                # Small hack needed to support Metabase versions older than 0.48
                # https://www.metabase.com/releases/metabase-48#fyi--breaking-changes
                return self._process_dashboard_response(
                    resp_dashboard, charts_dict, dashboard_id
                )
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the dashboard with id: {dashboard_id}")
        return None

    def get_database(self, database_id: str) -> Optional[MetabaseDatabase]:
        """
        Get Database using database ID
        """
        if not database_id:
            return None  # don't call api if database_id is None
        try:
            resp_database = self.client.get(f"/database/{database_id}")
            if resp_database:
                return MetabaseDatabase(**resp_database)
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the database with id: {database_id}")
        return None

    def get_table(self, table_id: str) -> Optional[MetabaseTable]:
        """
        Get Table using table ID
        """
        if not table_id:
            return None  # don't call api if table_id is None
        try:
            resp_table = self.client.get(f"/table/{table_id}")
            if resp_table:
                return MetabaseTable(**resp_table)
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the table with id: {table_id}")
        return None

    def get_user_details(self, user_id: str) -> Optional[MetabaseUser]:
        """
        Get User using user ID
        """
        if not user_id:
            return None  # don't call api if table_id is None
        try:
            resp_table = self.client.get(f"/user/{user_id}")
            if resp_table:
                return MetabaseUser(**resp_table)
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the user with id: {user_id}")
        return None
