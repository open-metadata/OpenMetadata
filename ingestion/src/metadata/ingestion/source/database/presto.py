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
from typing import Iterable

from pyhive.sqlalchemy_presto import PrestoDialect, _type_map
from sqlalchemy import inspect, types, util
from sqlalchemy.engine import reflection

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
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
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

    def get_database_names(self) -> Iterable[str]:
        self.inspector = inspect(self.engine)
        yield self.service_connection.catalog
