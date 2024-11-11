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
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.queryParserData import ParsedData, QueryParserData
from metadata.generated.schema.type.tableUsageCount import TableUsageCount
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Stage
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import init_staging_dir
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TableStageConfig(ConfigModel):
    filename: str


class TableUsageStage(Stage):
    """
    Stage implementation for Table Usage data.

    Converts QueryParserData into TableUsageCount
    and stores it in files partitioned by date.
    """

    config: TableStageConfig

    def __init__(
        self,
        config: TableStageConfig,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.table_usage = {}
        self.table_queries = {}
        init_staging_dir(self.config.filename)
        self.wrote_something = False

    @property
    def name(self) -> str:
        return "Table Usage"

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = TableStageConfig.model_validate(config_dict)
        return cls(config, metadata)

    def init_location(self) -> None:
        """
        Prepare the usage location
        """
        location = Path(self.config.filename)
        if location.is_dir():
            logger.info("Location exists, cleaning it up")
            shutil.rmtree(self.config.filename)
        logger.info(f"Creating the directory to store staging data in {location}")
        location.mkdir(parents=True, exist_ok=True)

    def _get_user_entity(
        self, username: str
    ) -> Tuple[Optional[List[str]], Optional[List[str]]]:
        """
        From the user received in the query history call - who executed the query in the db -
        return if we find any users in OM that match, plus the user that we found in the db record.
        """
        if username:
            user = self.metadata.get_by_name(entity=User, fqn=username)
            if user:
                return [user.fullyQualifiedName.root], [username]
            return None, [username]
        return None, None

    def _add_sql_query(self, record, table):
        users, used_by = self._get_user_entity(record.userName)
        if self.table_queries.get((table, record.date)):
            self.table_queries[(table, record.date)].append(
                CreateQueryRequest(
                    query=record.sql,
                    query_type=record.query_type,
                    exclude_usage=record.exclude_usage,
                    users=users,
                    queryDate=record.date,
                    dialect=record.dialect,
                    usedBy=used_by,
                    duration=record.duration,
                    service=record.serviceName,
                )
            )
        else:
            self.table_queries[(table, record.date)] = [
                CreateQueryRequest(
                    query=record.sql,
                    query_type=record.query_type,
                    exclude_usage=record.exclude_usage,
                    users=users,
                    queryDate=record.date,
                    usedBy=used_by,
                    dialect=record.dialect,
                    duration=record.duration,
                    service=record.serviceName,
                )
            ]

    def _handle_table_usage(
        self, parsed_data: ParsedData, table: str
    ) -> Iterable[Either[str]]:
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
            self.table_usage[(table, parsed_data.date)] = table_usage_count

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table,
                    error=f"Error in staging record [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )
        yield Either(right=table)

    def _run(self, record: QueryParserData) -> Iterable[Either[str]]:
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
                yield from self._handle_table_usage(
                    parsed_data=parsed_data, table=table
                )
        self.dump_data_to_file()

    def dump_data_to_file(self):
        for key, value in self.table_usage.items():
            if value:
                value.sqlQueries = self.table_queries.get(key, [])
                data = value.model_dump_json()
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
