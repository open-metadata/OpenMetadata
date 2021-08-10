#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import json
import logging

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import ColumnJoins, TableJoins
from metadata.ingestion.api.bulk_sink import BulkSink, BulkSinkStatus
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.models.table_queries import TableUsageCount, TableUsageRequest, TableColumn, \
    ColumnJoinedWith
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST, APIError

logger = logging.getLogger(__name__)


class MetadataUsageSinkConfig(ConfigModel):
    filename: str


class MetadataUsageBulkSink(BulkSink):
    config: MetadataUsageSinkConfig

    def __init__(self, ctx: WorkflowContext, config: MetadataUsageSinkConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.wrote_something = False
        self.file_handler = open(self.config.filename, 'r')
        self.client = REST(self.metadata_config)
        self.status = BulkSinkStatus()
        self.tables_dict = {}
        self.__map_tables()

    def __map_tables(self):
        tables = self.client.list_tables('columns')
        for table in tables:
            if table.name.__root__ not in self.tables_dict.keys():
                self.tables_dict[table.name.__root__] = table

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataUsageSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def handle_work_unit_start(self, wu):
        pass

    def handle_work_unit_end(self, wu):
        pass

    def write_records(self) -> None:
        usage_records = [json.loads(l) for l in self.file_handler.readlines()]
        for record in usage_records:
            table_usage = TableUsageCount(**json.loads(record))
            if table_usage.table in self.tables_dict:
                table_entity = self.tables_dict[table_usage.table]
                table_usage_request = TableUsageRequest(date=table_usage.date, count=table_usage.count)
                try:
                    self.client.publish_usage_for_a_table(table_entity, table_usage_request)
                    self.status.records.append(table_usage_request)
                except APIError as err:
                    self.status.failures.append(table_usage_request)
                    logger.error("Failed to update usage and query join {}".format(err))

                table_join_request = self.__get_table_joins(table_usage)
                logger.debug("table join request {}".format(table_join_request))
                try:
                    if table_join_request is not None and len(table_join_request.columnJoins) > 0:
                        self.client.publish_frequently_joined_with(table_entity, table_join_request)
                        self.status.records.append(table_join_request)
                except APIError as err:
                    self.status.failures.append(table_join_request)
                    logger.error("Failed to update usage and query join {}".format(err))

            else:
                logger.warning("Table does not exist, skipping usage publish {}, {}".format(table_usage.table,
                                                                                            table_usage.database))

    def __get_table_joins(self, table_usage):
        table_joins: TableJoins = TableJoins(columnJoins=[], startDate=table_usage.date)
        for column_join in table_usage.joins:
            if column_join.table_column is None or len(column_join.joined_with) == 0:
                continue
            logger.debug("main column join {}".format(column_join.table_column))
            main_column_fqdn = self.__get_column_fqdn(column_join.table_column)
            logger.debug("main column fqdn join {}".format(main_column_fqdn))
            joined_with = []
            for column in column_join.joined_with:
                logger.debug("joined column {}".format(column))
                joined_column_fqdn = self.__get_column_fqdn(column)
                logger.debug("joined column fqdn {}".format(joined_column_fqdn))
                if joined_column_fqdn is not None:
                    joined_with.append(ColumnJoinedWith(fullyQualifiedName=joined_column_fqdn, joinCount=1))
            table_joins.columnJoins.append(ColumnJoins(columnName=column_join.table_column.column,
                                                       joinedWith=joined_with))
        return table_joins

    def __get_column_fqdn(self, table_column: TableColumn):
        if table_column.table not in self.tables_dict:
            return None
        table_entity = self.tables_dict[table_column.table]
        for tbl_column in table_entity.columns:
            if table_column.column.lower() == tbl_column.name.__root__.lower():
                return tbl_column.fullyQualifiedName.__root__

    def get_status(self):
        return self.status

    def close(self):
        self.file_handler.close()
