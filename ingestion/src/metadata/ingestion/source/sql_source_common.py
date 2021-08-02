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

import logging
import time
from abc import abstractmethod, ABC
from metadata.config.common import ConfigModel
from typing import Any, Iterable, List, Optional, Tuple, Type
from dataclasses import dataclass, field
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from sqlalchemy import create_engine

from metadata.ingestion.ometa.auth_provider import MetadataServerConfig


@dataclass
class SQLSourceStatus(SourceStatus):
    tables_scanned = 0
    filtered: List[str] = field(default_factory=list)

    def report_table_scanned(self, table_name: str) -> None:
        self.tables_scanned += 1

    def report_dropped(self, table_name: str) -> None:
        self.filtered.append(table_name)


class SQLAlchemyConfig(ConfigModel):
    options: dict = {}

    @abstractmethod
    def get_sql_alchemy_url(self):
        pass

    def get_identifier(self, schema: str, table: str) -> str:
        return f"{schema}.{table}"

    def standardize_schema_table_names(
            self, schema: str, table: str
    ) -> Tuple[str, str]:
        # Some SQLAlchemy dialects need a standardization step to clean the schema
        # and table names. See BigQuery for an example of when this is useful.
        return schema, table


class BasicSQLQueryConfig(SQLAlchemyConfig):
    username: Optional[str] = None
    password: Optional[str] = None
    host_port: str
    database: Optional[str] = None
    scheme: str

    def get_sql_alchemy_url(self):
        url = f"{self.scheme}://"
        if self.username:
            url += f"{self.username}"
            if self.password:
                url += f":{self.password}"
            url += "@"
        url += f"{self.host_port}"
        if self.database:
            url += f"/{self.database}"
        return url


class SQLAlchemyHelper:
    """A helper class for all SQL Sources that use SQLAlchemy to extend"""

    def __init__(self, config: SQLAlchemyConfig, metadata_config: MetadataServerConfig,
                 ctx: WorkflowContext, platform: str, query: str):
        self.config = config
        self.platform = platform
        self.report = SQLSourceStatus()
        self.query = query
        self.connection = self._get_connection()

    def _get_connection(self) -> Any:
        """
        Create a SQLAlchemy connection to Database
        """
        engine = create_engine(self.config.get_sql_alchemy_url())
        conn = engine.connect()
        return conn

    def execute_query(self) -> Iterable[Any]:
        """
        Create an iterator to execute sql.
        """
        if not hasattr(self, 'results'):
            self.results = self.connection.execute(self.query)

        if hasattr(self, 'model_class'):
            results = [self.model_class(**result)
                       for result in self.results]
        else:
            results = self.results
        return iter(results)

    def next_record(self) -> Iterable[Any]:
        """
        Yield the sql result one at a time.
        convert the result to model if a model_class is provided
        """
        try:
            return next(self.iter)
        except StopIteration:
            return None
        except Exception as e:
            raise e

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()
