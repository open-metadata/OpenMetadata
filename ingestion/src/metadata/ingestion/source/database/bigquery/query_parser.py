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
Handle big query usage extraction
"""
from abc import ABC
from copy import deepcopy
from datetime import datetime
from typing import Optional

from google import auth

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    MultipleProjectId,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.bigquery.helper import get_inspector_details
from metadata.ingestion.source.database.query_parser_source import QueryParserSource


class BigqueryQueryParserSource(QueryParserSource, ABC):
    """
    BigQuery base for Usage and Lineage
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.project_id = self.set_project_id()
        self.database = self.project_id

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: BigQueryConnection = config.serviceConnection.root.config
        if not isinstance(connection, BigQueryConnection):
            raise InvalidSourceException(
                f"Expected BigQueryConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            region=self.service_connection.usageLocation,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
            cost_per_tib=self.service_connection.costPerTB,
        )

    @staticmethod
    def set_project_id():
        _, project_id = auth.default()
        return project_id

    def get_engine(self):
        if isinstance(
            self.service_connection.credentials.gcpConfig, GcpCredentialsValues
        ) and isinstance(
            self.service_connection.credentials.gcpConfig.projectId, MultipleProjectId
        ):
            project_ids = deepcopy(
                self.service_connection.credentials.gcpConfig.projectId
            )
            for project_id in project_ids.root:
                inspector_details = get_inspector_details(
                    project_id, self.service_connection
                )
                yield inspector_details.engine
        else:
            yield self.engine

    def check_life_cycle_query(
        self, query_type: Optional[str], query_text: Optional[str]
    ) -> bool:
        """
        returns true if query is to be used for life cycle processing.

        Override if we have specific parameters
        """
        if query_type != "SELECT":
            return True
        return False
