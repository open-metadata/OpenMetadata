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
REST client for Omni (https://docs.omni.co/api).

Auth is a static Bearer API token. List endpoints use cursor pagination
(``pageInfo.nextCursor``). The Omni API is rate limited (60 req/min by
default), so topics are resolved from a single model-YAML call per model
rather than one call per topic.
"""

import traceback
from typing import Iterable, List, Optional  # noqa: UP035

import yaml

from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
    OmniConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.dashboard.omni.models import (
    DocumentsResponse,
    ModelsResponse,
    OmniDashboardDocument,
    OmniDocument,
    OmniField,
    OmniModel,
    OmniQuery,
    OmniTopic,
    QueryPresentation,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()

PAGE_SIZE = 100
# Only the shared semantic-layer model(s) carry the real views/topics. The other
# model kinds (QUERY, WORKBOOK, BRANCH, SCHEMA) are per-document and would explode
# the number of API calls against the 60 req/min rate limit.
SEMANTIC_MODEL_KINDS = {"SHARED"}
# Omni model YAML uses LookML-like keys. A model bundle has a top-level ``model``
# file, ``<schema>/<name>.view`` files (physical tables + fields), and
# ``<name>.topic`` files (curated datasets that reference a base view).
_BASE_VIEW_KEYS = ("base_view", "base_view_name", "base_table", "view")
_TABLE_KEYS = ("sql_table_name", "table_name", "table", "sql_table")
_SCHEMA_KEYS = ("schema", "schema_name")


class OmniApiClient:
    """REST client wrapper for the Omni API."""

    client: TrackedREST

    def __init__(self, config: OmniConnection, verify_ssl=True, ssl_manager=None):
        self.config = config
        # Keep a reference so the SSLManager's temp CA file is not garbage collected.
        self.ssl_manager = ssl_manager
        client_config = ClientConfig(
            base_url=clean_uri(str(config.hostPort)),
            api_version="v1",
            auth_token=lambda: (config.token.get_secret_value(), 0),
            auth_header=AUTHORIZATION_HEADER,
            auth_token_mode="Bearer",
            extra_headers={"Content-Type": "application/json"},
            verify=verify_ssl,
        )
        self.client = TrackedREST(client_config, source_name="omni")

    # -- pagination ---------------------------------------------------------

    def _paginate(self, path: str, response_cls, params: Optional[dict] = None) -> Iterable:  # noqa: UP045
        """Yield records across all pages using cursor pagination."""
        data = {"pageSize": PAGE_SIZE, **(params or {})}
        while True:
            result = response_cls.model_validate(self.client.get(path, data=data))
            yield from result.records or []
            page_info = result.pageInfo
            if not (page_info and page_info.hasNextPage and page_info.nextCursor):
                break
            data = {**data, "cursor": page_info.nextCursor}

    # -- test connection ----------------------------------------------------

    def test_access(self) -> None:
        """Lightweight call used by the CheckAccess test-connection step."""
        self.client.get("/models", data={"pageSize": 1})

    def test_get_documents(self) -> None:
        """Used by the GetDashboards test-connection step."""
        self.client.get("/documents", data={"pageSize": 1})

    # -- models & topics ----------------------------------------------------

    def get_models(self) -> List[OmniModel]:  # noqa: UP006
        """List the shared semantic-layer models in the instance."""
        try:
            models = list(self._paginate("/models", ModelsResponse, params={"modelKind": "SHARED"}))
            # Defensive client-side filter in case the server ignores the param.
            return [m for m in models if m.modelKind in SEMANTIC_MODEL_KINDS]
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching Omni models: {exc}")
            return []

    def get_model_topics(self, model: OmniModel) -> List[OmniTopic]:  # noqa: UP006
        """
        Resolve a model's topics from its YAML definition.

        One ``/models/{id}/yaml`` call returns every view + topic for the model,
        which keeps us well within the API rate limit.
        """
        try:
            payload = self.client.get(f"/models/{model.id}/yaml", data={"fullyResolved": "true"})
            files = (payload or {}).get("files") or {}
            return self._parse_model_yaml(model, files)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching topics for model {model.id}: {exc}")
            return []

    @staticmethod
    def _first(mapping: dict, keys) -> Optional[str]:  # noqa: UP045
        for key in keys:
            if mapping.get(key):
                return str(mapping[key])
        return None

    @classmethod
    def _parse_view(cls, content: dict) -> dict:
        """Extract label, schema, table and fields from a view definition."""
        table = cls._first(content, _TABLE_KEYS)
        schema = cls._first(content, _SCHEMA_KEYS)
        if table and "." in table and not schema:
            schema, _, table = table.rpartition(".")
        fields: List[OmniField] = []  # noqa: UP006
        for kind, field_type in (("dimensions", "dimension"), ("measures", "measure")):
            for field_name, raw_field in (content.get(kind) or {}).items():
                field_def = raw_field or {}
                fields.append(
                    OmniField(
                        name=field_name,
                        label=field_def.get("label"),
                        data_type=field_def.get("type") or field_def.get("data_type"),
                        field_type=field_type,
                        description=field_def.get("description"),
                    )
                )
        return {"label": content.get("label"), "schema": schema, "table": table, "fields": fields}

    @classmethod
    def _parse_model_yaml(cls, model: OmniModel, files: dict) -> List[OmniTopic]:  # noqa: UP006
        """
        Build normalized data models from the model's YAML files.

        Each ``.view`` file -> a data model backed by a physical warehouse table
        (schema + table_name + fields). Each ``.topic`` file -> a curated data
        model that references a base view (for warehouse-table lineage).
        """
        views: dict = {}
        topic_defs: dict = {}
        for filename, raw in files.items():
            try:
                content = yaml.safe_load(raw) if isinstance(raw, str) else (raw or {})
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning(f"Skipping unparsable YAML file {filename}: {exc}")
                continue
            if not isinstance(content, dict):
                continue
            base = filename.split("/")[-1]
            if filename.endswith(".view"):
                views[base[: -len(".view")]] = cls._parse_view(content)
            elif filename.endswith(".topic"):
                topic_defs[base[: -len(".topic")]] = content

        topics: List[OmniTopic] = []  # noqa: UP006
        # Names must be unique within a model: a curated topic frequently shares its
        # name with its base view, and they would otherwise collide on the same data
        # model FQN. Topics take precedence (they carry the curated label/joins).
        seen_names: set = set()

        # Curated topics: resolve their base view to a physical table.
        for topic_name, topic_def in topic_defs.items():
            if topic_name in seen_names:
                continue
            seen_names.add(topic_name)
            base_view = cls._first(topic_def, _BASE_VIEW_KEYS) or topic_name
            view = views.get(base_view, {})
            topics.append(
                OmniTopic(
                    model_id=model.id,
                    model_name=model.name,
                    name=topic_name,
                    label=topic_def.get("label"),
                    description=topic_def.get("description"),
                    base_view=base_view,
                    base_schema=view.get("schema"),
                    base_table=view.get("table"),
                    fields=view.get("fields") or [],
                )
            )
        # Views: one data model per physical table, with its columns. Skip any whose
        # name was already taken by a topic (or another view).
        for view_name, view in views.items():
            if view_name in seen_names:
                logger.debug(f"Skipping view {view_name!r}: name already used by a topic/view in model {model.id}")
                continue
            seen_names.add(view_name)
            topics.append(
                OmniTopic(
                    model_id=model.id,
                    model_name=model.name,
                    name=view_name,
                    label=view.get("label"),
                    base_view=view_name,
                    base_schema=view.get("schema"),
                    base_table=view.get("table"),
                    fields=view.get("fields") or [],
                )
            )
        return topics

    # -- documents / dashboards --------------------------------------------

    def get_documents(self) -> List[OmniDocument]:  # noqa: UP006
        """List all documents (workbooks/dashboards) in the instance."""
        try:
            return list(self._paginate("/documents", DocumentsResponse, params={"include": "labels"}))
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching Omni documents: {exc}")
            return []

    def get_dashboard_document(self, document_id: str) -> Optional[OmniDashboardDocument]:  # noqa: UP045
        """
        Fetch a document's tiles via the document queries endpoint.

        The deprecated ``/documents/{id}/dashboard`` endpoint returns null for many
        documents, so we build the tiles from ``/documents/{id}/queries``: each query
        is one tile/chart, and its ``query`` object carries the table/fields used for
        lineage.
        """
        try:
            payload = self.client.get(f"/documents/{document_id}/queries")
            queries = (payload or {}).get("queries") or []
            tiles = []
            for query in queries:
                query_obj = query.get("query") or {}
                tiles.append(
                    QueryPresentation(
                        name=query.get("name"),
                        chartType=query.get("chartType"),
                        query=OmniQuery(
                            table=query_obj.get("table"),
                            fields=query_obj.get("fields"),
                        ),
                    )
                )
            return OmniDashboardDocument(identifier=document_id, queryPresentations=tiles)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching dashboard tiles for document {document_id}: {exc}")
        return None
