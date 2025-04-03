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
REST Auth & Client for QlikCloud
"""
import json
import traceback
from typing import Dict, Iterable, List, Optional

from metadata.generated.schema.entity.services.connections.dashboard.qlikCloudConnection import (
    QlikCloudConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.qlikcloud.constants import (
    APP_LOADMODEL_REQ,
    CREATE_SHEET_SESSION,
    GET_LOADMODEL_LAYOUT,
    GET_SHEET_LAYOUT,
    OPEN_DOC_REQ,
)
from metadata.ingestion.source.dashboard.qlikcloud.models import (
    QlikApp,
    QlikAppResponse,
    QlikSpace,
    QlikSpaceResponse,
)
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikDataModelResult,
    QlikSheet,
    QlikSheetResult,
    QlikTable,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

API_VERSION = "api"
API_LIMIT = 100


class QlikCloudClient:
    """
    Client Handling API communication with QlikCloud
    """

    def __init__(
        self,
        config: QlikCloudConnection,
    ):
        self.config = config
        self.socket_connection = None

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
            api_version=API_VERSION,
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (self.config.token.get_secret_value(), 0),
        )
        self.client = REST(client_config)

    def connect_websocket(self, dashboard_id: str = None) -> None:
        """
        Method to initialise websocket connection
        """
        # pylint: disable=import-outside-toplevel
        import ssl

        from websocket import create_connection

        if self.socket_connection:
            self.socket_connection.close()
        self.socket_connection = create_connection(
            f"wss://{clean_uri(self.config.hostPort.host)}/app/{dashboard_id or ''}",
            sslopt={"cert_reqs": ssl.CERT_NONE},
            header={"Authorization": f"Bearer {self.config.token.get_secret_value()}"},
        )
        self.socket_connection.recv()

    def close_websocket(self) -> None:
        if self.socket_connection:
            self.socket_connection.close()

    def _websocket_send_request(
        self, request: dict, response: bool = False
    ) -> Optional[Dict]:
        """
        Method to send request to websocket

        request: data required to be sent to websocket
        response: is json response required?
        """
        self.socket_connection.send(json.dumps(request))
        resp = self.socket_connection.recv()
        if response:
            return json.loads(resp)
        return None

    def get_dashboard_charts(self, dashboard_id: str) -> List[QlikSheet]:
        """
        Get dashboard chart list
        """
        try:
            self.connect_websocket(dashboard_id)
            OPEN_DOC_REQ.update({"params": [dashboard_id]})
            self._websocket_send_request(OPEN_DOC_REQ)
            self._websocket_send_request(CREATE_SHEET_SESSION)
            sheets = self._websocket_send_request(GET_SHEET_LAYOUT, response=True)
            data = QlikSheetResult(**sheets)
            return data.result.qLayout.qAppObjectList.qItems
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard charts")
        return []

    def get_dashboards_list(self) -> Iterable[QlikApp]:
        """
        Get List of all apps
        """
        try:
            link = f"/v1/items?resourceType=app&limit={API_LIMIT}"
            while True:
                resp_apps = self.client.get(link)
                if resp_apps:
                    resp = QlikAppResponse(**resp_apps)
                    yield from resp.apps
                    if resp.links and resp.links.next and resp.links.next.href:
                        link = resp.links.next.href.replace(
                            f"{self.config.hostPort}{API_VERSION}", ""
                        )
                    else:
                        break
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the app list")

    def get_dashboards_list_test_conn(self) -> Iterable[QlikApp]:
        resp_apps = self.client.get("/v1/items?resourceType=app")
        if resp_apps:
            resp = QlikAppResponse(**resp_apps)
            return list(resp.apps)

    def get_dashboard_details(self, dashboard_id: str) -> Optional[QlikApp]:
        """
        Get App Details
        """
        if not dashboard_id:
            return None  # don't call api if dashboard_id is None
        try:
            resp_dashboard = self.client.get(f"/v1/apps/{dashboard_id}")
            if resp_dashboard:
                return QlikApp(**resp_dashboard.get("attributes"))
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the dashboard with id: {dashboard_id}")
        return None

    def get_dashboard_models(self) -> List[QlikTable]:
        """
        Get dashboard data models
        """
        try:
            self._websocket_send_request(APP_LOADMODEL_REQ)
            models = self._websocket_send_request(GET_LOADMODEL_LAYOUT, response=True)
            data_models = QlikDataModelResult(**models)
            layout = data_models.result.qLayout
            if isinstance(layout, list):
                tables = []
                for layout in data_models.result.qLayout:
                    tables.extend(layout.value.tables)
                return tables
            return layout.tables
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard datamodels")
        return []

    def get_projects_list(self) -> Iterable[QlikSpace]:
        """
        Get list of all spaces
        """
        try:
            link = f"/v1/spaces?limit={API_LIMIT}"
            while True:
                resp_spaces = self.client.get(link)
                if resp_spaces:
                    resp = QlikSpaceResponse(**resp_spaces)
                    yield from resp.spaces
                    if resp.links and resp.links.next and resp.links.next.href:
                        link = resp.links.next.href.replace(
                            f"{self.config.hostPort}{API_VERSION}", ""
                        )
                    else:
                        break
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the space list")
