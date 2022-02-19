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

from pydantic import ValidationError

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
    "<=": op.le,
    ">=": op.ge,
}


class Validation:
    """
    Base class for Validation definition.

    This data will be extracted from the TestDef expression.

    We will map here the results from parsing with
    the grammar.
    """

    def __init__(self, metric: str, operator: Callable, value: Union[float, int, str]):
        self.metric = metric
        self.operator = operator
        self.value = value
        self.valid = None

    @classmethod
    def create(cls, raw_validation: Dict[str, str]) -> "Validation":
        """
        Given the results of the grammar parser, convert
        them to a Validation class with the assigned Metric,
        the right operator and the casted value.
        """

        raw_metric = raw_validation.get("metric")
        if not raw_metric:
            raise ValidationConversionException(
                f"Missing metric information in {raw_validation}."
            )

        metric = Metrics.get(raw_metric.upper())
        if not metric:
            logger.error("Error trying to get Metric from Registry.")
            raise ValidationConversionException(
                f"Cannot find metric from {raw_validation} in the Registry."
            )

        metric_name = metric.name()

        operator = _OPERATOR_MAP.get(raw_validation.get("operation"))
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

        if raw_value.isdigit():
            value = int(raw_value)  # Check if int
        else:
            try:
                value = float(raw_value)  # Otherwise, might be float
            except ValueError:
                value = raw_value  # If not, leave as string

        try:
            validation = cls(metric=metric_name, operator=operator, value=value)
        except ValidationError as err:
            logger.error(
                "Error trying to convert a RAW validation to a Validation model"
            )
            raise err

        return validation

    def validate(self, results: Dict[str, Any]) -> "Validation":
        """
        Given a Validation and the profiler results,
        compare their data.

        We will call this function for each validation
        that we received.

        Each time we will return a Validation object
        with a properly informed `valid` field,
        containing the result of the validation.
        """
        computed_metric = results.get(self.metric)

        if not computed_metric:
            raise MissingMetricException(
                f"The required metric {self.metric} is not available"
                + f" in the profiler results: {results}."
            )

        is_valid = self.operator(
            computed_metric, self.value  # Order matters. Real value vs. expected
        )

        self.valid = is_valid  # Either True / False

        return self  # return self for convenience
