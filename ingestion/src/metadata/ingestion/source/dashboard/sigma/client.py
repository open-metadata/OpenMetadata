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
REST Auth & Client for Sigma
"""

import traceback
from base64 import b64encode
from collections.abc import Iterator

from cachetools import LRUCache

from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.dashboard.sigma.models import (
    AuthToken,
    ConnectionsResponse,
    DataModel,
    DataModelsResponse,
    EdgeSource,
    EdgeSourceResponse,
    Elements,
    ElementsResponse,
    NodeDetails,
    OwnerDetails,
    Workbook,
    WorkbookDetails,
    WorkbookLineageResponse,
    WorkBookPageResponse,
    WorkbookQueriesResponse,
    WorkBookResponseDetails,
)
from metadata.utils.constants import AUTHORIZATION_HEADER, UTF_8
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()

HEADERS = {
    "accept": "application/json",
    "Content-type": "application/x-www-form-urlencoded",
}

TOKEN_PAYLOAD = {"grant_type": "client_credentials"}


class SigmaApiClient:
    """
    REST Auth & Client for Sigma
    """

    client: TrackedREST

    def __init__(self, config: SigmaConnection):
        self.config = config
        token_api_key = str(
            b64encode(f"{self.config.clientId}:{self.config.clientSecret.get_secret_value()}".encode(UTF_8)).decode(
                UTF_8
            )
        )

        token_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version=config.apiVersion,
            auth_header=AUTHORIZATION_HEADER,
            extra_headers=HEADERS,
            auth_token=lambda: (token_api_key, 0),
            auth_token_mode="Basic",
        )

        self.token_client = TrackedREST(token_config, source_name="sigma")

        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version=config.apiVersion,
            auth_token=self.get_auth_token,
            auth_header=AUTHORIZATION_HEADER,
        )

        self.client = TrackedREST(client_config, source_name="sigma")
        # Successful reads only: a failed read stays retryable for the next workbook or element.
        self._owner_cache: LRUCache[str, OwnerDetails] = LRUCache(maxsize=512)
        self._file_cache: LRUCache[str, NodeDetails] = LRUCache(maxsize=512)
        # A failed read leaves live workbooks, or a workbook's elements, out of the run, so the
        # source must not delete what this run did not see.
        self.workbooks_incomplete = False
        self.elements_incomplete = False
        self.data_models_incomplete = False
        self._connection_types: LRUCache[str, str] | None = None

    def get_auth_token(self) -> tuple[str, int]:
        """
        generate auth token
         Returns:
            Tuple[str, int]: A tuple containing the access_token (str) and expires_in (int)
        """
        result = AuthToken.model_validate(self.token_client.post("/auth/token", data=TOKEN_PAYLOAD))
        return result.access_token, result.expires_in

    def test_get_dashboards(self) -> list[Workbook] | None:  # noqa: RET503
        """
        method to test fetch dashboards from api
        """
        result = WorkBookResponseDetails.model_validate(self.client.get("/workbooks"))
        if result:
            return result.entries

    def get_dashboards(self) -> list[Workbook] | None:
        """
        method to fetch dashboards from api
        """
        workbooks = []
        try:
            result = WorkBookResponseDetails.model_validate(self.client.get("/workbooks"))
            if result:
                workbooks.extend(result.entries)
                while result.nextPage:
                    data = {"page": int(result.nextPage)}
                    result = WorkBookResponseDetails.model_validate(self.client.get("/workbooks", data=data))
                    if result:
                        workbooks.extend(result.entries)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching Dashboards: {exc}")
            self.workbooks_incomplete = True
        return workbooks

    def get_dashboard_detail(self, workbook_id: str) -> WorkbookDetails | None:
        """
        method to fetch dashboard details from api
        """
        try:
            result = WorkbookDetails.model_validate(self.client.get(f"/workbooks/{workbook_id}"))
            if result:
                return result
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching Dashboard details for for workbook {workbook_id}: {exc}")
            self.workbooks_incomplete = True
        return None

    def get_connection_type(self, connection_id: str) -> str | None:
        """
        The type of a Sigma connection, such as "snowflake" or "bigQuery". The connections are listed once per
        run; after a failed listing the types not yet read stay unknown, rather than relisting per lookup.
        """
        if self._connection_types is None:
            self._connection_types = LRUCache(maxsize=512)
            try:
                data = None
                while True:
                    result = ConnectionsResponse.model_validate(self.client.get("/connections", data=data))
                    for connection in result.entries:
                        self._connection_types[connection.connectionId] = connection.type
                    if not result.nextPage:
                        break
                    data = {"page": result.nextPage}
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Failed to list Sigma connections: {exc}")
        return self._connection_types.get(connection_id)

    def get_workbook_connection_ids(self, workbook_id: str) -> set[str]:
        """
        The connections the workbook's sources run on, from its lineage rows. Empty when the read fails, so a
        partial read never looks like a workbook on a single connection.
        """
        connection_ids = set()
        try:
            data = None
            while True:
                result = WorkbookLineageResponse.model_validate(
                    self.client.get(f"/workbooks/{workbook_id}/lineage", data=data)
                )
                connection_ids.update(entry.connectionId for entry in result.entries if entry.connectionId)
                if not result.nextPage:
                    return connection_ids
                data = {"page": result.nextPage}
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the lineage of workbook {workbook_id}: {exc}")
        return set()

    def _read_all(self, path: str, response_model: type[DataModelsResponse | ElementsResponse]) -> Iterator:
        """Every entry of a paginated Sigma listing; raises when a page cannot be read"""
        data = None
        while True:
            result = response_model.model_validate(self.client.get(path, data=data))
            yield from result.entries or []
            if not result.nextPage:
                return
            data = {"page": result.nextPage}

    def get_data_models(self) -> list[DataModel]:
        """Every Sigma Data Model; a failed page marks the listing incomplete"""
        data_models = []
        try:
            data_models.extend(self._read_all("/dataModels", DataModelsResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to list Sigma data models: {exc}")
            self.data_models_incomplete = True
        return data_models

    def get_data_model_elements(self, data_model_id: str) -> list[Elements] | None:
        """The elements of a Sigma Data Model, or None when they could not all be read"""
        try:
            return list(self._read_all(f"/dataModels/{data_model_id}/elements", ElementsResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the elements of data model {data_model_id}: {exc}")
        return None

    def get_owner_detail(self, owner_id: str) -> OwnerDetails | None:
        """
        method to fetch dashboard owner details from api
        """
        if owner_id in self._owner_cache:
            return self._owner_cache[owner_id]
        try:
            result = OwnerDetails.model_validate(self.client.get(f"/members/{owner_id}"))
            if result:
                self._owner_cache[owner_id] = result
                return result
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch owner details for owner {owner_id}: {exc}")
        return None

    def get_page_elements(self, workbook_id: str, page_id: str) -> list[Elements] | None:
        """
        method to fetch dashboards page elements from api
        """
        elements = []
        try:
            result = ElementsResponse.model_validate(
                self.client.get(f"/workbooks/{workbook_id}/pages/{page_id}/elements")
            )
            if result:
                elements.extend(result.entries)
                while result.nextPage:
                    data = {"page": int(result.nextPage)}
                    result = ElementsResponse.model_validate(
                        self.client.get(
                            f"/workbooks/{workbook_id}/pages/{page_id}/elements",
                            data=data,
                        )
                    )
                    if result:
                        elements.extend(result.entries)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch page elements for workbook {workbook_id}: {exc}")
            self.elements_incomplete = True
        return elements

    def get_chart_details(self, workbook_id: str) -> list[Elements] | None:
        """
        method to fetch dashboards chart details from api
        """
        try:
            elements_list = []
            pages = WorkBookPageResponse.model_validate(self.client.get(f"/workbooks/{workbook_id}/pages"))
            if not pages.entries:
                return None
            for page in pages.entries:
                page_elements = self.get_page_elements(workbook_id, page.pageId)
                if page_elements:
                    elements_list.extend(page_elements)
            while pages.nextPage:
                pages = WorkBookPageResponse.model_validate(
                    self.client.get(
                        f"/workbooks/{workbook_id}/pages",
                        data={"page": int(pages.nextPage)},
                    )
                )
                if not pages.entries:
                    break
                for page in pages.entries:
                    page_elements = self.get_page_elements(workbook_id, page.pageId)
                    if page_elements:
                        elements_list.extend(page_elements)
            return elements_list  # noqa: TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch chart details for workbook {workbook_id}: {exc}")
            self.elements_incomplete = True
        return None

    def get_workbook_queries(self, workbook_id: str) -> WorkbookQueriesResponse | None:
        """
        Fetch SQL queries for all elements in a workbook
        """
        try:
            queries = []
            result = WorkbookQueriesResponse.model_validate(self.client.get(f"/workbooks/{workbook_id}/queries"))
            if result:
                queries.extend(result.entries)
                while result.nextPage:
                    data = {"page": int(result.nextPage)}
                    result = WorkbookQueriesResponse.model_validate(
                        self.client.get(f"/workbooks/{workbook_id}/queries", data=data)
                    )
                    if result:
                        queries.extend(result.entries)
                return WorkbookQueriesResponse(entries=queries, total=len(queries))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch queries for workbook {workbook_id}: {exc}")
        return None

    def get_lineage_details(self, workbook_id: str, element_id: str) -> list[NodeDetails] | None:
        """
        method to fetch dashboards lineage details from api
        """
        try:
            source_nodes = []
            edges_response = EdgeSourceResponse.model_validate(
                self.client.get(f"/workbooks/{workbook_id}/lineage/elements/{element_id}")
            )

            node_ids = [
                node_id
                for edge in edges_response.edges or []
                if (node_id := edge.node_id) and edge.source not in edges_response.dependencies
            ]
            # Sigma keys the element's upstream tables in `dependencies`, so their edges start at a key
            node_ids += [
                node_id
                for node in edges_response.dependencies.values()
                if node.type in ("table", "dataset") and (node_id := EdgeSource(source=node.nodeId).node_id)
            ]
            for node_id in node_ids:
                try:
                    if node_id not in self._file_cache:
                        self._file_cache[node_id] = NodeDetails.model_validate(self.client.get(f"/files/{node_id}"))
                    node_details = self._file_cache[node_id]

                    if node_details.node_type in ["table", "dataset"]:
                        source_nodes.append(node_details)
                except Exception as node_exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Failed to fetch node details for {node_id}: {node_exc}")
                    continue

            return source_nodes if source_nodes else None  # noqa: TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch lineage details for workbook {workbook_id}, element {element_id}: {exc}")
        return None
