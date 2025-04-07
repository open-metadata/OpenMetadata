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
Websocket Auth & Client for QlikSense
"""
import json
import traceback
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import ValidationError

from metadata.generated.schema.entity.services.connections.dashboard.qlikSenseConnection import (
    QlikCertificatePath,
    QlikCertificateValues,
    QlikSenseConnection,
)
from metadata.ingestion.source.dashboard.qliksense.constants import (
    APP_LOADMODEL_REQ,
    CREATE_SHEET_SESSION,
    GET_DOCS_LIST_REQ,
    GET_LOADMODEL_LAYOUT,
    GET_SHEET_LAYOUT,
    OPEN_DOC_REQ,
)
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikDashboard,
    QlikDashboardResult,
    QlikDataModelResult,
    QlikSheet,
    QlikSheetResult,
    QlikTable,
)
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()

QLIK_USER_HEADER = "X-Qlik-User"


class QlikSenseClient:
    """
    Client Handling API communication with Qlik Engine APIs
    """

    def _clean_cert_value(self, cert_data: str) -> str:
        return cert_data.replace("\\n", "\n")

    def write_data_to_file(self, file_path: Path, cert_data: str) -> None:
        with open(
            file_path,
            "w+",
            encoding=UTF_8,
        ) as file:
            data = self._clean_cert_value(cert_data)

            file.write(data)

    def _get_ssl_context(self) -> Optional[dict]:
        if isinstance(self.config.certificates, QlikCertificatePath):
            context = {
                "ca_certs": self.config.certificates.rootCertificate,
                "certfile": self.config.certificates.clientCertificate,
                "keyfile": self.config.certificates.clientKeyCertificate,
                "check_hostname": self.config.validateHostName,
            }
            return context

        self.ssl_manager = SSLManager(
            ca=self.config.certificates.sslConfig.root.caCertificate,
            cert=self.config.certificates.sslConfig.root.sslCertificate,
            key=self.config.certificates.sslConfig.root.sslKey,
        )

        return self.ssl_manager.setup_ssl(self.config)

    def connect_websocket(self, app_id: str = None) -> None:
        """
        Method to initialise websocket connection
        """
        # pylint: disable=import-outside-toplevel
        import ssl

        from websocket import create_connection

        if self.socket_connection:
            self.socket_connection.close()

        ssl_conext = self._get_ssl_context()
        ssl.match_hostname = lambda cert, hostname: True
        self.socket_connection = create_connection(
            f"{clean_uri(self.config.hostPort)}/app/{app_id or ''}",
            sslopt=ssl_conext,
            header={
                f"{QLIK_USER_HEADER}: "
                f"UserDirectory={self.config.userDirectory}; UserId={self.config.userId}"
            },
        )
        if app_id:
            # get doc list needs to be executed before extracting data from app
            self.get_dashboards_list(create_new_socket=False)

    def close_websocket(self) -> None:
        if self.socket_connection:
            self.socket_connection.close()

        if isinstance(self.config.certificates, QlikCertificateValues):
            self.ssl_manager.cleanup_temp_files()

    def __init__(
        self,
        config: QlikSenseConnection,
    ) -> None:
        self.config = config
        self.socket_connection = None

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

    def get_dashboards_list(
        self, create_new_socket: bool = True
    ) -> List[QlikDashboard]:
        """
        Get List of all dashboards
        """
        try:
            if create_new_socket:
                self.connect_websocket()
            self._websocket_send_request(GET_DOCS_LIST_REQ)
            resp = self.socket_connection.recv()
            dashboard_result = QlikDashboardResult(**json.loads(resp))
            return dashboard_result.result.qDocList
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard list")
        return []

    def get_dashboard_charts(self, dashboard_id: str) -> List[QlikSheet]:
        """
        Get dahsboard chart list
        """
        try:
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

    def get_dashboard_models(self) -> List[QlikTable]:
        """
        Get dahsboard chart list
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

    def get_dashboard_for_test_connection(self):
        try:
            self.connect_websocket()
            self._websocket_send_request(GET_DOCS_LIST_REQ)
            resp = self.socket_connection.recv()
            self.close_websocket()
            return QlikDashboardResult(**json.loads(resp))
        except ValidationError:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard datamodels")
        return None
