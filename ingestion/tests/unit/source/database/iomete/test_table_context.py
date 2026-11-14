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
"""IOMETE observability inherits the execution connection's catalog selection."""

from copy import deepcopy
from unittest.mock import MagicMock
from uuid import uuid4

import iomete_sqlalchemy.dbapi
import pytest
from pydantic import RootModel
from sqlalchemy import func, select, text

from metadata.data_quality.runner.base_test_suite_source import BaseTestSuiteRunner
from metadata.data_quality.source.test_suite import TestSuiteSource
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.profiler.source.database.base.profiler_source import ProfilerSource
from metadata.sampler.entity_adapters import TableAdapter
from metadata.utils.profiler_utils import database_entities_cache
from metadata.utils.service_spec.service_spec import (
    import_profiler_class,
    import_sampler_class,
    import_test_suite_class,
)


class Cursor:
    def __init__(self, statements):
        self.statements = statements

    description = (("probe_count", None, None, None, None, None, None),)
    rowcount = -1

    def execute(self, sql, params=None):
        self.statements.append({"sql": sql, "params": params})

    def fetchone(self):
        return (1,)

    def fetchall(self):
        return [(1,)]

    def close(self):
        pass


class Connection:
    def __init__(self, statements):
        self.statements = statements

    def cursor(self):
        return Cursor(self.statements)

    def close(self):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass


def fixture(ingestion_catalog):
    label = ingestion_catalog or "default"
    service = DatabaseService(id=uuid4(), name="warehouse", serviceType="Iomete")
    sref = {"id": service.id, "type": "databaseService", "name": "warehouse"}
    db = Database(id=uuid4(), name=label, service=sref)
    dref = {"id": db.id, "type": "database", "name": label}
    schema = DatabaseSchema(id=uuid4(), name="finance", database=dref, service=sref)
    table = Table(
        id=uuid4(),
        name="amounts",
        columns=[{"name": "amount", "dataType": "INT"}],
        database=dref,
        databaseSchema={"id": schema.id, "type": "databaseSchema", "name": "finance"},
        service=sref,
        serviceType="Iomete",
        fullyQualifiedName=f"warehouse.{label}.finance.amounts",
    )
    metadata = MagicMock()
    metadata.get_by_id.side_effect = lambda entity, **kwargs: {
        Database: db,
        DatabaseSchema: schema,
        DatabaseService: service,
    }[entity]
    metadata.get_profiler_config_settings.return_value = None
    return table, db, schema, metadata


def workflow(runtime_catalog, mode):
    connection = {
        "type": "Iomete",
        "hostPort": "offline.invalid:443",
        "username": "probe",
        "password": "offline-only",
        "cluster": "probe_cluster",
        "dataPlane": "probe_plane",
        "catalog": runtime_catalog,
    }
    source = {
        "type": "iomete",
        "serviceName": "warehouse",
        "sourceConfig": {"config": {"type": "TestSuite" if mode == "dq" else "Profiler"}},
    }
    if mode == "dq":
        source["sourceConfig"]["config"]["serviceConnections"] = [
            {"serviceName": "warehouse", "serviceConnection": {"config": connection}}
        ]
    else:
        source["serviceConnection"] = {"config": connection}
    return OpenMetadataWorkflowConfig.model_validate(
        {
            "source": source,
            "processor": {"type": "orm-profiler", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://offline.invalid:8585/api",
                    "authProvider": "openmetadata",
                }
            },
        }
    )


def check_runtime_catalog(ingested, runtime, connects, statements):
    database_entities_cache.clear()
    table, db, schema, metadata = fixture(ingested)
    config = workflow(runtime, "dq")
    source = TestSuiteSource(config, metadata)
    selected = source._get_table_service_connection(table)
    assert selected.config.catalog == runtime
    config.source.serviceConnection = RootModel(selected)
    before = config.source.serviceConnection.root.config.model_dump()
    runner_source = BaseTestSuiteRunner(config, metadata, table)
    assert runner_source.service_conn_config.catalog == runtime
    interface = runner_source.create_data_quality_interface()
    try:
        offset = len(connects)
        sql_offset = len(statements)
        logical = interface.runner.get_table_reference()
        interface.session.execute(text(f"SELECT COUNT(*) FROM {logical} WHERE amount < :limit"), {"limit": 0}).scalar()
        interface.session.execute(select(func.count()).select_from(interface.sampler.raw_dataset)).scalar()
        with interface.sampler.get_client() as sampling_session:
            sampling_session.execute(select(func.count()).select_from(interface.sampler.raw_dataset)).scalar()
        expected = runtime or None
        assert {c["db_kwargs"].get("adbc.flight.sql.rpc.call_header.schema") for c in connects[offset:]} == {expected}
        assert logical == "finance.amounts"
        assert "finance.amounts" in statements[sql_offset]["sql"]
        assert "finance.amounts" in statements[sql_offset + 1]["sql"]
        assert before == config.source.serviceConnection.root.config.model_dump()
    finally:
        interface.session.close()
        interface.session.get_bind().dispose()
        interface.sampler.close()
    pconfig = workflow(runtime, "profiler")
    profiler_source = ProfilerSource(pconfig, db, metadata, None)
    profiler = profiler_source.create_profiler_interface(table, None, schema, db)
    try:
        offset = len(connects)
        profiler.session.execute(select(func.count()).select_from(profiler.table)).scalar()
        with profiler.sampler.get_client() as sampling_session:
            sampling_session.execute(select(func.count()).select_from(profiler.table)).scalar()
        assert {c["db_kwargs"].get("adbc.flight.sql.rpc.call_header.schema") for c in connects[offset:]} == {expected}
        classification_kwargs = TableAdapter().build_sampler_kwargs(
            pconfig, metadata, table, profiler_source.profiler_config, DatabaseServiceAutoClassificationPipeline()
        )
        classification_sampler = import_sampler_class(ServiceType.Database, "iomete").create(**classification_kwargs)
        try:
            offset_class = len(connects)
            with classification_sampler.get_client() as sampling_session:
                sampling_session.execute(select(func.count()).select_from(classification_sampler.raw_dataset)).scalar()
            assert connects[offset_class]["db_kwargs"].get("adbc.flight.sql.rpc.call_header.schema") == expected
        finally:
            classification_sampler.close()
    finally:
        profiler.close()
        profiler.sampler.close()


@pytest.mark.parametrize(
    "ingested,runtime",
    [
        (None, None),
        ("", ""),
        ("default", "default"),
        ("catalog_a", "catalog_a"),
        ("catalog_a", "catalog_b"),
        ("catalog_a", None),
        (None, "catalog_b"),
        ("default", "catalog_b"),
    ],
)
def test_inherited_workflows_preserve_runtime_catalog(monkeypatch, ingested, runtime):
    connects, statements = [], []

    def connect(*args, **kwargs):
        connects.append(deepcopy(kwargs))
        return Connection(statements)

    monkeypatch.setattr(iomete_sqlalchemy.dbapi, "connect", connect)
    try:
        for loader, name in [
            (import_sampler_class, "SQASampler"),
            (import_test_suite_class, "SQATestSuiteInterface"),
            (import_profiler_class, "SQAProfilerInterface"),
        ]:
            assert loader(ServiceType.Database, "iomete").__name__ == name
        check_runtime_catalog(ingested, runtime, connects, statements)
    finally:
        database_entities_cache.clear()
