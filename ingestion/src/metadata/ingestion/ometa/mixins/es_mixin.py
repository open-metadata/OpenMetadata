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
Mixin class containing Lineage specific methods

To be used by OpenMetadata class
"""
import functools
import json
import traceback
from typing import (
    Generic,
    Iterable,
    Iterator,
    List,
    Optional,
    Set,
    Type,
    TypeVar,
    Union,
)
from urllib.parse import quote_plus

from pydantic import Field
from typing_extensions import Annotated

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.client import REST, APIError
from metadata.ingestion.ometa.utils import quote
from metadata.ingestion.source.models import TableView
from metadata.utils.elasticsearch import ES_INDEX_MAP, get_entity_from_es_result
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)


class TotalModel(BaseModel):
    """Elasticsearch total model"""

    relation: str
    value: int


class HitsModel(BaseModel):
    """Elasticsearch hits model"""

    index: Annotated[str, Field(description="Index name", alias="_index")]
    type: Annotated[
        Optional[str],
        Field(default=None, description="Type of the document", alias="_type"),
    ]
    id: Annotated[str, Field(description="Document ID", alias="_id")]
    score: Annotated[
        Optional[float], Field(description="Score of the document", alias="_score")
    ]
    source: Annotated[dict, Field(description="Document source", alias="_source")]
    sort: Annotated[
        List[str],
        Field(description="Sort field. Used internally to get the next page FQN"),
    ]


class ESHits(BaseModel):
    """Elasticsearch hits model"""

    total: Annotated[TotalModel, Field(description="Total matched elements")]
    hits: Annotated[List[HitsModel], Field(description="List of matched elements")]


class ESResponse(BaseModel):
    """Elasticsearch response model"""

    hits: ESHits


class ESMixin(Generic[T]):
    """
    OpenMetadata API methods related to Elasticsearch.

    To be inherited by OpenMetadata
    """

    client: REST

    fqdn_search = (
        "/search/fieldQuery?fieldName={field_name}&fieldValue={field_value}&from={from_}"
        "&size={size}&index={index}&deleted=false"
    )

    # sort_field needs to be unique for the pagination to work, so we can use the FQN
    paginate_query = (
        "/search/query?q=&size={size}&deleted=false{filter}&index={index}{include_fields}"
        "&sort_field=fullyQualifiedName{after}"
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

            entities = []
            for hit in response["hits"]["hits"]:
                entity = self.get_by_name(
                    entity=entity_type,
                    fqn=hit["_source"]["fullyQualifiedName"],
                    fields=fields,
                )
                if entity is None:
                    continue

                entities.append(entity)

            return entities or None

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

    def _get_include_fields_query(self, fields: Optional[List[str]]) -> str:
        """Get the include fields query"""
        if fields:
            return "&include_source_fields=" + "&include_source_fields=".join(fields)
        return ""

    def _paginate_es_internal(
        self,
        entity: Type[T],
        query_filter: Optional[str] = None,
        size: int = 100,
        include_fields: Optional[List[str]] = None,
    ) -> Iterator[ESResponse]:
        """Paginate through the ES results, ignoring individual errors"""
        after: Optional[str] = None
        error_pages = 0
        query = functools.partial(
            self.paginate_query.format,
            index=ES_INDEX_MAP[entity.__name__],
            filter="&query_filter=" + quote_plus(query_filter) if query_filter else "",
            size=size,
            include_fields=self._get_include_fields_query(include_fields),
        )
        while True:
            query_string = query(
                after="&search_after=" + quote_plus(after) if after else ""
            )
            response = self._get_es_response(query_string)

            # Allow 3 errors getting pages before getting out of the loop
            if not response:
                error_pages += 1
                if error_pages < 3:
                    continue
                else:
                    break
            yield response

            # Get next page
            last_hit = response.hits.hits[-1] if response.hits.hits else None
            if not last_hit or not last_hit.sort:
                logger.debug("No more pages to fetch")
                break

            after = ",".join(last_hit.sort)

    def paginate_es(
        self,
        entity: Type[T],
        query_filter: Optional[str] = None,
        size: int = 100,
        fields: Optional[List[str]] = None,
    ) -> Iterator[T]:
        for response in self._paginate_es_internal(entity, query_filter, size):
            yield from self._yield_hits_from_api(
                response=response, entity=entity, fields=fields
            )

    def _get_es_response(self, query_string: str) -> Optional[ESResponse]:
        """Get the Elasticsearch response"""
        try:
            response = self.client.get(query_string)
            return ESResponse.model_validate(response)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error while getting ES response: {exc}")
        return None

    def _yield_hits_from_api(
        self, response: ESResponse, entity: Type[T], fields: Optional[List[str]]
    ) -> Iterator[T]:
        """Get the data from the API based on ES responses"""
        for hit in response.hits.hits:
            try:
                yield self.get_by_name(
                    entity=entity,
                    fqn=hit.source["fullyQualifiedName"],
                    fields=fields,
                    nullable=False,  # Raise an error if we don't find the Entity
                )
            except Exception as exc:
                logger.warning(
                    f"Error while getting {hit.source['fullyQualifiedName']} - {exc}"
                )

    def yield_es_view_def(
        self,
        service_name: str,
        incremental: bool = False,
    ) -> Iterable[TableView]:
        """
        Get the view definition from ES
        """

        from metadata.utils import fqn

        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {"term": {"service.name.keyword": service_name}}
                                ]
                            }
                        },
                        {
                            "bool": {
                                "must": [
                                    {
                                        "bool": {
                                            "should": [
                                                {
                                                    "term": {
                                                        "tableType": TableType.View.value
                                                    }
                                                },
                                                {
                                                    "term": {
                                                        "tableType": TableType.MaterializedView.value
                                                    }
                                                },
                                                {
                                                    "term": {
                                                        "tableType": TableType.SecureView.value
                                                    }
                                                },
                                                {
                                                    "term": {
                                                        "tableType": TableType.Dynamic.value
                                                    }
                                                },
                                                {
                                                    "term": {
                                                        "tableType": TableType.Stream.value
                                                    }
                                                },
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                        {"bool": {"should": [{"term": {"deleted": False}}]}},
                        {
                            "bool": {
                                "should": [{"exists": {"field": "schemaDefinition"}}]
                            }
                        },
                    ]
                }
            }
        }
        if incremental:
            query.get("query").get("bool").get("must").append(
                {
                    "bool": {
                        "should": [
                            {"term": {"processedLineage": False}},
                            {
                                "bool": {
                                    "must_not": {
                                        "exists": {"field": "processedLineage"}
                                    }
                                }
                            },
                        ]
                    }
                }
            )
        query = json.dumps(query)
        for response in self._paginate_es_internal(
            entity=Table,
            query_filter=query,
            include_fields=["schemaDefinition", "fullyQualifiedName"],
        ):
            for hit in response.hits.hits:
                _, database_name, schema_name, table_name = fqn.split(
                    hit.source["fullyQualifiedName"]
                )
                if hit.source.get("schemaDefinition"):
                    yield TableView(
                        view_definition=hit.source["schemaDefinition"],
                        service_name=service_name,
                        db_name=database_name,
                        schema_name=schema_name,
                        table_name=table_name,
                    )

    def search_in_any_service(
        self,
        entity_type: Type[T],
        fqn_search_string: str,
        fetch_multiple_entities: bool = False,
    ) -> Optional[Union[List[Table], Table]]:
        """
        fetch table from es when with/without `db_service_name`
        """
        try:
            entity_result = get_entity_from_es_result(
                entity_list=self.es_search_from_fqn(
                    entity_type=entity_type,
                    fqn_search_string=fqn_search_string,
                ),
                fetch_multiple_entities=fetch_multiple_entities,
            )
            return entity_result
        except Exception as exc:
            logger.debug(
                f"Error to fetch entity: fqn={fqn_search_string} from es: {exc}"
            )
            logger.debug(traceback.format_exc())
        return None
