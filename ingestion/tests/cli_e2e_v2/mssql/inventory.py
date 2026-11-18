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
"""Reviewed MSSQL v1-to-v2 observable coverage inventory."""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import MssqlConnection

INVENTORY = ContractInventory(
    family="mssql",
    required=frozenset(
        {
            "catalog.metadata",
            "procedure.code",
            "fk.relationships",
            "ingest.repeat",
            "deletion.tables",
            "classification.tags",
            "lineage.view",
            "filter.schema.include-one",
            "filter.schema.exclude-wins",
            "filter.table.include-one",
            "filter.table.exclude-one",
            "filter.table.mix",
            "filter.table.regex-exclude-wins",
            "filter.table.exclude-wins",
            "profile.metrics",
            "profile.partition.time-unit",
            "sample.limit",
            "sample.values.original",
            "sample.values.updated",
            "sample.values.replacement",
            "error.containment",
        }
    ),
    unsupported={
        # Verified live against SQL Server 2022 CU27: dropping a column a
        # non-schemabound view selects leaves the view's metadata stale rather than
        # invalid, so `get_view_names` still lists it and `get_columns` still returns
        # the dropped column from sys.columns. Ingestion reports 100% success with
        # zero errors, exactly as Oracle does. Finding an MSSQL induction that fails
        # one record and no other needs its own investigation; this is a declared
        # gap, not a skipped test.
        "error.containment": (
            "SQL Server keeps a non-schemabound view's column metadata after the base "
            "column is dropped, so the reference broken-view induction produces no "
            "ingestion error; needs an MSSQL-specific induction, tracked separately."
        ),
    },
    # Each capability listed here has contracts above that exercise it.
    capabilities={
        contract: MssqlConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
            "profile": "supportsProfiler",
            "lineage": "supportsLineageExtraction",
        }.items()
    },
)
