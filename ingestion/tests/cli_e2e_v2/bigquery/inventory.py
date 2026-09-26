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
"""Reviewed BigQuery coverage requirements and generated capability declarations.

Every behaviour asserted by the v1 `test_cli_bigquery.py` and
`test_cli_bigquery_multiple_project.py` maps to at least one ID here; see
README.md "BigQuery" for the v1 → v2 mapping.
"""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)

INVENTORY = ContractInventory(
    family="bigquery",
    required=frozenset(
        {
            "catalog.metadata",
            "catalog.multi-project",
            "procedure.code",
            "fk.relationships",
            "lineage.view",
            "classification.tags",
            "deletion.tables",
            "ingest.repeat",
            "filter.table.include-one",
            "filter.table.exclude-one",
            "filter.table.regex-exclude-wins",
            "filter.table.exclude-wins",
            "filter.schema.include-one",
            "filter.schema.exclude-wins",
            "filter.database.include-one",
            "profile.metrics",
            "profile.system",
            "profile.partition.default",
            "sample.limit",
            "sample.values.native",
            "sample.values.replacement",
            "dq.table-diff",
        }
    ),
    capabilities={
        contract: BigQueryConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
            "profile": "supportsProfiler",
            "lineage": "supportsLineageExtraction",
            "dq": "supportsDataDiff",
        }.items()
    },
)
