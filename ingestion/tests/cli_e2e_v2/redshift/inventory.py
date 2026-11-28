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
"""Reviewed Redshift v1-to-v2 observable coverage inventory.

Every behaviour asserted by the v1 `test_cli_redshift.py` maps to at least one ID
here, see README.md "Redshift" for the v1 to v2 mapping.
"""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import RedshiftConnection

INVENTORY = ContractInventory(
    family="redshift",
    required=frozenset(
        {
            "catalog.metadata",
            "procedure.code",
            "fk.relationships",
            "table.dist-sort-keys",
            "view.late-binding",
            "ingest.repeat",
            "deletion.tables",
            "classification.tags",
            "lineage.view",
            "error.containment",
            "filter.schema.include-one",
            "filter.schema.exclude-wins",
            "filter.table.include-one",
            "filter.table.exclude-one",
            "filter.table.mix",
            "filter.table.regex-exclude-wins",
            "filter.table.exclude-wins",
            "profile.metrics",
            "profile.system",
            "profile.partition.time-unit",
            "sample.limit",
            "sample.values.original",
            "sample.values.updated",
            "sample.values.replacement",
        }
    ),
    unsupported={
        # Verified live: a plain view cannot outlive the objects it reads (Redshift refuses
        # the DROP without CASCADE), and a late-binding view that does outlive its table is
        # reflected with zero columns. `get_redshift_columns` logs that miss and returns no
        # columns on purpose, for users without USAGE on the schema, so the reference
        # induction records no failure. Making it a recorded failure is a product decision
        # beyond this migration; this is a declared gap, not a skipped test.
        "error.containment": (
            "Redshift blocks dropping a plain view's dependencies, and a late-binding view "
            "over a dropped table is ingested with zero columns by design, so no Redshift "
            "induction fails exactly one record."
        ),
    },
    capabilities={
        contract: RedshiftConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
            "profile": "supportsProfiler",
            "lineage": "supportsLineageExtraction",
        }.items()
    },
)
