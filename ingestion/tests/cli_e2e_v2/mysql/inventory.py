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
"""Reviewed MySQL coverage requirements and generated capability declarations."""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)

INVENTORY = ContractInventory(
    family="mysql",
    required=frozenset(
        {
            "catalog.metadata",
            "filter.table.include-one",
            "filter.schema.include-one",
            "ingest.repeat",
            "procedure.code",
            "fk.relationships",
            "profile.metrics",
            "profile.freshness.columns",
            "profile.freshness.rows",
            "sample.values.original",
            "sample.values.updated",
            "sample.values.replacement",
            "lineage.view",
            "classification.tags",
            "deletion.tables",
            "error.containment",
            "filter.table.exclude-one",
            "filter.table.regex-exclude-wins",
            "filter.table.exclude-wins",
            "filter.schema.exclude-wins",
        }
    ),
    capabilities={
        contract: MysqlConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
            "profile": "supportsProfiler",
            "lineage": "supportsLineageExtraction",
        }.items()
    },
)
