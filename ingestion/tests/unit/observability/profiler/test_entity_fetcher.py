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
Validate entity fetcher filtering strategies
"""
import uuid

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.api.status import Status
from metadata.profiler.source.fetcher.fetcher_strategy import DatabaseFetcherStrategy

VIEW = Table(
    id=uuid.uuid4(),
    name="view",
    columns=[],
    tableType=TableType.View,
)

TABLE = Table(
    id=uuid.uuid4(),
    name="table",
    columns=[],
    tableType=TableType.Regular,
)


def get_db_fetcher(source_config):
    """Fetch database"""
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type="mysql",
            serviceName="mysql",
            sourceConfig=SourceConfig(
                config=source_config,
            ),
        ),
        workflowConfig=WorkflowConfig(
            openMetadataServerConfig=OpenMetadataConnection(
                hostPort="localhost:8585/api",
            )
        ),
    )
    return DatabaseFetcherStrategy(
        config=workflow_config,
        metadata=...,
        global_profiler_config=...,
        status=Status(),
    )


def test_include_views():
    """Validate we can include/exclude views"""
    config = DatabaseServiceAutoClassificationPipeline(
        includeViews=False,
    )
    fetcher = get_db_fetcher(config)

    assert fetcher._filter_views(VIEW)
    assert not fetcher._filter_views(TABLE)

    config = DatabaseServiceAutoClassificationPipeline(
        includeViews=True,
    )
    fetcher = get_db_fetcher(config)

    assert not fetcher._filter_views(VIEW)
    assert not fetcher._filter_views(TABLE)
