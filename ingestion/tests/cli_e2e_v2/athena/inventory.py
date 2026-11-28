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
"""Reviewed Athena v1-to-v2 observable coverage inventory; see README.md "Athena"."""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.athenaConnection import AthenaConnection

INVENTORY = ContractInventory(
    family="athena",
    required=frozenset(
        {
            "catalog.metadata",
            "schema.description",
            "partition.columns",
            "fk.relationships",
            "procedure.code",
            "ingest.repeat",
            "deletion.tables",
            "classification.tags",
            "lineage.view",
            "filter.schema.include-one",
            "filter.schema.exclude-wins",
            "filter.table.include-one",
            "filter.table.exclude-one",
            "filter.table.regex-exclude-wins",
            "filter.table.exclude-wins",
            "profile.metrics",
            "sample.limit",
            "sample.values.native",
            "sample.values.replacement",
        }
    ),
    unsupported={
        "fk.relationships": "Athena tables over Glue declare no primary or foreign keys.",
        "procedure.code": "Athena has no stored procedures.",
    },
    capabilities={
        contract: AthenaConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
            "profile": "supportsProfiler",
            "lineage": "supportsLineageExtraction",
        }.items()
    },
)
