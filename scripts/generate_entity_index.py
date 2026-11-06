#!/usr/bin/env python3
"""Generate docs/generated/entity-index.md from the schemas + JAX-RS resources.

For every first-class entity schema under
``openmetadata-spec/src/main/resources/json/schema/entity/**`` this emits its
schema path and the four artifacts codegen/routing derive from it:

  - Java generated type   -- read directly from the schema's ``javaType``
  - Python generated module -- the datamodel-code-generator convention
                               (input ``json/schema`` -> output ``generated/schema``)
  - TypeScript generated type -- the quicktype convention (``ui/src/generated/**``),
                               only listed when the committed ``.ts`` actually exists
  - REST resource class   -- joined from ``extends EntityResource<Entity, Repo>``

An "entity" here is a schema under ``entity/**`` that declares a ``javaType`` and a
top-level ``id`` property -- the discriminator that separates a first-class entity
(``Table``, ``Dashboard``) from a nested support type (``Column``, ``TagLabel``).

The output is deterministic (sorted, no timestamps) so ``git diff`` stays empty
until a source actually changes. Do not edit the output by hand -- run
``make generate-entity-index`` (or ``make generate-reference-docs``).
"""

import json
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SCHEMA_ROOT = "openmetadata-spec/src/main/resources/json/schema"
ENTITY_ROOT = os.path.join(SCHEMA_ROOT, "entity")
RESOURCE_ROOT = "openmetadata-service/src/main/java/org/openmetadata/service/resources"
JAVA_SRC_ROOT = "openmetadata-service/src/main/java/"
TS_GEN_ROOT = "openmetadata-ui/src/main/resources/ui/src/generated"
PY_GEN_MODULE = "metadata.generated.schema"
OUT_PATH = "docs/generated/entity-index.md"

ENTITY_RESOURCE_RE = re.compile(r"extends\s+EntityResource<\s*([A-Za-z0-9_]+)\s*,")


def repo(*parts):
    return os.path.join(REPO_ROOT, *parts)


def collect_resource_classes():
    """entity simple class name -> Java FQN of its *Resource, from EntityResource<X, Repo>."""
    by_entity = {}
    ambiguous = set()
    for dirpath, _dirs, files in os.walk(repo(RESOURCE_ROOT)):
        for name in files:
            if not name.endswith("Resource.java"):
                continue
            full = os.path.join(dirpath, name)
            with open(full, encoding="utf-8") as handle:
                match = ENTITY_RESOURCE_RE.search(handle.read())
            if match is None:
                continue
            entity_class = match.group(1)
            rel = os.path.relpath(full, repo(JAVA_SRC_ROOT))
            fqn = rel[: -len(".java")].replace(os.sep, ".")
            if entity_class in by_entity and by_entity[entity_class] != fqn:
                ambiguous.add(entity_class)
            by_entity[entity_class] = fqn
    for entity_class in ambiguous:
        by_entity[entity_class] = "MULTIPLE (review)"
    return by_entity


def is_entity_schema(schema):
    properties = schema.get("properties")
    return (
        isinstance(properties, dict)
        and "javaType" in schema
        and "id" in properties
    )


def collect_entities():
    entities = []
    for dirpath, _dirs, files in os.walk(repo(ENTITY_ROOT)):
        for name in sorted(files):
            if not name.endswith(".json"):
                continue
            full = os.path.join(dirpath, name)
            with open(full, encoding="utf-8") as handle:
                try:
                    schema = json.load(handle)
                except json.JSONDecodeError:
                    continue
            if not is_entity_schema(schema):
                continue
            schema_rel = os.path.relpath(full, REPO_ROOT).replace(os.sep, "/")
            entities.append((schema_rel, schema["javaType"]))
    return entities


def under_schema_root(schema_rel):
    return schema_rel[len(SCHEMA_ROOT) + 1 :]


def python_module(schema_rel):
    inner = under_schema_root(schema_rel)[: -len(".json")]
    return f"{PY_GEN_MODULE}." + inner.replace("/", ".")


def ts_type(schema_rel):
    inner = under_schema_root(schema_rel)[: -len(".json")]
    ts_rel = f"{TS_GEN_ROOT}/{inner}.ts"
    return ts_rel if os.path.exists(repo(ts_rel)) else "—"


def category_of(schema_rel):
    inner = under_schema_root(schema_rel)
    parts = inner.split("/")
    return parts[1] if len(parts) > 2 else "(root)"


def build_rows(entities, resources):
    rows = []
    for schema_rel, java_type in entities:
        simple = java_type.rsplit(".", 1)[-1]
        rows.append(
            {
                "category": category_of(schema_rel),
                "entity": simple,
                "schema": schema_rel,
                "java": java_type,
                "python": python_module(schema_rel),
                "ts": ts_type(schema_rel),
                "resource": resources.get(simple, "—"),
            }
        )
    rows.sort(key=lambda row: (row["category"], row["entity"], row["schema"]))
    return rows


def render(rows):
    total = len(rows)
    with_resource = sum(1 for row in rows if row["resource"] not in ("—", "MULTIPLE (review)"))
    lines = [
        "<!-- GENERATED FILE — DO NOT EDIT. Run `make generate-entity-index`. -->",
        "",
        "# Entity Index",
        "",
        "One row per first-class entity schema, with the artifacts codegen and routing",
        "derive from it. **Generated** from the JSON schemas and JAX-RS resources — do not",
        "hand-edit; run `make generate-entity-index` (or `make generate-reference-docs`).",
        "",
        "- **Entity** = a schema under `openmetadata-spec/src/main/resources/json/schema/entity/**`",
        "  that declares a `javaType` and a top-level `id` property.",
        "- **Java** is read from the schema's `javaType`. **Python** / **TypeScript** paths follow the",
        "  codegen conventions (datamodel-code-generator / quicktype); the TS column shows `—` when the",
        "  committed `.ts` is absent.",
        "- **REST resource** is joined from `extends EntityResource<Entity, …>`; `—` means no dedicated",
        "  `EntityResource` was found (the entity may be exposed via a shared or non-`EntityResource` route).",
        "",
        f"**{total} entities** · {with_resource} with a dedicated `EntityResource`.",
        "",
    ]
    current = None
    for index, row in enumerate(rows):
        if row["category"] != current:
            current = row["category"]
            lines.append(f"## entity/{current}")
            lines.append("")
            lines.append("| Entity | Schema | Java | Python | TypeScript | REST resource |")
            lines.append("|---|---|---|---|---|---|")
        lines.append(
            "| {entity} | `{schema}` | `{java}` | `{python}` | {ts} | {resource} |".format(
                entity=row["entity"],
                schema=row["schema"],
                java=row["java"],
                python=row["python"],
                ts=f"`{row['ts']}`" if row["ts"] != "—" else "—",
                resource=f"`{row['resource']}`" if row["resource"] != "—" else "—",
            )
        )
        is_last_in_group = index + 1 == len(rows) or rows[index + 1]["category"] != current
        if is_last_in_group:
            lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def main():
    resources = collect_resource_classes()
    entities = collect_entities()
    rows = build_rows(entities, resources)
    output = render(rows)
    os.makedirs(repo(os.path.dirname(OUT_PATH)), exist_ok=True)
    with open(repo(OUT_PATH), "w", encoding="utf-8") as handle:
        handle.write(output)
    print(f"wrote {OUT_PATH}: {len(rows)} entities")


if __name__ == "__main__":
    main()
