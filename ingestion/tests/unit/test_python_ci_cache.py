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

"""Exercise CI cache repair through the normal ingestion unit-test entry point."""

import importlib.util
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "ci_cache_regression",
    Path(__file__).resolve().parents[3] / ".github/scripts/test_setup_openmetadata_test_environment.py",
)
REGRESSION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REGRESSION)


@pytest.mark.parametrize("profile", ["test", "api"])
def test_ci_sync_repairs_corrupt_cached_airflow(tmp_path: Path, profile: str) -> None:
    REGRESSION.assert_airflow_cache_repair(tmp_path, profile)
