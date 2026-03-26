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

"""
Validate workflow configs and filters
"""
import uuid
from copy import deepcopy
from unittest.mock import patch

import sqlalchemy as sqa
from pytest import raises
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
    TableProfilerConfig,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.status import Status
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.converter import base
from metadata.profiler.source.database.base.profiler_source import ProfilerSource
from metadata.profiler.source.fetcher.fetcher_strategy import (
    DatabaseFetcherStrategy,
    _build_regex_from_filter,
)
from metadata.profiler.source.metadata import OpenMetadataSource
from metadata.utils.filters import InvalidPatternException
from metadata.workflow.profiler import ProfilerWorkflow

TABLE = Table(
    id=uuid.uuid4(),
    name="users",
    fullyQualifiedName="my_service.db.users",
    columns=[
        Column(name="id", dataType=DataType.INT),
        Column(name="name", dataType=DataType.STRING),
        Column(name="fullname", dataType=DataType.STRING),
        Column(name="nickname", dataType=DataType.STRING),
        Column(name="age", dataType=DataType.INT),
    ],
    database=EntityReference(id=uuid.uuid4(), name="db", type="database"),
    databaseSchema=EntityReference(
        id=uuid.uuid4(), name="schema", type="databaseSchema"
    ),
    tableProfilerConfig=TableProfilerConfig(
        profileSample=80.0,
    ),  # type: ignore
)  # type: ignore

config = {
    "source": {
        "type": "sqlite",
        "serviceName": "my_service",
        "serviceConnection": {"config": {"type": "SQLite"}},
        "sourceConfig": {"config": {"type": "Profiler"}},
    },
    "processor": {"type": "orm-profiler", "config": {}},
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": (
                    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1"
                    "QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib"
                    "3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blb"
                    "m1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREk"
                    "qVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq"
                    "91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMe"
                    "QaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133i"
                    "ikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
                )
            },
        }
    },
}


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = sqa.Column(sqa.Integer, primary_key=True)
    name = sqa.Column(sqa.String(256))
    fullname = sqa.Column(sqa.String(256))
    nickname = sqa.Column(sqa.String(256))
    age = sqa.Column(sqa.Integer)


@patch.object(
    ProfilerWorkflow,
    "test_connection",
)
@patch.object(
    SQAProfilerInterface,
    "table",
    new_callable=lambda: User,
)
@patch.object(
    OpenMetadataSource,
    "_validate_service_name",
    return_value=True,
)
def test_init_workflow(mocked_method, *_):  # pylint: disable=unused-argument
    """
    We can initialise the workflow from a config
    """
    workflow = ProfilerWorkflow.create(config)
    mocked_method.assert_called()

    assert isinstance(workflow.source.source_config, DatabaseServiceProfilerPipeline)
    assert isinstance(workflow.workflow_config, WorkflowConfig)

    profiler_processor_step = workflow.steps[0]
    assert isinstance(profiler_processor_step.profiler_config, ProfilerProcessorConfig)

    assert profiler_processor_step.profiler_config.profiler is None
    assert profiler_processor_step.profiler_config.tableConfig is None


def test_build_regex_from_filter():
    """Verify _build_regex_from_filter builds correct RegexFilter from FilterPattern"""
    assert _build_regex_from_filter(None) is None
    assert _build_regex_from_filter(FilterPattern()) is None

    result = _build_regex_from_filter(FilterPattern(includes=["finance"]))
    assert result is not None
    assert result.regex == "finance"
    assert result.mode == "include"

    result = _build_regex_from_filter(FilterPattern(excludes=["temp.*"]))
    assert result is not None
    assert result.regex == "temp.*"
    assert result.mode == "exclude"

    result = _build_regex_from_filter(FilterPattern(includes=["finance.*", "sales.*"]))
    assert result is not None
    assert result.regex == "(finance.*)|(sales.*)"
    assert result.mode == "include"

    # Includes take precedence over excludes
    result = _build_regex_from_filter(
        FilterPattern(includes=["finance"], excludes=["temp.*"])
    )
    assert result is not None
    assert result.regex == "finance"
    assert result.mode == "include"

    # Invalid regex in includes raises InvalidPatternException
    with raises(InvalidPatternException, match="Invalid regex"):
        _build_regex_from_filter(FilterPattern(includes=["[invalid"]))

    # Invalid regex in excludes raises InvalidPatternException
    with raises(InvalidPatternException, match="Invalid regex"):
        _build_regex_from_filter(FilterPattern(excludes=["(unclosed"]))


def test_build_database_params():
    """Verify that database filter patterns are correctly translated to API params"""
    # No filter pattern -> only service param
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**config), None, None, Status())  # type: ignore
    params = fetcher._build_database_params()
    assert params == {"service": "my_service"}

    # Include filter -> databaseRegex with include mode
    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["db.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**include_config), None, None, Status())  # type: ignore
    params = fetcher._build_database_params()
    assert params["databaseRegex"] == "db.*"
    assert params["regexMode"] == "include"
    assert "regexFilterByFqn" not in params

    # Exclude filter -> databaseRegex with exclude mode
    exclude_config = deepcopy(config)
    exclude_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "excludes": ["temp.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**exclude_config), None, None, Status())  # type: ignore
    params = fetcher._build_database_params()
    assert params["databaseRegex"] == "temp.*"
    assert params["regexMode"] == "exclude"

    # Multiple includes -> combined with OR
    multi_config = deepcopy(config)
    multi_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["finance.*", "sales.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**multi_config), None, None, Status())  # type: ignore
    params = fetcher._build_database_params()
    assert params["databaseRegex"] == "(finance.*)|(sales.*)"
    assert params["regexMode"] == "include"

    # useFqnForFiltering -> regexFilterByFqn param
    fqn_config = deepcopy(config)
    fqn_config["source"]["sourceConfig"]["config"]["useFqnForFiltering"] = True
    fqn_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["my_service.db.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**fqn_config), None, None, Status())  # type: ignore
    params = fetcher._build_database_params()
    assert params["regexFilterByFqn"] == "true"


def test_build_table_params():
    """Verify that schema/table filter patterns are correctly translated to API params"""
    database = Database(
        id=uuid.uuid4(),
        name="db",
        fullyQualifiedName="my_service.db",
        service=EntityReference(
            id=uuid.uuid4(), name="my_service", type="databaseService"
        ),
    )

    # No filter pattern -> only service and database params
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**config), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params == {"service": "my_service", "database": "my_service.db"}

    # Schema include filter
    schema_config = deepcopy(config)
    schema_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "includes": ["one_schema"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**schema_config), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params["databaseSchemaRegex"] == "one_schema"
    assert params["regexMode"] == "include"
    assert "tableRegex" not in params

    # Table exclude filter
    table_config = deepcopy(config)
    table_config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
        "excludes": ["temp.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**table_config), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params["tableRegex"] == "temp.*"
    assert params["regexMode"] == "exclude"
    assert "databaseSchemaRegex" not in params

    # Both schema and table filters
    both_config = deepcopy(config)
    both_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "includes": ["finance"]
    }
    both_config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
        "includes": ["orders.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**both_config), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params["databaseSchemaRegex"] == "finance"
    assert params["tableRegex"] == "orders.*"
    assert params["regexMode"] == "include"

    # useFqnForFiltering with schema filter
    fqn_config = deepcopy(config)
    fqn_config["source"]["sourceConfig"]["config"]["useFqnForFiltering"] = True
    fqn_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["my_service.db.another_schema"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**fqn_config), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params["databaseSchemaRegex"] == "my_service.db.another_schema"
    assert params["regexMode"] == "exclude"
    assert params["regexFilterByFqn"] == "true"

    conflict_config = deepcopy(config)
    conflict_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "includes": ["finance"]
    }
    conflict_config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
        "excludes": ["temp.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**conflict_config), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params["databaseSchemaRegex"] == "finance"
    assert params["regexMode"] == "include"
    assert "tableRegex" not in params

    # Conflicting modes: schema=exclude, table=include -> only include goes to backend
    conflict_config2 = deepcopy(config)
    conflict_config2["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["hr"]
    }
    conflict_config2["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
        "includes": ["orders.*"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**conflict_config2), None, None, Status())  # type: ignore
    params = fetcher._build_table_params(database)
    assert params["tableRegex"] == "orders.*"
    assert params["regexMode"] == "include"
    assert "databaseSchemaRegex" not in params


def test_filter_classifications():
    """Classification filtering still works client-side in _get_table_entities"""
    service_name = "my_service"

    schema_reference = EntityReference(
        id=uuid.uuid4(),
        name="schema",
        type="databaseSchema",
        fullyQualifiedName=f"{service_name}.db.schema",
    )

    all_tables = [
        Table(
            id=uuid.uuid4(),
            name="table1",
            databaseSchema=schema_reference,
            fullyQualifiedName=f"{service_name}.db.schema.table1",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
            database=EntityReference(id=uuid.uuid4(), name="db", type="database"),
            tags=[
                TagLabel(
                    labelType="Manual",
                    name="tag1",
                    tagFQN="tag1",
                    state="Confirmed",
                    source="Classification",
                ),
                TagLabel(
                    labelType="Manual",
                    name="tag2",
                    tagFQN="tag2",
                    state="Confirmed",
                    source="Classification",
                ),
            ],
        ),
        Table(
            id=uuid.uuid4(),
            name="table2",
            databaseSchema=schema_reference,
            fullyQualifiedName=f"{service_name}.db.schema.table2",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
            database=EntityReference(id=uuid.uuid4(), name="db", type="database"),
            tags=[
                TagLabel(
                    labelType="Manual",
                    name="tag2",
                    tagFQN="tag2",
                    state="Confirmed",
                    source="Classification",
                ),
            ],
        ),
        Table(
            id=uuid.uuid4(),
            name="table3",
            databaseSchema=schema_reference,
            fullyQualifiedName=f"{service_name}.db.schema.table3",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
            database=EntityReference(id=uuid.uuid4(), name="db", type="database"),
        ),
    ]

    # Include classification -> only tables with matching tags
    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"][
        "classificationFilterPattern"
    ] = {"includes": ["tag*"]}
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**include_config), None, None, Status())  # type: ignore
    filtered = [t for t in all_tables if not fetcher.filter_classifications(t)]
    assert len(filtered) == 2

    # Exclude classification
    exclude_config = deepcopy(config)
    exclude_config["source"]["sourceConfig"]["config"][
        "classificationFilterPattern"
    ] = {"excludes": ["tag2"]}
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**exclude_config), None, None, Status())  # type: ignore
    filtered = [t for t in all_tables if not fetcher.filter_classifications(t)]
    assert len(filtered) == 1

    # Both includes and excludes
    both_config = deepcopy(config)
    both_config["source"]["sourceConfig"]["config"]["classificationFilterPattern"] = {
        "excludes": ["tag1"],
        "includes": ["tag2"],
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**both_config), None, None, Status())  # type: ignore
    filtered = [t for t in all_tables if not fetcher.filter_classifications(t)]
    assert len(filtered) == 1


@patch.object(ProfilerWorkflow, "test_connection")
@patch.object(
    base,
    "get_orm_database",
    return_value="db",
)
@patch.object(
    base,
    "get_orm_schema",
    return_value="schema",
)
@patch.object(
    SQAProfilerInterface,
    "table",
    new_callable=lambda: User,
)
@patch.object(
    OpenMetadataSource,
    "_validate_service_name",
    return_value=True,
)
@patch("metadata.profiler.source.database.base.profiler_source.get_context_entities")
def test_profile_def(
    mock_context_entities, mocked_method, *_
):  # pylint: disable=unused-argument
    """
    Validate the definitions of the profile in the JSON
    """
    mock_context_entities.return_value = (None, None, None)

    profile_config = deepcopy(config)
    config_metrics = ["rowCount", "min", "valuesCount", "nullCount"]
    config_metrics_label = ["rowCount", "min", "valuesCount", "nullCount"]
    profile_config["processor"]["config"]["profiler"] = {
        "name": "my_profiler",
        "metrics": config_metrics,
    }

    profile_workflow = ProfilerWorkflow.create(profile_config)
    mocked_method.assert_called()

    profiler_processor_step = profile_workflow.steps[0]

    profiler_source = ProfilerSource(
        profile_workflow.config,
        Database(
            id=uuid.uuid4(),
            name="myDataBaseService",
            service=EntityReference(
                id=uuid.uuid4(), name="my_service", type="databaseService"
            ),
        ),
        profile_workflow.metadata,
        None,
    )
    profiler_runner = profiler_source.get_profiler_runner(
        TABLE, profiler_processor_step.profiler_config
    )

    # profile_workflow.create_profiler(TABLE, profiler_interface)
    profiler_obj_metrics = [metric.name() for metric in profiler_runner.metrics]

    assert profiler_processor_step.profiler_config.profiler
    assert config_metrics_label == profiler_obj_metrics


@patch.object(ProfilerWorkflow, "test_connection")
@patch.object(
    OpenMetadataSource,
    "_validate_service_name",
    return_value=None,
)
def test_service_name_validation_raised(*_):
    """Test the service name validation for the profiler
    workflow is raised correctly
    """
    with raises(ValueError, match="Service name `.*` does not exist"):
        ProfilerWorkflow.create(config)
