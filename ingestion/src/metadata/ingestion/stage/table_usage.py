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
Given query data about tables, store the results
in a temporary file (i.e., the stage)
to be further processed by the BulkSink.
"""
import json
import os
import shutil
import traceback

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import SqlQuery
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.queryParserData import QueryParserData
from metadata.generated.schema.type.tableUsageCount import TableUsageCount
from metadata.ingestion.api.stage import Stage, StageStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TableStageConfig(ConfigModel):
    filename: str


class TableUsageStage(Stage[QueryParserData]):
    """
    Stage implementation for Table Usage data.

    Converts QueryParserData into TableUsageCount
    and stores it in files partitioned by date.
    """

    config: TableStageConfig
    status: StageStatus

    def __init__(
        self,
        config: TableStageConfig,
        metadata_config: OpenMetadataConnection,
    ):
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(self.metadata_config)
        self.status = StageStatus()
        self.table_usage = {}
        self.table_queries = {}
        isdir = os.path.isdir(self.config.filename)
        if not isdir:
            os.mkdir(self.config.filename)
        else:
            shutil.rmtree(self.config.filename)
            os.mkdir(self.config.filename)
        self.wrote_something = False

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = TableStageConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def _get_user_entity(self, username: str):
        if username:
            user = self.metadata.get_by_name(entity=User, fqn=username)
            if user:
                return [
                    EntityReference(
                        id=user.id,
                        type="user",
                        name=user.name.__root__,
                        fullyQualifiedName=user.fullyQualifiedName.__root__,
                        description=user.description,
                        displayName=user.displayName,
                        deleted=user.deleted,
                        href=user.href,
                    )
                ]
        return []

    def _add_sql_query(self, record, table):
        if self.table_queries.get((table, record.date)):
            self.table_queries[(table, record.date)].append(
                SqlQuery(
                    query=record.sql,
                    users=self._get_user_entity(record.userName),
                    queryDate=record.date,
                    duration=record.duration,
                )
            )
        else:
            self.table_queries[(table, record.date)] = [
                SqlQuery(
                    query=record.sql,
                    users=self._get_user_entity(record.userName),
                    queryDate=record.date,
                    duration=record.duration,
                )
            ]

    def stage_record(self, record: QueryParserData) -> None:
        """
        Process the parsed data and store it in a file
        """
        if not record or not record.parsedData:
            return
        self.table_usage = {}
        self.table_queries = {}
        for parsed_data in record.parsedData:
            if parsed_data is None:
                continue
            for table in parsed_data.tables:
                table_joins = parsed_data.joins.get(table)
                try:
                    self._add_sql_query(record=parsed_data, table=table)
                    table_usage_count = self.table_usage.get((table, parsed_data.date))
                    if table_usage_count is not None:
                        table_usage_count.count = table_usage_count.count + 1
                        if table_joins:
                            table_usage_count.joins.extend(table_joins)
                    else:
                        joins = []
                        if table_joins:
                            joins.extend(table_joins)

                        table_usage_count = TableUsageCount(
                            table=table,
                            databaseName=parsed_data.databaseName,
                            date=parsed_data.date,
                            joins=joins,
                            serviceName=parsed_data.serviceName,
                            sqlQueries=[],
                            databaseSchema=parsed_data.databaseSchema,
                        )

                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Error in staging record: {exc}")
                self.table_usage[(table, parsed_data.date)] = table_usage_count
                logger.info(f"Successfully record staged for {table}")
        self.dump_data_to_file()

    def get_status(self):
        return self.status

    def dump_data_to_file(self):
        for key, value in self.table_usage.items():
            if value:
                value.sqlQueries = self.table_queries.get(key, [])
                data = value.json()
                with open(
                    os.path.join(self.config.filename, f"{value.serviceName}_{key[1]}"),
                    "a+",
                    encoding=UTF_8,
                ) as file:
                    file.write(json.dumps(data))
                    file.write("\n")

    def close(self) -> None:
        """
        Nothing to close. Data is being dumped inside a context manager
        """
