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
"""A routine left out of a later run must end up deleted, and only that one.

That takes both halves: the filter has to drop it, and every routine that is
ingested has to be registered as seen. The server treats an empty seen-set as
"delete nothing", so without registration the routine silently survives.
"""

from copy import deepcopy

import pytest

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def routine(patch_passwords_for_db_services, run_workflow, ingestion_config, metadata, db_service):
    run_workflow(MetadataWorkflow, ingestion_config)

    # A class-level set every source shares, so a second run in the same process would
    # inherit add_two as "seen". Each Airflow run is its own process and starts empty.
    DatabaseServiceSource.stored_procedure_source_state.clear()
    filtered = deepcopy(ingestion_config)
    filtered["source"]["sourceConfig"]["config"]["storedProcedureFilterPattern"] = {"excludes": ["^add_two$"]}
    run_workflow(MetadataWorkflow, filtered)

    def _get(name: str) -> StoredProcedure | None:
        fqn = f"{db_service.fullyQualifiedName.root}.itest.informix.{name}"
        return metadata.get_by_name(entity=StoredProcedure, fqn=fqn, include="all")

    return _get


class TestStoredProcedureFilter:
    def test_an_excluded_routine_is_marked_deleted(self, routine):
        procedure = routine("add_two")
        assert procedure is not None, "add_two was never ingested by the first run"
        assert procedure.deleted

    def test_the_other_routines_are_left_alone(self, routine):
        procedure = routine("triple")
        assert procedure is not None
        assert not procedure.deleted
