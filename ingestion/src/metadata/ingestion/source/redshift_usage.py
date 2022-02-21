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

# This import verifies that the dependencies are available.
import logging
import traceback
from typing import Any, Dict, Iterable, Iterator, Union

from sqllineage.runner import LineageRunner

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_queries import TableQuery
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.sink.metadata_rest import MetadataRestSink
from metadata.ingestion.source.redshift import RedshiftConfig
from metadata.ingestion.source.sql_alchemy_helper import (
    SQLAlchemyHelper,
    SQLSourceStatus,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.sql_queries import REDSHIFT_SQL_STATEMENT

logger = logging.getLogger(__name__)


class RedshiftUsageSource(Source[TableQuery]):
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

    def __init__(self, config, metadata_config, ctx):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        start, end = get_start_and_end(config.duration)
        self.sql_stmt = RedshiftUsageSource.SQL_STATEMENT.format(
            start_time=start, end_time=end
        )
        self.analysis_date = start
        self.alchemy_helper = SQLAlchemyHelper(
            config, metadata_config, ctx, "Redshift", self.sql_stmt
        )
        self._extract_iter: Union[None, Iterator] = None
        self._database = "redshift"
        self.status = SQLSourceStatus()

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = RedshiftConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def _get_raw_extract_iter(self) -> Iterable[Dict[str, Any]]:
        """
        Provides iterator of result row from SQLAlchemy helper
        :return:
        """
        rows = self.alchemy_helper.execute_query()
        for row in rows:
            yield row

    def next_record(self) -> Iterable[TableQuery]:
        """
        Using itertools.groupby and raw level iterator, it groups to table and yields TableMetadata
        :return:
        """
        for row in self._get_raw_extract_iter():
            tq = TableQuery(
                query=row["query"],
                user_name=row["usename"],
                starttime=str(row["starttime"]),
                endtime=str(row["endtime"]),
                analysis_date=str(self.analysis_date),
                database=row["database"],
                aborted=row["aborted"],
                sql=row["querytxt"],
                service_name=self.config.service_name,
            )
            yield tq
            result = LineageRunner(tq.sql)
            sink = MetadataRestSink(self.ctx, self.config, self.metadata_config)
            if result.target_tables and result.intermediate_tables:
                for intermediate_table in result.intermediate_tables:
                    for source_table in result.source_tables:
                        lineage = self.create_lineage(source_table, intermediate_table)
                        sink.write_record(lineage)
                    for target_table in result.target_tables:
                        lineage = self.create_lineage(intermediate_table, target_table)
                        sink.write_record(lineage)
            elif result.target_tables:
                for target_table in result.target_tables:
                    for source_table in result.source_tables:
                        lineage = self.create_lineage(source_table, target_table)
                        sink.write_record(lineage)

    def close(self):
        self.alchemy_helper.close()

    def get_status(self) -> SourceStatus:
        return self.status

    def create_lineage(self, from_table, to_table):
        try:
            from_fqdn = f"{self.config.service_name}.{from_table}"
            from_entity = self.metadata.get_by_name(entity=Table, fqdn=from_fqdn)
            to_fqdn = f"{self.config.service_name}.{to_table}"
            to_entity = self.metadata.get_by_name(entity=Table, fqdn=to_fqdn)
            return AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(
                        id=from_entity.id.__root__, type="table"
                    ),
                    toEntity=EntityReference(id=to_entity.id.__root__, type="table"),
                )
            )
        except Exception as err:  # pylint: disable=broad-except,unused-variable
            logger.error(traceback.print_exc())
