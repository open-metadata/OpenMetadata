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
from collections.abc import Collection, Iterable, Iterator, Sequence
from dataclasses import dataclass
from typing import (
    Annotated,
    Generic,
    TypeVar,
)
from urllib.parse import quote_plus, urlencode

from pydantic import Field, field_validator

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.client import REST, APIError
from metadata.ingestion.ometa.utils import quote
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.elasticsearch import ES_INDEX_MAP, get_entity_from_es_result
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)

# Search requests are GETs that carry every term in the URL; 100 checksums or ids
# keep the request line well under the server's default 8 KiB header limit
SEARCH_TERMS_BATCH_SIZE = 100

SERVICE_NAME_FIELD = "service.name.keyword"


def _batched(values: Sequence[str], size: int) -> Iterator[list[str]]:
    for start in range(0, len(values), size):
        yield list(values[start : start + size])


class SearchCursorStalledError(RuntimeError):
    """search_after pagination cannot page an index that does not sort on the id tiebreaker."""


@dataclass(frozen=True)
class FqnSearchResult:
    """Unhydrated FQN candidates and the server's hit count."""

    fqns: tuple[str, ...]
    total: int
    total_is_exact: bool


class TotalModel(BaseModel):
    """Elasticsearch total model"""

    relation: str
    value: int


class HitsModel(BaseModel):
    """Elasticsearch hits model"""

    index: Annotated[str, Field(description="Index name", alias="_index")]
    type: Annotated[
        str | None,
        Field(default=None, description="Type of the document", alias="_type"),
    ]
    id: Annotated[str, Field(description="Document ID", alias="_id")]
    score: Annotated[
        float | None,
        Field(default=None, description="Score of the document", alias="_score"),
    ]
    source: Annotated[dict, Field(description="Document source", alias="_source")]
    sort: Annotated[
        list[str | None] | None,
        Field(
            default=None,
            description="Sort field. Used internally to get the next page FQN",
        ),
    ]

    @field_validator("sort", mode="before")
    def normalize_sort(cls, sort_value: list | None):  # noqa: N805
        """
        Return sort as a list of strings, regardless of the actual type.
        if sort_field is set to `_score`, sort is a list of the score and the sort value.

        Input examples from ES:
        - ["metric"]
        - [1.234, "metric"]

        """
        if sort_value is None:
            return None

        # A null stays null: it marks a sort field the index cannot sort on.
        return [None if v is None else str(v) for v in sort_value]


class ESHits(BaseModel):
    """Elasticsearch hits model"""

    total: Annotated[TotalModel, Field(description="Total matched elements")]
    hits: Annotated[list[HitsModel], Field(description="List of matched elements")]


class ESResponse(BaseModel):
    """Elasticsearch response model"""

    hits: ESHits


class ESMixin(Generic[T]):
    """
    OpenMetadata API methods related to Elasticsearch.

    To be inherited by OpenMetadata
    """

    client: REST

    def search_fqn_candidates(
        self,
        entity_type: type[T],
        value: str,
        *,
        wildcard: bool = False,
        size: int = 11,
    ) -> FqnSearchResult:
        """Search active FQNs without caching or hydration; propagate lookup failures."""
        if size < 1:
            raise ValueError("Candidate search size must be positive")
        if not wildcard:
            value = value.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?")
        params = urlencode(
            {
                "fieldName": "fullyQualifiedName",
                "fieldValue": value,
                "index": ES_INDEX_MAP[entity_type.__name__],
                "deleted": "false",
                "from": 0,
                "size": size,
            }
        )
        response = self.client.get("/search/fieldQuery?" + params)
        if not isinstance(response, dict):
            raise TypeError("Invalid FQN search response")
        if response.get("timed_out") or response.get("_shards", {}).get("failed", 0):
            raise ValueError("Incomplete FQN search response")
        hits = response["hits"]
        total = hits["total"]
        if isinstance(total, int):
            count, exact = total, True
        else:
            count, exact = total["value"], total["relation"] == "eq"
        return FqnSearchResult(
            fqns=tuple(hit["_source"]["fullyQualifiedName"] for hit in hits["hits"]),
            total=count,
            total_is_exact=exact,
        )

    fqdn_search = (
        "/search/fieldQuery?fieldName={field_name}&fieldValue={field_value}&from={from_}"
        "&size={size}&index={index}&deleted=false"
    )

    # sort_field needs to be unique for the pagination to work, so we can use the FQN
    paginate_query = (
        "/search/query?q={search_query}&size={size}&deleted=false{filter}&index={index}{include_fields}"
        "&sort_field={sort_field}&sort_order={sort_order}{after}"
    )

    @functools.lru_cache(maxsize=512)  # noqa: B019
    def _search_es_entity(
        self,
        entity_type: type[T],
        query_string: str,
        fields: str | None = None,
    ) -> list[T] | None:
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

    def get_entity_from_es(self, entity: type[T], query_string: str, fields: list | None = None) -> T | None:
        """Fetch an entity instance from ES"""

        try:
            entity_list = self._search_es_entity(entity_type=entity, query_string=query_string, fields=fields)
            for instance in entity_list or []:
                return instance
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get {entity.__name__} info from ES due to {err}")

        return None

    def yield_entities_from_es(self, entity: type[T], query_string: str, fields: list | None = None) -> Iterable[T]:
        """Fetch an entity instance from ES"""

        try:
            entity_list = self._search_es_entity(entity_type=entity, query_string=query_string, fields=fields)
            for instance in entity_list or []:  # noqa: UP028
                yield instance
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get {entity.__name__} info from ES due to {err}")

        return None

    def es_search_from_fqn(
        self,
        entity_type: type[T],
        fqn_search_string: str,
        from_count: int = 0,
        size: int = 10,
        fields: str | None = None,
        *,
        raise_on_error: bool = False,
    ) -> list[T] | None:
        """
        Given a service name and filters, search for entities using Elasticsearch.

        Args:
            entity_type (Type[T]): The type of entity to look for.
            fqn_search_string (str): The string used to search by fully qualified name (FQN).
                Example: "service.*.schema.table".
            from_count (int): The starting index of the search results.
            size (int): The maximum number of records to return.
            fields (Optional[str]): Comma-separated list of fields to be returned.
            raise_on_error (bool): Propagate search errors instead of returning None.

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
            raise_on_error=raise_on_error,
        )

    def es_search_from_alias(
        self,
        entity_type: type[T],
        alias_fqn: str,
        from_count: int = 0,
        size: int = 10,
        fields: str | None = None,
    ) -> list[T] | None:
        """
        Find entities carrying an exact alternate FQN in their aliases field.

        Matches on the keyword subfield only: an alias is resolved for lineage,
        where a fuzzy hit would silently attach an edge to the wrong table.
        """
        return self._es_search_entity(
            entity_type=entity_type,
            field_value=alias_fqn,
            field_name="aliases.keyword",
            from_count=from_count,
            size=size,
            fields=fields,
        )

    def es_search_container_by_path(
        self,
        full_path: str,
        from_count: int = 0,
        size: int = 10,
        fields: str | None = None,
    ) -> list[Container] | None:
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
        entity_type: type[T],
        field_value: str,
        field_name: str,
        from_count: int = 0,
        size: int = 10,
        fields: str | None = None,
        *,
        raise_on_error: bool = False,
    ) -> list[T] | None:
        """
        Search for entities using Elasticsearch.

        Args:
            entity_type (Type[T]): The type of entity to look for.
            field_value (str): The value to search for in the specified field.
            field_name (str): The name of the field to search in.
            from_count (int, optional): The starting index of the search results. Defaults to 0.
            size (int, optional): The maximum number of search results to return. Defaults to 10.
            fields (Optional[str], optional): Comma-separated list of fields to be returned. Defaults to None.
            raise_on_error (bool): Propagate search errors instead of returning None.

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
            response = self._search_es_entity(entity_type=entity_type, query_string=query_string, fields=fields)
            return response  # noqa: RET504, TRY300
        except KeyError as err:
            if raise_on_error:
                raise
            logger.debug(traceback.format_exc())
            logger.warning(f"Cannot find the index in ES_INDEX_MAP for {entity_type.__name__}: {err}")
        except Exception as exc:
            if raise_on_error:
                raise
            logger.debug(traceback.format_exc())
            logger.warning(f"Elasticsearch search failed for query [{query_string}]: {exc}")
        return None

    @staticmethod
    def get_query_with_lineage_filter(service_name: str) -> str:
        query_lineage_filter = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"processedLineage": True}},
                        {"term": {SERVICE_NAME_FIELD: service_name}},
                    ]
                }
            }
        }
        return quote(json.dumps(query_lineage_filter))

    @functools.lru_cache(maxsize=12)  # noqa: B019
    def es_get_queries_with_lineage(self, service_name: str) -> set[str] | None:
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

    def es_get_lineage_processed_queries(self, service_name: str, checksums: Collection[str]) -> dict[str, set[str]]:
        """
        Map the checksum of each given query that the service already processed for
        lineage to the ids of the entities the query is used in (`queryUsedIn`).

        A query missing from the result was not processed, or could not be looked up.
        """
        processed: dict[str, set[str]] = {}
        for batch in _batched(sorted(checksums), SEARCH_TERMS_BATCH_SIZE):
            query_filter = {
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"processedLineage": True}},
                            {"term": {SERVICE_NAME_FIELD: service_name}},
                            {"terms": {"checksum.keyword": batch}},
                        ]
                    }
                }
            }
            for hit in self._search_page(
                ES_INDEX_MAP[Query.__name__], query_filter, size=len(batch), fields=["checksum", "queryUsedIn"]
            ):
                processed[hit.source["checksum"]] = {ref["id"] for ref in hit.source.get("queryUsedIn") or []}
        return processed

    def es_get_upstream_entity_ids(self, entity: type[T], entity_ids: Collection[str]) -> dict[str, set[str]]:
        """
        Map each given id that belongs to an indexed entity of the given type, soft-deleted
        entities included, to the ids of the entities its upstream lineage edges come from.
        An id missing from the result has no entity, or could not be looked up.
        """
        upstreams: dict[str, set[str]] = {}
        index = ES_INDEX_MAP[entity.__name__]
        for batch in _batched(sorted(entity_ids), SEARCH_TERMS_BATCH_SIZE):
            query_filter = {"query": {"ids": {"values": batch}}}
            for hit in self._search_page(
                index, query_filter, size=len(batch), fields=["id", "upstreamLineage.fromEntity.id"]
            ):
                upstreams[hit.id] = {
                    edge["fromEntity"]["id"]
                    for edge in hit.source.get("upstreamLineage") or []
                    if (edge.get("fromEntity") or {}).get("id")
                }
        return upstreams

    def _search_page(self, index: str, query_filter: dict, size: int, fields: list[str]) -> list[HitsModel]:
        """
        Hits of a single search request. Leaving `deleted` unset matches soft-deleted
        entities too; a failed search is logged and returns no hits.
        """
        response = self._get_es_response(
            f"/search/query?q=&index={index}&size={size}"
            f"{self._get_include_fields_query(fields)}&query_filter={quote_plus(json.dumps(query_filter))}"
        )
        return response.hits.hits if response else []

    def _get_include_fields_query(self, fields: list[str] | None) -> str:
        """Get the include fields query"""
        if fields:
            return "&include_source_fields=" + "&include_source_fields=".join(fields)
        return ""

    def _paginate_es_internal(
        self,
        entity: type[T],
        query_filter: str | None = None,
        size: int = 100,
        search_query: str = "",
        include_fields: list[str] | None = None,
        sort_field: str = "fullyQualifiedName",
        sort_order: str = "desc",
    ) -> Iterator[ESResponse]:
        """
        Paginate through the ES results, ignoring individual errors.

        Args:
            entity: The entity type to paginate
            query_filter: Optional ES query filter in JSON format
            size: Number of results per page (default: 100)
            search_query: Optional query string used to filter results (default: "").
            include_fields: Optional list of fields to include in ES response (optimization)
            sort_field: Field to sort by (default: "fullyQualifiedName").
                       Special field "_score" is supported for relevance sorting.
            sort_order: Sort order, either "asc" or "desc" (default: "desc")

        Yields:
            ESResponse objects containing paginated results

        Raises:
            ValueError: If sort_order is not "asc" or "desc"
        """
        if sort_order not in ("asc", "desc"):
            raise ValueError(f"sort_order must be 'asc' or 'desc', got '{sort_order}'")

        after: str = ""
        error_pages = 0
        query = functools.partial(
            self.paginate_query.format,
            index=ES_INDEX_MAP[entity.__name__],
            search_query=quote_plus(search_query) if search_query else "",
            filter="&query_filter=" + quote_plus(query_filter) if query_filter else "",
            size=size,
            include_fields=self._get_include_fields_query(include_fields),
            sort_field=sort_field,
            sort_order=sort_order,
        )
        while True:
            query_string = query(after=after)
            response = self._get_es_response(query_string)

            # Allow 3 errors getting pages before getting out of the loop
            if not response:
                error_pages += 1
                if error_pages < 3:
                    continue
                else:
                    break

            next_after = self._next_search_after(response)
            # The server sorts last on its id tiebreaker. An index without id.keyword sorts it as
            # null, and each next page then starts again with the previous page's last hit, so
            # the walk is refused before any page of it is handed out
            # (ADR:2026-10-23-paged-search-indexes-sort-last-on-id-keyword).
            last_hit = response.hits.hits[-1] if response.hits.hits else None
            no_tiebreaker = bool(last_hit and last_hit.sort and last_hit.sort[-1] is None)
            if no_tiebreaker or (after and next_after == after):
                raise SearchCursorStalledError(
                    f"Search cursor for {entity.__name__} cannot page its index"
                    f" {ES_INDEX_MAP[entity.__name__]}: it cannot sort on the id tiebreaker. Reindex it."
                )
            yield response

            if not next_after:
                logger.debug("No more pages to fetch")
                break

            after = next_after

    @staticmethod
    def _next_search_after(response: ESResponse) -> str:
        """The search_after query parameters for the page after `response`, empty on the last page."""
        last_hit = response.hits.hits[-1] if response.hits.hits else None
        sort = last_hit.sort if last_hit else None
        return "".join(f"&search_after={quote_plus(str(v))}" for v in sort or [])

    def paginate_es(
        self,
        entity: type[T],
        query_filter: str | None = None,
        size: int = 100,
        search_query: str = "",
        fields: list[str] | None = None,
        sort_field: str = "fullyQualifiedName",
        sort_order: str = "desc",
    ) -> Iterator[T]:
        """
        Paginate through Elasticsearch results and fetch full entities from the API.

        Args:
            entity: The entity type to paginate
            query_filter: Optional ES query filter in JSON format
            size: Number of results per page (default: 100)
            search_query: Optional query string used to filter results (default: "").
            fields: Optional list of fields to fetch from the API for each entity
            sort_field: Field to sort by (default: "fullyQualifiedName").
                       Must be an indexed ES field. Special field "_score" is supported
                       for relevance-based sorting.
            sort_order: Sort order, either "asc" or "desc" (default: "desc")

        Yields:
            Full entity objects fetched from the OpenMetadata API
        """
        for response in self._paginate_es_internal(
            entity,
            query_filter,
            size,
            search_query=search_query,
            sort_order=sort_order,
            sort_field=sort_field,
        ):
            yield from self._yield_hits_from_api(response=response, entity=entity, fields=fields)

    def _get_es_response(self, query_string: str) -> ESResponse | None:
        """Get the Elasticsearch response"""
        try:
            response = self.client.get(query_string)
            if response is None:
                logger.warning(f"Received null response from Elasticsearch for query: {query_string}")
                return None
            return ESResponse.model_validate(response)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Elasticsearch query failed: {exc}. Query: {query_string}. "
                "This may indicate issues with the Elasticsearch cluster, broken indexes, "
                "or connectivity problems. Please check Elasticsearch cluster health and logs."
            )
        return None

    def _yield_hits_from_api(self, response: ESResponse, entity: type[T], fields: list[str] | None) -> Iterator[T]:
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
                logger.warning(f"Error while getting {hit.source['fullyQualifiedName']} - {exc}")

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
                        {"bool": {"should": [{"term": {SERVICE_NAME_FIELD: service_name}}]}},
                        {
                            "bool": {
                                "must": [
                                    {
                                        "bool": {
                                            "should": [
                                                {"term": {"tableType": TableType.View.value}},
                                                {"term": {"tableType": TableType.MaterializedView.value}},
                                                {"term": {"tableType": TableType.SecureView.value}},
                                                {"term": {"tableType": TableType.Dynamic.value}},
                                                {"term": {"tableType": TableType.Stream.value}},
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                        {"bool": {"should": [{"term": {"deleted": False}}]}},
                        {"bool": {"should": [{"exists": {"field": "schemaDefinition"}}]}},
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
                            {"bool": {"must_not": {"exists": {"field": "processedLineage"}}}},
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
                _, database_name, schema_name, table_name = fqn.split(hit.source["fullyQualifiedName"])
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
        entity_type: type[T],
        fqn_search_string: str,
        fetch_multiple_entities: bool = False,
    ) -> list[Table] | Table | None:
        """
        fetch table from es when with/without `db_service_name`
        """
        try:
            prepended_fqn = fqn.prefix_entity_for_wildcard_search(entity_type=entity_type, fqn=fqn_search_string)
            entity_result = get_entity_from_es_result(
                entity_list=self.es_search_from_fqn(
                    entity_type=entity_type,
                    fqn_search_string=prepended_fqn,
                ),
                fetch_multiple_entities=fetch_multiple_entities,
            )
            return entity_result  # noqa: RET504, TRY300
        except Exception as exc:
            logger.debug(f"Error to fetch entity: fqn={fqn_search_string} from es: {exc}")
            logger.debug(traceback.format_exc())
        return None
