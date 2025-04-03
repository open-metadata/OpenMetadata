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
Athena Query parser module
"""

import traceback
from abc import ABC
from math import ceil
from typing import Optional

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.athena.models import (
    AthenaQueryExecutionList,
    QueryExecutionIdsResponse,
    WorkGroupsList,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.constants import QUERY_WITH_DBT, QUERY_WITH_OM_VERSION
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ATHENA_QUERY_PAGINATOR_LIMIT = 50

ATHENA_ENABLED_WORK_GROUP_STATE = "ENABLED"

QUERY_SUCCESS_STATUS = "SUCCEEDED"


class AthenaQueryParserSource(QueryParserSource, ABC):
    """
    Athena base for Usage and Lineage
    """

    filters: str

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client = AWSClient(self.service_connection.awsConfig).get_athena_client()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AthenaConnection = config.serviceConnection.root.config
        if not isinstance(connection, AthenaConnection):
            raise InvalidSourceException(
                f"Expected AthenaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _get_work_group_response(self, next_token: str, is_first_call: bool = False):
        if is_first_call:
            return self.client.list_work_groups()
        return self.client.list_work_groups(NextToken=next_token)

    def get_work_groups(self) -> str:
        """
        Method to get list of names of athena work groups
        """
        next_token = None
        is_first_call = True
        try:
            while True:
                work_group_list = self._get_work_group_response(
                    next_token, is_first_call
                )
                response_obj = WorkGroupsList(**work_group_list)
                for work_group in response_obj.WorkGroups:
                    if (
                        work_group.State
                        and work_group.State.upper() == ATHENA_ENABLED_WORK_GROUP_STATE
                    ):
                        yield work_group.Name
                next_token = response_obj.NextToken
                is_first_call = False
                if next_token is None:
                    break
        except Exception as exc:
            logger.debug(f"Failed to fetch work groups due to: {exc}")
            logger.debug(traceback.format_exc())
            if is_first_call:
                # if it fails for the first api call, most likely due to insufficient
                # permissions then still fetch the queries with default workgroup
                yield None

    def get_queries(self):
        """
        Method to fetch queries from all work groups
        """
        for work_group in self.get_work_groups():
            query_limit = ceil(
                self.source_config.resultLimit / ATHENA_QUERY_PAGINATOR_LIMIT
            )
            paginator = self.client.get_paginator("list_query_executions")
            if work_group:
                paginator_response = paginator.paginate(WorkGroup=work_group)
            else:
                paginator_response = paginator.paginate()
            for response in paginator_response:
                response_obj = QueryExecutionIdsResponse(**response)
                if response_obj.QueryExecutionIds:
                    query_details_response = self.client.batch_get_query_execution(
                        QueryExecutionIds=response_obj.QueryExecutionIds
                    )
                    query_details_list = AthenaQueryExecutionList(
                        **query_details_response
                    )
                    yield query_details_list
                query_limit -= 1
                if not query_limit:
                    break

    def is_not_dbt_or_om_query(self, query_text: str) -> bool:
        return not (
            query_text.startswith(QUERY_WITH_DBT)
            or query_text.startswith(QUERY_WITH_OM_VERSION)
        )
