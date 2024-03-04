"""
REST Auth & Client for Periscope
"""
import json
import traceback
from typing import List, Optional, Dict
from copy import deepcopy

import requests

from metadata.ingestion.source.dashboard.periscope.ometa_client import REST, ClientConfig
from metadata.ingestion.source.dashboard.periscope.connection import PeriscopeConnection
from metadata.ingestion.source.dashboard.periscope.models import (
    PeriscopeDashboard,
    PeriscopeDashboardList,
    PeriscopeDashboardDetails,
    PeriscopeViewList,
    PeriscopeView
)

from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.utils.constants import AUTHORIZATION_HEADER, NO_ACCESS_TOKEN
from metadata.utils.logger import ingestion_logger


logger = ingestion_logger()

SESSION_HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}
DEFAULT_TIMEOUT = 30

class PeriscopeClient:
    """
    Client Handling API communication with Periscope
    """

    def _check_connection(self) -> dict:
        try:
            headers = deepcopy(SESSION_HEADERS)
            headers["cookie"] = self.config.cookies
            self.resp = requests.get(
                f"https://app.periscopedata.com/login_state/dashboards",
                headers=headers,
                timeout=DEFAULT_TIMEOUT,
                params={"client_site_id": self.config.client_site_id},
            )

            if not self.resp.ok:
                msg = "Failed to fetch Periscope, please validate credentials"
                raise SourceConnectionException(msg)

        except Exception as exc:
            msg = f"Unknown error in connection: {exc}."
            raise SourceConnectionException(msg) from exc

        logger.debug(f"Periscope connection status: {self.resp.status_code}")
        return headers

    def __init__(
        self,
        config: PeriscopeConnection,
    ):
        self.config = config
        headers = self._check_connection()

        client_config: ClientConfig = ClientConfig(
            base_url="https://app.periscopedata.com",
            api_version="",
            auth_header="no-auth",
            auth_token=lambda: (NO_ACCESS_TOKEN, 0),
            extra_headers=headers
        )
        self.client = REST(client_config)
        self.cached_dashboard_dict = self.get_cached_dashboard_per_id()

    def get_dashboards_list(self) -> List[PeriscopeDashboard]:
        """
        Get List of all dashboards
        """
        try:
            resp_dashboards = self.client.get(f"login_state/dashboards",
                data={
                    "client_site_id": self.config.client_site_id
                }
            )
            if resp_dashboards:
                dashboard_list = PeriscopeDashboardList.parse_obj(resp_dashboards)
                return dashboard_list.Dashboard
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard list")
        return []

    def get_cached_dashboard_per_id(self) -> Dict[str, PeriscopeDashboard]:
        dashboards = self.get_dashboards_list()
        return {dashboard.id: dashboard for dashboard in dashboards}

    def get_views_list(self) -> List[PeriscopeView]:
        """
        Get List of all views
        """
        try:
            resp_collections = self.client.get("login_state/sql_views", data={"client_site_id": self.config.client_site_id})
            if resp_collections:
                collection_list = PeriscopeViewList.parse_obj(resp_collections)
                return collection_list.SqlView
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the collections list")
        return []

    def get_dashboard_details(
        self, dashboard_id: str
    ) -> Optional[PeriscopeDashboardDetails]:
        """
        Get Dashboard Details
        """
        if not dashboard_id:
            return None  # don't call api if dashboard_id is None
        try:
            resp_dashboard = self.client.get(f"welcome/remaining_widgets",
                data={
                    "current_dashboard": dashboard_id,
                    "client_site_id": self.config.client_site_id
                }
            )
            if resp_dashboard:
                return PeriscopeDashboardDetails(
                    charts=resp_dashboard.get("Widget"),
                    dashboard=self.cached_dashboard_dict[dashboard_id]
                )
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the dashboard with id: {dashboard_id}")
        return None
