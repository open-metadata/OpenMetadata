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
from typing import Generic, List, Optional, Type, TypeVar

from pydantic import BaseModel

from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.utils.elasticsearch import ES_INDEX_MAP

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)


class ESMixin(Generic[T]):
    """
    OpenMetadata API methods related to Elasticsearch.

    To be inherited by OpenMetadata
    """

    client: REST

    fqdn_search = "/search/query?q=fullyQualifiedName:{fqn}&from={from_}&size={size}&index={index}"

    def _search_es_entity(
        self, entity_type: Type[T], query_string: str
    ) -> Optional[List[T]]:
        """
        Run the ES query and return a list of entities that match
        :param entity_type: Entity to look for
        :param query_string: Query to run
        :return: List of Entities or None
        """

        response = self.client.get(query_string)

        if response:
            return [
                self.get_by_name(
                    entity=entity_type, fqn=hit["_source"]["fullyQualifiedName"]
                )
                for hit in response["hits"]["hits"]
            ] or None

        return None

    def es_search_from_fqn(
        self,
        entity_type: Type[T],
        fqn_search_string: str,
        from_count: int = 0,
        size: int = 10,
    ) -> Optional[List[T]]:
        """
        Given a service_name and some filters, search for entities using ES

        :param entity_type: Entity to look for
        :param fqn_search_string: string used to search by FQN. E.g., service.*.schema.table
        :param from_count: Records to expect
        :param size: Number of records
        :return: List of entities
        """
        query_string = self.fqdn_search.format(
            fqn=fqn_search_string,
            from_=from_count,
            size=size,
            index=ES_INDEX_MAP[entity_type.__name__],  # Fail if not exists
        )

        try:
            entity_list = self._search_es_entity(
                entity_type=entity_type, query_string=query_string
            )
            if entity_list:
                return entity_list

        except KeyError:
            logger.warning(
                f"Cannot find the index in ES_INDEX_MAP for {entity_type.__name__}"
            )
        except Exception as err:
            logger.warning(
                f"Elasticsearch search failed for query: {query_string} - {err}"
            )
        return None
