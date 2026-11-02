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
"""BigQuery test-suite sessions must select the attached table's project."""

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from google.auth.credentials import AnonymousCredentials
from google.cloud.bigquery import Client, ConnectionProperty, QueryJobConfig, SchemaField
from sqlalchemy import create_engine, func, select, text

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import SQATestSuiteInterface
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.connectionBasicType import ConnectionArguments
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import DatabaseServiceProfilerPipeline
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.security.credentials.gcpCredentials import GCPImpersonateServiceAccountValues
from metadata.generated.schema.security.credentials.gcpValues import SingleProjectId
from metadata.ingestion.source.database.bigquery.connection import BigQueryConnection, get_connection_url
from metadata.ingestion.source.database.bigquery.service_spec import ServiceSpec
from metadata.utils.bigquery_utils import copy_service_config
from metadata.utils.importer import import_from_module
from metadata.utils.profiler_utils import database_entities_cache


@pytest.fixture(params=["service_account", "gcp_credential_path", "gcp_adc"])
def credential_config(request, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "decoy")
    config = {"type": request.param}
    if request.param == "gcp_credential_path":
        config["path"] = "/synthetic/credentials.json"
    return config


def workflow(gcp_config):
    return OpenMetadataWorkflowConfig.model_validate(
        {
            "source": {
                "type": "bigquery",
                "serviceName": "bigquery",
                "serviceConnection": {
                    "config": {
                        "type": "BigQuery",
                        "credentials": {"gcpConfig": gcp_config},
                        "billingProjectId": "billing-project",
                        "usageLocation": "eu",
                    }
                },
                "sourceConfig": {"config": {"type": "TestSuite"}},
            },
            "workflowConfig": {
                "openMetadataServerConfig": {"hostPort": "http://localhost:8585/api", "authProvider": "openmetadata"}
            },
        }
    )


@pytest.mark.parametrize("projects", [None, "target", "decoy", ["decoy", "target"], ["target", "decoy"]])
def test_copy_selects_target_project_and_preserves_original(credential_config, projects):
    config = workflow({**credential_config, "projectId": projects})
    config.source.serviceConnection.root.config.credentials.gcpImpersonateServiceAccount = (
        GCPImpersonateServiceAccountValues(impersonateServiceAccount="runner@example.com", lifetime=600)
    )
    original = config.model_dump()
    copied = copy_service_config(config, "target")
    assert isinstance(copied.credentials.gcpConfig.projectId, SingleProjectId)
    assert copied.credentials.gcpConfig.projectId.root == "target"
    assert get_connection_url(copied).host == "target"
    expected = config.source.serviceConnection.root.config.model_dump()
    expected["credentials"]["gcpConfig"]["projectId"] = "target"
    assert copied.model_dump() == expected
    copied.credentials.gcpConfig.projectId.root = "mutated-copy"
    copied.credentials.gcpImpersonateServiceAccount.lifetime = 300
    assert config.model_dump() == original


def test_copy_preserves_external_account_default():
    config = workflow({"type": "external_account", "audience": "synthetic-audience"})
    assert (
        copy_service_config(config, "target").model_dump() == config.source.serviceConnection.root.config.model_dump()
    )


def test_test_suite_session_bind_selects_target_project(credential_config, monkeypatch):
    # Stub only Google authentication; retain the real connector, dialect and session creation.
    monkeypatch.setattr("google.auth.default", lambda **_: (AnonymousCredentials(), "decoy"))
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/synthetic/credentials.json")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "decoy")
    config = workflow({**credential_config, "projectId": ["decoy", "target"]})
    interface = SQATestSuiteInterface.__new__(SQATestSuiteInterface)
    interface.service_connection_config = copy_service_config(config, "target")
    interface.create_session()
    engine = interface.session.get_bind()
    try:
        assert engine.url.host == "target"
        assert engine.dialect.billing_project_id == "billing-project"
    finally:
        interface.session.close()
        engine.dispose()


@pytest.fixture
def table_context():
    database_entities_cache.clear()
    service = DatabaseService(id=uuid4(), name="bigquery", serviceType="BigQuery")
    service_ref = {"id": service.id, "type": "databaseService"}
    database = Database(id=uuid4(), name="target", service=service_ref)
    database_ref = {"id": database.id, "type": "database", "name": "target"}
    schema = DatabaseSchema(id=uuid4(), name="dataset", database=database_ref, service=service_ref)
    table = Table(
        id=uuid4(),
        name="amounts",
        columns=[{"name": "amount", "dataType": "INT"}],
        database=database_ref,
        databaseSchema={"id": schema.id, "type": "databaseSchema"},
        service=service_ref,
        serviceType="BigQuery",
        fullyQualifiedName="bigquery.target.dataset.amounts",
    )
    metadata = MagicMock()
    metadata.get_by_id.side_effect = lambda entity, **_: {
        Database: database,
        DatabaseSchema: schema,
        DatabaseService: service,
    }[entity]
    yield table, database, metadata
    database_entities_cache.clear()


@pytest.mark.parametrize("auth", ["driver", "external", "impersonation", "api_endpoint"])
@pytest.mark.parametrize("kind", ["sampler", "test_suite", "profiler"])
def test_observability_queries_preserve_target_and_billing(table_context, auth, kind, monkeypatch):
    monkeypatch.setattr("google.auth.default", lambda **_: (AnonymousCredentials(), "decoy"))
    monkeypatch.setattr(
        "metadata.utils.bigquery_utils.get_gcp_impersonate_credentials", lambda **_: AnonymousCredentials()
    )
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "decoy")
    config = workflow(
        {"type": "external_account", "audience": "synthetic-audience"}
        if auth == "external"
        else {"type": "service_account", "projectId": ["decoy", "target"]}
    )
    connection = config.source.serviceConnection.root.config
    if auth == "impersonation":
        connection.credentials.gcpImpersonateServiceAccount = GCPImpersonateServiceAccountValues(
            impersonateServiceAccount="runner@example.com"
        )
    elif auth == "api_endpoint":
        connection.credentials.gcpConfig.universeDomain = "example.invalid"
        connection.hostPort = "bigquery.example.invalid"
    connection.connectionArguments = ConnectionArguments(root={"prefer_bqstorage_client": False})
    before = config.model_dump()
    queries = []

    def query_and_wait(client, query, **kwargs):
        queries.append((client, query, {**kwargs, "job_config": deepcopy(kwargs["job_config"])}))
        schema = [SchemaField("row_count", "INTEGER")] if "count(" in query.lower() else []
        return SimpleNamespace(schema=schema, total_rows=0, num_dml_affected_rows=None)

    # Retain the real Client, SQLAlchemy dialect and DBAPI; replace the network job boundary.
    monkeypatch.setattr("google.cloud.bigquery._job_helpers.query_and_wait", query_and_wait)
    table, _, metadata = table_context
    sampler = import_from_module(ServiceSpec.sampler_class)(connection, metadata, table)
    interface = None
    if kind == "sampler":
        session = sampler.get_client()
    elif kind == "test_suite":
        interface = import_from_module(ServiceSpec.test_suite_class)(
            connection, metadata, sampler, table, validator_builder=MagicMock()
        )
        session = interface.session
    else:
        interface = import_from_module(ServiceSpec.profiler_class)(
            connection, metadata, table, DatabaseServiceProfilerPipeline(), sampler, 1
        )
        session = interface.session
    try:
        session.execute(text("SELECT * FROM `dataset`.`amounts` WHERE amount < :limit"), {"limit": 0})
        session.rollback()
        session.execute(select(func.count().label("row_count")).select_from(sampler.raw_dataset))
    finally:
        session.close()
        sampler.session_factory.remove()
        sampler.connection.dispose()
        if interface and kind == "profiler":
            interface.session_factory.remove()
            interface.connection.dispose()
    assert len(queries) == 2
    for client, _, kwargs in queries:
        assert client.project == "billing-project"
        assert kwargs["project"] == "billing-project"
        assert kwargs["location"] == "eu"
        job = kwargs["job_config"].to_api_repr()["query"]
        assert job["connectionProperties"] == [{"key": "dataset_project_id", "value": "target"}]
    bound_parameter = queries[0][2]["job_config"].query_parameters[0]
    assert bound_parameter.name == "limit"
    assert bound_parameter.value == 0
    assert config.model_dump() == before


@pytest.mark.parametrize("existing_config", [False, True])
def test_target_binding_copies_job_configuration_and_resolves_database(table_context, existing_config):
    from metadata.ingestion.source.database.bigquery.utils import bind_connection_to_table

    table, _, metadata = table_context
    table.database.name = "stale-decoy"
    job_config = QueryJobConfig(
        maximum_bytes_billed=42,
        labels={"team": "data-quality"},
        connection_properties=[
            ConnectionProperty(key="session_id", value="session"),
            ConnectionProperty(key="dataset_project_id", value="decoy"),
        ],
    )
    engine = create_engine("sqlite://").execution_options(
        stream_results=True, **({"job_config": job_config} if existing_config else {})
    )
    before = job_config.to_api_repr()
    bound = bind_connection_to_table(engine, table, metadata)
    try:
        options = bound.get_execution_options()
        assert options["stream_results"] is True
        actual = options["job_config"].to_api_repr()["query"]
        expected_properties = [{"key": "session_id", "value": "session"}] if existing_config else []
        assert actual["connectionProperties"] == expected_properties + [
            {"key": "dataset_project_id", "value": "target"}
        ]
        if existing_config:
            assert actual["maximumBytesBilled"] == "42"
            assert options["job_config"].labels == {"team": "data-quality"}
            options["job_config"].labels = {"changed": "copy"}
            assert engine.get_execution_options()["job_config"] is job_config
        else:
            assert "job_config" not in engine.get_execution_options()
        assert job_config.to_api_repr() == before
    finally:
        bound.dispose()
        engine.dispose()


@pytest.mark.parametrize("missing", ["table", "reference", "lookup"])
def test_target_binding_rejects_unresolved_project(table_context, missing):
    from metadata.ingestion.source.database.bigquery.utils import bind_connection_to_table

    table, _, metadata = table_context
    if missing == "table":
        table = None
    elif missing == "reference":
        table.database = None
    else:
        metadata.get_by_id.side_effect = None
        metadata.get_by_id.return_value = None
    engine = create_engine("sqlite://")
    try:
        with pytest.raises(ValueError, match=r"BigQuery.*database"):
            bind_connection_to_table(engine, table, metadata)
        assert "job_config" not in engine.get_execution_options()
    finally:
        engine.dispose()


def test_target_binding_isolates_connections_and_other_target_engines(table_context):
    from metadata.ingestion.source.database.bigquery.utils import bind_connection_to_table

    table, database, metadata = table_context
    template = QueryJobConfig(labels={"original": "setting"})
    engine = create_engine("sqlite://").execution_options(job_config=template)
    target = bind_connection_to_table(engine, table, metadata)
    database.name = type(database.name)("other-target")
    other_target = bind_connection_to_table(engine, table, metadata)
    with (
        engine.connect() as original,
        target.connect() as first,
        target.connect() as second,
        other_target.connect() as other,
    ):
        first_config = first.get_execution_options()["job_config"]
        second_config = second.get_execution_options()["job_config"]
        assert first_config is not second_config
        assert first_config is not target.get_execution_options()["job_config"]
        assert original.get_execution_options()["job_config"] is template
        assert template.connection_properties == []
        assert first_config.connection_properties[0].value == "target"
        assert other.get_execution_options()["job_config"].connection_properties[0].value == "other-target"
        first_config.labels = {"changed": "first"}
        assert second_config.labels == {"original": "setting"}
        assert target.get_execution_options()["job_config"].labels == {"original": "setting"}
    engine.dispose()


def test_interleaved_dbapi_requests_keep_independent_bound_values(table_context, monkeypatch):
    from metadata.ingestion.source.database.bigquery.utils import bind_connection_to_table

    monkeypatch.setattr(
        "metadata.utils.bigquery_utils.get_gcp_impersonate_credentials", lambda **_: AnonymousCredentials()
    )
    config = workflow({"type": "gcp_adc", "projectId": "target"}).source.serviceConnection.root.config
    config.credentials.gcpImpersonateServiceAccount = GCPImpersonateServiceAccountValues(
        impersonateServiceAccount="runner@example.com"
    )
    config.connectionArguments = ConnectionArguments(root={"prefer_bqstorage_client": False})
    table, _, metadata = table_context
    requests = []
    interleaved = False

    def query_and_wait(client, query, **kwargs):
        nonlocal interleaved
        if not interleaved:
            interleaved = True
            second.execute(text("SELECT :limit"), {"limit": 7})
        requests.append(deepcopy(kwargs["job_config"]))
        return SimpleNamespace(schema=[], total_rows=0, num_dml_affected_rows=None)

    monkeypatch.setattr("google.cloud.bigquery._job_helpers.query_and_wait", query_and_wait)
    with BigQueryConnection(config) as source:
        bound = bind_connection_to_table(source.client, table, metadata)
        with bound.connect() as first, bound.connect() as second:
            first.execute(text("SELECT :limit"), {"limit": 0})
        assert [request.query_parameters[0].value for request in requests] == [7, 0]
        assert "job_config" not in source.client.get_execution_options()
        assert bound.get_execution_options()["job_config"].query_parameters == []
    assert all(request.connection_properties[0].value == "target" for request in requests)


@pytest.mark.parametrize("supplied_client", [False, True])
def test_minimal_target_configuration_preserves_client_job_defaults(table_context, monkeypatch, supplied_client):
    from metadata.ingestion.source.database.bigquery.utils import bind_connection_to_table

    monkeypatch.setattr("google.auth.default", lambda **_: (AnonymousCredentials(), "target"))
    queries = []

    def query_and_wait(client, query, **kwargs):
        queries.append((kwargs["project"], deepcopy(kwargs["job_config"])))
        return SimpleNamespace(schema=[], total_rows=0, num_dml_affected_rows=None)

    monkeypatch.setattr("google.cloud.bigquery._job_helpers.query_and_wait", query_and_wait)
    args = {"prefer_bqstorage_client": False}
    client = None
    if supplied_client:
        client = Client(
            project="billing-project",
            credentials=AnonymousCredentials(),
            default_query_job_config=QueryJobConfig(maximum_bytes_billed=42, labels={"team": "data-quality"}),
        )
        args["client"] = client
        url = "bigquery://?user_supplied_client=true"
    else:
        url = "bigquery://?maximum_bytes_billed=42&labels=team:data-quality"
    engine = create_engine(url, billing_project_id="billing-project", connect_args=args)
    table, _, metadata = table_context
    bound = bind_connection_to_table(engine, table, metadata)
    try:
        with bound.connect() as connection:
            connection.execute(text("SELECT :limit"), {"limit": 0})
            connection.rollback()
            connection.execute(text("SELECT COUNT(*) FROM `dataset`.`amounts`"))
        for project, job_config in queries:
            assert project == "billing-project"
            assert job_config.maximum_bytes_billed == 42
            assert job_config.labels == {"team": "data-quality"}
            assert job_config.connection_properties[0].value == "target"
        assert len(queries) == 2
        assert queries[0][1].query_parameters[0].value == 0
        assert queries[1][1].query_parameters == []
        assert "job_config" not in engine.get_execution_options()
    finally:
        bound.dispose()
        engine.dispose()
        if client:
            client.close()
