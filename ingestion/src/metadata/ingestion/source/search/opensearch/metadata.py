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
OpenSearch source to extract metadata
"""
import shutil
import traceback
from pathlib import Path
from typing import Any, Iterable, Optional

from opensearchpy import OpenSearch

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import (
    IndexType,
    SearchIndex,
    SearchIndexSampleData,
)
from metadata.generated.schema.entity.services.connections.search.openSearchConnection import (
    OpenSearchConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.search_index_data import OMetaIndexSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.search.opensearch.parser import parse_os_index_mapping
from metadata.ingestion.source.search.search_service import SearchServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

WILDCARD_SEARCH = "*"


class OpensearchSource(SearchServiceSource):
    """
    Implements the necessary methods to extract
    Search Index metadata from OpenSearch.
    Excludes system indexes (indexes whose names start with a dot).
    """

    def __init__(self, config: Source, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client: OpenSearch = self.connection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """
        Create an instance of OpensearchSource.

        Args:
            config_dict: The configuration dictionary.
            metadata: An instance of OpenMetadata.
            pipeline_name: Optional pipeline name.

        Returns:
            An instance of OpensearchSource.
        """
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: OpenSearchConnection = config.serviceConnection.root.config
        if not isinstance(connection, OpenSearchConnection):
            raise InvalidSourceException(
                f"Expected OpenSearchConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _is_system_index(self, index_name: str) -> bool:
        """
        Determine if the given index is a system index.
        By default, system indexes start with a dot ('.').

        Args:
            index_name: The name of the index.

        Returns:
            True if it is a system index, False otherwise.
        """
        return index_name.startswith(".")

    def get_search_index_list(self) -> Iterable[dict]:
        """
        Get a list of all search indices from OpenSearch, excluding system indexes.

        Returns:
            Iterable of dictionaries containing index details.
        """
        index_list = self.client.indices.get_alias(expand_wildcards="open") or {}
        for index in index_list.keys():
            if self._is_system_index(index):
                logger.debug("Skipping system index: %s", index)
                continue
            yield self.client.indices.get(index=str(index))

    def get_search_index_name(self, search_index_details: dict) -> Optional[str]:
        """
        Get the search index name.

        Args:
            search_index_details: Dictionary containing index details.

        Returns:
            The index name if available, else None.
        """
        if search_index_details and len(search_index_details) == 1:
            return list(search_index_details.keys())[0]
        return None

    def yield_search_index(
        self, search_index_details: Any
    ) -> Iterable[Either[CreateSearchIndexRequest]]:
        """
        Yield Search Index entities.

        Args:
            search_index_details: The index details containing mappings and settings.

        Yields:
            Either wrapped CreateSearchIndexRequest objects.
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
                fields=parse_os_index_mapping(
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
        Yield sample data for the search index entity.

        Args:
            search_index_details: The index details used to query sample data.

        Yields:
            Either wrapped OMetaIndexSampleData objects.
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
        Get a list of all search index templates from OpenSearch.

        Returns:
            Iterable of dictionaries containing template details.
        """
        yield from self.client.indices.get_index_template().get("index_templates", [])

    def get_search_index_template_name(
        self, search_index_template_details: dict
    ) -> Optional[str]:
        """
        Get the search index template name.

        Args:
            search_index_template_details: Dictionary containing template details.

        Returns:
            The template name if available, else None.
        """
        return search_index_template_details and search_index_template_details["name"]

    def yield_search_index_template(
        self, search_index_template_details: Any
    ) -> Iterable[Either[CreateSearchIndexRequest]]:
        """
        Yield Search Index Template entities.

        Args:
            search_index_template_details: The template details including mappings and settings.

        Yields:
            Either wrapped CreateSearchIndexRequest objects.
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
                        fields=parse_os_index_mapping(
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
        """
        Clean up any temporary files and close the connection.
        """
        try:
            if Path(self.service_connection.sslConfig.certificates.stagingDir).exists():
                shutil.rmtree(self.service_connection.sslConfig.certificates.stagingDir)
        except AttributeError:
            pass
        return super().close()
