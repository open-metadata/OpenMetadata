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
We require Taxonomy Admin permissions to fetch all Policy Tags
"""
import os
from typing import Iterable, List, Optional

from google import auth
from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy import inspect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_bigquery import _types
from sqlalchemy_bigquery._struct import STRUCT
from sqlalchemy_bigquery._types import (
    _get_sqla_column_type,
    _get_transitive_schema_fields,
)

from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
_types._type_map["GEOGRAPHY"] = GEOGRAPHY


def get_columns(bq_schema):
    fields = _get_transitive_schema_fields(bq_schema)
    col_list = []
    for field in fields:
        col_obj = {
            "name": field.name,
            "type": _get_sqla_column_type(field)
            if "STRUCT" or "RECORD" not in field
            else STRUCT,
            "nullable": field.mode == "NULLABLE" or field.mode == "REPEATED",
            "comment": field.description,
            "default": None,
            "precision": field.precision,
            "scale": field.scale,
            "max_length": field.max_length,
            "raw_data_type": str(_get_sqla_column_type(field)),
            "policy_tags": None,
        }
        try:
            if field.policy_tags:
                col_obj["policy_tags"] = (
                    PolicyTagManagerClient()
                    .get_policy_tag(name=field.policy_tags.names[0])
                    .display_name
                )
        except Exception as err:
            logger.info(f"Skipping Policy Tag: {err}")
        col_list.append(col_obj)
    return col_list


_types.get_columns = get_columns


class BigquerySource(CommonDbSourceService):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.temp_credentials = None
        self.project_id = self.set_project_id()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: BigQueryConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, BigQueryConnection):
            raise InvalidSourceException(
                f"Expected BigQueryConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def standardize_table_name(self, schema: str, table: str) -> str:
        segments = fqn.split(table)
        if len(segments) != 2:
            raise ValueError(f"expected table to contain schema name already {table}")
        if segments[0] != schema:
            raise ValueError(f"schema {schema} does not match table {table}")
        return segments[1]

    @staticmethod
    def set_project_id():
        _, project_id = auth.default()
        return project_id

    def yield_tag(self, _: str) -> Iterable[OMetaTagAndCategory]:
        """
        Build tag context
        :param _:
        :return:
        """
        taxonomies = PolicyTagManagerClient().list_taxonomies(
            parent=f"projects/{self.project_id}/locations/{self.service_connection.taxonomyLocation}"
        )
        for taxonomy in taxonomies:
            policiy_tags = PolicyTagManagerClient().list_policy_tags(
                parent=taxonomy.name
            )
            for tag in policiy_tags:
                yield OMetaTagAndCategory(
                    category_name=CreateTagCategoryRequest(
                        name=self.service_connection.tagCategoryName,
                        description="",
                        categoryType="Classification",
                    ),
                    category_details=CreateTagRequest(
                        name=tag.display_name, description="Bigquery Policy Tag"
                    ),
                )

    def get_tag_labels(self, table_name: str) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        return []

    def get_column_tag_labels(
        self, table_name: str, column: dict
    ) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        if not self.source_config.includeTags:
            return
        if column.get("policy_tags"):
            return [
                TagLabel(
                    tagFQN=fqn.build(
                        self.metadata,
                        entity_type=Tag,
                        tag_category_name=self.service_connection.tagCategoryName,
                        tag_name=column["policy_tags"],
                    ),
                    labelType="Automated",
                    state="Suggested",
                    source="Tag",
                )
            ]

    def get_database_names(self) -> Iterable[str]:
        self.inspector = inspect(self.engine)
        yield self.project_id

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        if table_type == TableType.View:
            view_definition = ""
            try:
                view_definition = inspector.get_view_definition(
                    f"{self.project_id}.{schema_name}.{table_name}"
                )
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
            except NotImplementedError:
                view_definition = ""
            return view_definition

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type.replace(", ", ",").replace(" ", ":").lower()

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
