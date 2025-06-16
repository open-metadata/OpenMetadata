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
Elasticsearch source to extract metadata
"""
import shutil
import traceback
from pathlib import Path
from typing import Any, Iterable, Optional

from elasticsearch8 import Elasticsearch

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import (
    IndexType,
    SearchIndex,
    SearchIndexSampleData,
)
from metadata.generated.schema.entity.services.connections.search.elasticSearchConnection import (
    ElasticsearchConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.search_index_data import OMetaIndexSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.search.elasticsearch.parser import parse_es_index_mapping
from metadata.ingestion.source.search.search_service import SearchServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


WILDCARD_SEARCH = "*"


class ElasticsearchSource(SearchServiceSource):
    """
    Implements the necessary methods ot extract
    Search Index metadata from Elastic Search
    """

    def __init__(self, config: Source, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client: Elasticsearch = self.connection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: ElasticsearchConnection = config.serviceConnection.root.config
        if not isinstance(connection, ElasticsearchConnection):
            raise InvalidSourceException(
                f"Expected ElasticsearchConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_search_index_list(self) -> Iterable[dict]:
        """
        Get List of all search index
        """
        index_list = self.client.indices.get_alias(expand_wildcards="open") or {}
        for index in index_list.keys():
            yield self.client.indices.get(index=str(index))

    def get_search_index_name(self, search_index_details: dict) -> Optional[str]:
        """
        Get Search Index Name
        """
        if search_index_details and len(search_index_details) == 1:
            return list(search_index_details.keys())[0]

        return None

    def yield_search_index(
        self, search_index_details: Any
    ) -> Iterable[Either[CreateSearchIndexRequest]]:
        """
        Method to Get Search Index Entity
        """
        index_name = self.get_search_index_name(search_index_details)
        if index_name:
            search_index_request = CreateSearchIndexRequest(
                name=EntityName(index_name),
                displayName=index_name,
                searchIndexSettings=search_index_details.get(index_name, {}).get(
                    "settings", {}
                ),
                service=FullyQualifiedEntityName(self.context.get().search_service),
                fields=parse_es_index_mapping(
                    search_index_details.get(index_name, {}).get("mappings")
                ),
                indexType=IndexType.Index,
            )
            yield Either(right=search_index_request)
            self.register_record(search_index_request=search_index_request)

    def yield_search_index_sample_data(
        self, search_index_details: Any
    ) -> Iterable[Either[OMetaIndexSampleData]]:
        """
        Method to Get Sample Data of Search Index Entity
        """
        if self.source_config.includeSampleData and self.context.get().search_index:
            sample_data = self.client.search(
                index=self.context.get().search_index,
                q=WILDCARD_SEARCH,
                size=self.source_config.sampleSize,
                request_timeout=self.service_connection.connectionTimeoutSecs,
            )

            search_index_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=SearchIndex,
                service_name=self.context.get().search_service,
                search_index_name=self.context.get().search_index,
            )
            search_index_entity = self.metadata.get_by_name(
                entity=SearchIndex, fqn=search_index_fqn
            )

            yield Either(
                right=OMetaIndexSampleData(
                    entity=search_index_entity,
                    data=SearchIndexSampleData(
                        messages=[
                            str(message)
                            for message in sample_data.get("hits", {}).get("hits", [])
                        ]
                    ),
                )
            )

    def get_search_index_template_list(self) -> Iterable[dict]:
        """
        Get List of all search index template
        """
        yield from self.client.indices.get_index_template().get("index_templates", [])

    def get_search_index_template_name(
        self, search_index_template_details: dict
    ) -> Optional[str]:
        """
        Get Search Index Template Name
        """
        return search_index_template_details and search_index_template_details["name"]

    def yield_search_index_template(
        self, search_index_template_details: Any
    ) -> Iterable[Either[CreateSearchIndexRequest]]:
        """
        Method to Get Search Index Template Entity
        """
        try:
            if self.source_config.includeIndexTemplate:
                index_name = self.get_search_index_template_name(
                    search_index_template_details
                )
                index_template = search_index_template_details["index_template"]
                if index_name:
                    search_index_template_request = CreateSearchIndexRequest(
                        name=EntityName(index_name),
                        displayName=index_name,
                        searchIndexSettings=index_template.get("template", {}).get(
                            "settings", {}
                        ),
                        service=FullyQualifiedEntityName(
                            self.context.get().search_service
                        ),
                        fields=parse_es_index_mapping(
                            index_template.get("template", {}).get("mappings")
                        ),
                        indexType=IndexType.IndexTemplate,
                        description=index_template.get("_meta", {}).get("description"),
                    )
                    yield Either(right=search_index_template_request)
                    self.register_record(
                        search_index_request=search_index_template_request
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Could not include index templates due to {exc}")

    def close(self):
        try:
            if Path(self.service_connection.sslConfig.certificates.stagingDir).exists():
                shutil.rmtree(self.service_connection.sslConfig.certificates.stagingDir)
        except AttributeError:
            pass
        return super().close()
