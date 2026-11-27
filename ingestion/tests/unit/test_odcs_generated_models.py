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

"""Import and schema-build checks for every supported ODCS export model."""

from importlib import import_module

import pytest


@pytest.mark.parametrize("version", ["v221", "v222", "v300", "v301", "v302", "v310"])
def test_odcs_contract_model_imports_and_builds(version: str):
    module = import_module(f"metadata.generated.schema.type.datacontract.odcs.{version}.odcsContract")

    assert module.OdcsContract.model_rebuild(force=True)
