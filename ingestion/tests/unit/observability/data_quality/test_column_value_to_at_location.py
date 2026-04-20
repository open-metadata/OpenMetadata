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

"""Validate column value at location."""

from datetime import datetime
from typing import Dict, Iterator
from unittest.mock import patch

from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeAtExpectedLocation import (
    ColumnValuesToBeAtExpectedLocationValidator,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.type.basic import Timestamp


def _fetch_data() -> Iterator[Dict]:
    rows = [
        {"postal_code": 60001, "lon": "1,7743058", "lat": "49,6852237"},
        {"postal_code": 44001, "lon": "-1,5244159", "lat": "47,5546432"},
        {"postal_code": 60001, "lon": "3,17932", "lat": "49,59686"},
    ]

    yield from rows


def test_column_value_to_be_at_expected_location(
    test_case_column_values_to_be_at_expected_location,
):
    """Test column value to be at expected location validation."""
    validator = ColumnValuesToBeAtExpectedLocationValidator(
        None,
        test_case_column_values_to_be_at_expected_location,
        Timestamp(root=int(datetime.strptime("2021-07-03", "%Y-%m-%d").timestamp())),
    )
    with patch(
        "metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeAtExpectedLocation.ColumnValuesToBeAtExpectedLocationValidator._fetch_data",
        return_value=_fetch_data(),
    ):
        result: TestCaseResult = validator.run_validation()

        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == "2"
        assert result.testResultValue[1].value == "1"
        assert result.testResultValue[2].value == "0"
