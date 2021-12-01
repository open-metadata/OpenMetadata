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


from typing import Any, Iterable

from sqlalchemy import create_engine

from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

from .sql_source import SQLConnectionConfig, SQLSourceStatus


class SQLAlchemyHelper:
    """A helper class for all SQL Sources that use SQLAlchemy to extend"""

    def __init__(
        self,
        config: SQLConnectionConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
        platform: str,
        query: str,
    ):
        self.config = config
        self.platform = platform
        self.report = SQLSourceStatus()
        self.query = query
        self.connection = self._get_connection()

    def _get_connection(self) -> Any:
        """
        Create a SQLAlchemy connection to Database
        """
        engine = create_engine(self.config.get_connection_url())
        conn = engine.connect()
        return conn

    def execute_query(self) -> Iterable[Any]:
        """
        Create an iterator to execute sql.
        """
        if not hasattr(self, "results"):
            self.results = self.connection.execute(self.query)

        if hasattr(self, "model_class"):
            results = [self.model_class(**result) for result in self.results]
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
