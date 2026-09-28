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
"""Database entity observations and pure checks."""

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import ConstraintType, Table
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.fqn import split

from ...runtime.expect import Query
from .._om_compat import unwrap_root_list


def table_query(om, fqn: str) -> Query[Table | None]:
    return Query(
        f"table {fqn}",
        lambda: om.get_by_name(
            entity=Table,
            fqn=fqn,
            fields=["tags", "owners", "columns", "tableConstraints", "schemaDefinition"],
            include="all",
        ),
    )


def procedure_query(om, fqn: str) -> Query[StoredProcedure | None]:
    return Query(f"procedure {fqn}", lambda: om.get_by_name(entity=StoredProcedure, fqn=fqn))


def entity_exists(entity) -> None:
    assert entity is not None, "entity missing"


def has_description(text: str):
    if not text:
        raise ValueError("description text must not be empty")

    def check(entity):
        entity_exists(entity)
        assert text in model_str(entity.description or ""), f"description missing {text!r}"

    return check


def has_tag(tag: str):
    if not tag:
        raise ValueError("tag must not be empty")

    def check(entity):
        entity_exists(entity)
        assert tag in {model_str(item.tagFQN) for item in unwrap_root_list(entity.tags)}, f"missing tag {tag}"

    return check


def has_owner(name: str):
    if not name:
        raise ValueError("owner must not be empty")

    def check(entity):
        entity_exists(entity)
        assert name in {model_str(item.name) for item in unwrap_root_list(entity.owners)}, f"missing owner {name}"

    return check


def column(table, name: str):
    entity_exists(table)
    result = next((item for item in unwrap_root_list(table.columns) if model_str(item.name) == name), None)
    assert result is not None, f"column {name} missing"
    return result


def column_has_tag(name: str, tag: str):
    if not name or not tag:
        raise ValueError("column and tag must not be empty")

    def check(table):
        has_tag(tag)(column(table, name))

    return check


def column_has_no_tag(name: str, tag: str):
    if not name or not tag:
        raise ValueError("column and tag must not be empty")

    def check(table):
        observed = column(table, name)
        assert tag not in {model_str(item.tagFQN) for item in unwrap_root_list(observed.tags)}, f"unexpected tag {tag}"

    return check


def table_is_deleted(*, deleted: bool):
    def check(table):
        entity_exists(table)
        assert table.deleted is deleted, f"expected deleted={deleted}, got {table.deleted}"

    return check


def table_has_schema_definition(text: str):
    if not text:
        raise ValueError("schema definition text must not be empty")

    def check(table):
        entity_exists(table)
        assert text.lower() in model_str(table.schemaDefinition or "").lower(), f"schema definition missing {text!r}"

    return check


def procedure_has_code(text: str):
    if not text:
        raise ValueError("procedure code text must not be empty")

    def check(procedure):
        entity_exists(procedure)
        assert procedure.storedProcedureCode is not None, "procedure code missing"
        assert text in (procedure.storedProcedureCode.code or ""), f"procedure code missing {text!r}"

    return check


def table_has_foreign_key(columns: tuple[str, ...], referred_columns: tuple[str, ...]):
    if not columns or len(columns) != len(referred_columns):
        raise ValueError("foreign key requires equal, nonempty column lists")
    if any(not name for name in columns) or any(len(split(name)) < 5 for name in referred_columns):
        raise ValueError("referred columns must be full FQNs")
    wanted = tuple(zip(columns, referred_columns, strict=True))

    def check(table):
        entity_exists(table)
        actual = []
        for constraint in unwrap_root_list(table.tableConstraints):
            if constraint.constraintType != ConstraintType.FOREIGN_KEY:
                continue
            own = tuple(model_str(name) for name in unwrap_root_list(constraint.columns))
            referred = tuple(model_str(name) for name in unwrap_root_list(constraint.referredColumns))
            assert len(own) == len(referred), "foreign key has mismatched column list lengths"
            actual.append(tuple(zip(own, referred, strict=True)))
        assert wanted in actual, f"foreign key {wanted!r} missing; actual={actual!r}"

    return check
