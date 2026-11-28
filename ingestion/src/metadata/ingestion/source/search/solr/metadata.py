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
Solr source to extract search index (collection) metadata.
"""

import traceback
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import (
    IndexType,
    SearchIndex,
    SearchIndexSampleData,
)
from metadata.generated.schema.entity.services.connections.search.solrConnection import (
    SolrConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.search_index_data import OMetaIndexSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.search.search_service import SearchServiceSource
from metadata.ingestion.source.search.solr.parser import parse_solr_schema
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.ingestion.source.search.solr.client import SolrClient

logger = ingestion_logger()


class SolrSource(SearchServiceSource):
    """Extract collection metadata (schema fields) from an Apache Solr instance."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client: SolrClient = self.connection

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SolrConnection = config.serviceConnection.root.config
        if not isinstance(connection, SolrConnection):
            raise InvalidSourceException(f"Expected SolrConnection, but got {connection}")
        return cls(config, metadata)

    def get_search_index_list(self) -> Iterable[dict]:
        """List Solr collections together with their schema."""
        for collection in self.client.list_collections():
            try:
                yield {
                    "name": collection,
                    "schema": self.client.get_schema(collection),
                }
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Failed to retrieve schema for Solr collection '%s': %s",
                    collection,
                    exc,
                )

    def get_search_index_name(self, search_index_details: dict) -> str | None:
        return search_index_details.get("name")

    def yield_search_index(self, search_index_details: Any) -> Iterable[Either[CreateSearchIndexRequest]]:
        """Map a Solr collection into a SearchIndex entity."""
        index_name = self.get_search_index_name(search_index_details)
        if index_name:
            search_index_request = CreateSearchIndexRequest(
                name=EntityName(index_name),
                displayName=index_name,
                service=FullyQualifiedEntityName(self.context.get().search_service),
                fields=parse_solr_schema(search_index_details.get("schema")),
                indexType=IndexType.Index,
            )
            yield Either(right=search_index_request)
            self.register_record(search_index_request=search_index_request)

    def yield_search_index_sample_data(self, search_index_details: Any) -> Iterable[Either[OMetaIndexSampleData]]:
        """Fetch sample documents from a Solr collection when enabled."""
        if self.source_config.includeSampleData and self.context.get().search_index:
            index_name = self.get_search_index_name(search_index_details)
            try:
                sample_docs = self.client.get_sample_documents(index_name, self.source_config.sampleSize)
                search_index_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=SearchIndex,
                    service_name=self.context.get().search_service,
                    search_index_name=self.context.get().search_index,
                )
                search_index_entity = self.metadata.get_by_name(entity=SearchIndex, fqn=search_index_fqn)
                if not search_index_entity:
                    logger.warning(
                        "Could not find search index entity with FQN: %s",
                        search_index_fqn,
                    )
                    return
                yield Either(
                    right=OMetaIndexSampleData(
                        entity=search_index_entity,
                        data=SearchIndexSampleData(messages=[str(doc) for doc in sample_docs]),
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Failed to retrieve sample data from Solr collection '%s': %s",
                    index_name,
                    exc,
                )
