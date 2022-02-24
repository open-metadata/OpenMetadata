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

import sqlalchemy as sqa
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sqlite import SQLiteConfig
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.orm_profiler.processor.orm_profiler import OrmProfilerProcessor
from metadata.orm_profiler.profiles.models import ProfilerDef
from metadata.orm_profiler.profiles.simple import SimpleProfiler, SimpleTableProfiler

config = {
    "source": {"type": "sqlite", "config": {"service_name": "my_service"}},
    "processor": {"type": "orm-profiler", "config": {}},
    "sink": {"type": "metadata-rest", "config": {}},
    "metadata_server": {
        "type": "metadata-server",
        "config": {
            "api_endpoint": "http://localhost:8585/api",
            "auth_provider_type": "no-auth",
        },
    },
}

workflow = ProfilerWorkflow.create(config)


def test_init_workflow():
    """
    We can initialise the workflow from a config
    """
    assert isinstance(workflow.source_config, SQLiteConfig)
    assert isinstance(workflow.metadata_config, MetadataServerConfig)

    assert isinstance(workflow.processor, OrmProfilerProcessor)
    assert workflow.processor.config.profiler is None
    assert workflow.processor.config.tests is None


def test_filter_entities():
    """
    We can properly filter entities depending on the
    workflow configuration
    """

    service_name = "service"
    db_reference1 = EntityReference(id=uuid.uuid4(), name="one_db", type="database")
    db_reference2 = EntityReference(id=uuid.uuid4(), name="another_db", type="database")

    all_tables = [
        Table(
            id=uuid.uuid4(),
            name="table1",
            database=db_reference1,
            fullyQualifiedName=f"{service_name}.{db_reference1.name}.table1",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        ),
        Table(
            id=uuid.uuid4(),
            name="table2",
            database=db_reference1,
            fullyQualifiedName=f"{service_name}.{db_reference1.name}.table2",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        ),
        Table(
            id=uuid.uuid4(),
            name="table3",
            database=db_reference2,
            fullyQualifiedName=f"{service_name}.{db_reference2.name}.table3",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        ),
    ]

    # Simple workflow does not filter
    assert len(list(workflow.filter_entities(all_tables))) == 3

    # We can exclude based on the schema name
    exclude_filter_schema_config = deepcopy(config)
    exclude_filter_schema_config["source"]["config"]["schema_filter_pattern"] = {
        "excludes": ["one_db"]
    }

    exclude_filter_schema_workflow = ProfilerWorkflow.create(
        exclude_filter_schema_config
    )
    assert len(list(exclude_filter_schema_workflow.filter_entities(all_tables))) == 1

    # We can include based on the schema name
    include_filter_schema_config = deepcopy(config)
    include_filter_schema_config["source"]["config"]["schema_filter_pattern"] = {
        "includes": ["another_db"]
    }

    include_filter_schema_workflow = ProfilerWorkflow.create(
        include_filter_schema_config
    )
    assert len(list(include_filter_schema_workflow.filter_entities(all_tables))) == 1

    # We can exclude based on the table name
    exclude_filter_table_config = deepcopy(config)
    exclude_filter_table_config["source"]["config"]["table_filter_pattern"] = {
        "excludes": ["tab*"]
    }

    exclude_filter_table_workflow = ProfilerWorkflow.create(exclude_filter_table_config)
    assert len(list(exclude_filter_table_workflow.filter_entities(all_tables))) == 0

    # We can include based on the table name
    include_filter_table_config = deepcopy(config)
    include_filter_table_config["source"]["config"]["table_filter_pattern"] = {
        "includes": ["table1"]
    }

    include_filter_table_workflow = ProfilerWorkflow.create(include_filter_table_config)
    assert len(list(include_filter_table_workflow.filter_entities(all_tables))) == 1


def test_profile_def():
    """
    Validate the definitions of the profile in the JSON
    """
    profile_config = deepcopy(config)
    profile_config["processor"]["config"]["profiler"] = {
        "name": "my_profiler",
        "table_metrics": ["row_number"],
        "metrics": ["min", "COUNT", "null_count"],
    }

    profile_workflow = ProfilerWorkflow.create(profile_config)

    profile_definition = ProfilerDef(
        name="my_profiler",
        table_metrics=["ROW_NUMBER"],
        metrics=["MIN", "COUNT", "NULL_COUNT"],
        time_metrics=None,
        custom_metrics=None,
    )

    assert isinstance(profile_workflow.processor, OrmProfilerProcessor)
    assert profile_workflow.processor.config.profiler == profile_definition


def test_default_profile_def():
    """
    If no information is specified for the profiler, let's
    use the SimpleTableProfiler and SimpleProfiler
    """

    profile_workflow = ProfilerWorkflow.create(config)

    assert isinstance(profile_workflow.processor, OrmProfilerProcessor)
    assert profile_workflow.processor.config.profiler is None

    Base = declarative_base()

    class User(Base):
        __tablename__ = "users"
        id = sqa.Column(sqa.Integer, primary_key=True)
        name = sqa.Column(sqa.String(256))
        fullname = sqa.Column(sqa.String(256))
        nickname = sqa.Column(sqa.String(256))
        age = sqa.Column(sqa.Integer)

    assert isinstance(
        profile_workflow.processor.build_table_profiler(User), SimpleTableProfiler
    )
    assert isinstance(
        profile_workflow.processor.build_column_profiler(User, User.name).profiler,
        SimpleProfiler,
    )


def test_tests_def():
    """
    Validate the test case definition
    """
    test_config = deepcopy(config)
    test_config["processor"]["config"]["tests"] = {
        "name": "my_tests",
        "table_tests": [
            {
                "name": "first_test",
                "table": "service.db.name",
                "expression": "row_number > 100",
                "enabled": False,
            },
            {
                "name": "another_test",
                "table": "service.db.name",
                "expression": "row_number > 1000 & row_number < 2000",
            },
        ],
        "column_tests": [
            {
                "table": "service.db.name",
                "name": "set_of_col_tests",
                "columns": [
                    {
                        "name": "first_col_test",
                        "column": "column_name_1",
                        "expression": "min > 5",
                    },
                    {
                        "name": "another_col_test",
                        "column": "column_name_1",
                        "expression": "min > 5 & min < 10",
                    },
                    {
                        "name": "second_col_test",
                        "column": "column_name_2",
                        "expression": "null_ratio < 0.1",
                    },
                ],
            }
        ],
    }

    test_workflow = ProfilerWorkflow.create(test_config)

    assert isinstance(test_workflow.processor, OrmProfilerProcessor)
    tests = test_workflow.processor.config.tests

    assert tests.name == "my_tests"

    # Check cardinality
    assert len(tests.table_tests) == 2
    assert len(tests.column_tests) == 1
    assert len(tests.column_tests[0].columns) == 3

    assert tests.table_tests[0].name == "first_test"
    assert tests.table_tests[0].table == "service.db.name"
    assert tests.table_tests[0].expression[0].metric == "ROWNUMBER"
    assert not tests.table_tests[0].enabled

    assert tests.column_tests[0].columns[0].name == "first_col_test"
    assert tests.column_tests[0].columns[0].column == "column_name_1"
    assert tests.column_tests[0].columns[0].expression[0].metric == "MIN"
    assert tests.column_tests[0].columns[0].enabled

    # We cannot do a 1:1 general assertion because we are dynamically
    # creating the Validation classes. Then, the internal IDs don't match
    # and the assertion fails. However, and for visual representation,
    # the resulting class looks like follows:

    # TestDef(
    #     name="my_tests",
    #     table_tests=[
    #         # I can have multiple tests on the same table
    #         TableTest(
    #             name="first_test",
    #             table="service.db.name",
    #             expression="row_number > 100",  # This will be one Validation
    #             enabled=False,
    #         ),
    #         TableTest(
    #             name="another_test",
    #             table="service.db.name",
    #             expression="row_number > 1000 & row_number < 2000",  # This will be two Validations
    #         ),
    #     ],
    #     column_tests=[
    #         ColumnTest(
    #             table="service.db.name",
    #             name="set_of_col_tests",
    #             columns=[
    #                 ColumnTestExpression(
    #                     name="first_col_test",
    #                     column="column_name_1",
    #                     expression="min > 5",  # One Validation
    #                 ),
    #                 ColumnTestExpression(
    #                     name="another_col_test",
    #                     column="column_name_1",
    #                     expression="min > 5 & min < 10",  # Two Validations
    #                 ),
    #                 ColumnTestExpression(
    #                     name="second_col_test",
    #                     column="column_name_2",
    #                     expression="null_ratio < 0.1",  # One Validation
    #                 ),
    #             ],
    #         )
    #     ],
    # )
