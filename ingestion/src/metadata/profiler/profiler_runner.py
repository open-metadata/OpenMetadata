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

import importlib
import logging
import traceback
from datetime import datetime, timezone
from typing import Type, TypeVar

from metadata.config.common import ConfigModel, DynamicTypedConfig
from metadata.ingestion.source.sql_source_common import SQLSourceStatus
from metadata.profiler.common.database import Database
from metadata.profiler.profiler import Profiler
from metadata.profiler.profiler_metadata import ProfileResult

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ProfilerConfig(ConfigModel):
    profiler: DynamicTypedConfig


def type_class_fetch(clazz_type: str, is_file: bool):
    if is_file:
        return clazz_type.replace("-", "_")
    else:
        return "".join([i.title() for i in clazz_type.replace("-", "_").split("_")])


def get_clazz(key: str) -> Type[T]:
    if key.find(".") >= 0:
        # If the key contains a dot, we treat it as a import path and attempt
        # to load it dynamically.
        module_name, class_name = key.rsplit(".", 1)
        clazz = getattr(importlib.import_module(module_name), class_name)
        return clazz


class ProfilerRunner:
    config: ProfilerConfig
    database: Database

    def __init__(self, config: ProfilerConfig):
        self.config = config
        database_type = self.config.profiler.type
        database_class = get_clazz(
            "metadata.profiler.databases.{}.{}".format(
                type_class_fetch(database_type, True),
                type_class_fetch(database_type, False),
            )
        )
        self.database: Database = database_class.create(self.config.profiler.config)
        self.sql_config = self.database.config
        self.status = SQLSourceStatus()
        self.variables: dict = {}
        self.time = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")

    @classmethod
    def create(cls, config_dict: dict) -> "ProfilerRunner":
        config = ProfilerConfig.parse_obj(config_dict)
        return cls(config)

    def run_profiler(self):
        schema_names = self.database.inspector.get_schema_names()
        results = []
        for schema in schema_names:
            if not self.sql_config.schema_filter_pattern.included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            tables = self.database.inspector.get_table_names(schema)

            for table_name in tables:
                try:
                    if not self.sql_config.table_filter_pattern.included(table_name):
                        self.status.filter(
                            f"{self.sql_config.get_service_name()}.{table_name}",
                            "Table pattern not allowed",
                        )
                        continue
                    logger.info(f"profiling {schema}.{table_name}")
                    profile_result = self.execute(
                        schema,
                        table_name,
                        datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
                    )
                    results.append(profile_result)
                except Exception as err:
                    logger.debug(traceback.print_exc())
                    logger.error(err)
                    self.status.failures.append(
                        "{}.{}".format(self.sql_config.service_name, table_name)
                    )
                    continue
        return results

    def execute(self, schema: str, table_name: str, profile_date: str):
        try:
            profiler = Profiler(
                database=self.database,
                schema_name=schema,
                table_name=table_name,
                profile_time=profile_date,
            )
            profile_result: ProfileResult = profiler.execute()
            return profile_result
        except Exception as e:
            logger.exception(f"Profiler failed: {str(e)}")
            raise e
