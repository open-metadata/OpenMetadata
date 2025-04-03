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
"""
Hive Metastore Mysql Dialect
"""
from sqlalchemy.dialects import registry

from .dialect import HiveMysqlMetaStoreDialect

__version__ = "0.1.0"
__all__ = ["HiveMysqlMetaStoreDialect"]
registry.register(
    "hive.mysql",
    "metadata.ingestion.source.database.hive.metastore_dialects.mysql.dialect",
    "HiveMysqlMetaStoreDialect",
)
