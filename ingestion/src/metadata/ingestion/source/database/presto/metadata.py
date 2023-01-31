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
Presto source module
"""

import re
import traceback
from copy import deepcopy
from typing import Iterable

from pyhive.sqlalchemy_presto import PrestoDialect, _type_map
from sqlalchemy import inspect, types, util
from sqlalchemy.engine import reflection

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection,
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
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

_type_map.update(
    {
        "char": types.CHAR,
        "decimal": types.Float,
        "time": types.TIME,
        "varchar": types.VARCHAR,
    }
)


@reflection.cache
def get_columns(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    Handle columns for presto
    """
    rows = self._get_table_columns(  # pylint: disable=protected-access
        connection, table_name, schema
    )
    result = []
    for row in rows:
        try:
            # Take out the more detailed type information
            # e.g. 'map<int,int>' -> 'map'
            #      'decimal(10,1)' -> decimal
            col_type = re.search(r"^\w+", row.Type).group(0)
            coltype = _type_map[col_type]

            charlen = re.search(r"\(([\d]+)\)", row.Type)
            if charlen:
                charlen = charlen.group(1)
                args = (int(charlen),)
                coltype = coltype(
                    *args,
                )
        except KeyError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error reading row [{row}]: {err}")
            util.warn(f"Did not recognize type '{row.Type}' of column '{row.Column}'")
            coltype = types.NullType
        result.append(
            {
                "name": row.Column,
                "type": coltype,
                # newer Presto no longer includes this column
                "nullable": getattr(row, "Null", True),
                "default": None,
            }
        )
    return result


PrestoDialect.get_columns = get_columns


class PrestoSource(CommonDbSourceService):
    """
    Presto does not support querying by table type: Getting views is not supported.
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: PrestoConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PrestoConnection):
            raise InvalidSourceException(
                f"Expected PrestoConnection, but got {connection}"
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
        configured_catalog = self.service_connection.catalog
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
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Error trying to connect to database {new_catalog}: {exc}"
                        )
