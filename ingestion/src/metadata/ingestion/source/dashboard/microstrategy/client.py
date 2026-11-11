#  Copyright 2023 Collate
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
REST Auth & Client for MicroStrategy

Every read raises on failure instead of returning an empty result: the source decides what a
failure means, and an empty list read as "nothing exists" would drive stale deletion.
"""

from __future__ import annotations

import re
import traceback
from collections import OrderedDict
from typing import TYPE_CHECKING, Any, TypeVar
from urllib.parse import quote

import requests
from pydantic import ValidationError

from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import APIError, ClientConfig
from metadata.ingestion.source.dashboard.microstrategy.models import (
    MstrProject,
    MstrSearchPage,
    MstrSearchResult,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable

    from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
        MicroStrategyConnection,
    )

logger = ingestion_logger()

API_VERSION = "MicroStrategyLibrary/api"
AUTH_TOKEN_HEADER = "X-MSTR-AuthToken"
PROJECT_HEADER = "X-MSTR-ProjectID"
APPLICATION_TYPE = 35
DOSSIER_TYPE = 55
# ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
SEARCH_PAGE_SIZE = 500
CACHE_SIZE = 512
LOGIN_TIMEOUT = (10, 60)
# The sqlView endpoint appends this block, which is not SQL, after the statement. Left in, it
# fails SqlGlot and SqlFluff, and the parser falls back to SqlParse.
ENGINE_STEPS_TRAILER = re.compile(r"^\[Analytical engine calculation steps:.*", re.MULTILINE | re.DOTALL)

T = TypeVar("T")


def strip_engine_steps(sql: str | None) -> str | None:
    """The cube SQL without the Analytical engine calculation steps that follow the statement"""
    return ENGINE_STEPS_TRAILER.sub("", sql).rstrip() if sql else sql


class MicroStrategyApiError(Exception):
    """A MicroStrategy REST call failed or answered with an unexpected body"""


class MicroStrategyClient:
    """
    Client Handling API communication with MicroStrategy
    """

    def __init__(
        self,
        config: MicroStrategyConnection,
        verify: bool | str | None = None,
        cert: tuple[str, str] | None = None,
    ):
        self.config = config
        self._verify = verify
        self._cert = cert
        self._base_url = clean_uri(str(self.config.hostPort))
        self._cube_sql: OrderedDict[str, str | None] = OrderedDict()
        self._owner_emails: OrderedDict[str, str | None] = OrderedDict()
        # Objects dropped for not matching the expected shape. The source reads it to tell a
        # complete listing from a partial one, since a dropped dossier would look deleted.
        self.skipped_objects = 0
        self.client = self._login()

    def _login(self) -> TrackedREST:
        """
        Open a session and build a REST client that sends only its token and cookies.

        https://demo.microstrategy.com/MicroStrategyLibrary/api-docs/index.html#/Authentication/postLogin
        """
        data: dict[str, Any] = {
            "loginMode": int(self.config.loginMode),
            "applicationType": APPLICATION_TYPE,
        }
        if self.config.username:
            data["username"] = self.config.username
        if self.config.password:
            data["password"] = self.config.password.get_secret_value()
        response = requests.post(
            url=f"{self._base_url}/{API_VERSION}/auth/login",
            json=data,
            timeout=LOGIN_TIMEOUT,
            verify=self._verify if self._verify is not None else True,
            cert=self._cert,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise MicroStrategyApiError(
                f"Login failed with HTTP {response.status_code}: {response.text[:500]}. Check the username, "
                "password and Login Mode (1 Standard, 8 Anonymous, 16 LDAP)."
            ) from exc
        token = response.headers.get(AUTH_TOKEN_HEADER)
        if not token:
            raise MicroStrategyApiError(
                f"Login answered HTTP {response.status_code} without an {AUTH_TOKEN_HEADER} header; "
                "check that Host Port is the server root the MicroStrategyLibrary app is served from."
            )
        return TrackedREST(
            ClientConfig(
                base_url=self._base_url,
                api_version=API_VERSION,
                extra_headers={AUTH_TOKEN_HEADER: token},
                cookies=response.cookies,
                allow_redirects=True,
                verify=self._verify,
                cert=self._cert,
            ),
            source_name="microstrategy",
        )

    def _get(self, path: str, params: dict | None = None, project_id: str | None = None) -> Any:
        """GET that logs in again once when the session expired, and raises on any failure."""
        headers = {"Content-Type": "application/json"}
        if project_id:
            headers[PROJECT_HEADER] = project_id
        try:
            response = self.client.get(path, data=params, headers=dict(headers))
        except APIError as exc:
            if exc.status_code != 401:
                raise MicroStrategyApiError(f"GET {path} failed: {exc}") from exc
            logger.info("MicroStrategy session expired, logging in again")
            self.client = self._login()
            try:
                response = self.client.get(path, data=params, headers=dict(headers))
            except APIError as retry_exc:
                raise MicroStrategyApiError(f"GET {path} failed: {retry_exc}") from retry_exc
        if response is None:
            raise MicroStrategyApiError(f"GET {path} returned no response")
        return response

    def close_api_session(self) -> None:
        """
        Closes the active api session
        """
        try:
            self.client.post(path="/auth/logout", retries=0)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to close the MicroStrategy API session: %s", exc)

    def get_session_info(self) -> Any:
        """Read the session the token opened, proving it is valid"""
        return self._get("/sessions")

    def get_projects_list(self) -> list[MstrProject]:
        """
        Get List of all projects
        """
        if self.config.projectName:
            return [self.get_project_by_name(self.config.projectName)]
        response = self._get("/projects")
        if not isinstance(response, list):
            raise MicroStrategyApiError(f"Unexpected /projects response: {str(response)[:200]}")
        return self._validate_each(response, MstrProject, "project")

    def get_project_by_name(self, project_name: str) -> MstrProject:
        return MstrProject.model_validate(self._get(f"/projects/{quote(project_name, safe='')}"))

    def iter_search_results(
        self, project_id: str, object_type: int = DOSSIER_TYPE, page_size: int = SEARCH_PAGE_SIZE
    ) -> Iterable[MstrSearchResult]:
        """
        Page through the quick search of one project.

        The project is scoped by the X-MSTR-ProjectID header: a ``project_id`` query parameter
        is ignored and searches every project the user can read.
        https://demo.microstrategy.com/MicroStrategyLibrary/api-docs/index.html#/Browsing/doQuickSearch
        """
        offset = 0
        while True:
            params = {
                "type": object_type,
                "getAncestors": False,
                "offset": offset,
                "limit": page_size,
                "certifiedStatus": "ALL",
                "isCrossCluster": False,
                # Hidden dossiers are not ingested.
                "result.hidden": False,
            }
            page = MstrSearchPage.model_validate(self._get("/searches/results", params=params, project_id=project_id))
            results = page.result or []
            yield from self._validate_each(results, MstrSearchResult, "search result")
            offset += len(results)
            # Without totalItems, only a short page proves the search is exhausted.
            exhausted = offset >= page.totalItems if page.totalItems is not None else len(results) < page_size
            if not results or exhausted:
                return

    def get_dashboard_details(self, project_id: str, dashboard_id: str) -> dict[str, Any]:
        """
        Get the raw dossier definition
        """
        response = self._get(f"/v2/dossiers/{dashboard_id}/definition", project_id=project_id)
        if not isinstance(response, dict):
            raise MicroStrategyApiError(f"Unexpected definition of dossier {dashboard_id}: {str(response)[:200]}")
        return response

    def get_cube_sql_details(self, project_id: str, cube_id: str) -> str | None:
        """
        Get the SQL of a cube, cached for the dossiers that share it. A cube whose SQL cannot be
        read is cached as None too, so it is not requested again for every dossier using it.
        """
        return self._cached(
            self._cube_sql,
            cube_id,
            lambda: strip_engine_steps(
                self._get(f"/v2/cubes/{cube_id}/sqlView", project_id=project_id).get("sqlStatement")
            ),
            f"the SQL of cube {cube_id}",
        )

    def get_owner_email(self, owner_id: str) -> str | None:
        """The default email address of a user, when the session may read it"""

        def fetch() -> str | None:
            addresses = self._get(f"/users/{owner_id}/addresses").get("addresses") or []
            emails = [a for a in addresses if a.get("deliveryMode") == "EMAIL" and a.get("value")]
            default = next((a for a in emails if a.get("isDefault")), emails[0] if emails else None)
            return default["value"] if default else None

        return self._cached(self._owner_emails, owner_id, fetch, f"the email of user {owner_id}")

    @staticmethod
    def _cached(cache: OrderedDict[str, T | None], key: str, fetch: Callable[[], T | None], what: str) -> T | None:
        if key in cache:
            cache.move_to_end(key)
            return cache[key]
        try:
            value = fetch()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not read %s: %s", what, exc)
            value = None
        cache[key] = value
        if len(cache) > CACHE_SIZE:
            cache.popitem(last=False)
        return value

    def _validate_each(self, items: list[Any], model: type[T], what: str) -> list[T]:
        """Validate items one by one, so one malformed object does not drop its siblings"""
        valid = []
        for item in items:
            try:
                valid.append(model.model_validate(item))  # pyright: ignore[reportAttributeAccessIssue]
            except ValidationError as exc:
                self.skipped_objects += 1
                logger.warning("Skipping a MicroStrategy %s that does not match the expected shape: %s", what, exc)
        return valid
