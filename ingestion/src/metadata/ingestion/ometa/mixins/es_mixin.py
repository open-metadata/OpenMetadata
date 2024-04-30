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
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import functools
import json
import traceback
from typing import Generic, Iterable, List, Optional, Set, Type, TypeVar

from pydantic import BaseModel
from requests.utils import quote

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.query import Query
from metadata.ingestion.ometa.client import REST, APIError
from metadata.utils.elasticsearch import ES_INDEX_MAP
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)


class ESMixin(Generic[T]):
    """
    OpenMetadata API methods related to Elasticsearch.

    To be inherited by OpenMetadata
    """

    client: REST

    fqdn_search = (
        "/search/fieldQuery?fieldName={field_name}&fieldValue={field_value}&from={from_}"
        "&size={size}&index={index}"
    )

    @functools.lru_cache(maxsize=512)
    def _search_es_entity(
        self,
        entity_type: Type[T],
        query_string: str,
        fields: Optional[str] = None,
    ) -> Optional[List[T]]:
        """
        Run the ES query and return a list of entities that match. It does an extra query to the OM API with the
        requested fields per each entity found in ES.
        :param entity_type: Entity to look for
        :param query_string: Query to run
        :return: List of Entities or None
        """
        response = self.client.get(query_string)

        if response:
            if fields:
                fields = fields.split(",")
            return [
                self.get_by_name(
                    entity=entity_type,
                    fqn=hit["_source"]["fullyQualifiedName"],
                    fields=fields,
                )
                for hit in response["hits"]["hits"]
            ] or None

        return None

    def get_entity_from_es(
        self, entity: Type[T], query_string: str, fields: Optional[list] = None
    ) -> Optional[T]:
        """Fetch an entity instance from ES"""

        try:
            entity_list = self._search_es_entity(
                entity_type=entity, query_string=query_string, fields=fields
            )
            for instance in entity_list or []:
                return instance
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get {entity.__name__} info from ES due to {err}")

        return None

    def yield_entities_from_es(
        self, entity: Type[T], query_string: str, fields: Optional[list] = None
    ) -> Iterable[T]:
        """Fetch an entity instance from ES"""

        try:
            entity_list = self._search_es_entity(
                entity_type=entity, query_string=query_string, fields=fields
            )
            for instance in entity_list or []:
                yield instance
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get {entity.__name__} info from ES due to {err}")

        return None

    def es_search_from_fqn(
        self,
        entity_type: Type[T],
        fqn_search_string: str,
        from_count: int = 0,
        size: int = 10,
        fields: Optional[str] = None,
    ) -> Optional[List[T]]:
        """
        Given a service name and filters, search for entities using Elasticsearch.

        Args:
            entity_type (Type[T]): The type of entity to look for.
            fqn_search_string (str): The string used to search by fully qualified name (FQN).
                Example: "service.*.schema.table".
            from_count (int): The starting index of the search results.
            size (int): The maximum number of records to return.
            fields (Optional[str]): Comma-separated list of fields to be returned.

        Returns:
            Optional[List[T]]: A list of entities that match the search criteria, or None if no entities are found.
        """
        return self._es_search_entity(
            entity_type=entity_type,
            field_value=fqn_search_string,
            field_name="fullyQualifiedName",
            from_count=from_count,
            size=size,
            fields=fields,
        )

    def es_search_container_by_path(
        self,
        full_path: str,
        from_count: int = 0,
        size: int = 10,
        fields: Optional[str] = None,
    ) -> Optional[List[Container]]:
        """
        Given a service name and filters, search for containers using Elasticsearch.

        Args:
            entity_type (Type[T]): The type of entity to look for.
            full_path (str): The string used to search by full path.
            from_count (int): The starting index of the search results.
            size (int): The maximum number of records to return.
            fields (Optional[str]): Comma-separated list of fields to be returned.

        Returns:
            Optional[List[Container]]: A list of containers that match the search criteria, or None if no entities are found.
        """
        return self._es_search_entity(
            entity_type=Container,
            field_value=full_path,
            field_name="fullPath",
            from_count=from_count,
            size=size,
            fields=fields,
        )

    def _es_search_entity(
        self,
        entity_type: Type[T],
        field_value: str,
        field_name: str,
        from_count: int = 0,
        size: int = 10,
        fields: Optional[str] = None,
    ) -> Optional[List[T]]:
        """
        Search for entities using Elasticsearch.

        Args:
            entity_type (Type[T]): The type of entity to look for.
            field_value (str): The value to search for in the specified field.
            field_name (str): The name of the field to search in.
            from_count (int, optional): The starting index of the search results. Defaults to 0.
            size (int, optional): The maximum number of search results to return. Defaults to 10.
            fields (Optional[str], optional): Comma-separated list of fields to be returned. Defaults to None.

        Returns:
            Optional[List[T]]: A list of entities that match the search criteria, or None if no entities are found.
        """
        query_string = self.fqdn_search.format(
            field_name=field_name,
            field_value=field_value,
            from_=from_count,
            size=size,
            index=ES_INDEX_MAP[entity_type.__name__],  # Fail if not exists
        )

        try:
            response = self._search_es_entity(
                entity_type=entity_type, query_string=query_string, fields=fields
            )
            return response
        except KeyError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Cannot find the index in ES_INDEX_MAP for {entity_type.__name__}: {err}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Elasticsearch search failed for query [{query_string}]: {exc}"
            )
        return None

    @staticmethod
    def get_query_with_lineage_filter(service_name: str) -> str:
        query_lineage_filter = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"processedLineage": True}},
                        {"term": {"service.name.keyword": service_name}},
                    ]
                }
            }
        }
        return quote(json.dumps(query_lineage_filter))

    @functools.lru_cache(maxsize=12)
    def es_get_queries_with_lineage(self, service_name: str) -> Optional[Set[str]]:
        """Get a set of query checksums that have already been processed for lineage"""
        try:
            resp = self.client.get(
                f"/search/query?q=&index={ES_INDEX_MAP[Query.__name__]}"
                "&include_source_fields=checksum&include_source_fields="
                f"processedLineage&query_filter={self.get_query_with_lineage_filter(service_name)}"
            )
            return {elem["_source"]["checksum"] for elem in resp["hits"]["hits"]}

        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get queries from ES due to [{err}]")
            return None

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unknown error extracting results from ES query [{err}]")
            return None
