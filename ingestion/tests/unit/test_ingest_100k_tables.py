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
"""CLI validation and generated table shapes for the indexing benchmark."""

import argparse
import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "ingest_100k_tables.py"


@pytest.fixture
def benchmark():
    spec = importlib.util.spec_from_file_location("ingest_100k_tables", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("validator", ["positive_int", "non_negative_int"])
@pytest.mark.parametrize("value", ["abc", "1.5", ""])
def test_invalid_integer_has_a_consistent_validation_error(benchmark, validator, value):
    with pytest.raises(argparse.ArgumentTypeError, match="must be an integer"):
        getattr(benchmark, validator)(value)


@pytest.mark.parametrize(
    "validator,value,expected",
    [("positive_int", "1", 1), ("non_negative_int", "0", 0), ("non_negative_int", "3", 3)],
)
def test_valid_integer_bounds(benchmark, validator, value, expected):
    assert getattr(benchmark, validator)(value) == expected


@pytest.mark.parametrize(
    "validator,value",
    [("positive_int", "0"), ("positive_int", "-1"), ("non_negative_int", "-1")],
)
def test_out_of_range_integers_are_rejected(benchmark, validator, value):
    with pytest.raises(argparse.ArgumentTypeError, match="must be greater than"):
        getattr(benchmark, validator)(value)


@pytest.mark.parametrize("option", ["--tables", "--wide-every"])
def test_invalid_cli_integer_exits_cleanly(option):
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--token", "unused-test-token", option, "abc"],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 2
    assert f"argument {option}: must be an integer" in result.stderr
    assert "Traceback" not in result.stderr


@pytest.mark.parametrize("wide_every,wide_indices", [(0, []), (1, list(range(8))), (3, [2, 5])])
def test_wide_table_positions_are_one_based_across_batches(benchmark, wide_every, wide_indices):
    requests = []

    class MetadataSink:
        def create_or_update(self, request):
            requests.append(request)

    metadata = MetadataSink()
    columns = benchmark.build_columns(2)
    wide_columns = benchmark.build_columns(10)
    for start_idx, count in [(0, 4), (4, 4)]:
        assert (
            benchmark.create_tables_batch(
                metadata, "service.database.schema", start_idx, count, columns, wide_columns, wide_every
            )
            == count
        )

    assert [request.name.root for request in requests] == [f"test_table_{index:06d}" for index in range(8)]
    assert [index for index, request in enumerate(requests) if len(request.columns) == 10] == wide_indices
