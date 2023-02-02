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
"""Oracle source module"""
from sqlalchemy.dialects.oracle.base import OracleDialect
from sqlalchemy.engine import reflection

from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_ALL_TABLE_COMMENTS,
    ORACLE_ALL_VIEW_DEFINITIONS,
)
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, resolve_synonyms=False, dblink="", **kw
):  # pylint: disable=unused-argument
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=ORACLE_ALL_TABLE_COMMENTS,
    )


@reflection.cache
def get_view_definition(
    self, connection, view_name, schema=None, resolve_synonyms=False, dblink="", **kw
):  # pylint: disable=unused-argument
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=view_name,
        schema=schema,
        query=ORACLE_ALL_VIEW_DEFINITIONS,
    )


OracleDialect.get_table_comment = get_table_comment
OracleDialect.get_view_definition = get_view_definition
OracleDialect.get_all_view_definitions = get_all_view_definitions
OracleDialect.get_all_table_comments = get_all_table_comments


class OracleSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Oracle Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: OracleConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, OracleConnection):
            raise InvalidSourceException(
                f"Expected OracleConnection, but got {connection}"
            )
        return cls(config, metadata_config)
