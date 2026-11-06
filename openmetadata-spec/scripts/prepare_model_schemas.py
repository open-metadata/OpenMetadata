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

"""Prepare the shared schema inputs for Java, Python, and TypeScript generation.

The upstream document remains the runtime validation authority. This projection exposes
composed fields to jsonschema2pojo and prevents annotation defaults becoming native data.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

SPEC_ROOT = Path(__file__).resolve().parents[1]
VENDOR = SPEC_ROOT / "src/main/resources/odcs"
SOURCE_SCHEMAS = SPEC_ROOT / "src/main/resources/json/schema"


def _reference(root: dict, reference: str) -> dict:
    if not reference.startswith("#/"):
        raise ValueError(f"ODCS model generation requires a pinned local reference: {reference}")
    result = root
    for part in reference[2:].split("/"):
        result = result[part.replace("~1", "/").replace("~0", "~")]
    return result


def _merge_schema(left: dict, right: dict, *, conditional: bool = False) -> dict:
    result = copy.deepcopy(left)
    for key, value in right.items():
        if key == "required" and conditional:
            continue
        if key == "properties":
            properties = result.setdefault(key, {})
            for name, schema in value.items():
                properties[name] = _merge_schema(properties.get(name, {}), schema)
        elif key in ("required", "enum") and key in result:
            result[key] = list(dict.fromkeys([*result[key], *value]))
        elif key == "type" and key in result and result[key] != value:
            old = result[key] if isinstance(result[key], list) else [result[key]]
            new = value if isinstance(value, list) else [value]
            result[key] = list(dict.fromkeys([*old, *new]))
        else:
            result[key] = copy.deepcopy(value)
    return result


def _compose(node: dict, root: dict, seen: frozenset[str] = frozenset()) -> dict:
    result: dict = {}
    reference = node.get("$ref")
    if reference and reference not in seen:
        result = _compose(_reference(root, reference), root, seen | {reference})
    for branch in node.get("allOf", []):
        result = _merge_schema(result, _compose(branch, root, seen))
    for keyword in ("then", "else"):
        if isinstance(node.get(keyword), dict):
            result = _merge_schema(result, _compose(node[keyword], root, seen), conditional=True)
    for keyword in ("anyOf", "oneOf"):
        for branch in node.get(keyword, []):
            composed = _compose(branch, root, seen)
            if composed.get("properties"):
                result = _merge_schema(result, composed, conditional=True)
    own = {key: value for key, value in node.items() if key not in ("$ref", "allOf", "if", "then", "else")}
    return _merge_schema(result, own)


def _project_node(node, root: dict, *, definition: bool = False):
    if isinstance(node, bool):
        return node
    if not isinstance(node, dict):
        return copy.deepcopy(node)
    if "$ref" in node and not definition:
        reference = copy.deepcopy(node)
        reference.pop("default", None)
        reference["$ref"] = reference["$ref"].replace("#/$defs/", "#/definitions/")
        if _reference(root, node["$ref"]).get("type") == "array":
            reference["default"] = None
        return reference
    composed = _compose(node, root)
    result = {}
    for key, value in composed.items():
        if key == "default":
            continue
        if key in ("properties", "patternProperties", "$defs", "definitions"):
            result["definitions" if key == "$defs" else key] = {
                name: _project_node(schema, root, definition=key in ("$defs", "definitions"))
                for name, schema in value.items()
            }
        elif key in ("items", "additionalProperties", "contains", "propertyNames"):
            result[key] = _project_node(value, root)
        elif key in ("anyOf", "oneOf"):
            result[key] = [_project_node(schema, root) for schema in value]
        elif key == "unevaluatedProperties":
            continue
        else:
            result[key] = copy.deepcopy(value)
    if result.get("properties") and composed.get("unevaluatedProperties") is False:
        result["additionalProperties"] = False
    if result.get("type") == "array":
        result["default"] = None
    if result.get("type") == "string" and result.get("format") in (
        "date",
        "date-time",
        "time",
    ):
        result["javaType"] = "java.lang.String"
    return result


def project_model(source: dict, version: str, digest: str | None = None) -> dict:
    if not re.fullmatch(r"v\d+\.\d+\.\d+", version):
        raise ValueError(f"Invalid pinned ODCS version: {version}")
    slug = version.replace(".", "")
    package = f"org.openmetadata.schema.type.datacontract.odcs.{slug}"
    model = _project_node(source, source, definition=True)
    model["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    model["$id"] = f"https://open-metadata.org/schema/type/datacontract/odcs/{slug}/odcsContract.json"
    model["title"] = "odcsContract"
    model["javaType"] = f"{package}.OdcsContract"
    model["properties"]["apiVersion"]["enum"] = [version]
    model["properties"]["apiVersion"]["description"] = f"ODCS export profile {version}."
    model["x-odcs-version"] = version
    model["x-odcs-upstream-sha256"] = (
        digest or hashlib.sha256(json.dumps(source, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    )
    for name, definition in model.get("definitions", {}).items():
        if isinstance(definition, dict) and definition.get("properties"):
            definition["javaType"] = f"{package}.{name}"
    return model


def _schema_inputs(source_directory: Path, vendor_directory: Path):
    for source in sorted(source_directory.rglob("*.json")):
        yield source.relative_to(source_directory), source.read_bytes()
    for source in sorted(vendor_directory.glob("v*/schema.json")):
        version = source.parent.name
        content = source.read_bytes()
        model = project_model(json.loads(content), version, hashlib.sha256(content).hexdigest())
        target = Path("type/datacontract/odcs") / version.replace(".", "") / "odcsContract.json"
        yield (
            target,
            (json.dumps(model, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        )


def _write_schema(target: Path, content: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    # Separate generation entry points can prepare the same tree concurrently.
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temporary:
        temporary.write(content)
        path = Path(temporary.name)
    try:
        path.replace(target)
    finally:
        path.unlink(missing_ok=True)


def prepare(
    output_directory: Path,
    *,
    source_directory: Path = SOURCE_SCHEMAS,
    vendor_directory: Path = VENDOR,
    check: bool = False,
) -> bool:
    output_directory = output_directory.resolve()
    for directory in (source_directory.resolve(), vendor_directory.resolve()):
        if output_directory.is_relative_to(directory) or directory.is_relative_to(output_directory):
            raise ValueError("Prepared schema output must not overlap its source inputs")
        if not directory.is_dir():
            raise ValueError(f"Schema input directory does not exist: {directory}")
    current = True
    expected = set()
    for relative, content in _schema_inputs(source_directory, vendor_directory):
        target = output_directory / relative
        expected.add(target)
        if target.exists() and target.read_bytes() == content:
            continue
        if check:
            sys.stderr.write(f"Stale model schema input: {target}\n")
            current = False
        else:
            _write_schema(target, content)
    for obsolete in sorted(set(output_directory.rglob("*.json")) - expected):
        if check:
            sys.stderr.write(f"Obsolete model schema input: {obsolete}\n")
            current = False
        else:
            obsolete.unlink(missing_ok=True)
    return current


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if not prepare(args.output_dir, check=args.check):
        return 1
    if not args.check:
        sys.stdout.write(f"{args.output_dir.resolve()}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
