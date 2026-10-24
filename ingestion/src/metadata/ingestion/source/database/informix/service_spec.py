#  Copyright 2026 OpenMetadata
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
from metadata.ingestion.source.database.informix.connection import InformixConnection
from metadata.ingestion.source.database.informix.metadata import InformixSource
from metadata.profiler.interface.sqlalchemy.informix.profiler_interface import (
    InformixProfilerInterface,
)
from metadata.sampler.sqlalchemy.informix.sampler import InformixSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=get_class_path(InformixSource),
    connection_class=get_class_path(InformixConnection),
    profiler_class=get_class_path(InformixProfilerInterface),
    sampler_class=get_class_path(InformixSampler),
)
