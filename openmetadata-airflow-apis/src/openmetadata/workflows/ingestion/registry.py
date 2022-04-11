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
"""
DAG builder registry.

Add a function for each type from PipelineType
"""

from collections import namedtuple

from openmetadata.workflows.ingestion.metadata import build_metadata_dag
from openmetadata.workflows.ingestion.usage import build_usage_dag

from metadata.generated.schema.operations.pipelines.airflowPipeline import PipelineType


def register():
    """
    Helps us register custom functions for rendering
    """
    registry = dict()

    def add(name: str = None):
        def inner(fn):
            _name = fn.__name__ if not name else name
            registry[_name] = fn
            return fn

        return inner

    Register = namedtuple("Register", ["add", "registry"])
    return Register(add, registry)


build_registry = register()

build_registry.add(PipelineType.metadata.value)(build_metadata_dag)
build_registry.add(PipelineType.queryUsage.value)(build_usage_dag)
