from __future__ import annotations

import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[3]
IMPACT_MAP = REPOSITORY_ROOT / ".github/playwright/impact-map.json"
METADATA_TYPE_SOURCE = (
    "openmetadata-service/src/main/java/org/openmetadata/service/resources/**"
)
CUSTOM_PROPERTIES_SPECS = {
    "playwright/e2e/Pages/CustomProperties.spec.ts",
    "playwright/e2e/Pages/CustomPropertiesApiContract.spec.ts",
}
TYPE_IMPLEMENTATION_SOURCES = {
    "openmetadata-service/src/main/java/org/openmetadata/service/TypeRegistry.java",
    "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TypeRepository.java",
}


def test_metadata_type_changes_select_ui_and_api_custom_property_contracts():
    impact_map = json.loads(IMPACT_MAP.read_text(encoding="utf-8"))
    metadata_type_mapping = next(
        mapping
        for mapping in impact_map["mappings"]
        if METADATA_TYPE_SOURCE in mapping["sources"]
    )

    assert CUSTOM_PROPERTIES_SPECS <= set(metadata_type_mapping["specs"])


def test_type_implementation_changes_select_custom_property_contracts_precisely():
    impact_map = json.loads(IMPACT_MAP.read_text(encoding="utf-8"))
    implementation_mapping = next(
        mapping
        for mapping in impact_map["mappings"]
        if TYPE_IMPLEMENTATION_SOURCES <= set(mapping["sources"])
    )

    assert set(implementation_mapping["sources"]) == TYPE_IMPLEMENTATION_SOURCES
    assert set(implementation_mapping["projects"]) == {"chromium", "Basic"}
    assert set(implementation_mapping["specs"]) == CUSTOM_PROPERTIES_SPECS
