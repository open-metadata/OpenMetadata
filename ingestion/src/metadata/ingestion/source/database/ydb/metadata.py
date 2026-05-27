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
YDB source implementation
"""

import traceback
from typing import Iterable, List, Optional, Tuple  # noqa: UP035

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.ydbConnection import (
    YDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.ydb.utils import (
    full_name,
    schema_of,
    table_of,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class YdbSource(CommonDbSourceService):
    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, YDBConnection):
            raise InvalidSourceException(f"Expected YDBConnection, but got {connection}")
        return cls(config, metadata)

    @property
    def _all_table_names(self) -> list[str]:
        if not hasattr(self, "_table_names_cache"):
            self._table_names_cache = self.inspector.get_table_names(schema=None) or []
        return self._table_names_cache

    @property
    def _all_view_names(self) -> list[str]:
        if not hasattr(self, "_view_names_cache"):
            self._view_names_cache = self.inspector.get_view_names(schema=None) or []
        return self._view_names_cache

    def get_raw_database_schema_names(self) -> Iterable[str]:
        seen = set()
        for name in self._all_table_names + self._all_view_names:
            schema = schema_of(name)
            if schema not in seen:
                seen.add(schema)
                yield schema

    def query_table_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        return [
            TableNameAndType(name=table_of(full)) for full in self._all_table_names if schema_of(full) == schema_name
        ]

    def query_view_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        return [
            TableNameAndType(name=table_of(full), type_=TableType.View)
            for full in self._all_view_names
            if schema_of(full) == schema_name
        ]

    @staticmethod
    def get_table_description(schema_name: str, table_name: str, inspector: Inspector) -> str:
        return None

    def _get_columns_with_constraints(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> Tuple[List, List, List]:  # noqa: UP006
        return super()._get_columns_with_constraints(None, full_name(schema_name, table_name), inspector)

    def _get_columns_internal(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ):
        return inspector.get_columns(
            full_name(schema_name, table_name),
            None,
            table_type=table_type,
            db_name=db_name,
        )

    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        view_types = (
            TableType.View,
            TableType.MaterializedView,
            TableType.SecureView,
        )
        if table_type not in view_types:
            return None
        try:
            return inspector.get_view_definition(full_name(schema_name, table_name), schema=None)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch view definition for {table_name}: {exc}")
        return None
