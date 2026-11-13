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
from collections import Counter
from collections.abc import Iterator

from cachetools import LRUCache

from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.dashboard.sigma.models import (
    AuthToken,
    ColumnsResponse,
    Connection,
    ConnectionPath,
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
    WorkbookLineageEntry,
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
        # A failed read is cached as unknown for the run.
        self._connection_types: LRUCache[str, str | None] = LRUCache(maxsize=512)
        self._connection_paths: LRUCache[str, list[str] | None] = LRUCache(maxsize=512)

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
                    data = {"page": result.nextPage}
                    result = WorkBookResponseDetails.model_validate(self.client.get("/workbooks", data=data))
                    if result:
                        workbooks.extend(result.entries)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching Dashboards: {exc}")
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
        return None

    def get_badge(self, workbook_id: str) -> str | None:
        """
        The workbook's certification badge, read from its /files entry, whose inode id is the workbook id
        """
        try:
            return NodeDetails.model_validate(self.client.get(f"/files/{workbook_id}")).badge
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the badge of workbook %s: %s", workbook_id, exc)
        return None

    def get_connection_type(self, connection_id: str) -> str | None:
        """
        The type of a Sigma connection, such as "snowflake" or "bigQuery", read once per connection. A failed
        read is cached as unknown, so it is not retried for every workbook on that connection.
        """
        if connection_id not in self._connection_types:
            try:
                self._connection_types[connection_id] = Connection.model_validate(
                    self.client.get(f"/connections/{connection_id}")
                ).type
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Failed to read Sigma connection %s: %s", connection_id, exc)
                self._connection_types[connection_id] = None
        return self._connection_types[connection_id]

    def get_connection_path(self, inode_id: str) -> list[str] | None:
        """
        A warehouse table's path in its Sigma connection, read once per table. A failed read is cached as unknown:
        Sigma answers an error for an inode that is not a table.
        """
        if inode_id not in self._connection_paths:
            try:
                self._connection_paths[inode_id] = ConnectionPath.model_validate(
                    self.client.get(f"/connections/paths/{inode_id}")
                ).path
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Failed to read the Sigma connection path of %s: %s", inode_id, exc)
                self._connection_paths[inode_id] = None
        return self._connection_paths[inode_id]

    def get_workbook_lineage(self, workbook_id: str) -> list[WorkbookLineageEntry]:
        """
        The workbook's lineage rows. Empty when the read fails, so a partial read never looks like a workbook on a
        single connection or misses a data model it reads.
        """
        try:
            return list(self._read_all(f"/workbooks/{workbook_id}/lineage", WorkbookLineageResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the lineage of workbook %s: %s", workbook_id, exc)
        return []

    def get_data_model_lineage(self, data_model_id: str) -> list[WorkbookLineageEntry]:
        """The lineage rows of a Sigma Data Model, shaped as a workbook's. Empty when the read fails"""
        try:
            return list(self._read_all(f"/dataModels/{data_model_id}/lineage", WorkbookLineageResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the lineage of data model %s: %s", data_model_id, exc)
        return []

    def get_file(self, node_id: str) -> NodeDetails | None:
        """The /files entry of a table or other Sigma document, read once per run"""
        if node_id not in self._file_cache:
            try:
                self._file_cache[node_id] = NodeDetails.model_validate(self.client.get(f"/files/{node_id}"))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Failed to fetch node details for %s: %s", node_id, exc)
                return None
        return self._file_cache[node_id]

    def get_column_formulas(self, path: str) -> dict[str, dict[str, str]]:
        """
        Each element's non-empty column formulas by column name, from a /columns listing of a workbook or data
        model. A name an element holds twice is left out, as its formula cannot be told apart. Empty when any
        page fails to read, so a partial listing never stands for the whole.
        """
        try:
            columns = list(self._read_all(path, ColumnsResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the column formulas of %s: %s", path, exc)
            return {}
        names = Counter((column.elementId, column.name) for column in columns)
        formulas: dict[str, dict[str, str]] = {}
        for column in columns:
            if column.formula and names[column.elementId, column.name] == 1:
                formulas.setdefault(column.elementId, {})[column.name] = column.formula
        return formulas

    def _read_all(
        self,
        path: str,
        response_model: type[ColumnsResponse | DataModelsResponse | ElementsResponse | WorkbookLineageResponse],
    ) -> Iterator:
        """Every entry of a paginated Sigma listing; raises when a page cannot be read"""
        data = None
        while True:
            result = response_model.model_validate(self.client.get(path, data=data))
            yield from result.entries or []
            if not result.nextPage:
                return
            data = {"page": result.nextPage}

    def get_data_models(self) -> list[DataModel]:
        """Every Sigma Data Model"""
        data_models = []
        try:
            data_models.extend(self._read_all("/dataModels", DataModelsResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to list Sigma data models: %s", exc)
        return data_models

    def get_data_model_elements(self, data_model_id: str) -> list[Elements] | None:
        """The elements of a Sigma Data Model, or None when they could not all be read"""
        try:
            return list(self._read_all(f"/dataModels/{data_model_id}/elements", ElementsResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the elements of data model %s: %s", data_model_id, exc)
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

    def get_page_elements(self, workbook_id: str, page_id: str) -> list[Elements]:
        """
        method to fetch dashboards page elements from api
        """
        elements = []
        try:
            elements.extend(self._read_all(f"/workbooks/{workbook_id}/pages/{page_id}/elements", ElementsResponse))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch page elements for workbook %s: %s", workbook_id, exc)
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
                        data={"page": pages.nextPage},
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
                    data = {"page": result.nextPage}
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

    def get_lineage_details(self, workbook_id: str, element_id: str) -> tuple[list[NodeDetails], bool] | None:
        """
        Fetch an element's source tables, and whether every source was read as a table: a source that failed
        to read, or is not a table, could hold columns the returned tables do not
        """
        try:
            source_nodes = []
            all_sources_read = True
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
                node_details = self.get_file(node_id)
                if node_details and node_details.node_type in ["table", "dataset"]:
                    source_nodes.append(node_details)
                else:
                    all_sources_read = False

            return (source_nodes, all_sources_read) if source_nodes else None  # noqa: TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch lineage details for workbook {workbook_id}, element {element_id}: {exc}")
        return None
