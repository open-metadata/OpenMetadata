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

"""Athena source module"""

import traceback
from copy import deepcopy
from typing import Dict, Iterable, List, Optional, Tuple

from pyathena.sqlalchemy.base import AthenaDialect
from sqlalchemy import types
from sqlalchemy.engine import reflection
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    Table,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source import sqa_types
from metadata.ingestion.source.database.athena.client import AthenaLakeFormationClient
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import is_complex_type
from metadata.utils.tag_utils import get_ometa_tag_and_classification

logger = ingestion_logger()

ATHENA_TAG = "ATHENA TAG"
ATHENA_TAG_CLASSIFICATION = "ATHENA TAG CLASSIFICATION"

ATHENA_INTERVAL_TYPE_MAP = {
    **dict.fromkeys(["enum", "string", "VARCHAR"], PartitionIntervalTypes.COLUMN_VALUE),
    **dict.fromkeys(
        ["integer", "bigint", "INTEGER", "BIGINT"], PartitionIntervalTypes.INTEGER_RANGE
    ),
    **dict.fromkeys(
        ["date", "timestamp", "DATE", "DATETIME", "TIMESTAMP"],
        PartitionIntervalTypes.TIME_UNIT,
    ),
    "injected": PartitionIntervalTypes.INJECTED,
}


def _get_column_type(self, type_):
    """
    Function overwritten from AthenaDialect
    to add custom SQA typing.
    """
    type_ = type_.replace(" ", "").lower()
    match = self._pattern_column_type.match(type_)  # pylint: disable=protected-access
    if match:
        name = match.group(1).lower()
        length = match.group(2)
    else:
        name = type_.lower()
        length = None

    args = []
    col_map = {
        "boolean": types.BOOLEAN,
        "float": types.FLOAT,
        "double": types.FLOAT,
        "real": types.FLOAT,
        "tinyint": types.INTEGER,
        "smallint": types.INTEGER,
        "integer": types.INTEGER,
        "int": types.INTEGER,
        "bigint": types.BIGINT,
        "string": types.String,
        "date": types.DATE,
        "timestamp": types.TIMESTAMP,
        "binary": types.BINARY,
        "varbinary": types.BINARY,
        "array": types.ARRAY,
        "json": types.JSON,
        "struct": sqa_types.SQAStruct,
        "row": sqa_types.SQAStruct,
        "map": sqa_types.SQAMap,
        "decimal": types.DECIMAL,
        "varchar": types.VARCHAR,
        "char": types.CHAR,
    }
    if name in ["decimal", "char", "varchar"]:
        col_type = col_map[name]
        if length:
            args = [int(l) for l in length.split(",")]
    elif type_.startswith("array"):
        parsed_type = (
            ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                type_
            )
        )
        col_type = col_map["array"]
        if parsed_type["arrayDataType"].lower().startswith("array"):
            # as OpenMetadata doesn't store any details on children of array, we put
            # in type as string as default to avoid Array item_type required issue
            # from sqlalchemy types
            args = [types.String]
        else:
            args = [col_map.get(parsed_type.get("arrayDataType").lower(), types.String)]
    elif col_map.get(name):
        col_type = col_map.get(name)
    else:
        logger.warning(f"Did not recognize type '{type_}'")
        col_type = types.NullType
    return col_type(*args)


def _get_projection_details(
    columns: List[Dict], projection_parameters: Dict
) -> List[Dict]:
    """Get the projection details for the columns

    Args:
        columns (List[Dict]): list of columns
        projection_parameters (Dict): projection parameters
    """
    if not projection_parameters:
        return columns

    columns = deepcopy(columns)
    for col in columns:
        projection_details = next(
            ({k: v} for k, v in projection_parameters.items() if k == col["name"]), None
        )
        if projection_details:
            col["projection_type"] = projection_details[col["name"]]

    return columns


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    Method to handle table columns
    """
    metadata = self._get_table(  # pylint: disable=protected-access
        connection, table_name, schema=schema, **kw
    )
    columns = [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),  # pylint: disable=protected-access
            "nullable": True,
            "default": None,
            "autoincrement": False,
            "comment": c.comment,
            "system_data_type": c.type,
            "is_complex": is_complex_type(c.type),
            "dialect_options": {"awsathena_partition": True},
        }
        for c in metadata.partition_keys
    ]

    if kw.get("only_partition_columns"):
        # Return projected partition information to set partition type in `get_table_partition_details`
        # projected partition fields are stored in the form of `projection.<field_name>.type` as a table parameter
        projection_parameters = {
            key_.split(".")[1]: value_
            for key_, value_ in metadata.parameters.items()
            if key_.startswith("projection") and key_.endswith("type")
        }
        columns = _get_projection_details(columns, projection_parameters)
        return columns

    columns += [
        {
            "name": c.name,
            "type": self._get_column_type(c.type),  # pylint: disable=protected-access
            "nullable": True,
            "default": None,
            "autoincrement": False,
            "comment": c.comment,
            "system_data_type": c.type,
            "is_complex": is_complex_type(c.type),
            "dialect_options": {"awsathena_partition": None},
        }
        for c in metadata.columns
    ]

    return columns


# pylint: disable=unused-argument
@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    """
    Gets the view definition
    """
    full_view_name = f'"{view_name}"' if not schema else f'"{schema}"."{view_name}"'
    res = connection.execute(f"SHOW CREATE VIEW {full_view_name}").fetchall()
    if res:
        return "\n".join(i[0] for i in res)
    return None


AthenaDialect._get_column_type = _get_column_type  # pylint: disable=protected-access
AthenaDialect.get_columns = get_columns
AthenaDialect.get_view_definition = get_view_definition


class AthenaSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Athena Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AthenaConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AthenaConnection):
            raise InvalidSourceException(
                f"Expected AthenaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.athena_lake_formation_client = AthenaLakeFormationClient(
            connection=self.service_connection
        )

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """Return tables as external"""

        return [
            TableNameAndType(name=name, type_=TableType.External)
            for name in self.inspector.get_table_names(schema_name)
        ]

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, Optional[TablePartition]]:
        """Get Athena table partition detail

        Args:
            table_name (str): name of the table
            schema_name (str): name of the schema
            inspector (Inspector):


        Returns:
            Tuple[bool, Optional[TablePartition]]:
        """
        columns = inspector.get_columns(
            table_name=table_name, schema=schema_name, only_partition_columns=True
        )
        if columns:
            partition_details = TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=col["name"],
                        intervalType=ATHENA_INTERVAL_TYPE_MAP.get(
                            col.get("projection_type", str(col["type"])),
                            PartitionIntervalTypes.COLUMN_VALUE,
                        ),
                        interval=None,
                    )
                    for col in columns
                ]
            )
            return True, partition_details
        return False, None

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to yield schema tags
        """
        if self.source_config.includeTags:
            try:
                tags = self.athena_lake_formation_client.get_database_tags(
                    name=schema_name
                )
                for tag in tags or []:
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=fqn.build(
                            self.metadata,
                            DatabaseSchema,
                            service_name=self.context.database_service,
                            database_name=self.context.database,
                            schema_name=schema_name,
                        ),
                        tags=tag.TagValues,
                        classification_name=tag.TagKey,
                        tag_description=ATHENA_TAG,
                        classification_description=ATHENA_TAG_CLASSIFICATION,
                    )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Tags and Classifications",
                        error=f"Failed to fetch database tags due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_table_tags(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to yield table and column tags
        """
        if self.source_config.includeTags:
            try:
                table_name, _ = table_name_and_type
                table_tags = (
                    self.athena_lake_formation_client.get_table_and_column_tags(
                        schema_name=self.context.database_schema, table_name=table_name
                    )
                )

                # yield the table tags
                for tag in table_tags.LFTagsOnTable or []:
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=fqn.build(
                            self.metadata,
                            Table,
                            service_name=self.context.database_service,
                            database_name=self.context.database,
                            schema_name=self.context.database_schema,
                            table_name=table_name,
                        ),
                        tags=tag.TagValues,
                        classification_name=tag.TagKey,
                        tag_description=ATHENA_TAG,
                        classification_description=ATHENA_TAG_CLASSIFICATION,
                    )

                # yield the column tags
                for column in table_tags.LFTagsOnColumns or []:
                    for tag in column.LFTags or []:
                        yield from get_ometa_tag_and_classification(
                            tag_fqn=fqn.build(
                                self.metadata,
                                Column,
                                service_name=self.context.database_service,
                                database_name=self.context.database,
                                schema_name=self.context.database_schema,
                                table_name=table_name,
                                column_name=column.Name,
                            ),
                            tags=tag.TagValues,
                            classification_name=tag.TagKey,
                            tag_description=ATHENA_TAG,
                            classification_description=ATHENA_TAG_CLASSIFICATION,
                        )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Tags and Classifications",
                        error=f"Failed to fetch table/column tags due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )
