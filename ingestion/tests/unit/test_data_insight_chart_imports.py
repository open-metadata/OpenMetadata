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
Regression tests for the dataInsightCustomChart ⇄ lineChart/summaryCard
circular import.

`dataInsightCustomChart.json` previously owned both the `function` /
`kpiDetails` definitions and `oneOf` `$ref`s to `lineChart.json` /
`summaryCard.json`, while those two `$ref`-ed the definitions back.
Generated Pydantic v2 models tripped on the cycle with
``AttributeError: partially initialized module ... has no attribute
'Function'``.

The fix extracted the shared definitions into ``chartFunctions.json`` so
the chart modules depend only on it, never on ``dataInsightCustomChart``.
"""

import importlib
import json
import sys
from pathlib import Path

import pytest

SCHEMA_DIR = Path(__file__).resolve().parents[3] / "openmetadata-spec/src/main/resources/json/schema/dataInsight/custom"

CHART_MODULES = (
    "metadata.generated.schema.dataInsight.custom.chartFunctions",
    "metadata.generated.schema.dataInsight.custom.dataInsightCustomChart",
    "metadata.generated.schema.dataInsight.custom.lineChart",
    "metadata.generated.schema.dataInsight.custom.summaryCard",
)


def test_chart_functions_owns_shared_definitions():
    """The shared types must live in ``chartFunctions.json`` — moving them
    back into ``dataInsightCustomChart.json`` would re-close the cycle."""
    schema = json.loads((SCHEMA_DIR / "chartFunctions.json").read_text())

    assert set(schema["definitions"]) >= {"function", "kpiDetails"}


@pytest.mark.parametrize("filename", ["lineChart.json", "summaryCard.json"])
def test_chart_does_not_ref_data_insight_custom_chart(filename):
    """``lineChart`` / ``summaryCard`` must not ``$ref`` back into
    ``dataInsightCustomChart`` — that's exactly what closed the cycle."""
    body = (SCHEMA_DIR / filename).read_text()

    assert "dataInsightCustomChart" not in body, (
        f"{filename} references dataInsightCustomChart — re-introduces the "
        f"circular import the chartFunctions.json extraction was meant to break."
    )


@pytest.mark.parametrize("entry_point", CHART_MODULES)
def test_module_imports_cold(entry_point):
    """Each module must succeed as the first to import in the cycle. Purges
    ``sys.modules`` AND the parent package's cached attribute — without the
    latter, ``from . import X`` resolves to the cached child and skips the
    load that would otherwise trigger the cycle."""
    for name in CHART_MODULES:
        sys.modules.pop(name, None)
        parent_name, _, leaf = name.rpartition(".")
        parent = sys.modules.get(parent_name)
        if parent is not None and hasattr(parent, leaf):
            delattr(parent, leaf)

    assert importlib.import_module(entry_point) is not None
