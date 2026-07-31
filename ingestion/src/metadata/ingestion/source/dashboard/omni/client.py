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

import re
import traceback
from collections.abc import Iterable
from typing import cast

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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

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

    def __init__(self, config: OmniConnection, verify_ssl: bool | str | None = None):
        self.config = config
        # The Omni REST API lives under `<org-url>/api`. Be forgiving about what the
        # user enters: strip any trailing `/api` or `/api/v<n>` they may have copied
        # from the docs, then append the API root. The version ("v1") is added
        # separately by the REST client, so we must not leave it in the base URL.
        base_url = clean_uri(str(config.hostPort)).rstrip("/")
        base_url = re.sub(r"/api(/v\d+)?$", "", base_url)
        base_url = f"{base_url}/api"
        client_config = ClientConfig(
            base_url=base_url,
            api_version="v1",
            auth_token=lambda: (config.token.get_secret_value(), 0),
            auth_header=AUTHORIZATION_HEADER,
            auth_token_mode="Bearer",
            extra_headers={"Content-Type": "application/json"},
            verify=verify_ssl,
            # Omni is rate limited (60 req/min by default), so a 429 should be
            # retried with back-off rather than dropped. Retry transient 5xx too;
            # nothing is treated as a hard "skip" limit.
            retry_codes=[429, 500, 502, 503],
            limit_codes=[],
        )
        self.client = TrackedREST(client_config, source_name="omni")

    def close(self) -> None:
        """Close the underlying HTTP session, if the REST client exposes one."""
        close_fn = getattr(self.client, "close", None)
        if callable(close_fn):
            close_fn()

    # -- pagination ---------------------------------------------------------

    def _paginate(self, path: str, response_cls, params: dict | None = None) -> Iterable:
        """Yield records across all pages using cursor pagination."""
        data = {"pageSize": PAGE_SIZE, **(params or {})}
        while True:
            payload = self.client.get(path, data=data)
            if payload is None:
                break
            result = response_cls.model_validate(payload)
            yield from result.records or []
            page_info = result.pageInfo
            if not (page_info and page_info.hasNextPage and page_info.nextCursor):
                break
            data = {**data, "cursor": page_info.nextCursor}

    # -- test connection ----------------------------------------------------

    def test_access(self) -> None:
        """Lightweight call used by the CheckAccess test-connection step.

        Validates the response so a wrong host/token fails the step instead of
        silently returning nothing.
        """
        ModelsResponse.model_validate(self.client.get("/models", data={"pageSize": 1}))

    def test_get_documents(self) -> None:
        """Used by the GetDashboards test-connection step."""
        DocumentsResponse.model_validate(self.client.get("/documents", data={"pageSize": 1}))

    # -- models & topics ----------------------------------------------------

    def get_models(self) -> list[OmniModel]:
        """List the shared semantic-layer models in the instance."""
        # Keep the server-side param and the client-side guard in sync by
        # deriving both from SEMANTIC_MODEL_KINDS.
        model_kind = ",".join(sorted(SEMANTIC_MODEL_KINDS))
        try:
            models = list(self._paginate("/models", ModelsResponse, params={"modelKind": model_kind}))
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error("Error fetching Omni models: %s", exc)
            return []
        semantic_models = [model for model in models if model.modelKind in SEMANTIC_MODEL_KINDS]
        if len(semantic_models) != len(models):
            logger.debug(
                "Filtered %d non-semantic models client-side (server did not honor modelKind=%s)",
                len(models) - len(semantic_models),
                model_kind,
            )
        return semantic_models

    def get_model_topics(self, model: OmniModel) -> list[OmniTopic]:
        """
        Resolve a model's topics from its YAML definition.

        One ``/models/{id}/yaml`` call returns every view + topic for the model,
        which keeps us well within the API rate limit.
        """
        try:
            payload = cast(
                "dict | None",
                self.client.get(f"/models/{model.id}/yaml", data={"fullyResolved": "true"}),
            )
            files = (payload or {}).get("files") or {}
            return self._parse_model_yaml(model, files)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching topics for model %s: %s", model.id, exc)
            return []

    @staticmethod
    def _first(mapping: dict, keys) -> str | None:
        for key in keys:
            if mapping.get(key):
                return str(mapping[key])
        return None

    @classmethod
    def extract_schema(cls, content: dict) -> str | None:
        """Resolve the warehouse schema for a view (``schema`` key or ``schema.table``)."""
        schema = cls._first(content, _SCHEMA_KEYS)
        table = cls._first(content, _TABLE_KEYS)
        if not schema and table and "." in table:
            schema = table.rpartition(".")[0]
        return schema

    @classmethod
    def extract_table(cls, content: dict) -> str | None:
        """Resolve the warehouse table for a view, stripping any ``schema.`` prefix."""
        table = cls._first(content, _TABLE_KEYS)
        if table and "." in table and not cls._first(content, _SCHEMA_KEYS):
            table = table.rpartition(".")[-1]
        return table

    @classmethod
    def _extract_fields(cls, content: dict) -> list[OmniField]:
        fields: list[OmniField] = []
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
        return fields

    @classmethod
    def _parse_view(cls, content: dict) -> dict:
        """Extract label, schema, table and fields from a view definition."""
        return {
            "label": content.get("label"),
            "schema": cls.extract_schema(content),
            "table": cls.extract_table(content),
            "fields": cls._extract_fields(content),
        }

    @classmethod
    def _parse_model_yaml(cls, model: OmniModel, files: dict) -> list[OmniTopic]:
        """
        Build normalized data models from the model's YAML files.

        Each ``.view`` file -> a data model backed by a physical warehouse table
        (schema + table_name + fields). Each ``.topic`` file -> a curated data
        model that references a base view (for warehouse-table lineage).
        """
        # ``view_lookup`` maps every reference form (full path, dotted-qualified and
        # the bare leaf when unambiguous) to a parsed view, so a schema-qualified
        # ``base_view`` resolves to the right physical view. ``view_records`` keeps
        # one entry per view file for the "one data model per view" pass.
        view_lookup: dict = {}
        view_records: list = []
        leaf_seen: set = set()
        topic_defs: dict = {}
        for filename, raw in files.items():
            try:
                content = yaml.safe_load(raw) if isinstance(raw, str) else (raw or {})
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("Skipping unparsable YAML file %s: %s", filename, exc)
                continue
            if not isinstance(content, dict):
                continue
            base = filename.split("/")[-1]
            if filename.endswith(".view"):
                full = filename[: -len(".view")]
                leaf = base[: -len(".view")]
                parsed = cls._parse_view(content)
                view_records.append((leaf, parsed))
                # Full and dotted-qualified keys are unique; the bare leaf is only
                # keyed while unambiguous. If two view files share a leaf, drop the
                # bare key so a bare reference misses (skipping lineage) instead of
                # resolving to the wrong physical view.
                view_lookup[full] = parsed
                view_lookup[full.replace("/", ".")] = parsed
                if leaf in leaf_seen:
                    view_lookup.pop(leaf, None)
                    logger.debug(
                        "View leaf %r is ambiguous in model %s; a qualified reference is required",
                        leaf,
                        model.id,
                    )
                else:
                    leaf_seen.add(leaf)
                    view_lookup[leaf] = parsed
            elif filename.endswith(".topic"):
                topic_defs[base[: -len(".topic")]] = content

        topics: list[OmniTopic] = []
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
            # ``base_view`` may be bare or schema-qualified with ``.``, ``/`` or
            # ``__`` (per Omni's data-lineage docs); try the raw value and a
            # separator-normalized form. We never strip a qualifier down to a bare
            # leaf, so a qualified reference cannot bind to an unrelated view -- it
            # is left unresolved instead. (A single underscore is a valid
            # identifier character, so only ``__`` is treated as a separator.)
            view = view_lookup.get(base_view) or view_lookup.get(base_view.replace("__", ".").replace("/", ".")) or {}
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
        for view_name, view in view_records:
            if view_name in seen_names:
                logger.debug(
                    "Skipping view %r: name already used by a topic/view in model %s",
                    view_name,
                    model.id,
                )
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

    def get_documents(self) -> list[OmniDocument]:
        """List all documents (workbooks/dashboards) in the instance."""
        try:
            return list(self._paginate("/documents", DocumentsResponse, params={"include": "labels"}))
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error("Error fetching Omni documents: %s", exc)
            return []

    def get_dashboard_document(self, document_id: str) -> OmniDashboardDocument:
        """
        Fetch a document's tiles via the document queries endpoint.

        Tiles are built from ``/documents/{id}/queries``: each query is one tile/chart,
        and its ``query`` object carries the table/fields used for lineage.

        Always returns an ``OmniDashboardDocument`` so the dashboard is ingested even
        when its tiles cannot be fetched (e.g. legacy Omni workbooks that return
        ``400 "Workbook needs to be migrated"``) -- the dashboard is created without
        charts rather than being dropped entirely.
        """
        tiles = []
        try:
            payload = cast("dict | None", self.client.get(f"/documents/{document_id}/queries"))
            for query in (payload or {}).get("queries") or []:
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
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                "Could not fetch tiles for document %s (ingesting dashboard without charts): %s",
                document_id,
                exc,
            )
        return OmniDashboardDocument(identifier=document_id, queryPresentations=tiles)
