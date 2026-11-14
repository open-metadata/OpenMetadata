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
"""The registered BigQuery DQ adapter qualifies data independently of billing."""

from copy import deepcopy
from importlib import import_module
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from google.api_core.exceptions import BadRequest
from google.auth.credentials import AnonymousCredentials
from google.cloud.bigquery import Client, ConnectionProperty, QueryJobConfig, SchemaField
from google.cloud.bigquery.table import RowIterator
from sqlalchemy import create_engine, func, select, text

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.generated.schema.configuration.profilerConfiguration import SampleDataIngestionConfig
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import EntityType, TestDefinition
from metadata.generated.schema.type.samplingConfig import ProfileSampleConfig
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.models import SampleConfig
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.utils.bigquery_utils import copy_service_config
from metadata.utils.profiler_utils import database_entities_cache
from metadata.utils.service_spec.service_spec import import_sampler_class, import_test_suite_class


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


@pytest.fixture(params=["driver", "supplied_client"])
def sdk_engine(monkeypatch, request):
    monkeypatch.setattr("google.auth.default", lambda **_: (AnonymousCredentials(), "decoy-project"))
    defaults = QueryJobConfig(
        maximum_bytes_billed=42,
        labels={"team": "dq"},
        connection_properties=[
            ConnectionProperty(key="time_zone", value="America/Los_Angeles"),
            ConnectionProperty(key="dataset_project_id", value="stale-project"),
        ],
    )
    client = None
    if request.param == "supplied_client":
        client = Client(
            project="billing-project", credentials=AnonymousCredentials(), default_query_job_config=defaults
        )
        engine = create_engine(
            "bigquery://?user_supplied_client=true", connect_args={"client": client, "prefer_bqstorage_client": False}
        )
    else:
        engine = create_engine(
            "bigquery://decoy-project/dataset?maximum_bytes_billed=42&labels=team:dq",
            billing_project_id="billing-project",
            connect_args={"prefer_bqstorage_client": False},
        )
    # These options must survive the DQ-owned schema-map merge without mutation.
    schema_map = {"unrelated": "untouched", "dataset": "wrong.dataset"}
    engine = engine.execution_options(schema_translate_map=schema_map, application_option="retained")
    queries = []

    def boundary(active, query, **kwargs):
        queries.append((active, query, deepcopy(kwargs)))
        if "missing_column" in query:
            raise BadRequest("Unrecognized name: missing_column")
        count = "count(" in query.lower()
        schema = [SchemaField("count" if count else "amount", "INTEGER")]
        rows = [{"f": [{"v": "2" if count else "-1"}]}]
        return RowIterator(
            client=active,
            api_request=None,
            path="/offline/query",
            schema=schema,
            total_rows=1,
            first_page_response={"rows": rows, "totalRows": "1"},
        )

    monkeypatch.setattr("google.cloud.bigquery._job_helpers.query_and_wait", boundary)
    for module in [
        "metadata.sampler.sqlalchemy.sampler",
        "metadata.data_quality.interface.sqlalchemy.bigquery.test_suite_interface",
    ]:
        monkeypatch.setattr(import_module(module), "get_ssl_connection", lambda _: engine)
    yield engine, queries, client, schema_map
    engine.dispose()
    if client:
        client.close()


def construct(table_context, sdk_engine, sample_config=None):
    table, _, metadata = table_context
    config = workflow({"type": "external_account", "audience": "offline"}).source.serviceConnection.root.config
    sampler = import_sampler_class(ServiceType.Database, "bigquery")(
        config, metadata, table, config=DatabaseSamplerConfig(sample_config=sample_config) if sample_config else None
    )
    suite = import_test_suite_class(ServiceType.Database, "bigquery")(
        config,
        metadata,
        sampler,
        table,
        validator_builder=ValidatorBuilder,
        sample_data_config=SampleDataIngestionConfig(storeSampleData=False),
    )
    return suite, sampler


def close(suite, sampler):
    suite.session.close()
    sampler.close()


@pytest.mark.parametrize("entity_type", [EntityType.TABLE, EntityType.COLUMN])
@pytest.mark.parametrize("warm_pool", [False, True])
def test_registered_rules_keep_data_billing_defaults_and_recover(table_context, sdk_engine, entity_type, warm_pool):
    engine, queries, client, schema_map = sdk_engine
    table, _, metadata = table_context
    original = table.model_dump()
    if warm_pool:
        with engine.connect():
            pass
    defaults_before = client.default_query_job_config.to_api_repr() if client else None
    suite, sampler = construct(table_context, sdk_engine)
    raw = sampler.raw_dataset
    raw_table = raw.__table__
    shape = (raw_table.schema, list(raw_table.columns), list(raw_table.primary_key), raw_table.name)
    definition = TestDefinition(
        id=uuid4(),
        name="amountRule",
        fullyQualifiedName="amountRule",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        validatorClass=f"{entity_type.value.title()}RuleLibrarySqlExpressionValidator",
        parameterDefinition=[{"name": "thresholdUnit", "dataType": "STRING"}],
        sqlExpression="SELECT * FROM {{ table_name }} WHERE amount < 0",
    )
    metadata.get_by_name.return_value = definition
    original_lookup = metadata.get_by_id.side_effect
    metadata.get_by_id.side_effect = lambda entity, *args, **kwargs: (
        definition if entity is TestDefinition else original_lookup(entity, **kwargs)
    )
    link = "<#E::table::bigquery.target.dataset.amounts" + (
        "::columns::amount>" if entity_type is EntityType.COLUMN else ">"
    )

    def run(threshold, expression=None):
        if expression:
            definition.sqlExpression = type(definition.sqlExpression)(expression)
        case = TestCase(
            name="amount_rule",
            entityLink=link,
            testDefinition={"id": definition.id, "type": "testDefinition", "fullyQualifiedName": "amountRule"},
            testSuite={"id": uuid4(), "type": "testSuite"},
            parameterValues=[
                {"name": "thresholdUnit", "value": "PERCENTAGE"},
                {"name": "threshold", "value": str(threshold)},
            ],
        )
        return suite.run_test_case(case).testCaseResult

    try:
        assert queries == []  # inherited runner/timeout construction remains lazy
        assert suite.runner.table is raw
        assert suite.session.get_bind().get_execution_options()["schema_translate_map"] == {
            "unrelated": "untouched",
            "dataset": "target.dataset",
        }
        assert suite.session.get_bind().get_execution_options()["application_option"] == "retained"
        assert run(49).testCaseStatus is TestCaseStatus.Failed
        assert run(50).testCaseStatus is TestCaseStatus.Success
        assert (
            run(50, "SELECT * FROM {{ table_name }} WHERE missing_column < 0").testCaseStatus is TestCaseStatus.Aborted
        )
        assert run(50, "SELECT * FROM {{ table_name }} WHERE amount < 0").testCaseStatus is TestCaseStatus.Success
        suite.session.rollback()
        suite.session.execute(select(func.count()).select_from(raw)).scalar()
        suite.session.close()
        suite.session.execute(
            text(f"SELECT * FROM {suite.runner.get_table_reference()} WHERE amount < :limit"), {"limit": 0}
        )
        for active, query, kwargs in queries:
            assert "`target.dataset`.`amounts`" in query
            assert "wrong.dataset" not in query
            assert active.project == kwargs["project"] == "billing-project"
            job = kwargs["job_config"]
            assert job.maximum_bytes_billed == 42
            assert job.labels == {"team": "dq"}
            if client:
                assert {prop.key: prop.value for prop in job.connection_properties} == {
                    "time_zone": "America/Los_Angeles",
                    "dataset_project_id": "stale-project",
                }
        assert queries[-1][2]["job_config"].query_parameters[0].value == 0
        assert sampler.raw_dataset is raw and raw.__table__ is raw_table
        assert (raw_table.schema, list(raw_table.columns), list(raw_table.primary_key), raw_table.name) == shape
        assert table.model_dump() == original
        assert engine.get_execution_options()["schema_translate_map"] is schema_map
        assert schema_map == {"unrelated": "untouched", "dataset": "wrong.dataset"}
        if client:
            assert client.default_query_job_config.to_api_repr() == defaults_before
    finally:
        close(suite, sampler)


def test_two_dq_targets_keep_independent_maps(table_context, sdk_engine):
    engine, queries, _, schema_map = sdk_engine
    first, sampler = construct(table_context, sdk_engine)
    table, database, metadata = table_context
    database.name = "other-target"
    database_entities_cache.clear()
    second = import_test_suite_class(ServiceType.Database, "bigquery")(
        first.service_connection_config, metadata, sampler, table, validator_builder=ValidatorBuilder
    )
    try:
        for suite, project in [(first, "target"), (second, "other-target"), (first, "target")]:
            assert suite.runner.get_table_reference() == f"`{project}.dataset`.`amounts`"
            suite.session.execute(select(func.count()).select_from(sampler.raw_dataset)).scalar()
            assert f"`{project}.dataset`.`amounts`" in queries[-1][1]
            suite.session.rollback()
        assert engine.get_execution_options()["schema_translate_map"] is schema_map
    finally:
        second.session.close()
        close(first, sampler)


@pytest.mark.parametrize("missing", ["table", "database_ref", "schema_ref", "database_lookup", "schema_lookup"])
def test_missing_context_fails_before_engine_creation(table_context, monkeypatch, missing):
    table, _, metadata = table_context
    if missing == "table":
        table = None
    elif missing.endswith("_ref"):
        setattr(table, "database" if missing == "database_ref" else "databaseSchema", None)
    else:
        original = metadata.get_by_id.side_effect
        absent = Database if missing == "database_lookup" else DatabaseSchema
        metadata.get_by_id.side_effect = lambda entity, **kwargs: (
            None if entity is absent else original(entity, **kwargs)
        )

    def no_engine(_):
        raise AssertionError("engine created before validating metadata context")

    monkeypatch.setattr(
        import_module("metadata.data_quality.interface.sqlalchemy.bigquery.test_suite_interface"),
        "get_ssl_connection",
        no_engine,
    )
    with pytest.raises(ValueError, match=r"BigQuery.*(database|schema)"):
        import_test_suite_class(ServiceType.Database, "bigquery")(
            workflow({"type": "gcp_adc"}).source.serviceConnection.root.config,
            metadata,
            MagicMock(),
            table,
            validator_builder=ValidatorBuilder,
        )


@pytest.mark.parametrize("projects,expected", [(None, None), ("decoy", "decoy"), (["decoy", "target"], "target")])
def test_project_copy_retains_baseline_inline_policy(projects, expected):
    config = workflow({"type": "service_account", "projectId": projects})
    before = config.model_dump()
    copied = copy_service_config(config, "target")
    actual = copied.credentials.gcpConfig.projectId
    assert (actual.root if actual else None) == expected
    assert config.model_dump() == before


@pytest.mark.parametrize("sampling", [None, "PERCENTAGE", "ROWS"])
def test_lazy_dataset_construction_uses_dq_map(table_context, sdk_engine, sampling):
    sample = (
        SampleConfig(
            randomizedSample=False,
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType="STATIC", config=StaticSamplingConfig(profileSampleType=sampling, profileSample=10)
            ),
        )
        if sampling
        else None
    )
    suite, sampler = construct(table_context, sdk_engine, sample)
    _, queries, _, _ = sdk_engine
    try:
        assert queries == []
        suite.session.execute(select(suite.dataset)).fetchall()
        assert "`target.dataset`.`amounts`" in queries[-1][1]
    finally:
        close(suite, sampler)


@pytest.mark.parametrize("name", ["order.items", "select", "MixedCase", "percent%name", "colon:name"])
def test_session_binding_keeps_original_mapped_shape(table_context, sdk_engine, name):
    table, _, metadata = table_context
    table.name = type(table.name)(name)
    config = workflow({"type": "gcp_adc", "projectId": "decoy-project"}).source.serviceConnection.root.config
    before_config = config.model_dump()
    before_table = table.model_dump()
    sampler = import_sampler_class(ServiceType.Database, "bigquery")(config, metadata, table)
    raw = sampler.raw_dataset
    mapped = raw.__table__
    columns = [(column, column.key, column.name, column.name.quote, column.primary_key) for column in mapped.columns]
    shape = (mapped.schema, mapped.schema.quote, mapped.name, mapped.name.quote, columns, list(mapped.primary_key))
    suite = import_test_suite_class(ServiceType.Database, "bigquery")(
        config, metadata, sampler, table, validator_builder=ValidatorBuilder
    )
    try:
        assert suite.runner.table is raw
        assert raw.__table__ is mapped
        assert (
            mapped.schema,
            mapped.schema.quote,
            mapped.name,
            mapped.name.quote,
            [(column, column.key, column.name, column.name.quote, column.primary_key) for column in mapped.columns],
            list(mapped.primary_key),
        ) == shape
        assert suite.runner.table_name == name
        assert suite.runner.schema_name == "dataset"
        assert config.model_dump() == before_config
        assert table.model_dump() == before_table
    finally:
        close(suite, sampler)


@pytest.mark.parametrize("schema_map", [None, {}])
def test_dq_binding_without_inherited_translation(table_context, sdk_engine, monkeypatch, schema_map):
    engine, queries, _, _ = sdk_engine
    engine = engine.execution_options(schema_translate_map=schema_map)
    monkeypatch.setattr(
        import_module("metadata.data_quality.interface.sqlalchemy.bigquery.test_suite_interface"),
        "get_ssl_connection",
        lambda _: engine,
    )
    suite, sampler = construct(table_context, sdk_engine)
    try:
        suite.session.execute(select(func.count()).select_from(sampler.raw_dataset)).scalar()
        assert "`target.dataset`.`amounts`" in queries[-1][1]
        assert engine.get_execution_options()["schema_translate_map"] is schema_map
    finally:
        close(suite, sampler)
