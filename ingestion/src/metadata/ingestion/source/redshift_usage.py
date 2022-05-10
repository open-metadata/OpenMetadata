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
Redshift usage module
"""

# This import verifies that the dependencies are available.
from typing import Iterator, Union

from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.usage_source import UsageSource
from metadata.utils.helpers import get_start_and_end

# pylint: disable=useless-super-delegation
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import REDSHIFT_SQL_STATEMENT

logger = ingestion_logger()


class RedshiftUsageSource(UsageSource):
    # SELECT statement from mysql information_schema to extract table and column metadata
    SQL_STATEMENT = REDSHIFT_SQL_STATEMENT
    # CONFIG KEYS
    WHERE_CLAUSE_SUFFIX_KEY = "where_clause"
    CLUSTER_SOURCE = "cluster_source"
    CLUSTER_KEY = "cluster_key"
    USE_CATALOG_AS_CLUSTER_NAME = "use_catalog_as_cluster_name"
    DATABASE_KEY = "database_key"
    SERVICE_TYPE = DatabaseServiceType.Redshift.value
    DEFAULT_CLUSTER_SOURCE = "CURRENT_DATABASE()"

    def __init__(self, config: WorkflowSource, metadata_config: WorkflowConfig):
        super().__init__(config, metadata_config)
        start, end = get_start_and_end(self.config.sourceConfig.config.queryLogDuration)
        self.sql_stmt = RedshiftUsageSource.SQL_STATEMENT.format(
            start_time=start, end_time=end
        )
        self.analysis_date = start
        self._extract_iter: Union[None, Iterator] = None
        self._database = "redshift"

    @classmethod
    def create(cls, config_dict, metadata_config: WorkflowConfig):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedshiftConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedshiftConnection):
            raise InvalidSourceException(
                f"Expected RedshiftConnection, but got {connection}"
            )
        return cls(config, metadata_config)
