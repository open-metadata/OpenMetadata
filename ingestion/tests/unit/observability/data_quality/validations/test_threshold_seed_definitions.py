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
Keep the threshold enums the validators read in sync with the seeded test definitions.

The allowed values live in the `optionValues` of the seeded test definitions, which is what the UI
offers. The validators read them through hand-written enums, so a value added on one side only is
either offered and silently read as the default, or read but never offered.
"""

import json
from pathlib import Path

import pytest

from metadata.data_quality.validations.thresholds import (
    DIMENSION_FAILURE_POLICY_PARAM,
    THRESHOLD_UNIT_PARAM,
    DimensionFailurePolicy,
    ThresholdUnit,
)

SEED_DIR = Path(__file__).resolve().parents[6] / "openmetadata-service/src/main/resources/json/data/tests"


def declared_option_values(param_name):
    """`{definition name: optionValues}` for every seeded definition declaring `param_name`"""
    declared = {}
    for seed in sorted(SEED_DIR.glob("*.json")):
        definition = json.loads(seed.read_text(encoding="utf-8"))
        for param in definition.get("parameterDefinition") or []:
            if param["name"] == param_name:
                declared[definition["name"]] = param.get("optionValues")
    return declared


@pytest.mark.parametrize(
    "param_name,enum",
    [
        (THRESHOLD_UNIT_PARAM, ThresholdUnit),
        (DIMENSION_FAILURE_POLICY_PARAM, DimensionFailurePolicy),
    ],
)
def test_enum_matches_the_seeded_option_values(param_name, enum):
    declared = declared_option_values(param_name)

    assert declared, f"No seeded test definition declares {param_name} under {SEED_DIR}"
    expected = [member.value for member in enum]
    mismatched = {name: values for name, values in declared.items() if values != expected}
    assert not mismatched, f"{param_name} optionValues differ from {enum.__name__} {expected}: {mismatched}"
