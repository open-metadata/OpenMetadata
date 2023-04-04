#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from metadata.generated.schema.entity.data.table import (Column, DataType,
                                                         Table,
                                                         TableProfilerConfig)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import \
    OpenMetadataConnection
from metadata.generated.schema.entity.services.databaseService import \
    DatabaseConnection
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import \
    DatabaseServiceProfilerPipeline
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.profiler.api.workflow import ProfilerWorkflow
from metadata.profiler.interface.profiler_protocol import ProfilerProtocol
from metadata.profiler.interface.sqlalchemy.sqa_profiler_interface import \
    SQAProfilerInterface
from metadata.profiler.processor.default import DefaultProfiler
from pytest import raises
from sqlalchemy import MetaData
from sqlalchemy.orm import declarative_base

TABLE = Table(
    id=uuid.uuid4(),
    name="users",
    fullyQualifiedName="service.db.users",
    columns=[
        Column(name="id", dataType=DataType.INT),
        Column(name="name", dataType=DataType.STRING),
        Column(name="fullname", dataType=DataType.STRING),
        Column(name="nickname", dataType=DataType.STRING),
        Column(name="age", dataType=DataType.INT),
    ],
    database=EntityReference(id=uuid.uuid4(), name="db", type="database"),
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
    "_convert_table_to_orm_object",
    return_value=User,
)
@patch.object(
    ProfilerWorkflow,
    "_validate_service_name",
    return_value=True,
)
def test_init_workflow(mocked_method, mocked_orm):  # pylint: disable=unused-argument
    """
    We can initialise the workflow from a config
    """
    workflow = ProfilerWorkflow.create(config)
    mocked_method.assert_called()

    assert isinstance(workflow.source_config, DatabaseServiceProfilerPipeline)
    assert isinstance(workflow.metadata_config, OpenMetadataConnection)
    assert isinstance(workflow.profiler_config, ProfilerProcessorConfig)

    assert workflow.profiler_config.profiler is None
    assert workflow.profiler_config.tableConfig is None


@patch.object(
    ProfilerWorkflow,
    "_validate_service_name",
    return_value=True,
)
def test_filter_entities(mocked_method):
    """
    We can properly filter entities depending on the
    workflow configuration
    """
    workflow = ProfilerWorkflow.create(config)
    mocked_method.assert_called()

    service_name = "service"
    schema_reference1 = EntityReference(
        id=uuid.uuid4(), name="one_schema", type="databaseSchema"
    )
    schema_reference2 = EntityReference(
        id=uuid.uuid4(), name="another_schema", type="databaseSchema"
    )

    all_tables = [
        Table(
            id=uuid.uuid4(),
            name="table1",
            databaseSchema=schema_reference1,
            fullyQualifiedName=f"{service_name}.db.{schema_reference1.name}.table1",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        ),
        Table(
            id=uuid.uuid4(),
            name="table2",
            databaseSchema=schema_reference1,
            fullyQualifiedName=f"{service_name}.db.{schema_reference1.name}.table2",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        ),
        Table(
            id=uuid.uuid4(),
            name="table3",
            databaseSchema=schema_reference2,
            fullyQualifiedName=f"{service_name}.db.{schema_reference2.name}.table3",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        ),
    ]

    # Simple workflow does not filter
    assert len(list(workflow.filter_entities(all_tables))) == 3

    # We can exclude based on the schema name
    exclude_config = deepcopy(config)
    exclude_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["another_schema"]
    }

    exclude_workflow = ProfilerWorkflow.create(exclude_config)
    mocked_method.assert_called()
    assert len(list(exclude_workflow.filter_entities(all_tables))) == 2

    exclude_config = deepcopy(config)
    exclude_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["another*"]
    }

    exclude_workflow = ProfilerWorkflow.create(exclude_config)
    mocked_method.assert_called()
    assert len(list(exclude_workflow.filter_entities(all_tables))) == 2

    include_config = deepcopy(config)
    include_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["db*"]
    }

    include_workflow = ProfilerWorkflow.create(include_config)
    mocked_method.assert_called()
    assert len(list(include_workflow.filter_entities(all_tables))) == 3


@patch.object(
    SQAProfilerInterface,
    "_convert_table_to_orm_object",
    return_value=User,
)
@patch.object(
    ProfilerWorkflow,
    "_validate_service_name",
    return_value=True,
)
def test_profile_def(mocked_method, mocked_orm):  # pylint: disable=unused-argument
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

    profiler_interface: SQAProfilerInterface = ProfilerProtocol.create(
        _profiler_type=DatabaseConnection.__name__,
        entity=TABLE,
        entity_config=profile_workflow.get_config_for_entity(TABLE),
        source_config=profile_workflow.source_config,
        service_connection_config=profile_workflow.config.source.serviceConnection.__root__.config,
        ometa_client=None,
        sqa_metadata=MetaData(),
    )

    profile_workflow.create_profiler(TABLE, profiler_interface)
    profiler_obj_metrics = [
        metric.name() for metric in profile_workflow.profiler.metrics
    ]

    assert profile_workflow.profiler_config.profiler
    assert config_metrics_label == profiler_obj_metrics


@patch.object(
    SQAProfilerInterface,
    "_convert_table_to_orm_object",
    return_value=User,
)
@patch.object(
    ProfilerWorkflow,
    "_validate_service_name",
    return_value=True,
)
def test_default_profile_def(
    mocked_method, mocked_orm  # pylint: disable=unused-argument
):
    """
    If no information is specified for the profiler, let's
    use the SimpleTableProfiler and SimpleProfiler
    """

    profile_workflow = ProfilerWorkflow.create(config)
    mocked_method.assert_called()

    profiler_interface: SQAProfilerInterface = ProfilerProtocol.create(
        _profiler_type=DatabaseConnection.__name__,
        entity=TABLE,
        entity_config=profile_workflow.get_config_for_entity(TABLE),
        source_config=profile_workflow.source_config,
        service_connection_config=profile_workflow.config.source.serviceConnection.__root__.config,
        ometa_client=None,
        sqa_metadata=MetaData(),
    )

    profile_workflow.create_profiler(TABLE, profiler_interface)

    assert isinstance(
        profile_workflow.profiler,
        DefaultProfiler,
    )


def test_service_name_validation_raised():
    """Test the service name validation for the profiler
    workflow is raised correctly
    """
    with raises(ValueError, match="Service name `.*` does not exist"):
        ProfilerWorkflow.create(config)
