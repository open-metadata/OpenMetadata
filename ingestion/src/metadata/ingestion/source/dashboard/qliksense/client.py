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
import re
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Set

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
    GET_SCRIPT,
    GET_SHEET_LAYOUT,
    GET_TABLES_AND_KEYS,
    OPEN_DOC_REQ,
)
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikDashboard,
    QlikDashboardResult,
    QlikDataModelResult,
    QlikFields,
    QlikScriptResult,
    QlikSheet,
    QlikSheetResult,
    QlikTable,
    QlikTableConnectionProp,
    QlikTablesAndKeysResponse,
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

    def _get_tables_via_get_tables_and_keys(self) -> Optional[List[QlikTable]]:
        """
        Fetch all tables using GetTablesAndKeys API.
        This returns all tables in the app including those
        created via load scripts, not just Data Manager tables.
        """
        resp = self._websocket_send_request(GET_TABLES_AND_KEYS, response=True)
        data = QlikTablesAndKeysResponse(**resp)
        if not data.result or not data.result.qtr:
            return None
        tables = []
        for table_record in data.result.qtr:
            fields = [
                QlikFields(
                    name=field.qName,
                    id=field.qOriginalFieldName or field.qName,
                )
                for field in table_record.qFields or []
            ]
            tables.append(
                QlikTable(
                    tableName=table_record.qName,
                    id=table_record.qName,
                    connectorProperties=table_record.qConnectorProperties
                    or QlikTableConnectionProp(),
                    fields=fields,
                )
            )
        return tables

    def _get_tables_via_load_model(self) -> List[QlikTable]:
        """
        Fallback: fetch tables from the LoadModel object.
        Only returns tables created via Data Manager.
        """
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

    def get_dashboard_models(self) -> List[QlikTable]:
        """
        Get all data model tables for the current app.
        Uses GetTablesAndKeys to capture all tables including
        those created via load scripts.
        Falls back to LoadModel if GetTablesAndKeys fails.
        """
        try:
            tables = self._get_tables_via_get_tables_and_keys()
            if tables is not None:
                return tables
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("GetTablesAndKeys failed, falling back to LoadModel")
        try:
            return self._get_tables_via_load_model()
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard datamodels")
        return []

    def get_script(self) -> Optional[str]:
        """
        Retrieve the load script from the current app
        using the GetScript Engine API.
        """
        try:
            resp = self._websocket_send_request(GET_SCRIPT, response=True)
            script_result = QlikScriptResult(**resp)
            if script_result.result and script_result.result.qScript:
                return script_result.result.qScript
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the app load script")
        return None

    def get_script_tables(self) -> Dict[str, Set[str]]:
        """
        Parse the load script to extract source SQL tables
        for each Qlik table defined in the script.

        Returns a mapping of qlik_table_name -> set of source table names
        found in FROM/JOIN clauses.
        """
        table_source_map: Dict[str, Set[str]] = {}
        script = self.get_script()
        if not script:
            return table_source_map

        sections = re.split(r"(?:^|\n)\s*(?:\[([^\]]+)\]|(\w+))\s*:", script)

        current_table = None
        for i, section in enumerate(sections):
            if section is None:
                continue
            stripped = section.strip()
            if not stripped:
                continue
            if i % 3 in (1, 2):
                current_table = stripped
                continue
            if current_table:
                from_join_tables = re.findall(
                    r"(?:FROM|JOIN)\s+((?:(?:\[[a-zA-Z0-9_ ]+\]|[a-zA-Z0-9_]+)\.)*(?:\[[a-zA-Z0-9_ ]+\]|[a-zA-Z0-9_]+))",
                    stripped,
                    re.IGNORECASE,
                )
                sql_tables = {
                    re.sub(r"[\[\]]", "", t)
                    for t in from_join_tables
                    if "." in re.sub(r"[\[\]]", "", t)
                }
                if sql_tables:
                    table_source_map.setdefault(current_table, set()).update(sql_tables)

        return table_source_map

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
