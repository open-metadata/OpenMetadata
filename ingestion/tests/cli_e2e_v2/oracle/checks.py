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

from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import entity_exists, procedure_has_code


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


def native_sample_rows(table):
    """Return the persisted sample rows for all_types, keyed by id.

    Asserts the shape (column set, row count, row widths) before returning, so a
    caller comparing one cell cannot pass against a truncated or reshaped sample.
    """
    entity_exists(table)
    fqn = model_str(table.fullyQualifiedName)
    assert table.sampleData is not None, f"{fqn}: sample data missing"
    names = [name.root for name in table.sampleData.columns]
    rows = table.sampleData.rows
    assert len(rows) == 3, f"{fqn}: sample row count: expected 3, got {len(rows)}"
    widths = [len(row) for row in rows]
    assert all(width == len(names) for width in widths), (
        f"{fqn}: sample row widths: expected {len(names)} each, got {widths!r}"
    )
    assert "id" in names, f"{fqn}: sample columns missing 'id': {names!r}"
    keyed = {row[names.index("id")]: dict(zip(names, row, strict=True)) for row in rows}
    assert set(keyed) == {1, 2, 3}, f"{fqn}: sample row IDs: expected {{1, 2, 3}}, got {set(keyed)!r}"
    return keyed
