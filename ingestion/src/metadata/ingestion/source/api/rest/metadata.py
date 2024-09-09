#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""REST source module"""

import traceback
from typing import Any, Iterable, List, Optional

from pydantic import AnyUrl

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import ApiRequestMethod
from metadata.generated.schema.entity.services.connections.apiService.restConnection import (
    RESTConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.apiSchema import APISchema
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.api.api_service import ApiServiceSource
from metadata.ingestion.source.api.rest.models import RESTCollection, RESTEndpoint
from metadata.utils import fqn
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
        connection: RESTConnection = config.serviceConnection.root.config
        if not isinstance(connection, RESTConnection):
            raise InvalidSourceException(
                f"Expected RESTConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_api_collections(self, *args, **kwargs) -> Iterable[Any]:
        """
        Method to list all collections to process.
        Here is where filtering happens
        """
        json_response = {}
        try:
            json_response = self.connection.json()
        except Exception as err:
            logger.error(f"Error while fetching collections from schema URL :{err}")

        for collection in json_response.get("tags", []):
            if not collection.get("name"):
                continue
            yield collection

    def yield_api_collection(
        self, collection: dict
    ) -> Iterable[Either[CreateAPICollectionRequest]]:
        """Method to return api collection Entities"""
        try:
            rest_collection = RESTCollection(
                name=EntityName(collection.get("name")),
                display_name=collection.get("name"),
                description=Markdown(collection.get("description"))
                if collection.get("description")
                else None,
                service=FullyQualifiedEntityName(self.context.get().api_service),
                endpoint_url=AnyUrl(
                    f"{self.config.serviceConnection.root.config.openAPISchemaURL}#tag/{collection.get('name')}"
                ),
            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=collection.get("name"),
                    error=f"Error parsing collection: {err}",
                    stackTrace=traceback.format_exc(),
                )
            )
        try:
            collection_request = CreateAPICollectionRequest(
                name=rest_collection.name,
                displayName=rest_collection.display_name,
                description=rest_collection.description,
                service=rest_collection.service,
                endpointURL=rest_collection.endpoint_url,
            )
            yield Either(right=collection_request)
            self.register_record(collection_request=collection_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=collection.get("name"),
                    error=f"Error creating api collection request: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_api_endpoint(
        self, collection: dict
    ) -> Iterable[Either[CreateAPIEndpointRequest]]:
        """Method to return api endpoint Entities"""
        filtered_endpoints = self._filter_collection_endpoints(collection) or {}
        for path, methods in filtered_endpoints.items():
            for method_type, info in methods.items():
                try:
                    api_endpoint = RESTEndpoint(
                        name=EntityName(info.get("operationId")),
                        description=Markdown(info.get("description"))
                        if info.get("description")
                        else None,
                        api_collection=FullyQualifiedEntityName(
                            fqn.build(
                                self.metadata,
                                entity_type=APICollection,
                                service_name=self.context.get().api_service,
                                api_collection_name=collection.get("name"),
                            )
                        ),
                        endpoint_url=AnyUrl(
                            f"{self.config.serviceConnection.root.config.openAPISchemaURL}#operation/{info.get('operationId')}",
                        ),
                        request_method=self._get_api_request_method(method_type),
                        request_schema=self._get_request_schema(info),
                        response_schema=self._get_response_schema(info),
                    )
                except Exception as err:
                    yield Either(
                        left=StackTraceError(
                            name=collection.get("name"),
                            error=f"Error parsing api endpoint: {err}",
                            stackTrace=traceback.format_exc(),
                        )
                    )
                try:
                    yield Either(
                        right=CreateAPIEndpointRequest(
                            name=api_endpoint.name,
                            description=api_endpoint.description,
                            apiCollection=api_endpoint.api_collection,
                            endpointURL=api_endpoint.endpoint_url,
                            requestMethod=api_endpoint.request_method,
                            requestSchema=api_endpoint.request_schema,
                            responseSchema=api_endpoint.response_schema,
                        )
                    )
                except Exception as exc:  # pylint: disable=broad-except
                    yield Either(
                        left=StackTraceError(
                            name=collection.get("name"),
                            error=f"Error creating API Endpoint request [{info.get('operationId')}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _filter_collection_endpoints(self, collection: dict) -> Optional[dict]:
        """filter endpoints related to specific collection"""
        try:
            collection_name = collection.get("name")
            json_response = self.connection.json().get("paths", {})

            filtered_paths = {}
            for path, methods in json_response.items():
                for method_type, info in methods.items():
                    if collection_name in info.get("tags", []):
                        # path & methods are part of collection
                        filtered_paths.update({path: methods})
                    break
            return filtered_paths
        except Exception as err:
            logger.info(
                f"Error while filtering endpoints for collection {collection_name}"
            )
            return None

    def _get_api_request_method(self, method_type: str) -> Optional[str]:
        """fetch endpoint request method"""
        try:
            return ApiRequestMethod[method_type.upper()]
        except KeyError as err:
            logger.info(f"Keyerror while fetching request method: {err}")
        return None

    def _get_request_schema(self, info: dict) -> Optional[APISchema]:
        """fetch request schema"""
        schema_ref = (
            info.get("requestBody", {})
            .get("content", {})
            .get("application/json", {})
            .get("schema", {})
            .get("$ref")
        )
        if not schema_ref:
            logger.info("No request schema found for the endpoint")
            return None
        return self._process_schema(schema_ref)

    def _get_response_schema(self, info: dict) -> Optional[APISchema]:
        """fetch response schema"""
        schema_ref = (
            info.get("responses", {})
            .get("200", {})
            .get("content", {})
            .get("application/json", {})
            .get("schema", {})
            .get("$ref", {})
        )
        if not schema_ref:
            logger.info("No response schema found for the endpoint")
            return None
        return self._process_schema(schema_ref)

    def _process_schema(self, schema_ref: str) -> Optional[List[APISchema]]:
        """process schema"""
        try:
            schema_ref = schema_ref.split("/")[-1]
            schema_fields = (
                self.connection.json().get("components").get("schemas").get(schema_ref)
            )

            fetched_fields = []
            for key, val in schema_fields.get("properties", {}).items():
                dtype = val.get("type")
                if not dtype:
                    continue
                fetched_fields.append(
                    FieldModel(
                        name=key,
                        dataType=DataTypeTopic[dtype.upper()]
                        if dtype.upper() in DataTypeTopic.__members__
                        else DataTypeTopic.UNKNOWN,
                    )
                )
            return APISchema(schemaFields=fetched_fields)
        except Exception as err:
            logger.info(f"Error while processing request schema: {err}")
        return None
