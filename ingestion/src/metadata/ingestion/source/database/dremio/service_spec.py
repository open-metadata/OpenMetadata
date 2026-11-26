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
from metadata.ingestion.source.database.dremio.connection import DremioConnection
from metadata.ingestion.source.database.dremio.lineage import DremioLineageSource
from metadata.ingestion.source.database.dremio.metadata import DremioSource
from metadata.ingestion.source.database.dremio.usage import DremioUsageSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=DremioSource,  # pyright: ignore[reportArgumentType]
    lineage_source_class=DremioLineageSource,  # pyright: ignore[reportArgumentType]
    usage_source_class=DremioUsageSource,  # pyright: ignore[reportArgumentType]
    connection_class=DremioConnection,  # pyright: ignore[reportArgumentType]
)
