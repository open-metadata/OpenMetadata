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
import base64
import binascii
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
RDL_READ_TIMEOUT = 60
PAGE_SIZE = 100
MAX_RETRIES = 2
BACKOFF_FACTOR = 1
RETRY_STATUS_CODES = (500, 502, 503, 504)
REPORT_SELECT_FIELDS = "Id,Name,Path,Description,Type,Hidden,HasDataSources,CreatedBy"
FOLDER_SELECT_FIELDS = "Id,Name,Path"
RDL_CONTENT_PATHS = ("/Reports({id})/Content/$value", "/CatalogItems({id})/Content")
RDL_NOT_FOUND_STATUS = {404}
MAX_RDL_BYTES = 50 * 1024 * 1024


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

    def get_report_definition(self, report_id: str) -> Optional[bytes]:
        """Return the RDL XML bytes for a report, or ``None`` if unavailable.

        Tries ``/Reports({id})/Content/$value`` first, then ``/CatalogItems({id})/Content``.
        Not-found responses (404/400) trigger fallback silently; transport errors
        propagate so operators see outages instead of empty catalogs."""
        last_err: Optional[Exception] = None
        for template in RDL_CONTENT_PATHS:
            path = template.format(id=report_id)
            try:
                body = self._fetch_report_content(path)
            except requests.RequestException as exc:
                last_err = exc
                logger.warning("RDL fetch transport error for %s: %s", path, exc)
                continue
            if body is not None:
                return body
        if last_err is not None:
            raise SourceConnectionException(
                f"Failed to fetch RDL content for report [{report_id}]: {last_err}"
            ) from last_err
        return None

    def _fetch_report_content(self, path: str) -> Optional[bytes]:
        url = f"{self.base_url}{path}"
        resp = self.session.get(
            url,
            timeout=(CONNECT_TIMEOUT, RDL_READ_TIMEOUT),
            headers={"Accept": "application/xml,application/octet-stream"},
        )
        if resp.status_code in RDL_NOT_FOUND_STATUS:
            return None
        if not resp.ok:
            logger.warning("RDL fetch returned HTTP %s for %s", resp.status_code, path)
            return None
        if _exceeds_size_limit(resp, path):
            return None
        return _decode_rdl_response(resp, path)


def _exceeds_size_limit(resp: requests.Response, path: str) -> bool:
    length = resp.headers.get("Content-Length")
    if length is None:
        return False
    try:
        length_int = int(length)
    except ValueError:
        return False
    if length_int > MAX_RDL_BYTES:
        logger.warning(
            "RDL at %s exceeds size limit (%s bytes > %s); skipping to avoid OOM",
            path,
            length_int,
            MAX_RDL_BYTES,
        )
        return True
    return False


def _decode_rdl_response(resp: requests.Response, path: str) -> Optional[bytes]:
    content_type = (resp.headers.get("Content-Type") or "").lower()
    if "json" not in content_type:
        return _truncate_to_limit(resp.content, path) if resp.content else None
    try:
        payload = resp.json()
    except ValueError:
        return _truncate_to_limit(resp.content, path) if resp.content else None
    value = payload.get("Value") if isinstance(payload, dict) else None
    if not value:
        logger.warning("RDL JSON response missing 'Value' field at %s", path)
        return None
    try:
        decoded = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        logger.warning("Malformed base64 in RDL response at %s: %s", path, exc)
        return None
    return _truncate_to_limit(decoded, path)


def _truncate_to_limit(body: bytes, path: str) -> Optional[bytes]:
    if len(body) > MAX_RDL_BYTES:
        logger.warning(
            "RDL at %s exceeds size limit (%s bytes > %s); skipping to avoid OOM",
            path,
            len(body),
            MAX_RDL_BYTES,
        )
        return None
    return body
