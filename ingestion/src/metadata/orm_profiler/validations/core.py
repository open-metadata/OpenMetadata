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
Core Validation definitions
"""
import operator as op
from typing import Any, Callable, Dict, Union

from pydantic import BaseModel, ValidationError, validator

from metadata.orm_profiler.metrics.core import Metric
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.utils import logger

logger = logger()


class ValidationConversionException(Exception):
    """
    Issue converting parser results to our Metrics and Validations
    """


class MissingMetricException(Exception):
    """
    The required Metric is not available in the profiler results
    """


_OPERATOR_MAP = {
    "<": op.lt,
    ">": op.gt,
    "==": op.eq,
    "!=": op.ne,
}


class Validation(BaseModel):
    """
    Base class for Validation definition.

    We will map here the results from parsing with
    the grammar.
    """

    metric: Metric
    operator: Callable
    value: Union[str, int]
    valid: bool = None

    @validator("value")
    def empty_string(cls, val):  # Named `cls` as per pydantic docs
        if not val:
            raise ValueError(f"Empty strings are not allowed")

        return val

    class Config:
        arbitrary_types_allowed = True


def to_validation(raw_validation: Dict[str, str]):
    """
    Given the results of the grammar parser, convert
    them to a Validation class with the assigned Metric,
    the right operator and the casted value.
    """

    metric = Metrics.get(raw_validation["metric"])
    if not metric:
        logger.error("Error trying to get Metric from Registry.")
        raise ValidationConversionException(
            f"Cannot find metric from {raw_validation} in the Registry."
        )

    operator = _OPERATOR_MAP.get(raw_validation.get("operator"))
    if not operator:
        logger.error("Invalid Operator when converting to validation.")
        raise ValidationConversionException(
            f"Cannot find operator from {raw_validation}."
        )

    raw_value = raw_validation.get("value")
    if not raw_value:
        logger.error("Missing or Empty value")
        raise ValidationConversionException(
            f"Missing or empty value in {raw_validation}."
        )

    value = int(raw_value) if raw_value.isdigit() else raw_value

    try:
        validation = Validation(metric=metric, operator=operator, value=value)
    except ValidationError as err:
        logger.error("Error trying to convert a RAW validation to a Validation model")
        raise err

    return validation


def validate(validation: Validation, results: Dict[str, Any]) -> Validation:
    """
    Given a Validation and the profiler results,
    compare their data.

    We will call this function for each validation
    that we received.

    Each time we will return a Validation object
    with a properly informed `valid` field,
    containing the result of the validation.
    """
    computed_metric = results.get(validation.metric.name())

    if not computed_metric:
        raise MissingMetricException(
            f"The required metric {validation.metric.name()} is not available"
            + f" in the profiler results: {results}."
        )

    is_valid = validation.operator(
        validation.value, computed_metric  # Expected value  # Real value
    )

    validation.valid = is_valid

    return validation
