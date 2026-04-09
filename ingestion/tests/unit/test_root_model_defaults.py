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
"""Regression coverage for RootModel defaults in generated schema models."""

import json
from importlib import import_module
from pathlib import Path

import pytest
from pydantic import ValidationError

from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

DATA_PRODUCT_PAYLOAD = {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "data_product",
    "description": "Data product used to validate RootModel defaults",
}

INVALID_ENTITY_REFERENCE_LIST_VALUES = [
    "bad",
    1,
    {"root": "bad"},
    [1],
    [{"id": "bad"}],
]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _schema_root() -> Path:
    return _repo_root() / "openmetadata-spec/src/main/resources/json/schema"


def _generated_schema_root() -> Path:
    local_generated_root = _repo_root() / "ingestion/src/metadata/generated/schema"
    if local_generated_root.exists():
        return local_generated_root

    generated_schema = import_module("metadata.generated.schema")

    return Path(generated_schema.__file__).resolve().parent


def _root_model_default_offenders() -> list[tuple[str, str, str]]:
    schema_root = _schema_root()
    generated_schema_root = _generated_schema_root()
    offenders: list[tuple[str, str, str]] = []

    for schema_file in schema_root.rglob("*.json"):
        schema = json.loads(schema_file.read_text(encoding="utf-8"))
        properties = schema.get("properties", {})

        if not isinstance(properties, dict):
            continue

        for property_name, property_definition in properties.items():
            if not isinstance(property_definition, dict):
                continue

            if property_definition.get("default") != []:
                continue

            ref = property_definition.get("$ref")
            if not isinstance(ref, str) or not ref.endswith(".json"):
                continue

            referenced_schema = (schema_file.parent / ref).resolve()
            try:
                referenced_schema_relative = referenced_schema.relative_to(
                    schema_root.resolve()
                )
            except ValueError:
                continue

            generated_model = (
                generated_schema_root / referenced_schema_relative.with_suffix(".py")
            )
            if not generated_model.exists():
                continue

            if "RootModel[" not in generated_model.read_text(encoding="utf-8"):
                continue

            offenders.append(
                (
                    str(schema_file.relative_to(schema_root)),
                    property_name,
                    str(referenced_schema_relative),
                )
            )

    return sorted(offenders)


def _serialize_without_runtime_error(
    data_product: DataProduct,
) -> tuple[dict[str, object], dict[str, object]]:
    try:
        dumped = data_product.model_dump()
        dumped_json = json.loads(data_product.model_dump_json())
    except (AttributeError, TypeError) as exc:
        pytest.fail(f"Serialization raised unexpected {type(exc).__name__}: {exc}")

    return dumped, dumped_json


def test_omitted_root_model_fields_default_to_none() -> None:
    data_product = DataProduct.model_validate(DATA_PRODUCT_PAYLOAD)

    assert data_product.consumesFrom is None
    assert data_product.providesTo is None

    dumped, dumped_json = _serialize_without_runtime_error(data_product)

    assert dumped.get("consumesFrom") is None
    assert dumped.get("providesTo") is None
    assert "consumesFrom" not in dumped_json
    assert "providesTo" not in dumped_json


def test_explicit_none_root_model_fields_serialize_without_runtime_error() -> None:
    data_product = DataProduct.model_validate(
        {
            **DATA_PRODUCT_PAYLOAD,
            "consumesFrom": None,
            "providesTo": None,
        }
    )

    assert data_product.consumesFrom is None
    assert data_product.providesTo is None

    dumped, dumped_json = _serialize_without_runtime_error(data_product)

    assert dumped.get("consumesFrom") is None
    assert dumped.get("providesTo") is None
    assert "consumesFrom" not in dumped_json
    assert "providesTo" not in dumped_json


def test_explicit_empty_lists_coerce_to_entity_reference_list() -> None:
    data_product = DataProduct.model_validate(
        {
            **DATA_PRODUCT_PAYLOAD,
            "consumesFrom": [],
            "providesTo": [],
        }
    )

    assert isinstance(data_product.consumesFrom, EntityReferenceList)
    assert isinstance(data_product.providesTo, EntityReferenceList)

    dumped, dumped_json = _serialize_without_runtime_error(data_product)

    assert dumped["consumesFrom"] == []
    assert dumped["providesTo"] == []
    assert dumped_json["consumesFrom"] == []
    assert dumped_json["providesTo"] == []


@pytest.mark.parametrize("invalid_value", INVALID_ENTITY_REFERENCE_LIST_VALUES)
def test_invalid_root_model_values_fail_with_validation_error(
    invalid_value: object,
) -> None:
    with pytest.raises(ValidationError):
        DataProduct.model_validate(
            {
                **DATA_PRODUCT_PAYLOAD,
                "consumesFrom": invalid_value,
            }
        )


def test_root_model_refs_do_not_use_plain_list_defaults() -> None:
    assert _root_model_default_offenders() == []
