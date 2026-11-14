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
from collections.abc import Hashable
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

# ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged (v2: Library path)
DEFAULT_LIBRARY_PATH = "MicroStrategyLibrary"
AUTH_TOKEN_HEADER = "X-MSTR-AuthToken"
PROJECT_HEADER = "X-MSTR-ProjectID"
APPLICATION_TYPE = 35
DOSSIER_TYPE = 55
REPORT_TYPE = 3
# Report subtypes of Data Import (EMMA) cubes, whose objects the modeling API does not serve
DATA_IMPORT_CUBE_SUBTYPES = frozenset({779, 780})
# ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
SEARCH_PAGE_SIZE = 500
CACHE_SIZE = 512
LOGIN_TIMEOUT = (10, 60)
# The sqlView endpoint appends this block, which is not SQL, after the statement. Left in, it
# fails SqlGlot and SqlFluff, and the parser falls back to SqlParse.
ENGINE_STEPS_TRAILER = re.compile(r"^\[Analytical engine calculation steps:.*", re.MULTILINE | re.DOTALL)
# The sqlView endpoint's answer for a dataset that is a report rather than an Intelligent Cube
NOT_A_CUBE = "Only cube is supported to get SQL view"

T = TypeVar("T")
K = TypeVar("K", bound=Hashable)


def strip_engine_steps(sql: str | None) -> str | None:
    """The cube SQL without the Analytical engine calculation steps that follow the statement"""
    return ENGINE_STEPS_TRAILER.sub("", sql).rstrip() if sql else sql


def cached(cache: OrderedDict[K, T | None], key: K, fetch: Callable[[], T | None], what: str) -> T | None:
    """
    Read through a bounded LRU cache. A failure is logged and cached as None, so a value that
    cannot be read is not requested again for every dossier that uses it.
    """
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


class MicroStrategyApiError(Exception):
    """A MicroStrategy REST call failed or answered with an unexpected body"""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


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
        # The Library web app is usually served at /MicroStrategyLibrary, but a server can run it,
        # or a second copy of it, under another name.
        library_path = (self.config.libraryPath or "").strip().strip("/") or DEFAULT_LIBRARY_PATH
        self.library_url = f"{self._base_url}/{library_path}"
        self._api_version = f"{library_path}/api"
        self._cube_sql: OrderedDict[str, str | None] = OrderedDict()
        self._owner_emails: OrderedDict[str, str | None] = OrderedDict()
        self._dataset_subtypes: OrderedDict[str, int | None] = OrderedDict()
        self._form_columns: OrderedDict[str, dict[str, frozenset[tuple[str, str]]] | None] = OrderedDict()
        self._attribute_failure_reported = False
        self._physical_tables: OrderedDict[str, str | None] = OrderedDict()
        # Reading schema objects needs modeling privileges; their absence is reported once.
        self.modeling_denied = False
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
            url=f"{self.library_url}/api/auth/login",
            json=data,
            timeout=LOGIN_TIMEOUT,
            verify=self._verify if self._verify is not None else True,
            cert=self._cert,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            hint = (
                f"No MicroStrategy Library API at {self.library_url}/api; check the Host and Port and the Library Path."
                if response.status_code == 404
                else "Check the username, password and Login Mode (1 Standard, 8 Anonymous, 16 LDAP)."
            )
            raise MicroStrategyApiError(
                f"Login failed with HTTP {response.status_code}: {response.text[:500]}. {hint}"
            ) from exc
        token = response.headers.get(AUTH_TOKEN_HEADER)
        if not token:
            raise MicroStrategyApiError(
                f"Login answered HTTP {response.status_code} without an {AUTH_TOKEN_HEADER} header; "
                f"check that Host and Port is the server root and Library Path is the app at {self.library_url}."
            )
        return TrackedREST(
            ClientConfig(
                base_url=self._base_url,
                api_version=self._api_version,
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
                raise MicroStrategyApiError(f"GET {path} failed: {exc}", exc.status_code) from exc
            logger.info("MicroStrategy session expired, logging in again")
            self.client = self._login()
            try:
                response = self.client.get(path, data=params, headers=dict(headers))
            except APIError as retry_exc:
                raise MicroStrategyApiError(f"GET {path} failed: {retry_exc}", retry_exc.status_code) from retry_exc
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

        def fetch() -> str | None:
            try:
                response = self._get(f"/v2/cubes/{cube_id}/sqlView", project_id=project_id)
            except MicroStrategyApiError as exc:
                if NOT_A_CUBE not in str(exc):
                    raise
                # A dataset can be a report rather than an Intelligent Cube, and the SQL view
                # serves cubes only.
                logger.warning(
                    "Dataset %s is a report, not an Intelligent Cube: its SQL cannot be read, so it has no lineage",
                    cube_id,
                )
                return None
            return strip_engine_steps(response.get("sqlStatement"))

        return cached(self._cube_sql, cube_id, fetch, f"the SQL of cube {cube_id}")

    def get_dataset_subtype(self, project_id: str, dataset_id: str) -> int | None:
        """The subtype of the report object behind a dossier dataset, e.g. 776 for an Intelligent Cube"""
        return cached(
            self._dataset_subtypes,
            dataset_id,
            lambda: self._get(f"/objects/{dataset_id}", params={"type": REPORT_TYPE}, project_id=project_id).get(
                "subtype"
            ),
            f"the type of dataset {dataset_id}",
        )

    def get_attribute_form_columns(
        self, project_id: str, attribute_id: str
    ) -> dict[str, frozenset[tuple[str, str]]] | None:
        """
        For each form of a schema attribute, the (physical table, column) pairs its expressions read,
        lowercased. None when the attribute cannot be read, for instance without modeling privileges.
        """
        if attribute_id in self._form_columns:
            self._form_columns.move_to_end(attribute_id)
            return self._form_columns[attribute_id]
        if self.modeling_denied:
            return None
        try:
            attribute = self._get(
                f"/model/attributes/{attribute_id}", params={"showExpressionAs": "tree"}, project_id=project_id
            )
            forms = {
                form["id"]: frozenset(self._form_expression_columns(project_id, form)) for form in attribute["forms"]
            }
        except MicroStrategyApiError as exc:
            if exc.status_code == 403:
                # Without the privilege every attribute fails alike, so none is asked for again.
                logger.warning(
                    "Schema cubes get table-level lineage only: column-level lineage needs the service account "
                    "to read schema objects (Architect privileges): %s",
                    exc,
                )
                self.modeling_denied = True
                return None
            self._attribute_failed(attribute_id, exc)
            forms = None
        except Exception as exc:
            self._attribute_failed(attribute_id, exc)
            forms = None
        self._form_columns[attribute_id] = forms
        if len(self._form_columns) > CACHE_SIZE:
            self._form_columns.popitem(last=False)
        return forms

    def _attribute_failed(self, attribute_id: str, exc: Exception) -> None:
        """One warning for the run, so a server refusing many attributes does not flood the log"""
        logger.debug(traceback.format_exc())
        if self._attribute_failure_reported:
            logger.debug("Could not read schema attribute %s: %s", attribute_id, exc)
            return
        self._attribute_failure_reported = True
        logger.warning(
            "Could not read schema attribute %s, so its columns get no column-level lineage; further attributes "
            "that cannot be read are logged at debug level: %s",
            attribute_id,
            exc,
        )

    def _form_expression_columns(self, project_id: str, form: dict[str, Any]) -> Iterable[tuple[str, str]]:
        for expression in form.get("expressions") or []:
            column = (expression.get("expression") or {}).get("tree", {}).get("columnName")
            if not column:
                continue
            for table in expression.get("tables") or []:
                physical = self.get_physical_table(project_id, table["objectId"])
                if physical:
                    yield physical, column.lower()

    def get_physical_table(self, project_id: str, logical_table_id: str) -> str | None:
        """
        The name the SQL gives the physical table behind a logical table, lowercased: its table
        prefix when one is set (that is what MicroStrategy writes into the SQL), else its namespace,
        then the table name.
        """

        def fetch() -> str | None:
            physical = self._get(f"/model/tables/{logical_table_id}", project_id=project_id).get("physicalTable") or {}
            name = physical.get("tableName")
            if not name:
                return None
            qualifier = (physical.get("tablePrefix") or "").strip(".") or physical.get("namespace") or ""
            return ".".join(part for part in (qualifier, name) if part).lower()

        return cached(self._physical_tables, logical_table_id, fetch, f"the physical table of {logical_table_id}")

    def get_owner_email(self, owner_id: str) -> str | None:
        """The default email address of a user, when the session may read it"""

        def fetch() -> str | None:
            addresses = self._get(f"/users/{owner_id}/addresses").get("addresses") or []
            emails = [a for a in addresses if a.get("deliveryMode") == "EMAIL" and a.get("value")]
            default = next((a for a in emails if a.get("isDefault")), emails[0] if emails else None)
            return default["value"] if default else None

        return cached(self._owner_emails, owner_id, fetch, f"the email of user {owner_id}")

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
