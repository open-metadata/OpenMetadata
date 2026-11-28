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

from metadata.ingestion.source.database.cloudberry.connection import CloudberryConnection
from metadata.ingestion.source.database.cloudberry.lineage import CloudberryLineageSource
from metadata.ingestion.source.database.cloudberry.metadata import CloudberrySource
from metadata.profiler.interface.sqlalchemy.profiler_interface import SQAProfilerInterface
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=get_class_path(CloudberrySource),
    lineage_source_class=get_class_path(CloudberryLineageSource),
    connection_class=get_class_path(CloudberryConnection),
    profiler_class=get_class_path(SQAProfilerInterface),
    sampler_class=get_class_path(SQASampler),
)
