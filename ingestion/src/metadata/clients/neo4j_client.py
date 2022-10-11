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
Neo4J helper
"""
import importlib
import traceback
from typing import Any, Iterable, Iterator, Optional, Union

import neo4j
from neo4j import GraphDatabase

from metadata.config.common import ConfigModel
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class Neo4JConfig(ConfigModel):
    username: Optional[str] = None
    password: Optional[str] = None
    neo4j_url: str
    max_connection_life_time: int = 50
    neo4j_encrypted: bool = True
    neo4j_validate_ssl: bool = False
    model_class: Optional[str] = None


class Neo4jHelper:
    """
    A helper class to extract data from Neo4J
    """

    def __init__(self, conf: Neo4JConfig) -> None:
        """
        Establish connections and import data model class if provided
        :param conf:
        """
        self.conf = conf
        self.graph_url = self.conf.neo4j_url
        self.driver = self._get_driver()
        self._extract_iter: Union[None, Iterator] = None

        model_class = self.conf.model_class
        if model_class is not None:
            module_name, class_name = model_class.rsplit(".", 1)
            mod = importlib.import_module(module_name)
            self.model_class = getattr(mod, class_name)

    def _get_driver(self) -> Any:
        """
        Create a Neo4j connection to Database
        """
        trust = (
            neo4j.TRUST_SYSTEM_CA_SIGNED_CERTIFICATES
            if self.conf.neo4j_validate_ssl
            else neo4j.TRUST_ALL_CERTIFICATES
        )
        return GraphDatabase.driver(
            self.graph_url,
            auth=(self.conf.username, self.conf.password),
            encrypted=self.conf.neo4j_encrypted,
            trust=trust,
        )

    def _execute_query(self, transaction: Any, query: str) -> Any:
        """
        Create an iterator to execute sql.
        """
        logger.debug("Executing query %s", query)
        result = transaction.run(query)
        entities = []
        for record in result:
            entities.append(record.data())
        return entities

    def execute_query(self, query: str) -> Iterable[Any]:
        """
        Execute {query} and yield result one at a time
        """
        with self.driver.session() as session:
            neo4j_results = session.read_transaction(self._execute_query, query)
            if hasattr(self, "model_class"):
                results = [
                    self.model_class(**neo4j_result) for neo4j_result in neo4j_results
                ]
            else:
                results = neo4j_results
            return iter(results)

    def close(self) -> None:
        """
        close connection to neo4j cluster
        """
        try:
            self.driver.close()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Exception encountered while closing the graph driver: {exc}"
            )
