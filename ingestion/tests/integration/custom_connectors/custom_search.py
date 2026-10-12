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
"""Custom Search connector yielding deterministic in-memory search indexes."""

from collections.abc import Iterable

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.api.services.createSearchService import (
    CreateSearchServiceRequest,
)
from metadata.generated.schema.entity.data.searchIndex import (
    DataType,
    IndexType,
    SearchIndexField,
)
from metadata.generated.schema.entity.services.connections.search.customSearchConnection import (
    CustomSearchConnection,
)
from metadata.generated.schema.entity.services.searchService import SearchServiceType
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata

INDEXES: dict[str, tuple[str, list[tuple[str, DataType, str]]]] = {
    "my_product_index": (
        "Searchable product catalogue",
        [
            ("product_id", DataType.KEYWORD, "Stable product identifier"),
            ("title", DataType.TEXT, "Analysed product title"),
            ("price", DataType.DOUBLE, "Current list price"),
        ],
    ),
    "my_customer_index": (
        "Searchable customer directory",
        [
            ("customer_id", DataType.KEYWORD, "Stable customer identifier"),
            ("signup_date", DataType.DATE, "Date the account was opened"),
        ],
    ),
}


class CustomSearchSource(Source):
    """Yields two search indexes with described, typed fields."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomSearchSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomSearchConnection):
            raise InvalidSourceException(f"Expected CustomSearchConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateSearchServiceRequest(
                name=service_name,
                serviceType=SearchServiceType.CustomSearch,
                connection=self.config.serviceConnection.root,
                displayName="Custom Search Demo",
                description="Search cluster served by the custom search connector",
            )
        )
        for index_name, (index_description, fields) in INDEXES.items():
            yield Either(
                right=CreateSearchIndexRequest(
                    name=index_name,
                    service=service_name,
                    displayName=index_name.replace("_", " ").title(),
                    description=index_description,
                    indexType=IndexType.Index,
                    fields=[
                        SearchIndexField(name=field_name, dataType=data_type, description=field_description)
                        for field_name, data_type, field_description in fields
                    ],
                )
            )
