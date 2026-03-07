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
SSRS REST client
"""
import traceback
from typing import List, Optional

import requests
from requests_ntlm import HttpNtlmAuth

from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.ssrs.models import (
    SsrsFolder,
    SsrsFolderListResponse,
    SsrsReport,
    SsrsReportListResponse,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

API_VERSION = "api/v2.0"
DEFAULT_TIMEOUT = 30


class SsrsClient:
    def __init__(self, config: SsrsConnection):
        self.config = config
        self.base_url = f"{clean_uri(str(config.hostPort))}/{API_VERSION}"
        self.session = requests.Session()
        if config.username and config.password:
            self.session.auth = HttpNtlmAuth(
                config.username, config.password.get_secret_value()
            )
        self.session.headers.update({"Accept": "application/json"})

    def _get(self, path: str) -> dict:
        url = f"{self.base_url}{path}"
        resp = self.session.get(url, timeout=DEFAULT_TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def test_access(self):
        try:
            self._get("/Folders")
        except Exception as exc:
            raise SourceConnectionException(
                f"Failed to connect to SSRS: {exc}"
            ) from exc

    def get_folders(self) -> List[SsrsFolder]:
        try:
            data = self._get("/Folders")
            return SsrsFolderListResponse(**data).value
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch SSRS folders")
        return []

    def get_reports(self) -> List[SsrsReport]:
        try:
            data = self._get("/Reports")
            return SsrsReportListResponse(**data).value
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch SSRS reports")
        return []

    def get_report_details(self, report_id: str) -> Optional[SsrsReport]:
        try:
            data = self._get(f"/Reports({report_id})")
            return SsrsReport(**data)
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch report details for id: {report_id}")
        return None
