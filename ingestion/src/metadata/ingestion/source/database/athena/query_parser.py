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
Athena Query parser module
"""

from abc import ABC
from math import ceil

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.athena.models import (
    AthenaQueryExecutionList,
    QueryExecutionIdsResponse,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ATHENA_QUERY_PAGINATOR_LIMIT = 50


class AthenaQueryParserSource(QueryParserSource, ABC):
    """
    Athena base for Usage and Lineage
    """

    filters: str

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.client = AWSClient(self.service_connection.awsConfig).get_athena_client()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AthenaConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AthenaConnection):
            raise InvalidSourceException(
                f"Expected AthenaConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_queries(self):
        query_limit = ceil(
            self.source_config.resultLimit / ATHENA_QUERY_PAGINATOR_LIMIT
        )
        paginator = self.client.get_paginator("list_query_executions")
        paginator_response = paginator.paginate()
        for response in paginator_response:
            response_obj = QueryExecutionIdsResponse(**response)
            query_details_response = self.client.batch_get_query_execution(
                QueryExecutionIds=response_obj.QueryExecutionIds
            )
            query_details_list = AthenaQueryExecutionList(**query_details_response)
            yield query_details_list
            query_limit -= 1
            if not query_limit:
                break
