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

from sqlalchemy.dialects.mssql.base import MSDialect, ischema_names

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
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.mssql.utils import (
    get_columns,
    get_table_comment,
    get_view_definition,
)
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)

ischema_names.update(
    {
        "nvarchar": create_sqlalchemy_type("NVARCHAR"),
        "nchar": create_sqlalchemy_type("NCHAR"),
        "ntext": create_sqlalchemy_type("NTEXT"),
        "bit": create_sqlalchemy_type("BIT"),
        "image": create_sqlalchemy_type("IMAGE"),
        "binary": create_sqlalchemy_type("BINARY"),
        "smallmoney": create_sqlalchemy_type("SMALLMONEY"),
        "money": create_sqlalchemy_type("MONEY"),
        "real": create_sqlalchemy_type("REAL"),
        "smalldatetime": create_sqlalchemy_type("SMALLDATETIME"),
        "datetime2": create_sqlalchemy_type("DATETIME2"),
        "datetimeoffset": create_sqlalchemy_type("DATETIMEOFFSET"),
        "sql_variant": create_sqlalchemy_type("SQL_VARIANT"),
        "uniqueidentifier": create_sqlalchemy_type("UUID"),
        "xml": create_sqlalchemy_type("XML"),
    }
)

MSDialect.get_table_comment = get_table_comment
MSDialect.get_view_definition = get_view_definition
MSDialect.get_all_view_definitions = get_all_view_definitions
MSDialect.get_all_table_comments = get_all_table_comments
MSDialect.get_columns = get_columns


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
