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
"""Reviewed Oracle coverage requirements and generated capability declarations."""

from ingestion.tests.cli_e2e_v2.contracts.inventory import ContractInventory
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
)

INVENTORY = ContractInventory(
    family="oracle",
    required=frozenset(
        {
            "catalog.metadata",
            "filter.schema.include-one",
            "filter.table.include-one",
            "filter.table.exclude-one",
            "ingest.repeat",
            "procedure.code",
            "fk.relationships",
            "deletion.tables",
            "error.containment",
        }
    ),
    unsupported={
        # The reference induction — invalidate a view by dropping a column it selects —
        # does not fail on Oracle. Verified live against oracle-free 23: both a dropped
        # column and a dropped base table leave the view reflecting its columns and its
        # definition from the data dictionary, so ingestion reports 100% success with
        # zero errors. Finding an Oracle induction that fails exactly one record needs
        # its own investigation; this is a declared gap, not a skipped test.
        "error.containment": (
            "Oracle retains dictionary metadata for invalid views, so the reference "
            "broken-view induction produces no ingestion error; needs an Oracle-specific "
            "induction, tracked separately."
        ),
    },
    # Only capabilities this slice actually declares contracts for. OracleConnection
    # also defaults supportsProfiler and supportsLineageExtraction to true, but listing
    # them here while `required` carries no profile.*/lineage.* contract would be inert
    # (capabilities only gate `unsupported`) and would read as a coverage claim. They
    # belong here alongside their contracts, in the next slice.
    capabilities={
        contract: OracleConnection.model_fields[flag].get_default(call_default_factory=True)
        for contract, flag in {
            "catalog": "supportsMetadataExtraction",
        }.items()
    },
)
