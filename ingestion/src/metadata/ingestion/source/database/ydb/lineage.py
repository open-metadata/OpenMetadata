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
YDB lineage module
"""

from typing import Iterable, Optional  # noqa: UP035

from metadata.generated.schema.entity.services.connections.database.ydbConnection import (
    YDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.ydb.utils import (
    rewrite_yql_paths_to_dotted,
)
from metadata.ingestion.source.models import TableView
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class YdbLineageSource(LineageSource):
    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: YDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, YDBConnection):
            raise InvalidSourceException(
                f"Expected YDBConnection, but got {connection}"
            )
        return cls(config, metadata)

    def view_lineage_producer(self) -> Iterable[TableView]:
        # OM's lineage pipeline splits source identifiers on '.', but YDB
        # writes them as backtick-quoted paths like `staging/events`. Rewrite
        # each path to `schema`.`table` so sqlglot exposes db+name separately
        # and downstream ES search matches the canonical (schema, table) form
        # used during metadata ingestion.
        for view in super().view_lineage_producer():
            if view.view_definition:
                yield view.model_copy(
                    update={
                        "view_definition": rewrite_yql_paths_to_dotted(
                            view.view_definition
                        )
                    }
                )
            else:
                yield view
