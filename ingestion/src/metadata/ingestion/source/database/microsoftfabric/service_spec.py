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
Microsoft Fabric Database Service Spec
"""
from metadata.ingestion.source.database.microsoftfabric.lineage import (
    MicrosoftFabricLineageSource,
)
from metadata.ingestion.source.database.microsoftfabric.metadata import (
    MicrosoftFabricSource,
)
from metadata.ingestion.source.database.microsoftfabric.usage import (
    MicrosoftFabricUsageSource,
)
from metadata.sampler.sqlalchemy.mssql.sampler import MssqlSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MicrosoftFabricSource,
    lineage_source_class=MicrosoftFabricLineageSource,
    usage_source_class=MicrosoftFabricUsageSource,
    sampler_class=MssqlSampler,
)
