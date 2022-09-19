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
Test Table and Column Tests' validate implementations.

Each test should validate the Success, Failure and Aborted statuses
"""

import os
import unittest
from datetime import datetime
from uuid import uuid4

import sqlalchemy as sqa
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.interfaces.sqa_interface import SQAInterface
from metadata.test_suite.validations.core import validation_enum_registry

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")

Base = declarative_base()

TABLE = Table(
    id=uuid4(),
    name="users",
    fullyQualifiedName="service.db.users",
    columns=[
        Column(name="id", dataType=DataType.INT),
        Column(name="name", dataType=DataType.STRING),
        Column(name="fullname", dataType=DataType.STRING),
        Column(name="nickname", dataType=DataType.STRING),
        Column(name="age", dataType=DataType.INT),
    ],
    database=EntityReference(id=uuid4(), name="db", type="database"),
)

TEST_SUITE = TestSuite(name="my_test_suite", description="description")


class User(Base):
    __tablename__ = "users"
    id = sqa.Column(sqa.Integer, primary_key=True)
    name = sqa.Column(sqa.String(256))
    fullname = sqa.Column(sqa.String(256))
    nickname = sqa.Column(sqa.String(256))
    age = sqa.Column(sqa.Integer)


class testSuiteValidation(unittest.TestCase):
    """test suite validation"""

    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    )
    sqlite_conn = SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=db_path + "?check_same_thread=False",
    )

    sqa_profiler_interface = SQAInterface(
        sqlite_conn,
        table=User,
        table_entity=TABLE,
    )
    runner = sqa_profiler_interface.runner
    engine = sqa_profiler_interface.session.get_bind()
    session = sqa_profiler_interface.session

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        User.__table__.create(bind=cls.engine)

        for i in range(10):
            data = [
                User(
                    name="John",
                    fullname="John Doe",
                    nickname="johnny b goode",
                    age=30,
                ),
                User(
                    name="Jane",
                    fullname="Jone Doe",
                    nickname="Johnny d",
                    age=31,
                ),
                User(
                    name="John",
                    fullname="John Doe",
                    nickname=None,
                    age=None,
                ),
            ]
            cls.session.add_all(data)
            cls.session.commit()

    def test_column_value_length_to_be_between(self):
        """
        Check ColumnValueLengthsToBeBetween
        """

        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minLength", value="1"),
                TestCaseParameterValue(name="maxLength", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueLengthsToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "8"
        assert res.testResultValue[1].value == "14"

    def test_column_value_max_to_be_between(self):
        """test column value max to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForMaxInCol", value="1"),
                TestCaseParameterValue(name="maxValueForMaxInCol", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMaxToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "31"

    def test_column_value_mean_to_be_between(self):
        """test column value mean to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForMeanInCol", value="1"),
                TestCaseParameterValue(name="maxValueForMeanInCol", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMeanToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "30.5"

    def test_column_value_median_to_be_between(self):
        """test column value median to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForMedianInCol", value="1"),
                TestCaseParameterValue(name="maxValueForMedianInCol", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMedianToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "30.0"

    def test_column_value_min_to_be_between(self):
        """test column value min to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForMinInCol", value="25"),
                TestCaseParameterValue(name="maxValueForMinInCol", value="40"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMinToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"

    def test_column_value_stddev_to_be_between(self):
        """test column value stddev to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForStdDevInCol", value="20"),
                TestCaseParameterValue(name="maxValueForStdDevInCol", value="40"),
            ],
        )

        res = validation_enum_registry.registry["columnValueStdDevToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "0.25"

    def test_column_value_in_set(self):
        """test column value in set"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="allowedValues", value="['John']"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToBeInSet"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "20"

    def test_column_values_missing_count_to_be_equal(self):
        """test column value missing count to be equal"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="missingCountValue", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesMissingCount"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "10"

        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="missingCountValue", value="10"),
                TestCaseParameterValue(name="missingValueMatch", value="['Johnny d']"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesMissingCount"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )
        assert res.testResultValue[0].value == "20"

    def test_column_values_not_in_set(self):
        """test column value not in set"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="forbiddenValues", value="['John']"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToBeNotInSet"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "20"

    def test_column_sum_to_be_between(self):
        """test column value sum to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForColSum", value="10"),
                TestCaseParameterValue(name="maxValueForColSum", value="100"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesSumToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "610"

    def test_column_values_to_be_between(self):
        """test column value to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValue", value="29"),
                TestCaseParameterValue(name="maxValue", value="33"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"

    def test_column_values_to_be_not_null(self):
        """test column value to be not null"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        res = validation_enum_registry.registry["columnValuesToBeNotNull"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "10"

    def test_column_values_to_be_unique(self):
        """test column value to be unique"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        res = validation_enum_registry.registry["columnValuesToBeUnique"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "20"
        assert res.testResultValue[1].value == "0"

    def test_column_values_to_match_regex(self):
        """test column value to match regex"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="regex", value="J%"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToMatchRegex"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"

    def test_column_values_to_not_match_regex(self):
        """test column value to not match regex"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="forbiddenRegex", value="X%"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToNotMatchRegex"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "0"

    def test_table_column_count_to_be_between(self):
        """test column value count to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minColValue", value="2"),
                TestCaseParameterValue(name="maxColValue", value="10"),
            ],
        )

        res = validation_enum_registry.registry["tableColumnCountToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "5"

    def test_table_column_count_to_equal(self):
        """test column value to be equal"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[TestCaseParameterValue(name="columnCount", value="6")],
        )

        res = validation_enum_registry.registry["tableColumnCountToEqual"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "5"

    def test_table_column_name_to_exist(self):
        """test column name to exist"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[TestCaseParameterValue(name="columnName", value="id")],
        )

        res = validation_enum_registry.registry["tableColumnNameToExist"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "True"

    def test_column_to_match_set(self):
        """test column names to match set"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="columnNames", value="id,name,nickname")
            ],
        )

        res = validation_enum_registry.registry["tableColumnToMatchSet"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert (
            res.testResultValue[0].value
            == "['id', 'name', 'fullname', 'nickname', 'age']"
        )

        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(
                    name="columnNames", value="id,name,nickname,fullname,age"
                )
            ],
        )

        res = validation_enum_registry.registry["tableColumnToMatchSet"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert res.testCaseStatus == TestCaseStatus.Success

        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(
                    name="columnNames", value="id,name,nickname,fullname,age"
                ),
                TestCaseParameterValue(name="ordered", value="True"),
            ],
        )

        res = validation_enum_registry.registry["tableColumnToMatchSet"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert res.testCaseStatus == TestCaseStatus.Failed

    def test_table_custom_sql_query(self):
        """test custom sql"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(
                    name="sqlExpression", value="SELECT * FROM users WHERE age > 20"
                ),
            ],
        )

        res = validation_enum_registry.registry["tableCustomSQLQuery"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "20"

        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(
                    name="sqlExpression", value="SELECT * FROM users WHERE age < 0"
                ),
            ],
        )

        res = validation_enum_registry.registry["tableCustomSQLQuery"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert res.testCaseStatus == TestCaseStatus.Success

    def test_table_row_count_to_be_between(self):
        """test row count to be between"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValue", value="10"),
                TestCaseParameterValue(name="maxValue", value="35"),
            ],
        )

        res = validation_enum_registry.registry["tableRowCountToBeBetween"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"

    def test_table_row_count_to_be_equal(self):
        """test row count to be equal"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="value", value="10"),
            ],
        )

        res = validation_enum_registry.registry["tableRowCountToEqual"](
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
            runner=self.runner,
        )

        assert isinstance(res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "30"

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
        return super().tearDownClass()
