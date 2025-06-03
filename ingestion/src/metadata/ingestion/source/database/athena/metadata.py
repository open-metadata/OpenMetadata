#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Athena source module"""

import traceback
from typing import Iterable, Optional, Tuple

from pyathena.sqlalchemy.base import AthenaDialect
from sqlalchemy.engine.reflection import Inspector

from metadata.clients.aws_client import AWSClient
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
from metadata.ingestion.source.database.athena.client import AthenaLakeFormationClient
from metadata.ingestion.source.database.athena.utils import (
    _get_column_type,
    get_columns,
    get_table_options,
    get_view_definition,
)
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
)
from metadata.ingestion.source.database.glue.models import DatabasePage
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_all_table_ddls, get_table_ddl
from metadata.utils.tag_utils import get_ometa_tag_and_classification

AthenaDialect._get_column_type = _get_column_type  # pylint: disable=protected-access
AthenaDialect.get_columns = get_columns
AthenaDialect.get_view_definition = get_view_definition
AthenaDialect.get_table_options = get_table_options

Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl

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


class AthenaSource(ExternalTableLineageMixin, CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Athena Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AthenaConnection = config.serviceConnection.root.config
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
        self.external_location_map = {}
        self.schema_description_map = {}

    def prepare(self):
        """
        Prepare the source by fetching the schema descriptions from the AWS Glue service.
        """
        try:
            super().prepare()
            glue_client = AWSClient(self.service_connection.awsConfig).get_glue_client()
            paginator = glue_client.get_paginator("get_databases")
            for page in paginator.paginate():
                database_page = DatabasePage(**page)
                for database in database_page.DatabaseList or []:
                    if database.Description:
                        self.schema_description_map[
                            database.Name
                        ] = database.Description
        except Exception as exc:
            logger.warning(f"Error preparing Athena source: {exc}")
            logger.debug(traceback.format_exc())

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        return self.schema_description_map.get(schema_name)

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

    def get_location_path(self, table_name: str, schema_name: str) -> Optional[str]:
        """
        Method to fetch the location path of the table
        """
        return self.external_location_map.get(
            (self.context.get().database, schema_name, table_name)
        )

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
                            service_name=self.context.get().database_service,
                            database_name=self.context.get().database,
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
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                    )
                )

                # yield the table tags
                for tag in table_tags.LFTagsOnTable or []:
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=fqn.build(
                            self.metadata,
                            Table,
                            service_name=self.context.get().database_service,
                            database_name=self.context.get().database,
                            schema_name=self.context.get().database_schema,
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
                                service_name=self.context.get().database_service,
                                database_name=self.context.get().database,
                                schema_name=self.context.get().database_schema,
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

    # pylint: disable=arguments-differ
    def get_table_description(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
            table_option = inspector.get_table_options(table_name, schema_name)
            self.external_location_map[
                (self.context.get().database, schema_name, table_name)
            ] = table_option.get("awsathena_location")
        # Catch any exception without breaking the ingestion
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Table description error for table [{schema_name}.{table_name}]: {exc}"
            )
        else:
            description = table_info.get("text")
        return description
