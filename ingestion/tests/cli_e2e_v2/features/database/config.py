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
"""Build complete database workflow invocations from generated pipeline options."""

from copy import deepcopy
from typing import Any

from ...runtime.cli import WorkflowInvocation
from ...server import ServerConfig
from .pipelines import PipelineOptions, pipeline_spec


def database_invocation(
    *,
    source_type: str,
    service_name: str,
    service_connection: dict[str, Any],
    server: ServerConfig,
    options: PipelineOptions,
) -> WorkflowInvocation:
    spec = pipeline_spec(options)
    config = {
        "source": {
            "type": source_type + spec.source_type_suffix,
            "serviceName": service_name,
            "serviceConnection": {"config": deepcopy(service_connection)},
            "sourceConfig": {"config": options.model_dump(mode="json", exclude_none=True)},
        },
        "sink": server.to_sink_config_dict(),
        "workflowConfig": server.to_workflow_config_dict(),
    }
    if spec.processor is not None:
        config["processor"] = {"type": spec.processor, "config": {}}
    return WorkflowInvocation(spec.cli_subcommand, config)
