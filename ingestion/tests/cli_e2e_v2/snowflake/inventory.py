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
"""Reviewed Snowflake coverage requirements and generated capability declarations.

Every behaviour asserted by the v1 `test_cli_snowflake.py` maps to at least one ID
here, see README.md "Snowflake" for the v1 to v2 mapping.
"""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)

INVENTORY = ContractInventory(
    family="snowflake",
    required=frozenset(
        {
            "catalog.metadata",
            "procedure.code",
            "fk.relationships",
            "lineage.view",
            "classification.tags",
            "tags.source",
            "deletion.tables",
            "ingest.repeat",
            "filter.table.include-one",
            "filter.table.exclude-one",
            "filter.table.regex-exclude-wins",
            "filter.table.exclude-wins",
            "filter.schema.include-one",
            "filter.schema.exclude-wins",
            "table.transient.include",
            "table.transient.exclude",
            "table.dynamic",
            "table.stream",
            "partition.cluster-key",
            "profile.metrics",
            "profile.system",
            "profile.partition.time-unit",
            "sample.limit",
            "sample.values.native",
            "sample.values.replacement",
            "dq.table-diff",
        }
    ),
    capabilities={
        contract: SnowflakeConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
            "profile": "supportsProfiler",
            "lineage": "supportsLineageExtraction",
            "dq": "supportsDataDiff",
        }.items()
    },
)
