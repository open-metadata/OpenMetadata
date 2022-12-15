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
from unittest.mock import patch
from uuid import uuid4

import sqlalchemy as sqa
from pandas import DataFrame
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
from metadata.interfaces.sqalchemy.sqa_test_suite_interface import SQATestSuiteInterface
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
        Column(name="first name", dataType=DataType.STRING),
        Column(name="fullname", dataType=DataType.STRING),
        Column(name="nickname", dataType=DataType.STRING),
        Column(name="age", dataType=DataType.INT),
    ],
    database=EntityReference(id=uuid4(), name="db", type="database"),
)

TEST_SUITE = TestSuite(name="my_test_suite", description="description")
DL_DATA = (
    ["1", "John", "Jo", "John Doe", "johnny b goode", 30],
    ["2", "Jane", "Ja", "Jone Doe", "Johnny d", 31],
    ["3", "John", "Joh", "John Doe", None, None],
) * 10


DATALAKE_DATA_FRAME = DataFrame(
    DL_DATA, columns=["id", "name", "first name", "fullname", "nickname", "age"]
)


class User(Base):
    __tablename__ = "users"
    id = sqa.Column(sqa.Integer, primary_key=True)
    name = sqa.Column(sqa.String(256))
    first_name = sqa.Column("first name", sqa.String(256))
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

    with patch.object(
        SQATestSuiteInterface, "_convert_table_to_orm_object", return_value=User
    ):
        sqa_profiler_interface = SQATestSuiteInterface(
            sqlite_conn,
            table_entity=TABLE,
            ometa_client=None,
        )
    dl_runner = DATALAKE_DATA_FRAME

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
                    first_name="Jo",
                    fullname="John Doe",
                    nickname="johnny b goode",
                    age=30,
                ),
                User(
                    name="Jane",
                    first_name="Ja",
                    fullname="Jone Doe",
                    nickname="Johnny d",
                    age=31,
                ),
                User(
                    name="John",
                    first_name="Joh",
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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueLengthsToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "8"
        assert res.testResultValue[1].value == "14"
        assert dl_res.testResultValue[0].value == "4"
        assert dl_res.testResultValue[1].value == "14"

        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::first+name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minLength", value="1"),
                TestCaseParameterValue(name="maxLength", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueLengthsToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueLengthsToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "2"
        assert res.testResultValue[1].value == "3"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "2"
        assert dl_res.testResultValue[1].value == "3"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::first+name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="maxLength", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueLengthsToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )
        dl_res = validation_enum_registry.registry["columnValueLengthsToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMaxToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "31"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "31.0"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="maxValueForMaxInCol", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMaxToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMaxToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testCaseStatus == TestCaseStatus.Failed

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMeanToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "30.5"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "30.5"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForMeanInCol", value="1"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMeanToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMeanToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMedianToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "30.0"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "30.5"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMinToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "30.0"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="maxValueForMinInCol", value="40"),
            ],
        )

        res = validation_enum_registry.registry["columnValueMinToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueMinToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueStdDevToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "0.25"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "0.512989176042577"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="maxValueForStdDevInCol", value="40"),
            ],
        )

        res = validation_enum_registry.registry["columnValueStdDevToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValueStdDevToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesToBeInSet"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "20"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "20"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesMissingCount"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "10"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "10"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesMissingCount"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )
        assert res.testResultValue[0].value == "20"
        assert dl_res.testResultValue[0].value == "20"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesToBeNotInSet"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "20"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "20"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesSumToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "610"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "610.0"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValueForColSum", value="10"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesSumToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesSumToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "30.0"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users::columns::age>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValue", value="29"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

    def test_column_values_to_be_not_null(self):
        """test column value to be not null"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        res = validation_enum_registry.registry["columnValuesToBeNotNull"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesToBeNotNull"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "10"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "10"

    def test_column_values_to_be_unique(self):
        """test column value to be unique"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::nickname>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        res = validation_enum_registry.registry["columnValuesToBeUnique"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["columnValuesToBeUnique"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "20"
        assert res.testResultValue[1].value == "0"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "30"
        assert dl_res.testResultValue[1].value == "2"

    def test_column_values_to_match_regex(self):
        """test column value to match regex"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users::columns::name>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="regex", value="J.*"),
            ],
        )

        res = validation_enum_registry.registry["columnValuesToMatchRegex"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnCountToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "6"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "6"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="maxColValue", value="10"),
            ],
        )

        res = validation_enum_registry.registry["tableColumnCountToBeBetween"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnCountToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testCaseStatus == TestCaseStatus.Success

    def test_table_column_count_to_equal(self):
        """test column value to be equal"""
        test_case = TestCase(
            name="my_test_case",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[TestCaseParameterValue(name="columnCount", value="7")],
        )

        res = validation_enum_registry.registry["tableColumnCountToEqual"](
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnCountToEqual"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "6"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "6"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnNameToExist"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "True"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "True"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnToMatchSet"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert (
            res.testResultValue[0].value
            == "['first name', 'id', 'name', 'fullname', 'nickname', 'age']"
        )
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert (
            dl_res.testResultValue[0].value
            == "['id', 'name', 'first name', 'fullname', 'nickname', 'age']"
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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnToMatchSet"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testCaseStatus == TestCaseStatus.Failed

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableColumnToMatchSet"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testCaseStatus == TestCaseStatus.Failed

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableRowCountToBeBetween"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "30"

        test_case = TestCase(
            name="my_test_case_two",
            entityLink="<#E::table::service.db.users>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
            parameterValues=[
                TestCaseParameterValue(name="minValue", value="10"),
            ],
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Success
        assert res.testResultValue[0].value == "30"
        assert dl_res.testCaseStatus == TestCaseStatus.Success
        assert dl_res.testResultValue[0].value == "30"

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
            self.runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        dl_res = validation_enum_registry.registry["tableRowCountToEqual"](
            self.dl_runner,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        assert isinstance(res, TestCaseResult)
        assert isinstance(dl_res, TestCaseResult)
        assert res.testCaseStatus == TestCaseStatus.Failed
        assert res.testResultValue[0].value == "30"
        assert dl_res.testCaseStatus == TestCaseStatus.Failed
        assert dl_res.testResultValue[0].value == "30"

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
        return super().tearDownClass()
