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
"""Regression coverage for migrating legacy dbt definitions in place."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from metadata.generated.schema.tests.testCase import TestCase as Case
from metadata.generated.schema.tests.testDefinition import TestDefinition as Definition
from metadata.generated.schema.type.basic import ProviderType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.dbt.test_definition_migration import migrate_test_definition


@pytest.fixture
def migration():
    node = SimpleNamespace(
        name="unique_orders_id",
        column_name="id",
        description="Unique ids",
        meta={},
        test_metadata=SimpleNamespace(name="unique", kwargs={"column_name": "id"}),
    )
    old = Definition(
        id=uuid4(),
        name=node.name,
        version=0.1,
        description=node.description,
        entityType="COLUMN",
        testPlatforms=["dbt"],
        provider="user",
        parameterDefinition=[{"name": "unique", "displayName": "unique", "required": False}],
    )
    target = old.model_copy(deep=True)
    target.id = type(old.id)(uuid4())
    target.name = type(old.name)("unique")
    case = Case(
        id=uuid4(),
        name=node.name,
        fullyQualifiedName="svc.db.schema.orders.id.unique_orders_id",
        description=node.description,
        version=0.1,
        testSuite=EntityReference(id=uuid4(), type="testSuite"),
        entityLink="<#E::table::svc.db.schema.orders::columns::id>",
        testDefinition=EntityReference(id=old.id, type="testDefinition", name=node.name),
        parameterValues=[{"name": "unique", "value": ""}],
    )
    catalog = {node.name: old, "unique": target}
    client = MagicMock(spec=OpenMetadata)
    client.client = MagicMock()
    client.get_suffix.return_value = "dataQuality/testDefinitions"
    client.get_by_name.side_effect = lambda entity, fqn, **kwargs: (
        catalog[model_str(fqn)].model_copy(deep=True) if model_str(fqn) in catalog else None
    )
    client.patch.side_effect = lambda **kwargs: kwargs["destination"]

    def delete_unchanged(path, headers):
        if headers["If-Match"] != f'W/"{model_str(catalog[node.name].version)}"':
            raise APIError({"message": "Definition changed"}, 412)
        return catalog.pop(node.name)

    client.client.delete.side_effect = delete_unchanged
    return SimpleNamespace(node=node, old=old, target=target, case=case, catalog=catalog, client=client)


def test_reassigns_existing_case_and_hard_deletes_legacy_definition(migration):
    m = migration
    migrated = migrate_test_definition(m.client, m.case, m.node)
    assert migrated.id == m.case.id
    assert migrated.fullyQualifiedName == m.case.fullyQualifiedName
    assert migrated.parameterValues == m.case.parameterValues
    assert migrated.description == m.case.description
    assert migrated.testDefinition.id == m.target.id
    assert m.node.name not in m.catalog
    assert m.client.client.delete.call_args.args == (f"dataQuality/testDefinitions/{model_str(m.old.id)}/unused",)
    assert m.client.client.delete.call_args.kwargs == {"headers": {"If-Match": 'W/"0.1"'}}
    assert m.client.patch.call_args.kwargs["if_match"] == 'W/"0.1"'
    assert migrate_test_definition(m.client, migrated, m.node) == migrated
    assert m.client.patch.call_count == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("testPlatforms", ["OpenMetadata"]),
        ("provider", ProviderType.system),
        ("description", "User customization"),
        ("displayName", "Custom label"),
        ("entityType", "TABLE"),
        ("parameterDefinition", []),
        ("enabled", False),
        ("supportedServices", ["Snowflake"]),
        ("supportsDynamicAssertion", True),
        ("supportsRowLevelPassedFailed", True),
        ("sqlExpression", "select 1"),
        ("validatorClass", "custom.Validator"),
        ("dataQualityDimension", "Validity"),
        ("owners", {"root": [{"id": str(uuid4()), "type": "user"}]}),
        ("domains", {"root": [{"id": str(uuid4()), "type": "domain"}]}),
    ],
)
def test_preserves_customized_or_incompatible_legacy_definitions(migration, field, value):
    m = migration
    data = m.old.model_dump()
    data[field] = value["root"] if isinstance(value, dict) else value
    m.catalog[m.node.name] = Definition.model_validate(data)
    assert migrate_test_definition(m.client, m.case, m.node) == m.case
    assert m.node.name in m.catalog
    m.client.patch.assert_not_called()
    m.client.client.delete.assert_not_called()


@pytest.mark.parametrize(
    "field,value",
    [
        ("testPlatforms", ["OpenMetadata"]),
        ("entityType", "TABLE"),
        ("parameterDefinition", []),
        ("enabled", False),
    ],
)
def test_preserves_case_when_shared_definition_is_incompatible(migration, field, value):
    m = migration
    data = m.target.model_dump()
    data[field] = value
    m.catalog["unique"] = Definition.model_validate(data)
    assert migrate_test_definition(m.client, m.case, m.node) == m.case
    m.client.patch.assert_not_called()
    m.client.client.delete.assert_not_called()


def test_patch_failure_never_deletes_legacy_definition(migration):
    m = migration
    m.client.patch.side_effect = APIError({"message": "denied"}, 403)
    with pytest.raises(APIError):
        migrate_test_definition(m.client, m.case, m.node)
    assert m.node.name in m.catalog
    m.client.client.delete.assert_not_called()


@pytest.mark.parametrize("response", [None, "unchanged"])
def test_unconfirmed_patch_never_deletes_legacy_definition(migration, response):
    m = migration
    m.client.patch.side_effect = None
    m.client.patch.return_value = m.case if response else None
    with pytest.raises(ValueError, match="reassign"):
        migrate_test_definition(m.client, m.case, m.node)
    m.client.client.delete.assert_not_called()


def test_cleanup_retries_when_another_case_still_references_definition(migration):
    m = migration
    m.client.client.delete.side_effect = APIError({"message": "Definition has test cases"}, 400)
    migrated = migrate_test_definition(m.client, m.case, m.node)
    assert migrated.testDefinition.id == m.target.id
    assert m.node.name in m.catalog
    m.client.client.delete.side_effect = lambda *args, **kwargs: m.catalog.pop(m.node.name)
    assert migrate_test_definition(m.client, migrated, m.node) == migrated
    assert m.node.name not in m.catalog
    assert m.client.patch.call_count == 1


@pytest.mark.parametrize("missing", ["unique", "unique_orders_id"])
def test_missing_definition_leaves_case_unchanged(migration, missing):
    m = migration
    m.catalog.pop(missing)
    assert migrate_test_definition(m.client, m.case, m.node) == m.case
    m.client.client.delete.assert_not_called()


def test_singular_test_is_not_migrated(migration):
    m = migration
    del m.node.test_metadata
    assert migrate_test_definition(m.client, m.case, m.node) == m.case
    m.client.get_by_name.assert_not_called()


def test_manually_assigned_definition_is_not_migrated(migration):
    m = migration
    m.case.testDefinition.name = "custom_definition"
    assert migrate_test_definition(m.client, m.case, m.node) == m.case
    m.client.get_by_name.assert_not_called()


def test_table_scoped_test_uses_table_definition(migration):
    m = migration
    m.node.column_name = None
    m.node.test_metadata.kwargs = {}
    m.old.entityType = m.target.entityType = type(m.old.entityType).TABLE
    m.target.name = type(m.target.name)("unique_table")
    m.catalog["unique_table"] = m.catalog.pop("unique")
    m.case.entityLink = type(m.case.entityLink)("<#E::table::svc.db.schema.orders>")
    assert migrate_test_definition(m.client, m.case, m.node).testDefinition.id == m.target.id


def test_empty_server_relationship_lists_are_not_customizations(migration):
    m = migration
    data = m.old.model_dump()
    data.update(owners=[], domains=[])
    m.catalog[m.node.name] = Definition.model_validate(data)
    assert migrate_test_definition(m.client, m.case, m.node).testDefinition.id == m.target.id


def test_same_named_unrelated_definition_is_not_migrated(migration):
    m = migration
    m.case.testDefinition.id = type(m.case.testDefinition.id)(uuid4())
    assert migrate_test_definition(m.client, m.case, m.node) == m.case
    m.client.patch.assert_not_called()
    m.client.client.delete.assert_not_called()


def test_concurrent_customization_prevents_hard_deletion(migration):
    m = migration

    def patch_after_definition_edit(**kwargs):
        m.old.description = type(m.old.description)("Saved during ingestion")
        m.old.version = type(m.old.version)(0.2)
        return kwargs["destination"]

    m.client.patch.side_effect = patch_after_definition_edit
    migrated = migrate_test_definition(m.client, m.case, m.node)
    assert migrated.testDefinition.id == m.target.id
    assert model_str(m.catalog[m.node.name].description) == "Saved during ingestion"


def test_definition_without_version_is_never_deleted(migration):
    m = migration
    m.old.version = None
    migrated = migrate_test_definition(m.client, m.case, m.node)
    assert migrated.testDefinition.id == m.target.id
    assert m.node.name in m.catalog
    m.client.client.delete.assert_not_called()
