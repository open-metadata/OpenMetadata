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
import logging
import os
from typing import Iterable, Optional

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import dsa, rsa
from snowflake.sqlalchemy.custom_types import VARIANT
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names
from sqlalchemy.engine import reflection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect
from sqlalchemy.sql import text

from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.engines import get_engine

GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["VARIANT"] = VARIANT
ischema_names["GEOGRAPHY"] = GEOGRAPHY

logger: logging.Logger = logging.getLogger(__name__)

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)


class SnowflakeConfig(SnowflakeConnection, SQLConnectionConfig):
    result_limit: int = 1000
    duration: Optional[int]

    def get_connection_url(self):
        connect_string = super().get_connection_url()
        options = {
            "account": self.account,
            "warehouse": self.warehouse,
            "role": self.role,
        }
        params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
        if params:
            connect_string = f"{connect_string}{params}"
        return connect_string


class SnowflakeSource(SQLSource):
    def __init__(self, config, metadata_config):
        if config.connect_args.get("private_key"):
            private_key = config.connect_args["private_key"]
            p_key = serialization.load_pem_private_key(
                bytes(private_key, "utf-8"),
                password=os.environ["SNOWFLAKE_PRIVATE_KEY_PASSPHRASE"].encode(),
                backend=default_backend(),
            )
            pkb = p_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            config.connect_args["private_key"] = pkb
        super().__init__(config, metadata_config)

    def get_databases(self) -> Iterable[Inspector]:
        if self.config.database != None:
            yield from super().get_databases()
        else:
            query = "SHOW DATABASES"
            results = self.connection.execute(query)
            for res in results:

                row = list(res)
                use_db_query = f"USE DATABASE {row[1]}"
                self.connection.execute(use_db_query)
                logger.info(f"Ingesting from database: {row[1]}")
                self.config.database = row[1]
                self.engine = get_engine(self.config)
                yield inspect(self.engine)

    def get_table_fqn(self, service_name, schema, table_name) -> str:
        return f"{service_name}{FQDN_SEPARATOR}{self.config.database}{FQDN_SEPARATOR}{schema}{FQDN_SEPARATOR}{table_name}"

    def _get_database(self, schema: str) -> Database:
        return Database(
            name=self.config.database + "_" + schema,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        resp_sample_data = super().fetch_sample_data(schema, table)
        if not resp_sample_data:
            try:
                logger.info("Using Table Name with quotes to fetch the data")
                query = self.config.query.format(schema, f'"{table}"')
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

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config = SnowflakeConfig.parse_obj(config_dict)
        return cls(config, metadata_config)


@reflection.cache
def _get_table_comment(self, connection, table_name, schema=None, **kw):
    """
    Returns comment of table.
    """
    sql_command = "select * FROM information_schema.tables WHERE TABLE_SCHEMA ILIKE '{}' and TABLE_NAME ILIKE '{}'".format(
        self.normalize_name(schema),
        table_name,
    )

    cursor = connection.execute(text(sql_command))
    return cursor.fetchone()  # pylint: disable=protected-access


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    return []


SnowflakeDialect._get_table_comment = _get_table_comment
SnowflakeDialect.get_unique_constraints = get_unique_constraints
