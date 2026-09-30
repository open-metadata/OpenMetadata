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
"""Pure Oracle fixture-specific persisted-state checks."""

from ..features.database.entities import procedure_has_code


def procedures_have_bodies(snapshot):
    """Both procedure bodies are ingested intact.

    OM stores Oracle procedure names uppercase; the bodies keep the source's own
    casing, so the fragments below stay lowercase where the DDL wrote them.
    """
    for name, fragments in (
        ("SP_ACTIVE_CUSTOMER_COUNT", ("SELECT COUNT(*)",)),
        ("SP_UPDATE_CUSTOMER_STATUS", ("p_customer_id", "UPDATE")),
    ):
        procedure = next((item for item in snapshot.procedures if item.name.root == name), None)
        for fragment in fragments:
            procedure_has_code(fragment)(procedure)
