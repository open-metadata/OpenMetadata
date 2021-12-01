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
import sys
from datetime import datetime, timezone
from typing import Type, TypeVar

from openmetadata.common.config import ConfigModel, DynamicTypedConfig
from openmetadata.common.database import Database
from openmetadata.common.database_common import SQLConnectionConfig
from openmetadata.profiler.profiler import Profiler
from openmetadata.profiler.profiler_metadata import ProfileResult

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
            "openmetadata.databases.{}.{}".format(
                type_class_fetch(database_type, True),
                type_class_fetch(database_type, False),
            )
        )
        self.profiler_config = self.config.profiler.dict().get("config", {})
        self.database: Database = database_class.create(
            self.profiler_config.get("sql_connection", {})
        )
        self.table_name = self.profiler_config.get("table_name")
        self.variables: dict = {}
        self.time = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")

    @classmethod
    def create(cls, config_dict: dict) -> "ProfilerRunner":
        config = ProfilerConfig.parse_obj(config_dict)
        return cls(config)

    def execute(self):
        try:
            profiler = Profiler(
                database=self.database,
                table_name=self.table_name,
                profile_time=self.time,
            )
            profile_result: ProfileResult = profiler.execute()
            return profile_result
        except Exception as e:
            logger.exception(f"Profiler failed: {str(e)}")
            logger.info(f"Exiting with code 1")
            sys.exit(1)
