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
OpenMetadata API test suite mixin test
"""
from datetime import datetime, timezone

import pytest

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.api.tests.createTestSuite import (
    CreateTestSuiteRequest,
    TestSuiteEntityName,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase as OMetaTestCase
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.basic import (
    EntityLink,
    FullyQualifiedEntityName,
    Markdown,
    TestCaseEntityName,
)
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

from ..integration_base import generate_name, get_create_entity, get_create_service
from .conftest import _safe_delete


@pytest.fixture(scope="module")
def ts_service(metadata):
    """Module-scoped database service for test suite tests."""
    service_name = generate_name()
    service = metadata.create_or_update(
        data=get_create_service(entity=DatabaseService, name=service_name)
    )
    yield service

    _safe_delete(
        metadata,
        entity=DatabaseService,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def ts_database(metadata, ts_service):
    """Module-scoped database for test suite tests."""
    db = metadata.create_or_update(
        data=get_create_entity(entity=Database, reference=ts_service.fullyQualifiedName)
    )
    return db


@pytest.fixture(scope="module")
def ts_schema(metadata, ts_database):
    """Module-scoped schema for test suite tests."""
    schema = metadata.create_or_update(
        data=get_create_entity(
            entity=DatabaseSchema, reference=ts_database.fullyQualifiedName
        )
    )
    return schema


@pytest.fixture(scope="module")
def ts_table(metadata, ts_schema):
    """Module-scoped table for test suite tests."""
    table = metadata.create_or_update(
        data=get_create_entity(entity=Table, reference=ts_schema.fullyQualifiedName)
    )
    return table


@pytest.fixture(scope="module")
def test_suite_definition(metadata):
    """Module-scoped test definition for test suite tests."""
    name = generate_name()
    test_definition = metadata.create_or_update(
        CreateTestDefinitionRequest(
            name=TestCaseEntityName(name.root),
            description=Markdown(
                root="this is a test definition for integration tests"
            ),
            entityType=EntityType.TABLE,
            testPlatforms=[TestPlatform.GreatExpectations],
            parameterDefinition=[TestCaseParameterDefinition(name="foo")],
        )
    )

    yield test_definition

    _safe_delete(
        metadata,
        entity=TestDefinition,
        entity_id=test_definition.id,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_suite_entity(metadata, ts_table, test_suite_definition):
    """Module-scoped executable test suite bound to our own table."""
    table_fqn = ts_table.fullyQualifiedName.root
    test_suite = metadata.create_or_update_executable_test_suite(
        CreateTestSuiteRequest(
            name=TestSuiteEntityName(root=f"{table_fqn}.TestSuite"),
            description=Markdown(root="This is a test suite for the integration tests"),
            basicEntityReference=FullyQualifiedEntityName(table_fqn),
        )
    )

    yield test_suite

    metadata.delete_executable_test_suite(
        entity=TestSuite,
        entity_id=test_suite.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_case_entity(metadata, ts_table, test_suite_entity, test_suite_definition):
    """Module-scoped test case for test suite tests."""
    table_fqn = ts_table.fullyQualifiedName.root
    tc_name = generate_name()
    test_case = metadata.create_or_update(
        CreateTestCaseRequest(
            name=TestCaseEntityName(tc_name.root),
            entityLink=EntityLink(f"<#E::table::{table_fqn}>"),
            testDefinition=test_suite_definition.fullyQualifiedName,
            parameterValues=[TestCaseParameterValue(name="foo", value="10")],
        )
    )

    metadata.add_test_case_results(
        test_results=TestCaseResult(
            timestamp=datetime_to_ts(datetime.now(timezone.utc)),
            testCaseStatus=TestCaseStatus.Success,
            result="Test Case Success",
            sampleData=None,
            testResultValue=[TestResultValue(name="foo", value="10")],
        ),
        test_case_fqn=f"{table_fqn}.{tc_name.root}",
    )

    yield test_case


@pytest.fixture(scope="module")
def test_case_special_chars(
    metadata, ts_table, test_suite_entity, test_suite_definition
):
    """Module-scoped test case with special characters for test suite tests."""
    table_fqn = ts_table.fullyQualifiedName.root
    test_case = metadata.create_or_update(
        CreateTestCaseRequest(
            name=TestCaseEntityName("testCase:With/Special&Characters"),
            entityLink=EntityLink(f"<#E::table::{table_fqn}>"),
            testDefinition=test_suite_definition.fullyQualifiedName,
            parameterValues=[TestCaseParameterValue(name="foo", value="20")],
        )
    )

    metadata.add_test_case_results(
        test_results=TestCaseResult(
            timestamp=datetime_to_ts(datetime.now(timezone.utc)),
            testCaseStatus=TestCaseStatus.Success,
            result="Test Case with special chars Success",
            sampleData=None,
            testResultValue=[TestResultValue(name="foo", value="20")],
        ),
        test_case_fqn=f"{table_fqn}.testCase:With/Special&Characters",
    )

    yield test_case


class TestOMetaTestSuiteAPI:
    """
    Test Suite API integration tests.
    Tests test suite, test definition, and test case operations.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_get_or_create_test_suite(self, metadata, test_suite_entity, ts_table):
        """test we get a test suite object"""
        table_fqn = ts_table.fullyQualifiedName.root
        test_suite = metadata.get_or_create_test_suite(f"{table_fqn}.TestSuite")
        assert test_suite.name.root == f"{table_fqn}.TestSuite"
        assert isinstance(test_suite, TestSuite)

    def test_get_or_create_test_definition(self, metadata, test_suite_definition):
        """test we get a test definition object"""
        td_name = test_suite_definition.name.root
        test_definition = metadata.get_or_create_test_definition(td_name)
        assert test_definition.name.root == td_name
        assert isinstance(test_definition, TestDefinition)

    def test_get_or_create_test_case(self, metadata, test_case_entity, ts_table):
        """test we get a test case object"""
        table_fqn = ts_table.fullyQualifiedName.root
        tc_fqn = f"{table_fqn}.{test_case_entity.name.root}"
        test_case = metadata.get_or_create_test_case(tc_fqn)
        assert test_case.name.root == test_case_entity.name.root
        assert isinstance(test_case, OMetaTestCase)

    def test_create_test_case(self, metadata, test_suite_entity, ts_table):
        """test we get a create the test case object if it does not exists"""
        table_fqn = ts_table.fullyQualifiedName.root
        test_case_fqn = f"{table_fqn}.aNonExistingTestCase"
        test_case = metadata.get_by_name(
            entity=OMetaTestCase, fqn=test_case_fqn, fields=["*"]
        )

        assert test_case is None

        test_case = metadata.get_or_create_test_case(
            test_case_fqn,
            test_definition_fqn="columnValuesToMatchRegex",
            entity_link=f"<#E::table::{table_fqn}::columns::id>",
            test_case_parameter_values=[
                TestCaseParameterValue(name="regex", value=".*")
            ],
        )
        assert test_case.name.root == "aNonExistingTestCase"
        assert isinstance(test_case, OMetaTestCase)

    def test_get_test_case_results(self, metadata, test_case_entity, ts_table):
        """test get test case result method"""
        table_fqn = ts_table.fullyQualifiedName.root
        tc_fqn = f"{table_fqn}.{test_case_entity.name.root}"
        res = metadata.get_test_case_results(
            tc_fqn,
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
        )

        assert res

    def test_get_test_case_results_with_special_characters(
        self, metadata, test_case_special_chars, ts_table
    ):
        """test get test case results with special characters in FQN (: / &)"""
        table_fqn = ts_table.fullyQualifiedName.root
        res = metadata.get_test_case_results(
            f"{table_fqn}.testCase:With/Special&Characters",
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
        )

        assert (
            res is not None
        ), "Should fetch results for test case with special characters"
        assert len(res) > 0, "Should have at least one result"
        assert res[0].result == "Test Case with special chars Success"
        assert res[0].testCaseStatus == TestCaseStatus.Success
