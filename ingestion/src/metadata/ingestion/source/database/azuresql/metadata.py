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
"""Azure SQL source module"""

from sqlalchemy.dialects.mssql.base import ischema_names
from sqlalchemy.dialects.mssql.pyodbc import MSDialect_pyodbc
from sqlalchemy.sql.sqltypes import String

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService


class NCHAR(String):
    """The SQL NCHAR type."""

    __visit_name__ = "NCHAR"


class NVARCHAR(String):
    """The SQL NVARCHAR type."""

    __visit_name__ = "NVARCHAR"


class NTEXT(String):
    """The SQL NTEXT type."""

    __visit_name__ = "NTEXT"


class BINARY(String):
    """The SQL BINARY type."""

    __visit_name__ = "BINARY"


class IMAGE(String):
    """The SQL IMAGE type."""

    __visit_name__ = "IMAGE"


class BIT(String):
    """The SQL BIT type."""

    __visit_name__ = "BIT"


class SMALLMONEY(String):
    """The SQL SMALLMONEY type."""

    __visit_name__ = "SMALLMONEY"


class MONEY(String):
    """The SQL MONEY type."""

    __visit_name__ = "MONEY"


class REAL(String):
    """The SQL REAL type."""

    __visit_name__ = "REAL"


class SMALLDATETIME(String):
    """The SQL SMALLDATETIME type."""

    __visit_name__ = "SMALLDATETIME"


class DATETIME2(String):
    """The SQL DATETIME2 type."""

    __visit_name__ = "DATETIME2"


class DATETIMEOFFSET(String):
    """The SQL DATETIMEOFFSET type."""

    __visit_name__ = "DATETIMEOFFSET"


class SQL_VARIANT(String):
    """The SQL SQL_VARIANT type."""

    __visit_name__ = "SQL_VARIANT"


class UNIQUEIDENTIFIER(String):
    """The SQL UNIQUEIDENTIFIER type."""

    __visit_name__ = "UNIQUEIDENTIFIER"


class XML(String):
    """The SQL XML type."""

    __visit_name__ = "XML"


class GEOGRAPHY(String):
    """The SQL GEOGRAPHY type."""

    __visit_name__ = "GEOGRAPHY"


class GEOMETRY(String):
    """The SQL GEOMETRY type."""

    __visit_name__ = "GEOMETRY"


ischema_names.update(
    {
        "nvarchar": NVARCHAR,
        "nchar": NCHAR,
        "ntext": NTEXT,
        "bit": BIT,
        "image": IMAGE,
        "binary": BINARY,
        "smallmoney": SMALLMONEY,
        "money": MONEY,
        "real": REAL,
        "smalldatetime": SMALLDATETIME,
        "datetime2": DATETIME2,
        "datetimeoffset": DATETIMEOFFSET,
        "sql_variant": SQL_VARIANT,
        "uniqueidentifier": UNIQUEIDENTIFIER,
        "xml": XML,
        "geography": GEOGRAPHY,
        "geometry": GEOMETRY,
    }
)


MSDialect_pyodbc.ischema_names = ischema_names


class AzuresqlSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Azuresql Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AzureSQLConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AzureSQLConnection):
            raise InvalidSourceException(
                f"Expected AzureSQLConnection, but got {connection}"
            )
        return cls(config, metadata_config)
