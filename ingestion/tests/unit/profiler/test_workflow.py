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
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.status import Status
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.converter import base
from metadata.profiler.processor.default import DefaultProfiler
from metadata.profiler.source.database.base.profiler_source import ProfilerSource
from metadata.profiler.source.fetcher.fetcher_strategy import DatabaseFetcherStrategy
from metadata.profiler.source.metadata import OpenMetadataSource
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

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = sqa.Column(sqa.Integer, primary_key=True)
    name = sqa.Column(sqa.String(256))
    fullname = sqa.Column(sqa.String(256))
    nickname = sqa.Column(sqa.String(256))
    age = sqa.Column(sqa.Integer)


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


def test_filter_entities():
    """
    We can properly filter entities depending on the
    workflow configuration
    """
    service_name = "my_service"

    schema_reference1 = EntityReference(
        id=uuid.uuid4(),
        name="one_schema",
        type="databaseSchema",
        fullyQualifiedName=f"{service_name}.db.one_schema",
    )
    schema_reference2 = EntityReference(
        id=uuid.uuid4(),
        name="another_schema",
        type="databaseSchema",
        fullyQualifiedName=f"{service_name}.db.another_schema",
    )

    all_tables = [
        Table(
            id=uuid.uuid4(),
            name="table1",
            databaseSchema=schema_reference1,
            fullyQualifiedName=f"{service_name}.db.{schema_reference1.name}.table1",
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
            databaseSchema=schema_reference1,
            fullyQualifiedName=f"{service_name}.db.{schema_reference1.name}.table2",
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
            databaseSchema=schema_reference2,
            fullyQualifiedName=f"{service_name}.db.{schema_reference2.name}.table3",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
            database=EntityReference(id=uuid.uuid4(), name="db", type="database"),
        ),
    ]

    # Simple workflow does not filter
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 3

    fqn_filter_config = deepcopy(config)
    fqn_filter_config["source"]["sourceConfig"]["config"]["useFqnForFiltering"] = True
    fqn_filter_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["my_service.db.another_schema"]
    }

    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**fqn_filter_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 2

    fqn_filter_config_2 = deepcopy(config)
    fqn_filter_config_2["source"]["sourceConfig"]["config"]["useFqnForFiltering"] = True
    fqn_filter_config_2["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "includes": ["my_service.db.one_schema"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**fqn_filter_config_2), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 2

    fqn_filter_config_3 = deepcopy(config)
    fqn_filter_config_3["source"]["sourceConfig"]["config"]["useFqnForFiltering"] = True
    fqn_filter_config_3["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
        "includes": ["my_service.db.one_schema.table1"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**fqn_filter_config_3), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 1

    fqn_filter_config_4 = deepcopy(config)
    fqn_filter_config_4["source"]["sourceConfig"]["config"]["useFqnForFiltering"] = True
    fqn_filter_config_4["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
        "excludes": ["my_service.db.one_schema.table1"]
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**fqn_filter_config_4), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 2

    # We can exclude based on the schema name
    exclude_config = deepcopy(config)
    exclude_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["another_schema"]
    }

    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**exclude_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 2

    exclude_config = deepcopy(config)
    exclude_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["another*"]
    }

    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**exclude_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 2

    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["db*"]
    }

    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**include_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 3

    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"][
        "classificationFilterPattern"
    ] = {"includes": ["tag*"]}
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**include_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 2

    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"][
        "classificationFilterPattern"
    ] = {"excludes": ["tag2"]}
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**include_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 1

    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"][
        "classificationFilterPattern"
    ] = {
        "excludes": ["tag1"],
        "includes": ["tag2"],
    }
    fetcher = DatabaseFetcherStrategy(OpenMetadataWorkflowConfig(**include_config), None, None, Status())  # type: ignore
    assert len(fetcher._filter_entities(all_tables)) == 1


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
def test_profile_def(mocked_method, *_):  # pylint: disable=unused-argument
    """
    Validate the definitions of the profile in the JSON
    """
    profile_config = deepcopy(config)
    config_metrics = ["row_count", "min", "COUNT", "null_count"]
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
def test_default_profile_def(mocked_method, *_):  # pylint: disable=unused-argument
    """
    If no information is specified for the profiler, let's
    use the SimpleTableProfiler and SimpleProfiler
    """

    profile_workflow = ProfilerWorkflow.create(config)
    mocked_method.assert_called()

    profiler_processor_step = profile_workflow.steps[0]

    profiler_source = ProfilerSource(
        profile_workflow.config,
        DatabaseService(
            id=uuid.uuid4(),
            name="myDataBaseService",
            serviceType=DatabaseServiceType.SQLite,
        ),  # type: ignore
        profile_workflow.metadata,
        None,
    )
    profiler_runner = profiler_source.get_profiler_runner(
        TABLE, profiler_processor_step.profiler_config
    )

    assert isinstance(
        profiler_runner,
        DefaultProfiler,
    )


def test_service_name_validation_raised():
    """Test the service name validation for the profiler
    workflow is raised correctly
    """
    with raises(ValueError, match="Service name `.*` does not exist"):
        ProfilerWorkflow.create(config)
