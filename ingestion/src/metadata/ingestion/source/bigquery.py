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
import json
import logging
import os
import tempfile
from typing import Optional, Tuple

from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy_bigquery import _types
from sqlalchemy_bigquery._struct import STRUCT
from sqlalchemy_bigquery._types import (
    _get_sqla_column_type,
    _get_transitive_schema_fields,
)

from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.helpers import get_start_and_end

logger = logging.getLogger(__name__)
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


class BigQueryConfig(BigQueryConnection, SQLConnectionConfig):
    duration: int = 1
    partition_query: str = 'select * from {}.{} WHERE {} = "{}" LIMIT 1000'
    partition_field: Optional[str] = "_PARTITIONTIME"

    def get_connection_url(self):
        if self.projectID:
            return f"{self.scheme}://{self.projectID}"
        return f"{self.scheme}://"


class BigquerySource(SQLSource, BigQueryConfig):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.temp_credentials = None

    #  and "policy_tags" in column and column["policy_tags"]
    def prepare(self):
        try:
            if self.enablePolicyTagImport:
                self.metadata.create_tag_category(
                    CreateTagCategoryRequest(
                        name=self.tagCategoryName,
                        description="",
                        categoryType="Classification",
                    )
                )
        except Exception as err:
            logger.error(err)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config: SQLConnectionConfig = BigQueryConfig.parse_obj(config_dict)
        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            if config.options.get("credentials_path"):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = config.options[
                    "credentials_path"
                ]
            elif config.options.get("credentials"):
                cls.temp_credentials = cls.create_credential_temp_file(
                    credentials=config.options.get("credentials")
                )
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cls.temp_credentials
                del config.options["credentials"]
            else:
                logger.warning(
                    "Please refer to the BigQuery connector documentation, especially the credentials part "
                    "https://docs.open-metadata.org/connectors/bigquery"
                )
        return cls(config, metadata_config)

    @staticmethod
    def create_credential_temp_file(credentials: dict) -> str:
        with tempfile.NamedTemporaryFile(delete=False) as fp:
            cred_json = json.dumps(credentials, indent=4, separators=(",", ": "))
            fp.write(cred_json.encode())
            return fp.name

    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        segments = table.split(".")
        if len(segments) != 2:
            raise ValueError(f"expected table to contain schema name already {table}")
        if segments[0] != schema:
            raise ValueError(f"schema {schema} does not match table {table}")
        return segments[0], segments[1]

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        partition_details = self.inspector.get_indexes(table, schema)
        if partition_details and partition_details[0].get("name") == "partition":
            try:
                logger.info("Using Query for Partitioned Tables")
                partition_details = self.inspector.get_indexes(table, schema)
                start, end = get_start_and_end(self.config.duration)

                query = self.partition_query.format(
                    schema,
                    table,
                    partition_details[0]["column_names"][0] or self.partition_field,
                    start.strftime("%Y-%m-%d"),
                )
                logger.info(query)
                results = self.connection.execute(query)
                cols = []
                for col in results.keys():
                    cols.append(col)
                rows = []
                for res in results:
                    row = list(res)
                    rows.append(row)
                return TableData(columns=cols, rows=rows)
            except Exception as err:
                logger.error(err)
                return []

        super().fetch_sample_data(schema, table)

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type.replace(", ", ",").replace(" ", ":").lower()

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
