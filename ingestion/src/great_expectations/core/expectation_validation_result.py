import json
import logging
from copy import deepcopy
from typing import Optional
from uuid import UUID

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.expectation_configuration import (
    ExpectationConfigurationSchema,
)
from great_expectations.core.util import (
    convert_to_json_serializable,
    ensure_json_serializable,
    in_jupyter_notebook,
)
from great_expectations.marshmallow__shade import Schema, fields, post_load, pre_dump
from great_expectations.types import SerializableDictDot

logger = logging.getLogger(__name__)


def get_metric_kwargs_id(metric_name, metric_kwargs):
    ###
    #
    # WARNING
    # WARNING
    # THIS IS A PLACEHOLDER UNTIL WE HAVE REFACTORED EXPECTATIONS TO HANDLE THIS LOGIC THEMSELVES
    # WE ARE NO WORSE OFF THAN THE PREVIOUS SYSTEM, BUT NOT FULLY CUSTOMIZABLE
    # WARNING
    # WARNING
    #
    ###
    if "metric_kwargs_id" in metric_kwargs:
        return metric_kwargs["metric_kwargs_id"]
    if "column" in metric_kwargs:
        return "column=" + metric_kwargs.get("column")
    return None


class ExpectationValidationResult(SerializableDictDot):
    def __init__(
        self,
        success=None,
        expectation_config=None,
        result=None,
        meta=None,
        exception_info=None,
    ):
        if result and not self.validate_result_dict(result):
            raise ge_exceptions.InvalidCacheValueError(result)
        self.success = success
        self.expectation_config = expectation_config
        # TODO: re-add
        # assert_json_serializable(result, "result")
        if result is None:
            result = {}
        self.result = result
        if meta is None:
            meta = {}
        # We require meta information to be serializable, but do not convert until necessary
        ensure_json_serializable(meta)
        self.meta = meta
        self.exception_info = exception_info or {
            "raised_exception": False,
            "exception_traceback": None,
            "exception_message": None,
        }

    def __eq__(self, other):
        """ExpectationValidationResult equality ignores instance identity, relying only on properties."""
        # NOTE: JPC - 20200213 - need to spend some time thinking about whether we want to
        # consistently allow dict as a comparison alternative in situations like these...
        # if isinstance(other, dict):
        #     try:
        #         other = ExpectationValidationResult(**other)
        #     except ValueError:
        #         return NotImplemented
        if not isinstance(other, self.__class__):
            # Delegate comparison to the other instance's __eq__.
            return NotImplemented
        try:
            if self.result and other.result:
                common_keys = set(self.result.keys()) & other.result.keys()
                result_dict = self.to_json_dict()["result"]
                other_result_dict = other.to_json_dict()["result"]
                contents_equal = all(
                    [result_dict[k] == other_result_dict[k] for k in common_keys]
                )
            else:
                contents_equal = False

            return all(
                (
                    self.success == other.success,
                    (
                        self.expectation_config is None
                        and other.expectation_config is None
                    )
                    or (
                        self.expectation_config is not None
                        and self.expectation_config.isEquivalentTo(
                            other.expectation_config
                        )
                    ),
                    # Result is a dictionary allowed to have nested dictionaries that are still of complex types (e.g.
                    # numpy) consequently, series' comparison can persist. Wrapping in all() ensures comparison is
                    # handled appropriately.
                    not (self.result or other.result) or contents_equal,
                    self.meta == other.meta,
                    self.exception_info == other.exception_info,
                )
            )
        except (ValueError, TypeError):
            # if invalid comparisons are attempted, the objects are not equal.
            return False

    def __ne__(self, other):
        # Negated implementation of '__eq__'. TODO the method should be deleted when it will coincide with __eq__.
        # return not self == other
        if not isinstance(other, self.__class__):
            # Delegate comparison to the other instance's __ne__.
            return NotImplemented
        try:
            return any(
                (
                    self.success != other.success,
                    (
                        self.expectation_config is None
                        and other.expectation_config is not None
                    )
                    or (
                        self.expectation_config is not None
                        and not self.expectation_config.isEquivalentTo(
                            other.expectation_config
                        )
                    ),
                    # TODO should it be wrapped in all()/any()? Since it is the only difference to __eq__:
                    (self.result is None and other.result is not None)
                    or (self.result != other.result),
                    self.meta != other.meta,
                    self.exception_info != other.exception_info,
                )
            )
        except (ValueError, TypeError):
            # if invalid comparisons are attempted, the objects are not equal.
            return True

    def __repr__(self):
        if in_jupyter_notebook():
            json_dict = self.to_json_dict()
            json_dict.pop("expectation_config")
            return json.dumps(json_dict, indent=2)
        return json.dumps(self.to_json_dict(), indent=2)

    def __str__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def validate_result_dict(self, result):
        if result.get("unexpected_count") and result["unexpected_count"] < 0:
            return False
        if result.get("unexpected_percent") and (
            result["unexpected_percent"] < 0 or result["unexpected_percent"] > 100
        ):
            return False
        if result.get("missing_percent") and (
            result["missing_percent"] < 0 or result["missing_percent"] > 100
        ):
            return False
        if result.get("unexpected_percent_nonmissing") and (
            result["unexpected_percent_nonmissing"] < 0
            or result["unexpected_percent_nonmissing"] > 100
        ):
            return False
        if result.get("missing_count") and result["missing_count"] < 0:
            return False
        return True

    def to_json_dict(self):
        myself = expectationValidationResultSchema.dump(self)
        # NOTE - JPC - 20191031: migrate to expectation-specific schemas that subclass result with properly-typed
        # schemas to get serialization all-the-way down via dump
        if "result" in myself:
            myself["result"] = convert_to_json_serializable(myself["result"])
        if "meta" in myself:
            myself["meta"] = convert_to_json_serializable(myself["meta"])
        if "exception_info" in myself:
            myself["exception_info"] = convert_to_json_serializable(
                myself["exception_info"]
            )
        return myself

    def get_metric(self, metric_name, **kwargs):
        if not self.expectation_config:
            raise ge_exceptions.UnavailableMetricError(
                "No ExpectationConfig found in this ExpectationValidationResult. Unable to "
                "return a metric."
            )

        metric_name_parts = metric_name.split(".")
        metric_kwargs_id = get_metric_kwargs_id(metric_name, kwargs)

        if metric_name_parts[0] == self.expectation_config.expectation_type:
            curr_metric_kwargs = get_metric_kwargs_id(
                metric_name, self.expectation_config.kwargs
            )
            if metric_kwargs_id != curr_metric_kwargs:
                raise ge_exceptions.UnavailableMetricError(
                    "Requested metric_kwargs_id (%s) does not match the configuration of this "
                    "ExpectationValidationResult (%s)."
                    % (metric_kwargs_id or "None", curr_metric_kwargs or "None")
                )
            if len(metric_name_parts) < 2:
                raise ge_exceptions.UnavailableMetricError(
                    "Expectation-defined metrics must include a requested metric."
                )
            elif len(metric_name_parts) == 2:
                if metric_name_parts[1] == "success":
                    return self.success
                else:
                    raise ge_exceptions.UnavailableMetricError(
                        "Metric name must have more than two parts for keys other than "
                        "success."
                    )
            elif metric_name_parts[1] == "result":
                try:
                    if len(metric_name_parts) == 3:
                        return self.result.get(metric_name_parts[2])
                    elif metric_name_parts[2] == "details":
                        return self.result["details"].get(metric_name_parts[3])
                except KeyError:
                    raise ge_exceptions.UnavailableMetricError(
                        "Unable to get metric {} -- KeyError in "
                        "ExpectationValidationResult.".format(metric_name)
                    )
        raise ge_exceptions.UnavailableMetricError(
            "Unrecognized metric name {}".format(metric_name)
        )


class ExpectationValidationResultSchema(Schema):
    success = fields.Bool()
    expectation_config = fields.Nested(ExpectationConfigurationSchema)
    result = fields.Dict()
    meta = fields.Dict()
    exception_info = fields.Dict()

    # noinspection PyUnusedLocal
    @pre_dump
    def convert_result_to_serializable(self, data, **kwargs):
        data = deepcopy(data)
        if isinstance(data, ExpectationValidationResult):
            data.result = convert_to_json_serializable(data.result)
        elif isinstance(data, dict):
            data["result"] = convert_to_json_serializable(data.get("result"))
        return data

    # # noinspection PyUnusedLocal
    # @pre_dump
    # def clean_empty(self, data, **kwargs):
    #     # if not hasattr(data, 'meta'):
    #     #     pass
    #     # elif len(data.meta) == 0:
    #     #     del data.meta
    #     # return data
    #     pass

    # noinspection PyUnusedLocal
    @post_load
    def make_expectation_validation_result(self, data, **kwargs):
        return ExpectationValidationResult(**data)


class ExpectationSuiteValidationResult(SerializableDictDot):
    def __init__(
        self,
        success=None,
        results=None,
        evaluation_parameters=None,
        statistics=None,
        meta=None,
        ge_cloud_id: Optional[UUID] = None,
    ):
        self.success = success
        if results is None:
            results = []
        self.results = results
        if evaluation_parameters is None:
            evaluation_parameters = {}
        self.evaluation_parameters = evaluation_parameters
        if statistics is None:
            statistics = {}
        self.statistics = statistics
        if meta is None:
            meta = {}
        ensure_json_serializable(
            meta
        )  # We require meta information to be serializable.
        self.meta = meta
        self._metrics = {}

    def __eq__(self, other):
        """ExpectationSuiteValidationResult equality ignores instance identity, relying only on properties."""
        if not isinstance(other, self.__class__):
            # Delegate comparison to the other instance's __eq__.
            return NotImplemented
        return all(
            (
                self.success == other.success,
                self.results == other.results,
                self.evaluation_parameters == other.evaluation_parameters,
                self.statistics == other.statistics,
                self.meta == other.meta,
            )
        )

    def __repr__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def __str__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def to_json_dict(self):
        myself = deepcopy(self)
        # NOTE - JPC - 20191031: migrate to expectation-specific schemas that subclass result with properly-typed
        # schemas to get serialization all-the-way down via dump
        myself["evaluation_parameters"] = convert_to_json_serializable(
            myself["evaluation_parameters"]
        )
        myself["statistics"] = convert_to_json_serializable(myself["statistics"])
        myself["meta"] = convert_to_json_serializable(myself["meta"])
        myself = expectationSuiteValidationResultSchema.dump(myself)
        return myself

    def get_metric(self, metric_name, **kwargs):
        metric_name_parts = metric_name.split(".")
        metric_kwargs_id = get_metric_kwargs_id(metric_name, kwargs)

        metric_value = None
        # Expose overall statistics
        if metric_name_parts[0] == "statistics":
            if len(metric_name_parts) == 2:
                return self.statistics.get(metric_name_parts[1])
            else:
                raise ge_exceptions.UnavailableMetricError(
                    "Unrecognized metric {}".format(metric_name)
                )

        # Expose expectation-defined metrics
        elif metric_name_parts[0].lower().startswith("expect_"):
            # Check our cache first
            if (metric_name, metric_kwargs_id) in self._metrics:
                return self._metrics[(metric_name, metric_kwargs_id)]
            else:
                for result in self.results:
                    try:
                        if (
                            metric_name_parts[0]
                            == result.expectation_config.expectation_type
                        ):
                            metric_value = result.get_metric(metric_name, **kwargs)
                            break
                    except ge_exceptions.UnavailableMetricError:
                        pass
                if metric_value is not None:
                    self._metrics[(metric_name, metric_kwargs_id)] = metric_value
                    return metric_value

        raise ge_exceptions.UnavailableMetricError(
            "Metric {} with metric_kwargs_id {} is not available.".format(
                metric_name, metric_kwargs_id
            )
        )


class ExpectationSuiteValidationResultSchema(Schema):
    success = fields.Bool()
    results = fields.List(fields.Nested(ExpectationValidationResultSchema))
    evaluation_parameters = fields.Dict()
    statistics = fields.Dict()
    meta = fields.Dict(allow_none=True)
    ge_cloud_id = fields.UUID(required=False, allow_none=True)

    # noinspection PyUnusedLocal
    @pre_dump
    def prepare_dump(self, data, **kwargs):
        data = deepcopy(data)
        if isinstance(data, ExpectationSuiteValidationResult):
            data.meta = convert_to_json_serializable(data.meta)
        elif isinstance(data, dict):
            data["meta"] = convert_to_json_serializable(data.get("meta"))
        return data

    # noinspection PyUnusedLocal
    @post_load
    def make_expectation_suite_validation_result(self, data, **kwargs):
        return ExpectationSuiteValidationResult(**data)


expectationSuiteValidationResultSchema = ExpectationSuiteValidationResultSchema()
expectationValidationResultSchema = ExpectationValidationResultSchema()
