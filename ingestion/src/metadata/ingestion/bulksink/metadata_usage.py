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
from datetime import datetime

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import ColumnJoins, TableJoins
from metadata.ingestion.api.bulk_sink import BulkSink, BulkSinkStatus
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.models.table_queries import (
    TableUsageCount,
    TableUsageRequest,
    TableColumn,
    ColumnJoinedWith,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.openmetadata_rest import (
    OpenMetadataAPIClient,
    MetadataServerConfig,
)

logger = logging.getLogger(__name__)


class MetadataUsageSinkConfig(ConfigModel):
    filename: str


class MetadataUsageBulkSink(BulkSink):
    config: MetadataUsageSinkConfig

    def __init__(
        self,
        ctx: WorkflowContext,
        config: MetadataUsageSinkConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.wrote_something = False
        self.file_handler = open(self.config.filename, "r")
        self.client = OpenMetadataAPIClient(self.metadata_config)
        self.status = BulkSinkStatus()
        self.tables_dict = {}
        self.table_join_dict = {}
        self.__map_tables()
        self.today = datetime.today().strftime("%Y-%m-%d")

    def __map_tables(self):
        table_entities = self.client.list_tables("columns")
        for table in table_entities.tables:
            if table.name.__root__ not in self.tables_dict.keys():
                self.tables_dict[table.name.__root__] = table

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
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
            if "." in table_usage.table:
                table_usage.table = table_usage.table.split(".")[1]
            if table_usage.table in self.tables_dict:
                table_entity = self.tables_dict[table_usage.table]
                table_usage_request = TableUsageRequest(
                    date=table_usage.date, count=table_usage.count
                )
                try:
                    self.client.publish_usage_for_a_table(
                        table_entity, table_usage_request
                    )
                except APIError as err:
                    self.status.failures.append(table_usage_request)
                    logger.error(
                        "Failed to update usage for {} {}".format(
                            table_usage.table, err
                        )
                    )

                table_join_request = self.__get_table_joins(table_usage)
                logger.debug("table join request {}".format(table_join_request))
                try:
                    if (
                        table_join_request is not None
                        and len(table_join_request.columnJoins) > 0
                    ):
                        self.client.publish_frequently_joined_with(
                            table_entity, table_join_request
                        )
                except APIError as err:
                    self.status.failures.append(table_join_request)
                    logger.error(
                        "Failed to update query join for {}, {}".format(
                            table_usage.table, err
                        )
                    )

            else:
                logger.warning(
                    "Table does not exist, skipping usage publish {}, {}".format(
                        table_usage.table, table_usage.database
                    )
                )
        try:
            self.client.compute_percentile("table", self.today)
            self.client.compute_percentile("database", self.today)
        except APIError:
            logger.error("Failed to publish compute.percentile")

    def __get_table_joins(self, table_usage):
        table_joins: TableJoins = TableJoins(columnJoins=[], startDate=table_usage.date)
        column_joins_dict = {}
        joined_with = {}
        for column_join in table_usage.joins:
            if column_join.table_column is None or len(column_join.joined_with) == 0:
                continue

            if column_join.table_column.column in column_joins_dict.keys():
                joined_with = column_joins_dict[column_join.table_column.column]
            else:
                column_joins_dict[column_join.table_column.column] = {}

            main_column_fqdn = self.__get_column_fqdn(column_join.table_column)
            for column in column_join.joined_with:
                joined_column_fqdn = self.__get_column_fqdn(column)

                if joined_column_fqdn in joined_with.keys():
                    column_joined_with = joined_with[joined_column_fqdn]
                    column_joined_with.joinCount += 1
                    joined_with[joined_column_fqdn] = column_joined_with
                elif joined_column_fqdn is not None:
                    joined_with[joined_column_fqdn] = ColumnJoinedWith(
                        fullyQualifiedName=joined_column_fqdn, joinCount=1
                    )
                else:
                    logger.info("Skipping join columns for {}".format(column))
            column_joins_dict[column_join.table_column.column] = joined_with

        for key, value in column_joins_dict.items():
            table_joins.columnJoins.append(
                ColumnJoins(columnName=key, joinedWith=list(value.values()))
            )
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
        self.client.close()
