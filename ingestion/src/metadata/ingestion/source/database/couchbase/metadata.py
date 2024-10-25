#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Couchbase source methods.
"""
import re
import traceback
from typing import Dict, Iterable, List, Optional

import requests
from requests.auth import HTTPBasicAuth

from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_nosql_source import CommonNoSQLSource
from metadata.ingestion.source.database.couchbase.models import IndexObject as Index
from metadata.ingestion.source.database.couchbase.queries import (
    COUCHBASE_GET_INDEX_KEYS,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DEFAULT_SCHEMA_NAME = "_default"


class CouchbaseSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from Dynamo Source
    """

    service_connection: CouchbaseConnection

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.couchbase = self.connection_obj
        self.index_condition_map = {}

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: CouchbaseConnection = config.serviceConnection.root.config
        if not isinstance(connection, CouchbaseConnection):
            raise InvalidSourceException(
                f"Expected CouchbaseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        try:
            if self.service_connection.bucket:
                self.index_condition_map.clear()
                yield self.service_connection.__dict__.get("bucket")
            else:
                buckets = self.couchbase.buckets()
                for bucket_name in buckets.get_all_buckets():
                    self.index_condition_map.clear()
                    yield bucket_name.name
        except Exception as exp:
            logger.debug(f"Failed to fetch bucket name: {exp}")
            logger.debug(traceback.format_exc())

    def get_schema_name_list(self) -> List[str]:
        """
        Method to get list of schema names available within NoSQL db
        need to be overridden by sources
        """
        database_name = self.context.get().database
        try:
            bucket = self.couchbase.bucket(database_name)
            collection_manager = bucket.collections()
            self.context.get().scope_dict = {
                scope.name: scope for scope in collection_manager.get_all_scopes()
            }
            return [scopes.name for scopes in collection_manager.get_all_scopes()]
        except Exception as exp:
            logger.debug(
                f"Failed to list scope for bucket names [{database_name}]: {exp}"
            )
            logger.debug(traceback.format_exc())
        return []

    def get_table_name_list(self, schema_name: str) -> List[str]:
        """
        Method to get list of table names available within schema db
        """
        try:
            scope_object = self.context.get().scope_dict.get(schema_name)
            return [collection.name for collection in scope_object.collections]
        except Exception as exp:
            logger.debug(
                f"Failed to list collection names for scope [{schema_name}]: {exp}"
            )
            logger.debug(traceback.format_exc())
        return []

    def _is_valid_key(self, key: str) -> bool:
        return bool(re.fullmatch(r"[a-zA-Z0-9._`\%]+", key))

    def get_index_condition(self, schema_name: str) -> str:
        """
        Method to prepare query condition based on index
        """
        bucket_name = self.context.get().database
        if self.index_condition_map.get((bucket_name, schema_name)):
            return self.index_condition_map.get((bucket_name, schema_name))

        index_condition = set()

        if schema_name == DEFAULT_SCHEMA_NAME:
            condition = f"keyspace_id = '{bucket_name}' "
        else:
            condition = f"bucket_id = '{bucket_name}' AND scope_id = '{schema_name}'"

        query = COUCHBASE_GET_INDEX_KEYS.format(condition=condition)
        result = self.couchbase.query(query)
        for row in result.rows():
            index_obj = Index(**dict(row))
            if index_obj.indexes:
                if index_obj.indexes.is_primary:
                    self.index_condition_map[(bucket_name, schema_name)] = ""
                    return ""
                for key in index_obj.indexes.index_key or []:
                    if self._is_valid_key(key):
                        condition = ""
                        if index_obj.indexes.condition:
                            condition = f"AND {index_obj.indexes.condition}"
                        index_condition.add(f"({key} is not missing {condition})")
        if index_condition:
            self.index_condition_map[
                (bucket_name, schema_name)
            ] = "WHERE " + " OR ".join(index_condition)
            return self.index_condition_map[(bucket_name, schema_name)]

        self.index_condition_map[(bucket_name, schema_name)] = ""
        return ""

    def _fetch_document_ids(self, schema_name: str, table_name: str) -> List[str]:
        # Parameters for pagination
        page_size = 100  # Number of documents to fetch per page
        document_ids = []

        try:
            page = 0
            while len(document_ids) < 1000:
                # REST API endpoint with pagination
                couchbase_port = 8091
                database_name = self.context.get().database
                connection_scheme = "http"
                url = (
                    f"{connection_scheme}://{self.service_connection.hostport}:{couchbase_port}"
                    f"/pools/default/buckets/{database_name}/scopes/{schema_name}/collections/{table_name}/docs"
                )
                params = {"skip": page * page_size, "limit": page_size}

                # Fetch the next page
                response = requests.get(
                    url,
                    auth=HTTPBasicAuth(
                        self.service_connection.username,
                        self.service_connection.password.get_secret_value(),
                    ),
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                # Add document IDs from the current page
                ids = [doc["id"] for doc in data["rows"]]
                document_ids.extend(ids)

                # If fewer documents than page_size were returned, we’re at the end
                if len(ids) < page_size:
                    break

                # Increment the page number
                page += 1

            # Limit the list to the first 1,000 IDs
            document_ids = document_ids[:1000]

            return document_ids

        except Exception as exc:
            logger.debug(f"Error fetching document IDs: [{table_name}]: {exc}")
            logger.debug(traceback.format_exc())

        logger.info("Document IDs not found")
        return []

    def get_table_columns_dict(self, schema_name: str, table_name: str) -> List[Dict]:
        """
        Method to get actual data available within table
        need to be overridden by sources
        """
        from couchbase.exceptions import QueryIndexNotFoundException

        try:
            database_name = self.context.get().database
            bucket = self.couchbase.bucket(database_name)
            scope = bucket.scope(schema_name)
            collection = scope.collection(table_name)
            documents = collection.get_multi(
                self._fetch_document_ids(schema_name, table_name)
            )
            return list(map(lambda x: x.value, documents.results.values()))
        except QueryIndexNotFoundException as exp:
            logger.warning(
                f"Fetching columns failed for [`{database_name}`.`{schema_name}`.`{table_name}`],"
                " check if the index is created for the table or data exists in the table"
            )
            logger.debug(traceback.format_exc())
        except Exception as exp:
            logger.debug(f"Failed to list column names for table [{table_name}]: {exp}")
            logger.debug(traceback.format_exc())
        return []
