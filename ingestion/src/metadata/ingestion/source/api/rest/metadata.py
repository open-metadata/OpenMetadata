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
from typing import Iterable, List, Optional

from pydantic import AnyUrl

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import ApiRequestMethod
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.api.api_service import ApiServiceSource
from metadata.ingestion.source.api.rest.models import RESTCollection, RESTEndpoint
from metadata.utils import fqn
from metadata.utils.filters import filter_by_collection
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class RestSource(ApiServiceSource):
    """
    Source implementation to ingest REST data.

    We will iterate on the registered collections, endpoints
    and prepare an iterator of
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: RestConnection = config.serviceConnection.root.config
        if not isinstance(connection, RestConnection):
            raise InvalidSourceException(
                f"Expected RestConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_api_collections(self, *args, **kwargs) -> Iterable[RESTCollection]:
        """
        Method to list all collections to process.
        Here is where filtering happens
        """
        try:
            self.json_response = self.connection.json()
            collections_list = []
            tags_collection_set = set()
            if self.json_response.get("tags", []):
                # Works only if list of tags are present in schema so we can fetch collection names
                for collection in self.json_response.get("tags", []):
                    if not collection.get("name"):
                        continue
                    collections_list.append(collection)
                    tags_collection_set.update({collection.get("name")})
            # iterate through paths if there's any missing collection not present in tags
            collections_set = set()
            for path, methods in self.json_response.get("paths", {}).items():
                for method_type, info in methods.items():
                    collections_set.update({tag for tag in info.get("tags", [])})
            for collection_name in collections_set:
                if collection_name not in tags_collection_set:
                    collections_list.append({"name": collection_name})
            for collection in collections_list:
                if filter_by_collection(
                    self.source_config.apiCollectionFilterPattern,
                    collection.get("name"),
                ):
                    self.status.filter(
                        collection.get("name"), "Collection filtered out"
                    )
                    continue
                yield RESTCollection(**collection)
        except Exception as err:
            logger.error(f"Error while fetching collections from schema URL :{err}")

    def yield_api_collection(
        self, collection: RESTCollection
    ) -> Iterable[Either[CreateAPICollectionRequest]]:
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

    def yield_api_endpoint(
        self, collection: RESTCollection
    ) -> Iterable[Either[CreateAPIEndpointRequest]]:
        """Method to return api endpoint Entities"""
        filtered_endpoints = self._filter_collection_endpoints(collection) or {}
        for path, methods in filtered_endpoints.items():
            for method_type, info in methods.items():
                try:
                    endpoint = self._prepare_endpoint_data(
                        path, method_type, info, collection
                    )
                    if not endpoint:
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

    def _filter_collection_endpoints(
        self, collection: RESTCollection
    ) -> Optional[dict]:
        """filter endpoints related to specific collection"""
        try:
            filtered_paths = {}
            for path, methods in self.json_response.get("paths", {}).items():
                for method_type, info in methods.items():
                    if collection.name.root in info.get("tags", []):
                        # path & methods are part of collection
                        filtered_paths.update({path: methods})
                    break
            return filtered_paths
        except Exception as err:
            logger.warning(
                f"Error while filtering endpoints for collection {collection.name.root}"
            )
            return None

    def _prepare_endpoint_data(
        self, path, method_type, info, collection
    ) -> Optional[RESTEndpoint]:
        try:
            endpoint = RESTEndpoint(**info)
            path_clean_name = clean_uri(path)
            endpoint.name = f"{path_clean_name}/{method_type}"
            endpoint.display_name = f"{path_clean_name}"
            endpoint.url = self._generate_endpoint_url(collection, endpoint)
            return endpoint
        except Exception as err:
            logger.warning(f"Error while parsing endpoint data: {err}")
        return None

    def _generate_collection_url(self, collection_name: str) -> Optional[AnyUrl]:
        """generate collection url"""
        try:
            base_url = self.config.serviceConnection.root.config.docURL
            if not base_url:
                logger.debug(
                    f"Could not generate collection url for {collection_name}"
                    " because docURL is not present"
                )
                return self.config.serviceConnection.root.config.openAPISchemaURL
            base_url = str(base_url)
            if base_url.endswith("#/") or base_url.endswith("#"):
                base_url = base_url.split("#")[0]
            return AnyUrl(f"{clean_uri(base_url)}/#/{collection_name}")
        except Exception as err:
            logger.warning(
                f"Error while generating collection url for {collection_name}: {err}"
            )
        return self.config.serviceConnection.root.config.openAPISchemaURL

    def _generate_endpoint_url(
        self, collection: RESTCollection, endpoint: RESTEndpoint
    ) -> AnyUrl:
        """generate endpoint url"""
        try:
            if not collection.url or not endpoint.operationId:
                logger.debug(
                    f"Could not generate endpoint url for {str(endpoint.name)},"
                    f" collection url: {str(collection.url)},"
                    f" endpoint operation id: {str(endpoint.operationId)}"
                )
                return self.config.serviceConnection.root.config.openAPISchemaURL
            return AnyUrl(f"{str(collection.url)}/{endpoint.operationId}")
        except Exception as err:
            logger.warning(f"Error while generating collection url: {err}")
        return self.config.serviceConnection.root.config.openAPISchemaURL

    def _get_api_request_method(self, method_type: str) -> Optional[str]:
        """fetch endpoint request method"""
        try:
            return ApiRequestMethod[method_type.upper()]
        except KeyError as err:
            logger.warning(f"Keyerror while fetching request method: {err}")
        return None

    def _get_request_schema(self, info: dict) -> Optional[APISchema]:
        """fetch request schema"""
        try:
            schema_ref = (
                info.get("requestBody", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema", {})
                .get("$ref")
            )
            if not schema_ref:
                logger.debug("No request schema found for the endpoint")
                return None
            return APISchema(schemaFields=self.process_schema_fields(schema_ref))
        except Exception as err:
            logger.warning(f"Error while parsing request schema: {err}")
        return None

    def _get_response_schema(self, info: dict) -> Optional[APISchema]:
        """fetch response schema"""
        try:
            schema_ref = (
                info.get("responses", {})
                .get("200", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema", {})
                .get("$ref", {})
            )
            if not schema_ref:
                logger.debug("Trying to parse response schema from schema property")
                schema_ref = (
                    info.get("responses", {})
                    .get("200", {})
                    .get("content", {})
                    .get("application/json", {})
                    .get("schema", {})
                    .get("properties", {})
                    .get("data", {})
                    .get("$ref")
                )
            if not schema_ref:
                logger.debug("No response schema found for the endpoint")
                return None
            return APISchema(schemaFields=self.process_schema_fields(schema_ref))
        except Exception as err:
            logger.warning(f"Error while parsing response schema: {err}")
        return None

    def process_schema_fields(
        self, schema_ref: str, parent_refs: Optional[List[str]] = None
    ) -> Optional[List[FieldModel]]:
        try:
            if parent_refs is None:
                parent_refs = []
            schema_name = schema_ref.split("/")[-1]
            schema_fields = (
                self.json_response.get("components").get("schemas").get(schema_name)
            )
            parent_refs.append(schema_ref)
            fetched_fields = []
            for key, val in schema_fields.get("properties", {}).items():
                dtype = val.get("type")
                if dtype:
                    dtype = "INT" if dtype.upper() == "INTEGER" else dtype
                    parsed_dtype = (
                        DataTypeTopic[dtype.upper()]
                        if dtype.upper() in DataTypeTopic.__members__
                        else DataTypeTopic.UNKNOWN
                    )
                    children = None
                    if parsed_dtype.value == DataTypeTopic.ARRAY.value:
                        # If field of array type then parse children
                        children_ref = val.get("items", {}).get("$ref")
                        if children_ref:
                            # check infinite recursion by checking pre-processed schemas(parent_refs)
                            if children_ref not in parent_refs:
                                logger.debug(
                                    f"Processing array fields inside schema: {children_ref}"
                                )
                                children = self.process_schema_fields(
                                    children_ref, parent_refs
                                )
                                logger.debug(
                                    f"Completed processing array fields inside schema: {children_ref}"
                                )
                            else:
                                logger.debug(
                                    f"Skipping array fields inside schema: {children_ref} to avoid infinite recursion"
                                )
                    fetched_fields.append(
                        FieldModel(name=key, dataType=parsed_dtype, children=children)
                    )
                else:
                    # If type of field is not defined then check for sub-schema
                    # Check if it's `object` type field
                    children = None
                    if val.get("$ref"):
                        # check infinite recursion by checking pre-processed schemas(parent_refs)
                        if val.get("$ref") not in parent_refs:
                            children = self.process_schema_fields(
                                val.get("$ref"), parent_refs
                            )
                        else:
                            logger.debug(
                                f"Skipping object fields inside schema: {val.get('$ref')} to avoid infinite recursion"
                            )
                    fetched_fields.append(
                        FieldModel(
                            name=key,
                            dataType=DataTypeTopic.UNKNOWN,
                            dataTypeDisplay="OBJECT",
                            children=children,
                        )
                    )
            if parent_refs and (schema_ref in parent_refs):
                parent_refs.pop()
            return fetched_fields
        except Exception as err:
            logger.warning(f"Error while processing schema fields: {err}")
            if parent_refs and (schema_ref in parent_refs):
                parent_refs.pop()
                logger.debug(
                    f"Popping {schema_ref} from parent_refs due to processing error"
                )
        return None
