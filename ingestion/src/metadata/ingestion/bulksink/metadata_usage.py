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
BulkSink class used for Usage workflows.

It sends Table queries and usage counts to Entities,
as well as populating JOIN information.

It picks up the information from reading the files
produced by the stage. At the end, the path is removed.
"""
import json
import os
import shutil
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    ColumnJoins,
    JoinedWith,
    Table,
    TableJoins,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.generated.schema.type.tableUsageCount import TableColumn, TableUsageCount
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.steps import BulkSink
from metadata.ingestion.lineage.sql_lineage import (
    get_column_fqn,
    get_table_entities_from_query,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.constants import UTF_8
from metadata.utils.life_cycle_utils import get_query_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import convert_timestamp

logger = ingestion_logger()

LRU_CACHE_SIZE = 4096


class MetadataUsageSinkConfig(ConfigModel):
    filename: str


class MetadataUsageBulkSink(BulkSink):
    """
    BulkSink implementation to send:
    - table usage
    - table queries
    - frequent joins
    """

    config: MetadataUsageSinkConfig

    def __init__(
        self,
        config: MetadataUsageSinkConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.service_name = None
        self.wrote_something = False
        self.metadata = metadata
        self.table_join_dict = {}
        self.table_usage_map = {}
        self.today = datetime.today().strftime("%Y-%m-%d")

    @property
    def name(self) -> str:
        return "OpenMetadata"

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = MetadataUsageSinkConfig.model_validate(config_dict)
        return cls(config, metadata)

    def __populate_table_usage_map(
        self, table_entity: Table, table_usage: TableUsageCount
    ) -> None:
        """
        Method Either initialise the map data or
        update existing data with information from new queries on the same table
        """
        if not self.table_usage_map.get(table_entity.id.root):
            self.table_usage_map[table_entity.id.root] = {
                "table_entity": table_entity,
                "usage_count": table_usage.count,
                "usage_date": table_usage.date,
                "database": table_usage.databaseName,
                "database_schema": table_usage.databaseSchema,
            }
        else:
            self.table_usage_map[table_entity.id.root][
                "usage_count"
            ] += table_usage.count

    def __publish_usage_records(self) -> None:
        """
        Method to publish SQL Queries, Table Usage
        """
        for _, value_dict in self.table_usage_map.items():
            table_usage_request = None
            try:
                table_usage_request = UsageRequest(
                    date=datetime.fromtimestamp(
                        convert_timestamp(value_dict["usage_date"])
                    ).strftime("%Y-%m-%d"),
                    count=value_dict["usage_count"],
                )
                self.metadata.publish_table_usage(
                    value_dict["table_entity"], table_usage_request
                )
                logger.info(
                    f"Successfully table usage published for {value_dict['table_entity'].fullyQualifiedName.root}"
                )
                self.status.scanned(
                    f"Table: {value_dict['table_entity'].fullyQualifiedName.root}"
                )
            except ValidationError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Cannot construct UsageRequest from {value_dict['table_entity']}: {err}"
                )
            except Exception as exc:
                name = value_dict["table_entity"].fullyQualifiedName.root
                error = f"Failed to update usage for {name} :{exc}"
                logger.debug(traceback.format_exc())
                logger.warning(error)
                self.status.failed(
                    StackTraceError(
                        name=value_dict["table_entity"].fullyQualifiedName.root,
                        error=f"Failed to update usage for {name} :{exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def iterate_files(self):
        """
        Iterate through files in the given directory
        """
        check_dir = os.path.isdir(self.config.filename)
        if check_dir:
            for filename in os.listdir(self.config.filename):
                full_file_name = os.path.join(self.config.filename, filename)
                if not os.path.isfile(full_file_name):
                    continue
                with open(full_file_name, encoding=UTF_8) as file:
                    yield file

    # Check here how to properly pick up ES and/or table query data
    def run(self) -> None:
        for file_handler in self.iterate_files():
            self.table_usage_map = {}
            for usage_record in file_handler.readlines():
                record = json.loads(usage_record)
                table_usage = TableUsageCount(**json.loads(record))

                self.service_name = table_usage.serviceName
                table_entities = None
                try:
                    table_entities = get_table_entities_from_query(
                        metadata=self.metadata,
                        service_name=self.service_name,
                        database_name=table_usage.databaseName,
                        database_schema=table_usage.databaseSchema,
                        table_name=table_usage.table,
                    )
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Cannot get table entities from query table {table_usage.table}: {exc}"
                    )

                if not table_entities:
                    logger.warning(
                        f"Could not fetch table {table_usage.databaseName}.{table_usage.table}"
                    )
                    continue

                self.get_table_usage_and_joins(table_entities, table_usage)

            self.__publish_usage_records()

    def get_table_usage_and_joins(
        self, table_entities: List[Table], table_usage: TableUsageCount
    ):
        """
        For the list of tables, compute usage with already existing seen
        tables and publish the join information.
        """
        for table_entity in table_entities:
            if table_entity is not None:
                table_join_request = None
                try:
                    self.__populate_table_usage_map(
                        table_usage=table_usage, table_entity=table_entity
                    )
                    table_join_request = self.__get_table_joins(
                        table_entity=table_entity, table_usage=table_usage
                    )
                    logger.debug(f"table join request {table_join_request}")

                    if (
                        table_join_request is not None
                        and len(table_join_request.columnJoins) > 0
                    ):
                        self.metadata.publish_frequently_joined_with(
                            table_entity, table_join_request
                        )

                    if table_usage.sqlQueries:
                        self.metadata.ingest_entity_queries_data(
                            entity=table_entity, queries=table_usage.sqlQueries
                        )
                        self._get_table_life_cycle_data(
                            table_entity=table_entity, table_usage=table_usage
                        )
                except APIError as err:
                    error = f"Failed to update query join for {table_usage}: {err}"
                    logger.debug(traceback.format_exc())
                    logger.warning(error)
                    self.status.failed(
                        StackTraceError(
                            name=table_usage.table,
                            error=error,
                            stackTrace=traceback.format_exc(),
                        )
                    )
                except Exception as exc:
                    name = table_entity.name.root
                    error = (
                        f"Error getting usage and join information for {name}: {exc}"
                    )
                    logger.debug(traceback.format_exc())
                    logger.warning(error)
                    self.status.failed(
                        StackTraceError(
                            name=name, error=error, stackTrace=traceback.format_exc()
                        )
                    )
            else:
                logger.warning(
                    "Could not fetch table"
                    f" {table_usage.databaseName}.{table_usage.databaseSchema}.{table_usage.table}"
                )
                self.status.warning(
                    f"Table: {table_usage.table}", reason="Could not fetch table"
                )

    def __get_table_joins(
        self, table_entity: Table, table_usage: TableUsageCount
    ) -> TableJoins:
        """
        Method to get Table Joins
        """
        # TODO: Clean up how we are passing dates from query parsing to here to use timestamps instead of strings
        start_date = datetime.fromtimestamp(int(table_usage.date) / 1000)
        table_joins: TableJoins = TableJoins(
            columnJoins=[], directTableJoins=[], startDate=start_date.date()
        )
        column_joins_dict = {}
        for column_join in table_usage.joins:
            joined_with = {}
            if column_join.tableColumn is None or len(column_join.joinedWith) == 0:
                continue

            if column_join.tableColumn.column in column_joins_dict:
                joined_with = column_joins_dict[column_join.tableColumn.column]
            else:
                column_joins_dict[column_join.tableColumn.column] = {}

            for column in column_join.joinedWith:
                joined_column_fqn = self.__get_column_fqn(
                    table_usage.databaseName, table_usage.databaseSchema, column
                )
                if str(joined_column_fqn) in joined_with.keys():
                    column_joined_with = joined_with[str(joined_column_fqn)]
                    column_joined_with.joinCount += 1
                    joined_with[str(joined_column_fqn)] = column_joined_with
                elif joined_column_fqn is not None:
                    joined_with[str(joined_column_fqn)] = JoinedWith(
                        fullyQualifiedName=str(joined_column_fqn), joinCount=1
                    )
                else:
                    logger.debug(
                        f"Skipping join columns for {column} {joined_column_fqn}"
                    )
            column_joins_dict[column_join.tableColumn.column] = joined_with

        for key, value in column_joins_dict.items():
            key_name = get_column_fqn(table_entity=table_entity, column=key)
            if not key_name:
                logger.warning(
                    f"Could not find column {key} in table {table_entity.fullyQualifiedName.root}"
                )
                continue
            table_joins.columnJoins.append(
                ColumnJoins(
                    columnName=fqn.split(key_name)[-1], joinedWith=list(value.values())
                )
            )
        return table_joins

    def __get_column_fqn(
        self, database: str, database_schema: str, table_column: TableColumn
    ) -> Optional[str]:
        """
        Method to get column fqn
        """
        table_entities = get_table_entities_from_query(
            metadata=self.metadata,
            service_name=self.service_name,
            database_name=database,
            database_schema=database_schema,
            table_name=table_column.table,
        )
        if not table_entities:
            return None

        for table_entity in table_entities:
            return get_column_fqn(table_entity=table_entity, column=table_column.column)

    def _get_table_life_cycle_data(
        self, table_entity: Table, table_usage: TableUsageCount
    ):
        """
        Method to call the lifeCycle API to store the data.
        We iterate over all the queries of a table entity and pick the life cycle
        data according to the query.
        The life cycle data will only be added if the current lifecycle datetime is less the datetime of
        the query being processed.
        """
        try:
            life_cycle = LifeCycle()
            for create_query in table_usage.sqlQueries:
                user = None
                process_user = None
                if create_query.users:
                    user = self.metadata.get_entity_reference(
                        entity=User, fqn=create_query.users[0]
                    )
                elif create_query.usedBy:
                    process_user = create_query.usedBy[0]
                query_type = get_query_type(create_query=create_query)
                if query_type:
                    access_details = AccessDetails(
                        timestamp=Timestamp(create_query.queryDate.root),
                        accessedBy=user,
                        accessedByAProcess=process_user,
                    )
                    life_cycle_attr = getattr(life_cycle, query_type)
                    if (
                        not life_cycle_attr
                        or life_cycle_attr.timestamp.root
                        < access_details.timestamp.root
                    ):
                        setattr(life_cycle, query_type, access_details)

            self.metadata.patch_life_cycle(entity=table_entity, life_cycle=life_cycle)

        except Exception as err:
            error = f"Unable to get life cycle data for table {table_entity.fullyQualifiedName}: {err}"
            self.status.failed(
                StackTraceError(
                    name=table_usage.table,
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )

    def close(self):
        if Path(self.config.filename).exists():
            shutil.rmtree(self.config.filename)
        try:
            self.metadata.compute_percentile(Table, self.today)
            self.metadata.compute_percentile(Database, self.today)
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to publish compute.percentile: {err}")

        self.metadata.close()
