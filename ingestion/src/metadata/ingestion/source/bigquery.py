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

import os
from typing import Optional, Tuple, Any
import json, tempfile, logging

from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig
from metadata.utils.column_type_parser import create_sqlalchemy_type
from sqlalchemy_bigquery import _types
from sqlalchemy_bigquery._struct import STRUCT
from sqlalchemy_bigquery._types import (
    _get_sqla_column_type,
    _get_transitive_schema_fields,
)

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
        }
        col_list.append(col_obj)
    return col_list


_types.get_columns = get_columns


class BigQueryConfig(SQLConnectionConfig):
    scheme = "bigquery"
    host_port: Optional[str] = "bigquery.googleapis.com"
    username: Optional[str] = None
    project_id: Optional[str] = None
    duration: int = 1
    service_type = "BigQuery"

    def get_connection_url(self):
        if self.project_id:
            return f"{self.scheme}://{self.project_id}"
        return f"{self.scheme}://"


class BigquerySource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config: SQLConnectionConfig = BigQueryConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        if config.options.get("credentials_path"):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = config.options[
                "credentials_path"
            ]
        elif config.options.get("credentials", None):
            cred_path = create_credential_temp_file(config.options.get("credentials"))
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path
            config.options["credentials_path"] = cred_path
            del config.options["credentials"]
        return cls(config, metadata_config, ctx)

    def close(self):
        super().close()
        if self.config.options["credentials_path"]:
            os.unlink(self.config.options["credentials_path"])

    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        segments = table.split(".")
        if len(segments) != 2:
            raise ValueError(f"expected table to contain schema name already {table}")
        if segments[0] != schema:
            raise ValueError(f"schema {schema} does not match table {table}")
        return segments[0], segments[1]

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type.replace(", ", ",").replace(" ", ":").lower()


def create_credential_temp_file(credentials: dict) -> str:
    with tempfile.NamedTemporaryFile(delete=False) as fp:
        cred_json = json.dumps(credentials, indent=4, separators=(",", ": "))
        fp.write(cred_json.encode())
        return fp.name
