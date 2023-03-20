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
Trino source implementation.
"""
import logging
import sys
import traceback
from copy import deepcopy
from typing import Iterable

from sqlalchemy import inspect
from trino.sqlalchemy.dialect import TrinoDialect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ANSI, ingestion_logger, log_ansi_encoded_string
from metadata.utils.sqlalchemy_utils import get_all_table_comments

logger = ingestion_logger()


TrinoDialect._get_columns = _get_columns  # pylint: disable=protected-access
TrinoDialect.get_all_table_comments = get_all_table_comments
TrinoDialect.get_table_comment = get_table_comment


class TrinoSource(CommonDbSourceService):
    """
    Trino does not support querying by table type: Getting views is not supported.
    """

    def __init__(self, config, metadata_config):
        self.trino_connection: TrinoConnection = (
            config.serviceConnection.__root__.config
        )
        try:
            from trino import (  # pylint: disable=import-outside-toplevel,unused-import
                dbapi,
            )
        except ModuleNotFoundError:
            log_ansi_encoded_string(
                color=ANSI.BRIGHT_RED,
                bold=False,
                message="Trino source dependencies are missing. Please run\n"
                "$ pip install --upgrade 'openmetadata-ingestion[trino]'",
            )
            if logger.isEnabledFor(logging.DEBUG):
                raise
            sys.exit(1)
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: TrinoConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, TrinoConnection):
            raise InvalidSourceException(
                f"Expected TrinoConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def set_inspector(self, database_name: str) -> None:
        """
        When sources override `get_database_names`, they will need
        to setup multiple inspectors. They can use this function.
        :param database_name: new database to set
        """
        logger.info(f"Ingesting from catalog: {database_name}")

        new_service_connection = deepcopy(self.service_connection)
        new_service_connection.catalog = database_name
        self.engine = get_connection(new_service_connection)
        self.inspector = inspect(self.engine)

    def get_database_names(self) -> Iterable[str]:
        configured_catalog = self.trino_connection.catalog
        if configured_catalog:
            self.set_inspector(database_name=configured_catalog)
            yield configured_catalog
        else:
            results = self.connection.execute("SHOW CATALOGS")
            for res in results:
                if res:
                    new_catalog = res[0]
                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.context.database_service.name.__root__,
                        database_name=new_catalog,
                    )
                    if filter_by_database(
                        self.source_config.databaseFilterPattern,
                        database_fqn
                        if self.source_config.useFqnForFiltering
                        else new_catalog,
                    ):
                        self.status.filter(database_fqn, "Database Filtered Out")
                        continue

                    try:
                        self.set_inspector(database_name=new_catalog)
                        yield new_catalog
                    except Exception as err:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Error trying to connect to database {new_catalog}: {err}"
                        )
