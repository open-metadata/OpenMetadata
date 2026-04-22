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
from typing import Iterable, Iterator, Optional, Union

import requests
from requests.adapters import HTTPAdapter
from requests_ntlm import HttpNtlmAuth
from urllib3.util.retry import Retry

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
CONNECT_TIMEOUT = 10
READ_TIMEOUT = 120
PAGE_SIZE = 100
MAX_RETRIES = 2
BACKOFF_FACTOR = 1
RETRY_STATUS_CODES = (500, 502, 503, 504)
REPORT_SELECT_FIELDS = "Id,Name,Path,Description,Type,Hidden,HasDataSources"
FOLDER_SELECT_FIELDS = "Id,Name,Path"


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
        retry = Retry(
            total=MAX_RETRIES,
            connect=MAX_RETRIES,
            read=MAX_RETRIES,
            status=MAX_RETRIES,
            backoff_factor=BACKOFF_FACTOR,
            status_forcelist=RETRY_STATUS_CODES,
            allowed_methods=frozenset(["GET"]),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def close(self) -> None:
        if self.session:
            self.session.close()

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        url = f"{self.base_url}{path}"
        resp = self.session.get(
            url, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT), params=params
        )
        resp.raise_for_status()
        return resp.json()

    def _paginate(self, path: str, params: dict, resource_label: str) -> Iterable[dict]:
        """Yield pages from an OData endpoint. Any per-page failure raises
        ``SourceConnectionException`` so callers can surface it instead of
        producing a silently truncated result set."""
        skip = 0
        while True:
            page_params = {**params, "$top": str(PAGE_SIZE), "$skip": str(skip)}
            try:
                data = self._get(path, params=page_params)
            except Exception as exc:
                raise SourceConnectionException(
                    f"Failed to fetch SSRS {resource_label} at skip={skip}: {exc}"
                ) from exc
            yield data
            value = data.get("value") or []
            if len(value) < PAGE_SIZE:
                return
            skip += PAGE_SIZE

    def test_access(self) -> None:
        try:
            self._get("/Folders", params={"$top": "1"})
        except Exception as exc:
            raise SourceConnectionException(
                f"Failed to connect to SSRS: {exc}"
            ) from exc

    def test_get_reports(self) -> None:
        try:
            self._get("/Reports", params={"$top": "1"})
        except Exception as exc:
            raise SourceConnectionException(
                f"Failed to fetch SSRS reports: {exc}"
            ) from exc

    def get_folders(self) -> Iterator[SsrsFolder]:
        params = {
            "$orderby": "Id",
            "$select": FOLDER_SELECT_FIELDS,
        }
        for data in self._paginate("/Folders", params, "folders"):
            yield from SsrsFolderListResponse(**data).value

    def get_reports(self) -> Iterator[SsrsReport]:
        params = {
            "$orderby": "Id",
            "$select": REPORT_SELECT_FIELDS,
        }
        for data in self._paginate("/Reports", params, "reports"):
            yield from SsrsReportListResponse(**data).value
