#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""REST source module"""

import traceback
from typing import Iterable, List, Optional, Set  # noqa: UP035

from pydantic import AnyUrl

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import ApiRequestMethod
from metadata.generated.schema.entity.services.connections.api.openAPISchemaURL import (
    OpenAPISchemaURL,
)
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.apiSchema import APISchema
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Markdown
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel, FieldName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.api.api_service import ApiServiceSource
from metadata.ingestion.source.api.rest.models import RESTCollection, RESTEndpoint
from metadata.ingestion.source.api.rest.parser import parse_openapi_schema
from metadata.utils import fqn
from metadata.utils.filters import filter_by_collection, filter_by_endpoint
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DEFAULT_TAG = "default"


class RestSource(ApiServiceSource):
    """
    Source implementation to ingest REST data.

    We will iterate on the registered collections, endpoints
    and prepare an iterator of
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.json_response: dict = {}
        self._collections: Optional[List[RESTCollection]] = None  # noqa: UP006, UP045

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: RestConnection = config.serviceConnection.root.config
        if not isinstance(connection, RestConnection):
            raise InvalidSourceException(f"Expected RestConnection, but got {connection}")
        return cls(config, metadata)

    def _get_openapi_schema(self) -> dict:
        """Fetch and parse the OpenAPI document once.

        Both topology nodes produce from ``get_api_collections``, so without this a
        large document would be downloaded and parsed twice.
        """
        if not self.json_response:
            if isinstance(self.connection, dict):
                self.json_response = self.connection
            else:
                self.json_response = parse_openapi_schema(self.connection)
        return self.json_response

    def _tag_collections(self, json_response: dict) -> List[dict]:  # noqa: UP006
        """Collection definitions declared in the document's root ``tags``.

        Non-conforming entries (the spec requires an object with a ``name``) are
        skipped instead of aborting: a tag only referenced from ``paths`` is still
        recovered by ``_path_collection_names``.
        """
        collections_list = []
        for collection in json_response.get("tags") or []:
            if not isinstance(collection, dict):
                logger.warning(f"Skipping malformed tag entry, expected an object with a name: {collection}")
                continue
            collection_name = collection.get("name")
            if isinstance(collection_name, str) and collection_name:
                collections_list.append({**collection, "name": collection_name})
        return collections_list

    def _path_collection_names(self, json_response: dict) -> Set[str]:  # noqa: UP006
        """Tag names referenced by operations under ``paths``."""
        collections_set: Set[str] = set()  # noqa: UP006
        for methods in (json_response.get("paths") or {}).values():
            if not isinstance(methods, dict):
                continue
            for info in methods.values():
                if isinstance(info, dict):
                    collections_set.update(tag for tag in info.get("tags") or [] if isinstance(tag, str))
        return collections_set

    def _derive_collections(self) -> List[RESTCollection]:  # noqa: UP006
        """Derive every collection the document describes.

        A collection that cannot be built is reported and skipped so one malformed
        tag cannot silently drop the rest of the document - the previous single
        try/except around the whole walk stopped the generator on the first bad
        entry, leaving the service with few or no collections.
        """
        collections: List[RESTCollection] = []  # noqa: UP006
        try:
            json_response = self._get_openapi_schema()
        except Exception as err:
            logger.error(f"Error while fetching collections from schema URL :{err}")
            logger.debug(traceback.format_exc())
            return collections

        collections_list = self._tag_collections(json_response)
        tags_collection_set = {str(collection["name"]) for collection in collections_list}
        # append default tag for endpoints that don't have any collection tag
        if DEFAULT_TAG not in tags_collection_set:
            tags_collection_set.add(DEFAULT_TAG)
            collections_list.append({"name": DEFAULT_TAG})
        # iterate through paths if there's any missing collection not present in tags
        # sorted() so a rerun derives the collections in the same order every time
        collections_list.extend(
            {"name": collection_name}
            for collection_name in sorted(self._path_collection_names(json_response))
            if collection_name not in tags_collection_set
        )

        for collection in collections_list:
            collection_name = str(collection["name"])
            if filter_by_collection(
                self.source_config.apiCollectionFilterPattern,
                collection_name,
            ):
                self.status.filter(collection_name, "Collection filtered out")
                continue
            try:
                collections.append(RESTCollection(**collection))
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=collection_name,
                        error=f"Error building api collection [{collection_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
        return collections

    def get_api_collections(self, *args, **kwargs) -> Iterable[RESTCollection]:
        """
        Method to list all collections to process.
        Here is where filtering happens

        Memoized: the endpoint node replays this producer and needs the very same
        objects, since ``yield_api_collection`` resolves ``collection.url`` in place
        and ``_generate_endpoint_url`` builds endpoint URLs from it.
        """
        if self._collections is None:
            self._collections = self._derive_collections()
        yield from self._collections

    def yield_api_collection(self, collection: RESTCollection) -> Iterable[Either[CreateAPICollectionRequest]]:
        """Method to return api collection Entities"""
        try:
            collection.url = self._generate_collection_url(collection.name.root)
            collection_request = CreateAPICollectionRequest(
                name=collection.name,
                displayName=collection.display_name,
                description=collection.description,
                service=FullyQualifiedEntityName(self.context.get().api_service),
                endpointURL=collection.url,
            )
            yield Either(right=collection_request)
            self.register_record(collection_request=collection_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=collection.name.root,
                    error=f"Error creating api collection request: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_api_endpoint(self, collection: RESTCollection) -> Iterable[Either[CreateAPIEndpointRequest]]:
        """Method to return api endpoint Entities"""
        filtered_endpoints = self._filter_collection_endpoints(collection) or {}
        for path, methods in filtered_endpoints.items():
            for method_type, info in methods.items():
                try:
                    endpoint = self._prepare_endpoint_data(path, method_type, info, collection)
                    if not endpoint:
                        continue
                    if filter_by_endpoint(
                        self.source_config.apiEndpointFilterPattern,
                        endpoint.display_name,
                    ):
                        self.status.filter(endpoint.display_name, "Endpoint filtered out")
                        continue
                    yield Either(
                        right=CreateAPIEndpointRequest(
                            name=endpoint.name,
                            displayName=endpoint.display_name,
                            description=endpoint.description,
                            endpointURL=endpoint.url,
                            requestMethod=self._get_api_request_method(method_type),
                            requestSchema=self._get_request_schema(info),
                            responseSchema=self._get_response_schema(info),
                            apiCollection=FullyQualifiedEntityName(
                                fqn.build(
                                    self.metadata,
                                    entity_type=APICollection,
                                    service_name=self.context.get().api_service,
                                    api_collection_name=collection.name.root,
                                )
                            ),
                        )
                    )
                except Exception as exc:  # pylint: disable=broad-except
                    yield Either(
                        left=StackTraceError(
                            name=endpoint.name,
                            error=f"Error creating API Endpoint request [{info.get('operationId')}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _filter_collection_endpoints(self, collection: RESTCollection) -> Optional[dict]:  # noqa: UP045
        """filter endpoints related to specific collection"""
        try:
            filtered_paths = {}
            for path, methods in self.json_response.get("paths", {}).items():
                for method_type, info in methods.items():  # noqa: B007, PERF102
                    if (
                        collection.name.root == DEFAULT_TAG and not info.get("tags")
                    ) or collection.name.root in info.get("tags", []):
                        filtered_paths.update({path: methods})
                    break
            return filtered_paths  # noqa: TRY300
        except Exception as err:  # noqa: F841
            logger.warning(f"Error while filtering endpoints for collection {collection.name.root}")
            return None

    def _prepare_endpoint_data(self, path, method_type, info, collection) -> Optional[RESTEndpoint]:  # noqa: UP045
        try:
            endpoint = RESTEndpoint(**info)
            path_clean_name = clean_uri(path)
            endpoint.name = f"{path_clean_name}/{method_type}"
            endpoint.display_name = f"{path_clean_name}"
            endpoint.url = self._generate_endpoint_url(collection, endpoint)
            return endpoint  # noqa: TRY300
        except Exception as err:
            logger.warning(f"Error while parsing endpoint data: {err}")
        return None

    def _get_fallback_url(self) -> Optional[AnyUrl]:  # noqa: UP045
        """Return openAPISchemaURL if available, otherwise None."""
        schema_conn = self.config.serviceConnection.root.config.openAPISchemaConnection  # pyright: ignore[reportAttributeAccessIssue]
        if isinstance(schema_conn, OpenAPISchemaURL):
            return schema_conn.openAPISchemaURL
        return None

    def _generate_collection_url(self, collection_name: str) -> Optional[AnyUrl]:  # noqa: UP045
        """generate collection url"""
        try:
            base_url = self.config.serviceConnection.root.config.docURL  # pyright: ignore[reportAttributeAccessIssue]
            if not base_url:
                logger.debug(f"Could not generate collection url for {collection_name} because docURL is not present")
                return self._get_fallback_url()
            base_url = str(base_url)
            if base_url.endswith("#/") or base_url.endswith("#"):  # noqa: PIE810
                base_url = base_url.split("#")[0]
            return AnyUrl(f"{clean_uri(base_url)}/#/{collection_name}")
        except Exception as err:
            logger.warning(f"Error while generating collection url for {collection_name}: {err}")
        return self._get_fallback_url()

    def _generate_endpoint_url(self, collection: RESTCollection, endpoint: RESTEndpoint) -> Optional[AnyUrl]:  # noqa: UP045
        """generate endpoint url"""
        try:
            if not collection.url or not endpoint.operationId:
                logger.debug(
                    f"Could not generate endpoint url for {str(endpoint.name)},"  # noqa: RUF010
                    f" collection url: {str(collection.url)},"  # noqa: RUF010
                    f" endpoint operation id: {str(endpoint.operationId)}"  # noqa: RUF010
                )
                return self._get_fallback_url()
            return AnyUrl(f"{str(collection.url)}/{endpoint.operationId}")  # noqa: RUF010
        except Exception as err:
            logger.warning(f"Error while generating collection url: {err}")
        return self._get_fallback_url()

    def _get_api_request_method(self, method_type: str) -> Optional[str]:  # noqa: UP045
        """fetch endpoint request method"""
        try:
            return ApiRequestMethod[method_type.upper()]
        except KeyError as err:
            logger.warning(f"Keyerror while fetching request method: {err}")
        return None

    def _get_request_schema(self, info: dict) -> Optional[APISchema]:  # noqa: UP045
        """fetch request schema - supports both OpenAPI 3.0 and Swagger 2.0"""
        try:
            # Try OpenAPI 3.0 format first (requestBody)
            schema = info.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            schema_ref = schema.get("$ref")
            if not schema_ref and self._parse_openapi_type(schema.get("type")) == DataTypeTopic.ARRAY:
                schema_ref = schema.get("items", {}).get("$ref")

            if schema_ref:
                return APISchema(schemaFields=self.process_schema_fields(schema_ref))

            # Try Swagger 2.0 format (parameters with "in": "body")
            parameters = info.get("parameters", [])
            for param in parameters:
                if param.get("in") == "body" and "schema" in param:
                    schema = param["schema"]
                    schema_ref = schema.get("$ref")
                    if not schema_ref and self._parse_openapi_type(schema.get("type")) == DataTypeTopic.ARRAY:
                        schema_ref = schema.get("items", {}).get("$ref")
                    if schema_ref:
                        return APISchema(schemaFields=self.process_schema_fields(schema_ref))

            # Try to get query/path parameters for GET/DELETE requests
            # This handles Swagger 2.0 and OpenAPI 3.0 query parameters
            param_fields = []
            for param in parameters:
                # Resolve parameter $ref if present
                if "$ref" in param:
                    param = self._resolve_parameter_ref(param.get("$ref"))  # noqa: PLW2901
                    if not param:
                        continue

                if param.get("in") in ["query", "path"]:
                    field = self._convert_parameter_to_field(param)
                    if field:
                        param_fields.append(field)

            if param_fields:
                return APISchema(schemaFields=param_fields)

            logger.debug("No request schema found for the endpoint")
            return None  # noqa: TRY300
        except Exception as err:
            logger.warning(f"Error while parsing request schema: {err}")
        return None

    def _resolve_parameter_ref(self, param_ref: str) -> Optional[dict]:  # noqa: UP045
        """Resolve parameter $ref to actual parameter definition"""
        try:
            # Parameter refs look like: "#/parameters/ParameterName"
            if not param_ref or not param_ref.startswith("#/parameters/"):
                return None

            param_name = param_ref.split("/")[-1]  # noqa: PLC0207

            # Swagger 2.0: parameters at root level
            if self.json_response.get("parameters"):
                return self.json_response.get("parameters", {}).get(param_name)

            # OpenAPI 3.0: components.parameters
            if self.json_response.get("components"):
                return self.json_response.get("components", {}).get("parameters", {}).get(param_name)

            logger.debug(f"Parameter reference '{param_name}' not found")
            return None  # noqa: TRY300
        except Exception as err:
            logger.warning(f"Error resolving parameter reference: {err}")
            return None

    def _parse_openapi_type(
        self,
        openapi_type: Optional[object],  # noqa: UP045
        openapi_format: Optional[object] = None,  # noqa: UP045
    ) -> DataTypeTopic:
        """
        Parse OpenAPI type string to DataTypeTopic enum.
        Shared type conversion logic used across the codebase.
        """
        if isinstance(openapi_type, list):
            non_null_types = [item for item in openapi_type if isinstance(item, str) and item.lower() != "null"]
            openapi_type = non_null_types[0] if len(non_null_types) == 1 else None

        if not isinstance(openapi_type, str):
            return DataTypeTopic.UNKNOWN

        if not openapi_type:
            return DataTypeTopic.UNKNOWN

        if openapi_type.lower() == "number" and isinstance(openapi_format, str):
            normalized_format = openapi_format.upper()
            if normalized_format in {"FLOAT", "DOUBLE"}:
                return DataTypeTopic[normalized_format]

        # Handle INTEGER -> INT conversion
        normalized_type = "INT" if openapi_type.upper() == "INTEGER" else openapi_type.upper()

        # Check if type exists in DataTypeTopic enum
        if normalized_type in DataTypeTopic.__members__:
            return DataTypeTopic[normalized_type]

        return DataTypeTopic.UNKNOWN

    def _convert_parameter_to_field(self, param: dict) -> Optional[FieldModel]:  # noqa: UP045
        """Convert OpenAPI/Swagger parameter to FieldModel for query/path parameters"""
        try:
            param_name = param.get("name")
            if not param_name:
                return None

            param_schema = param.get("schema", {})
            param_type = param.get("type") or param_schema.get("type")
            param_format = param.get("format") or (
                param_schema.get("format") if isinstance(param_schema, dict) else None
            )
            data_type = self._parse_openapi_type(param_type, param_format)

            # Handle array items
            children = None
            if data_type == DataTypeTopic.ARRAY:
                items = param.get("items") or param.get("schema", {}).get("items")
                if items:
                    item_type = items.get("type")
                    child_data_type = self._parse_openapi_type(item_type, items.get("format"))
                    children = [FieldModel(name="item", dataType=child_data_type)]

            return FieldModel(
                name=param_name,
                dataType=data_type,
                children=children,
                description=param.get("description"),
            )
        except Exception as err:
            logger.warning(f"Error converting parameter to field: {err}")
            return None

    def _process_array_items(
        self,
        items: dict,
        parent_refs: List[str],  # noqa: UP006
    ) -> Optional[List[FieldModel]]:  # noqa: UP006, UP045
        if not items:
            return None

        items_ref = items.get("$ref")
        if items_ref:
            if items_ref in parent_refs:
                logger.debug(f"Skipping array fields inside schema: {items_ref} to avoid infinite recursion")
                return None

            logger.debug(f"Processing array fields inside schema: {items_ref}")
            children = self.process_schema_fields(items_ref, parent_refs)
            logger.debug(f"Completed processing array fields inside schema: {items_ref}")
            return children

        properties = items.get("properties", {})
        if properties:
            return self._process_schema_properties(properties, parent_refs)

        return [
            FieldModel(
                name=FieldName(root="item"),
                dataType=self._parse_openapi_type(items.get("type"), items.get("format")),
            )
        ]

    def _process_schema_properties(
        self,
        properties: dict,
        parent_refs: List[str],  # noqa: UP006
    ) -> List[FieldModel]:  # noqa: UP006
        fields = []
        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get("type")
            children = None
            data_type_display = None

            if prop_type:
                data_type = self._parse_openapi_type(prop_type, prop_def.get("format"))
                if data_type == DataTypeTopic.ARRAY:
                    children = self._process_array_items(prop_def.get("items", {}), parent_refs)
            else:
                data_type = DataTypeTopic.UNKNOWN
                data_type_display = "OBJECT"
                prop_ref = prop_def.get("$ref")
                if prop_ref:
                    if prop_ref not in parent_refs:
                        children = self.process_schema_fields(prop_ref, parent_refs)
                    else:
                        logger.debug(f"Skipping object fields inside schema: {prop_ref} to avoid infinite recursion")
                elif prop_def.get("properties"):
                    children = self._process_schema_properties(prop_def["properties"], parent_refs)

            description = prop_def.get("description")
            description_obj = Markdown(root=description) if description is not None else None
            fields.append(
                FieldModel(
                    name=prop_name,
                    dataType=data_type,
                    dataTypeDisplay=data_type_display,
                    children=children,
                    description=description_obj,
                )
            )

        return fields

    def _process_inline_schema(self, properties: dict) -> Optional[APISchema]:  # noqa: UP045
        """Process inline schema properties (schemas without $ref)"""
        try:
            fields = self._process_schema_properties(properties, [])
            return APISchema(schemaFields=fields) if fields else None
        except Exception as err:
            logger.warning(f"Error processing inline schema: {err}")
            return None

    def _extract_schema_from_response(self, response: dict) -> dict:
        """Extract schema from a response object (supports both OpenAPI 3.0 and Swagger 2.0)"""
        # OpenAPI 3.0: response.content.application/json.schema
        schema = response.get("content", {}).get("application/json", {}).get("schema", {})
        # Swagger 2.0: response.schema
        if not schema:
            schema = response.get("schema", {})
        return schema

    def _get_response_schema(self, info: dict) -> Optional[APISchema]:  # noqa: UP045
        """fetch response schema - supports OpenAPI 3.0, Swagger 2.0, arrays, and inline schemas"""
        try:
            # Try response code 200 first
            response_200 = info.get("responses", {}).get("200", {})
            schema = self._extract_schema_from_response(response_200)

            # Fallback: Try other success response codes if 200 not found
            if not schema:
                responses = info.get("responses", {})
                for code in ["201", "202", "203", "204"]:
                    if code in responses:
                        logger.debug(f"Using response code {code} as 200 not found")
                        schema = self._extract_schema_from_response(responses[code])
                        if schema:
                            break

            if not schema:
                logger.debug("No response schema found for the endpoint")
                return None

            # Case 1: Direct $ref (object response)
            schema_ref = schema.get("$ref")
            if schema_ref:
                return APISchema(schemaFields=self.process_schema_fields(schema_ref))

            # Case 2: Array response with $ref in items
            if schema.get("type") == "array":
                items_ref = schema.get("items", {}).get("$ref")
                if items_ref:
                    logger.debug(f"Processing array response schema: {items_ref}")
                    return APISchema(schemaFields=self.process_schema_fields(items_ref))

            # Case 3: Nested $ref in schema.properties.data
            schema_ref = schema.get("properties", {}).get("data", {}).get("$ref")
            if schema_ref:
                logger.debug("Found response schema in schema.properties.data")
                return APISchema(schemaFields=self.process_schema_fields(schema_ref))

            # Case 4: Inline schema with properties (no $ref)
            properties = schema.get("properties", {})
            if properties:
                logger.debug("Processing inline response schema with properties")
                return self._process_inline_schema(properties)

            logger.debug("No processable response schema found for the endpoint")
            return None  # noqa: TRY300
        except Exception as err:
            logger.warning(f"Error while parsing response schema: {err}")
        return None

    def _resolve_schema_ref(self, schema_ref: str) -> Optional[dict]:  # noqa: UP045
        schema_name = schema_ref.rsplit("/", maxsplit=1)[-1]
        if self.json_response.get("components"):
            return self.json_response.get("components", {}).get("schemas", {}).get(schema_name)
        if self.json_response.get("definitions"):
            return self.json_response.get("definitions", {}).get(schema_name)
        return None

    def process_schema_fields(
        self,
        schema_ref: str,
        parent_refs: Optional[List[str]] = None,  # noqa: UP006, UP045
    ) -> Optional[List[FieldModel]]:  # noqa: UP006, UP045
        try:
            if parent_refs is None:
                parent_refs = []
            schema_name = schema_ref.split("/")[-1]  # noqa: PLC0207

            schema_fields = self._resolve_schema_ref(schema_ref)

            if not schema_fields:
                logger.warning(f"Schema '{schema_name}' not found in components.schemas or definitions")
                return None

            parent_refs.append(schema_ref)
            try:
                if self._parse_openapi_type(schema_fields.get("type")) == DataTypeTopic.ARRAY:
                    return self._process_array_items(schema_fields.get("items", {}), parent_refs) or []

                return self._process_schema_properties(schema_fields.get("properties", {}), parent_refs)
            finally:
                parent_refs.pop()
        except Exception as err:
            warning = f"Error while processing schema fields: {err}"
            logger.warning(warning)
        return None
