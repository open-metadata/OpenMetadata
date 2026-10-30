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
"""IOMETE observability must use the attached table's catalog."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, func, select, text

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.iometeConnection import IometeConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import DatabaseServiceProfilerPipeline
from metadata.ingestion.source.database.iomete.service_spec import ServiceSpec
from metadata.ingestion.source.database.iomete.utils import copy_connection_for_table
from metadata.utils.importer import import_from_module
from metadata.utils.profiler_utils import database_entities_cache


@pytest.fixture
def context():
    database_entities_cache.clear()
    service = DatabaseService(id=uuid4(), name="service.with.dot", serviceType="Iomete")
    service_ref = {"id": service.id, "type": "databaseService"}
    database = Database(id=uuid4(), name="target", service=service_ref)
    database_ref = {"id": database.id, "type": "database", "name": "stale-decoy"}
    schema = DatabaseSchema(id=uuid4(), name="main", database=database_ref, service=service_ref)
    table = Table(
        id=uuid4(),
        name="amounts",
        columns=[{"name": "amount", "dataType": "INT"}],
        database=database_ref,
        databaseSchema={"id": schema.id, "type": "databaseSchema"},
        service=service_ref,
        serviceType="Iomete",
        fullyQualifiedName="wrong.decoy.main.amounts",
    )
    metadata = MagicMock()
    metadata.get_by_id.side_effect = lambda entity, **_: {
        Database: database,
        DatabaseSchema: schema,
        DatabaseService: service,
    }[entity]
    yield table, database, metadata
    database_entities_cache.clear()


def connection(catalog):
    return IometeConnection(
        hostPort="localhost:443",
        username="user",
        password="secret",
        cluster="cluster",
        dataPlane="plane",
        catalog=catalog,
        databaseSchema="main",
        schemaFilterPattern={"includes": ["main"]},
    )


def adapter(kind):
    return import_from_module(getattr(ServiceSpec, kind + "_class"))


@pytest.mark.parametrize("catalog", ["target", "decoy", None])
@pytest.mark.parametrize("target", ["target", "default"])
def test_catalog_copy_uses_resolved_database_and_preserves_settings(context, catalog, target):
    table, database, metadata = context
    database.name = target
    original = connection(catalog)
    before = original.model_dump()
    copied = copy_connection_for_table(original, table, metadata)
    assert copied.catalog == target
    assert original.model_dump() == before
    assert copied.model_dump(exclude={"catalog"}) == original.model_dump(exclude={"catalog"})
    copied.schemaFilterPattern.includes.append("other")
    assert original.schemaFilterPattern.includes == ["main"]


@pytest.mark.parametrize("kind", ["sampler", "test_suite", "profiler"])
@pytest.mark.parametrize("catalog", ["target", "decoy", None])
def test_all_observability_sessions_query_target_catalog(context, monkeypatch, kind, catalog):
    table, _, metadata = context
    engines = {name: create_engine("sqlite://") for name in ["target", "decoy"]}
    for name, engine in engines.items():
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE amounts (amount INT)"))
            values = [10, -1, 20] if name == "target" else [-1, -2] + [10] * 8
            conn.execute(text("INSERT INTO amounts VALUES (:amount)"), [{"amount": value} for value in values])
    observed = []

    def get_engine(config):
        observed.append(config.catalog)
        return engines[config.catalog or "decoy"]

    for module in [
        "metadata.sampler.sqlalchemy.sampler",
        "metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface",
        "metadata.profiler.interface.profiler_interface",
    ]:
        monkeypatch.setattr(module + ".get_ssl_connection", get_engine)
    original = connection(catalog)
    sampler = adapter("sampler")(original, metadata, table)
    if kind == "sampler":
        session = sampler.get_client()
    elif kind == "test_suite":
        interface = adapter(kind)(original, metadata, sampler, table, validator_builder=MagicMock())
        session = interface.session
    else:
        interface = adapter(kind)(original, metadata, table, DatabaseServiceProfilerPipeline(), sampler, 1)
        session = interface.session
    assert session.execute(select(func.count()).select_from(sampler.raw_dataset)).scalar() == 3
    assert session.execute(text("SELECT COUNT(*) FROM amounts WHERE amount < :limit"), {"limit": 0}).scalar() == 1
    assert observed == ["target"] * (1 if kind == "sampler" else 2)
    assert original.catalog == catalog
    session.close()
    sampler.session_factory.remove()
    for engine in engines.values():
        engine.dispose()


@pytest.mark.parametrize("kind", ["sampler", "test_suite", "profiler"])
def test_missing_database_fails_before_engine_creation(context, monkeypatch, kind):
    table, _, metadata = context
    table.database = None
    engine = MagicMock(side_effect=AssertionError("source engine must not be created"))
    for module in [
        "metadata.sampler.sqlalchemy.sampler",
        "metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface",
        "metadata.profiler.interface.profiler_interface",
    ]:
        monkeypatch.setattr(module + ".get_ssl_connection", engine)
    with pytest.raises(ValueError, match=r"IOMETE.*database"):
        if kind == "sampler":
            adapter(kind)(connection("decoy"), metadata, table)
        elif kind == "test_suite":
            adapter(kind)(connection("decoy"), metadata, MagicMock(), table, validator_builder=MagicMock())
        else:
            adapter(kind)(connection("decoy"), metadata, table, DatabaseServiceProfilerPipeline(), MagicMock(), 1)
    engine.assert_not_called()


def test_service_spec_selects_connector_adapters():
    for kind, name in [
        ("sampler", "IometeSampler"),
        ("test_suite", "IometeTestSuiteInterface"),
        ("profiler", "IometeProfilerInterface"),
    ]:
        assert adapter(kind).__name__ == name


@pytest.mark.parametrize("missing", ["table", "reference", "lookup"])
def test_catalog_copy_rejects_unresolved_database(context, missing):
    table, _, metadata = context
    if missing == "table":
        table = None
    elif missing == "reference":
        table.database = None
    else:
        metadata.get_by_id.side_effect = None
        metadata.get_by_id.return_value = None
    with pytest.raises(ValueError, match=r"IOMETE.*database"):
        copy_connection_for_table(connection("decoy"), table, metadata)


def test_catalog_copy_resolves_id_only_database_reference(context):
    table, database, metadata = context
    table.database.name = None
    copied = copy_connection_for_table(connection(None), table, metadata)
    assert copied.catalog == database.name.root
