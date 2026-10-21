#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
A Domo dataset name is a free-text label an ordinary Domo user types in the UI,
so it is untrusted. The query endpoint addresses the dataset by `dataset_id` in
the request URL -- pydomo's own example is `SELECT * FROM table LIMIT 2` -- so the
name must not reach the SQL at all.
"""

import pytest

from metadata.ingestion.source.database.domodatabase.metadata import DomodatabaseSource
from metadata.ingestion.source.database.domodatabase.models import OutputDataset, Owner

# A single SELECT, so Domo's read-only restriction does not block it.
HOSTILE_NAME = 'sales" UNION SELECT * FROM "secrets'
EXPECTED_QUERY = "SELECT * FROM table LIMIT 1"


class _FakeDatasets:
    def __init__(self, emitted):
        self.emitted = emitted

    def query(self, dataset_id, sql):
        self.emitted.append((dataset_id, sql))
        return


class _FakeDomoClient:
    def __init__(self, emitted):
        self.datasets = _FakeDatasets(emitted)


@pytest.fixture(name="source")
def source_fixture():
    emitted = []
    source = DomodatabaseSource.__new__(DomodatabaseSource)
    source.domo_client = _FakeDomoClient(emitted)
    source.emitted = emitted
    return source


@pytest.mark.parametrize("name", [HOSTILE_NAME, "orders", 'quote"inside', "o'brien"])
def test_the_dataset_name_never_reaches_the_query(source, name):
    source.get_columns_from_federated_dataset(table_name=name, dataset_id="abc-123")

    assert source.emitted == [("abc-123", EXPECTED_QUERY)]


def test_the_dataset_is_addressed_by_id_not_by_name(source):
    """The id in the URL is what selects the dataset, so the name is redundant."""
    source.get_columns_from_federated_dataset(table_name="orders", dataset_id="dataset-42")

    dataset_id, sql = source.emitted[0]
    assert dataset_id == "dataset-42"
    assert "orders" not in sql


def _dataset() -> OutputDataset:
    return OutputDataset(id="abc-123", name="orders", rows=0, columns=0, owner=Owner(id=1, name="owner"))


def test_get_columns_survives_a_dataset_with_no_resolvable_schema(source):
    """`get_columns` overwrites `schemas` with the probe's result, and the probe
    returns None whenever Domo rejects the query."""
    assert source.get_columns(_dataset()) == []


def test_federated_columns_are_parsed_from_the_response(source):
    """Pins the branch the fix made reachable: names come from `columns`, types
    from the matching index of `metadata`."""
    source.domo_client.datasets.query = lambda dataset_id, sql: {
        "columns": ["id", "total"],
        "metadata": [{"type": "LONG"}, {"type": "DOUBLE"}],
    }

    schema = source.get_columns_from_federated_dataset(table_name="orders", dataset_id="abc-123")

    assert [(column.name, column.type) for column in schema.columns] == [("id", "LONG"), ("total", "DOUBLE")]
