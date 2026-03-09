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
from typing import List, Optional, Union

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
PAGE_SIZE = 100


class SsrsClient:
    def __init__(
        self,
        config: SsrsConnection,
        verify_ssl: Optional[Union[bool, str]] = None,
    ):
        self.config = config
        self.base_url = f"{clean_uri(config.hostPort)}/{API_VERSION}"
        self.session = requests.Session()
        if config.username and config.password:
            self.session.auth = HttpNtlmAuth(
                config.username, config.password.get_secret_value()
            )
        self.session.headers.update({"Accept": "application/json"})
        if verify_ssl is not None:
            self.session.verify = verify_ssl

    def close(self) -> None:
        if self.session:
            self.session.close()

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        url = f"{self.base_url}{path}"
        resp = self.session.get(url, timeout=DEFAULT_TIMEOUT, params=params)
        resp.raise_for_status()
        return resp.json()

    def test_access(self) -> None:
        try:
            self._get("/Folders", params={"$top": "1"})
        except Exception as exc:
            raise SourceConnectionException(
                f"Failed to connect to SSRS: {exc}"
            ) from exc

    def get_folders(self) -> List[SsrsFolder]:
        try:
            results: List[SsrsFolder] = []
            skip = 0
            while True:
                data = self._get(
                    "/Folders", params={"$top": str(PAGE_SIZE), "$skip": str(skip)}
                )
                response = SsrsFolderListResponse(**data)
                results.extend(response.value)
                if len(response.value) < PAGE_SIZE:
                    break
                skip += PAGE_SIZE
            return results
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch SSRS folders: %s", exc)
        return []

    def get_reports(self) -> List[SsrsReport]:
        try:
            results: List[SsrsReport] = []
            skip = 0
            while True:
                data = self._get(
                    "/Reports", params={"$top": str(PAGE_SIZE), "$skip": str(skip)}
                )
                response = SsrsReportListResponse(**data)
                results.extend(response.value)
                if len(response.value) < PAGE_SIZE:
                    break
                skip += PAGE_SIZE
            return results
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch SSRS reports: %s", exc)
        return []
