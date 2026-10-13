#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Generated pipeline configuration and independent invocation overlays."""

import pytest

from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.ingestion.ometa.utils import model_str

from ..features.database.config import database_invocation
from ..features.database.pipelines import (
    AutoClassificationPipeline,
    LineagePipeline,
    MetadataPipeline,
    ProfilerPipeline,
)
from ..features.database.pipelines import TestPipeline as DataQualityPipeline
from ..server import ServerConfig


@pytest.fixture
def server(monkeypatch):
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:9/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "placeholder")
    return ServerConfig("http://127.0.0.1:9/api", "placeholder", "env")


@pytest.mark.parametrize(
    "options,command,source,processor",
    [
        (
            MetadataPipeline(includeTables=True, tableFilterPattern={"includes": ["^customers$"]}),
            "ingest",
            "custom-mysql",
            None,
        ),
        (ProfilerPipeline(), "profile", "custom-mysql", "orm-profiler"),
        (LineagePipeline(), "ingest", "custom-mysql-lineage", None),
        (DataQualityPipeline(type="TestSuite"), "test", "custom-mysql", None),
        (AutoClassificationPipeline(enableAutoClassification=True), "classify", "custom-mysql", "tag-pii-processor"),
    ],
)
def test_complete_generated_workflow_configs(server, options, command, source, processor):
    invocation = database_invocation(
        source_type="custom-mysql",
        service_name="owned",
        server=server,
        service_connection={"type": "Mysql", "username": "reader", "hostPort": "localhost:3306"},
        options=options,
    )
    assert invocation.subcommand == command
    assert invocation.config["source"]["type"] == source
    parsed = OpenMetadataWorkflowConfig.model_validate(invocation.config)
    assert parsed.source.serviceName == "owned"
    assert parsed.source.serviceConnection.root.config.username == "reader"
    assert parsed.sink.type == "metadata-rest"
    assert parsed.sink.config.root["bulk_sink_batch_size"] == 1
    assert model_str(parsed.workflowConfig.openMetadataServerConfig.hostPort) == "${OM_SERVER_URL}"
    assert invocation.config["source"]["sourceConfig"]["config"] == options.model_dump(mode="json", exclude_none=True)
    assert (parsed.processor.type if parsed.processor else None) == processor


def test_sibling_invocations_do_not_share_nested_connection_or_filters(server):
    connection = {"type": "Mysql", "connectionOptions": {"connect_timeout": 7}}
    options = MetadataPipeline(tableFilterPattern={"includes": ["^customers$"]})
    arguments = {
        "source_type": "mysql",
        "service_name": "owned",
        "service_connection": connection,
        "server": server,
        "options": options,
    }
    left, right = database_invocation(**arguments), database_invocation(**arguments)
    left.config["source"]["serviceConnection"]["config"]["connectionOptions"]["connect_timeout"] = 2
    left.config["source"]["sourceConfig"]["config"]["tableFilterPattern"]["includes"].append(".*")
    assert right.config["source"]["serviceConnection"]["config"]["connectionOptions"] == {"connect_timeout": 7}
    assert right.config["source"]["sourceConfig"]["config"]["tableFilterPattern"]["includes"] == ["^customers$"]
    assert connection["connectionOptions"] == {"connect_timeout": 7}
    assert options.tableFilterPattern.includes == ["^customers$"]


def test_database_factory_rejects_unsupported_usage_pipeline(server):
    with pytest.raises(ValueError, match="Unsupported database pipeline: DatabaseServiceQueryUsagePipeline"):
        database_invocation(
            source_type="mysql",
            service_name="owned",
            server=server,
            service_connection={"type": "Mysql", "username": "reader", "hostPort": "localhost:3306"},
            options=DatabaseServiceQueryUsagePipeline(),
        )
