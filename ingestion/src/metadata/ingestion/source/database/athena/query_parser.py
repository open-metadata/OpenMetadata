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

import sys
import traceback
from abc import ABC
from collections.abc import Iterator
from typing import Optional, TypeGuard

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
    AthenaQueryExecution,
    AthenaQueryExecutionList,
    AthenaUserQuery,
    QueryExecutionIdsResponse,
    WorkGroupsList,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.constants import QUERY_WITH_DBT, QUERY_WITH_OM_VERSION
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

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
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AthenaConnection = config.serviceConnection.root.config
        if not isinstance(connection, AthenaConnection):
            raise InvalidSourceException(f"Expected AthenaConnection, but got {connection}")
        return cls(config, metadata)

    def _get_work_group_response(self, next_token: str, is_first_call: bool = False):
        if is_first_call:
            return self.client.list_work_groups()
        return self.client.list_work_groups(NextToken=next_token)

    def get_work_groups(self) -> Iterator[str | None]:
        """
        Names of the workgroups whose query history is read: the configured
        workgroup when there is one, otherwise every enabled workgroup
        """
        if self.service_connection.workgroup:
            yield self.service_connection.workgroup
            return
        yield from self._get_enabled_work_groups()

    def _get_enabled_work_groups(self) -> Iterator[str | None]:
        """
        Method to get list of names of enabled athena work groups
        """
        next_token = None
        is_first_call = True
        try:
            while True:
                work_group_list = self._get_work_group_response(next_token, is_first_call)
                response_obj = WorkGroupsList(**work_group_list)
                for work_group in response_obj.WorkGroups:
                    if work_group.State and work_group.State.upper() == ATHENA_ENABLED_WORK_GROUP_STATE:
                        yield work_group.Name
                next_token = response_obj.NextToken
                is_first_call = False
                if next_token is None:
                    break
        except Exception as exc:
            logger.debug("Failed to fetch work groups due to: %s", exc)
            logger.debug(traceback.format_exc())
            if is_first_call:
                # if it fails for the first api call, most likely due to insufficient
                # permissions then still fetch the queries with default workgroup
                yield None

    def get_queries(self) -> Iterator[list[AthenaUserQuery]]:
        """
        Yield the user queries of the query log window page by page, at most
        `resultLimit` of them across every workgroup read
        """
        result_limit = getattr(self.source_config, "resultLimit", None)
        remaining = result_limit if isinstance(result_limit, int) else sys.maxsize
        for work_group in self.get_work_groups():
            for executions in self._get_query_executions(work_group):
                user_queries = [execution for execution in executions if self._is_user_query(execution)][:remaining]
                if user_queries:
                    remaining -= len(user_queries)
                    yield user_queries
                if remaining <= 0:
                    return
                if self._precedes_query_window(executions):
                    break

    def _get_query_executions(self, work_group: str | None) -> Iterator[list[AthenaQueryExecution]]:
        """
        Pages of a workgroup's query executions, in ListQueryExecutions order
        """
        paginator = self.client.get_paginator("list_query_executions")
        pages = paginator.paginate(WorkGroup=work_group) if work_group else paginator.paginate()
        for page in pages:
            execution_ids = QueryExecutionIdsResponse(**page).QueryExecutionIds
            if execution_ids:
                response = self.client.batch_get_query_execution(QueryExecutionIds=execution_ids)
                yield AthenaQueryExecutionList(**response).QueryExecutions or []

    def _is_user_query(self, execution: AthenaQueryExecution) -> TypeGuard[AthenaUserQuery]:
        """
        Whether the execution is a successful query of the window that neither
        OpenMetadata nor dbt ran, so it counts towards `resultLimit`
        """
        status = execution.Status
        return bool(
            execution.Query
            and status
            and status.State
            and status.State.upper() == QUERY_SUCCESS_STATUS
            and status.SubmissionDateTime
            and status.SubmissionDateTime.date() >= self.start.date()
            and self.is_not_dbt_or_om_query(execution.Query)
        )

    def _precedes_query_window(self, executions: list[AthenaQueryExecution]) -> bool:
        """
        Whether every execution of a page was submitted before the query log window.

        ListQueryExecutions returns the most recent executions first (observed
        behaviour, AWS does not document the order), so the rest of the
        workgroup's history precedes the window too and is not worth reading.
        See ADR:2026-10-13-athena-query-history-reads-the-configured-workgroup-newest-first.
        """
        return bool(executions) and all(
            execution.Status
            and execution.Status.SubmissionDateTime
            and execution.Status.SubmissionDateTime.date() < self.start.date()
            for execution in executions
        )

    def is_not_dbt_or_om_query(self, query_text: str) -> bool:
        return not (query_text.startswith(QUERY_WITH_DBT) or query_text.startswith(QUERY_WITH_OM_VERSION))  # noqa: PIE810
