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

import json
import logging
import pathlib

from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.stage import Stage, StageStatus
from metadata.ingestion.models.table_queries import (
    QueryParserData,
    TableColumn,
    TableColumnJoin,
    TableUsageCount,
)
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.stage.file import FileStageConfig

logger = logging.getLogger(__name__)


def get_table_column_join(table, table_aliases, joins):
    table_column = None
    joined_with = []
    for join in joins:
        try:
            if "." in join:
                if join.count(".") < 3:
                    jtable, column = join.split(".")
                else:
                    jtable, column = join.split(".")[2:]

            if table == jtable or jtable in table_aliases:
                table_column = TableColumn(
                    table=table_aliases[jtable] if jtable in table_aliases else jtable,
                    column=column,
                )
            else:
                joined_with.append(
                    TableColumn(
                        table=table_aliases[jtable]
                        if jtable in table_aliases
                        else jtable,
                        column=column,
                    )
                )
        except ValueError as err:
            logger.error("Error in parsing sql query joins {}".format(err))
            pass
    return TableColumnJoin(table_column=table_column, joined_with=joined_with)


class TableUsageStage(Stage[QueryParserData]):
    config: FileStageConfig
    status: StageStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: FileStageConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = StageStatus()
        self.table_usage = {}
        fpath = pathlib.Path(self.config.filename)
        self.file = fpath.open("w")
        self.wrote_something = False

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = FileStageConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def stage_record(self, record: QueryParserData) -> None:
        if record is not None:
            for table in record.tables:
                table_usage_count = None
                if table in self.table_usage.keys():
                    table_usage_count = self.table_usage.get(table)
                    table_usage_count.count = table_usage_count.count + 1
                    if "join" in record.columns:
                        table_usage_count.joins.append(
                            get_table_column_join(
                                table, record.tables_aliases, record.columns["join"]
                            )
                        )
                else:
                    joins = []
                    if "join" in record.columns:
                        tbl_column_join = get_table_column_join(
                            table, record.tables_aliases, record.columns["join"]
                        )
                        if tbl_column_join is not None:
                            joins.append(tbl_column_join)

                    table_usage_count = TableUsageCount(
                        table=table,
                        database=record.database,
                        date=record.date,
                        joins=joins,
                    )
                self.table_usage[table] = table_usage_count

    def get_status(self):
        return self.status

    def close(self):
        for key, value in self.table_usage.items():
            data = value.json()
            self.file.write(json.dumps(data))
            self.file.write("\n")
        self.file.close()
