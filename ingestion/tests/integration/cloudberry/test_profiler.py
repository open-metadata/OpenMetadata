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

from copy import deepcopy
from uuid import uuid4

import pytest

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


@pytest.fixture(scope="module")
def create_service_request(cloudberry_connection):
    return CreateDatabaseServiceRequest(
        name=f"cloudberry_profiler_{uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Cloudberry,
        connection=cloudberry_connection,
    )


def test_profiler_publishes_cloudberry_table_and_column_metrics(
    db_service, ingestion_config, metadata, profiler_config, run_workflow
):
    assert db_service.connection.config.model_dump()["supportsProfiler"] is True

    ingestion = deepcopy(ingestion_config)
    ingestion["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {"includes": ["^base$"]}
    run_workflow(MetadataWorkflow, ingestion)

    config = deepcopy(profiler_config)
    config["source"]["serviceConnection"] = ingestion["source"]["serviceConnection"]
    config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {"includes": ["^base$"]}
    run_workflow(ProfilerWorkflow, config)

    table = metadata.get_latest_table_profile(f"{db_service.name.root}.om_cloudberry.warehouse.base")
    assert table is not None and table.profile is not None
    assert table.profile.rowCount == 3
    amount = next(column.profile for column in table.columns if column.name.root == "amount")
    assert amount.nullCount == 1
    assert amount.mean == 15
