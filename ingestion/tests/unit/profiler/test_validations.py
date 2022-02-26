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
Test that we can safely convert to validation
and check results
"""
import operator as op

import pytest

from metadata.orm_profiler.validations.core import (
    Validation,
    ValidationConversionException,
)
from metadata.orm_profiler.validations.grammar import ExpVisitor, parse

visitor = ExpVisitor()


def test_model_conversion():
    """
    Check that we can properly convert to a Validation model
    """
    raw_validation = parse("count == 100", visitor)[0]
    model = Validation.create(raw_validation)

    assert model.metric == "valuesCount"
    assert model.operator == op.eq
    assert model.value == 100

    raw_validation = parse("min > something", visitor)[0]
    model = Validation.create(raw_validation)

    assert model.metric == "min"
    assert model.operator == op.gt
    assert model.value == "something"

    raw_validation = parse("null_ratio < 0.2", visitor)[0]
    model = Validation.create(raw_validation)

    assert model.metric == "nullProportion"
    assert model.operator == op.lt
    assert model.value == 0.2

    # This validation does not make sense, but we are just checking cases
    raw_validation = parse("null_ratio >= 5.4", visitor)[0]
    model = Validation.create(raw_validation)

    assert model.metric == "nullProportion"
    assert model.operator == op.ge
    assert model.value == 5.4


def test_model_conversion_exceptions():
    """
    Check that we cannot pass malformed data
    """

    # No info at all
    with pytest.raises(ValidationConversionException):
        Validation.create({})

    # Invalid metric, cannot be found in Registry
    with pytest.raises(ValidationConversionException):
        Validation.create({"metric": "not a valid metric"})

    # Missing Operation key
    with pytest.raises(ValidationConversionException):
        Validation.create({"metric": "min"})

    # Invalid Operation value
    with pytest.raises(ValidationConversionException):
        Validation.create({"metric": "min", "operation": "invalid operation"})

    # Missing value key
    with pytest.raises(ValidationConversionException):
        Validation.create({"metric": "min", "operation": "=="})

    # Empty value
    with pytest.raises(ValidationConversionException):
        Validation.create({"metric": "min", "operation": "==", "value": ""})


def test_validate():
    """
    Make sure that we are properly flagging validation results
    """
    results = {"valuesCount": 100}

    raw_validation = parse("count == 100", visitor)[0]
    validation = Validation.create(raw_validation)

    assert validation.validate(results).valid

    raw_validation = parse("count != 100", visitor)[0]
    validation = Validation.create(raw_validation)

    assert not validation.validate(results).valid

    results = {"nullProportion": 0.2}

    raw_validation = parse("Null_Ratio < 0.3", visitor)[0]
    validation = Validation.create(raw_validation)

    assert validation.validate(results).valid

    raw_validation = parse("Null_Ratio >= 0.3", visitor)[0]
    validation = Validation.create(raw_validation)

    assert not validation.validate(results).valid
