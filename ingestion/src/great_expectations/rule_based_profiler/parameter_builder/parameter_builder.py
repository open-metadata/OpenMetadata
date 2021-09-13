import copy
from abc import ABC, abstractmethod
from numbers import Number
from typing import Any, Dict, List, Optional, Union

import numpy as np

import great_expectations.exceptions as ge_exceptions
from great_expectations.data_context import DataContext
from great_expectations.rule_based_profiler.domain_builder import Domain
from great_expectations.rule_based_profiler.parameter_builder import ParameterContainer
from great_expectations.rule_based_profiler.util import build_metric_domain_kwargs
from great_expectations.rule_based_profiler.util import (
    get_batch_ids as get_batch_ids_from_batch_request,
)
from great_expectations.rule_based_profiler.util import (
    get_parameter_value_and_validate_return_type,
)
from great_expectations.rule_based_profiler.util import (
    get_validator as get_validator_from_batch_request,
)
from great_expectations.util import is_numeric
from great_expectations.validator.validation_graph import MetricConfiguration
from great_expectations.validator.validator import Validator


class ParameterBuilder(ABC):
    """
    A ParameterBuilder implementation provides support for building Expectation Configuration Parameters suitable for
    use in other ParameterBuilders or in ConfigurationBuilders as part of profiling.

    A ParameterBuilder is configured as part of a ProfilerRule. Its primary interface is the `build_parameters` method.

    As part of a ProfilerRule, the following configuration will create a new parameter for each domain returned by the
    domain_builder, with an associated id.

        ```
        parameter_builders:
          - parameter_name: my_parameter
            class_name: MetricParameterBuilder
            metric_name: column.mean
        ```
    """

    def __init__(
        self,
        parameter_name: str,
        data_context: Optional[DataContext] = None,
        batch_request: Optional[Union[dict, str]] = None,
    ):
        """
        The ParameterBuilder will build parameters for the active domain from the rule.

        Args:
            parameter_name: the name of this parameter -- this is user-specified parameter name (from configuration);
            it is not the fully-qualified parameter name; a fully-qualified parameter name must start with "$parameter."
            and may contain one or more subsequent parts (e.g., "$parameter.<my_param_from_config>.<metric_name>").
            data_context: DataContext
            batch_request: specified in ParameterBuilder configuration to get Batch objects for parameter computation.
        """

        self._parameter_name = parameter_name
        self._data_context = data_context
        self._batch_request = batch_request

    def build_parameters(
        self,
        parameter_container: ParameterContainer,
        domain: Domain,
        *,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ):
        self._build_parameters(
            parameter_container=parameter_container,
            domain=domain,
            variables=variables,
            parameters=parameters,
        )

    @abstractmethod
    def _build_parameters(
        self,
        parameter_container: ParameterContainer,
        domain: Domain,
        *,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ):
        pass

    def get_validator(
        self,
        domain: Optional[Domain] = None,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> Optional[Validator]:
        return get_validator_from_batch_request(
            purpose="parameter_builder",
            data_context=self.data_context,
            batch_request=self._batch_request,
            domain=domain,
            variables=variables,
            parameters=parameters,
        )

    def get_batch_ids(
        self,
        domain: Optional[Domain] = None,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> Optional[List[str]]:
        return get_batch_ids_from_batch_request(
            data_context=self.data_context,
            batch_request=self._batch_request,
            domain=domain,
            variables=variables,
            parameters=parameters,
        )

    def get_batch_id(
        self,
        domain: Optional[Domain] = None,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> Optional[str]:
        batch_ids: Optional[List[str]] = self.get_batch_ids(
            domain=domain,
            variables=variables,
            parameters=parameters,
        )
        num_batch_ids: int = len(batch_ids)
        if num_batch_ids != 1:
            raise ge_exceptions.ProfilerExecutionError(
                message=f"""{self.__class__.__name__}.get_batch_id() expected to return exactly one batch_id \
({num_batch_ids} were retrieved).
"""
            )

        return batch_ids[0]

    def get_metric(
        self,
        batch_id: str,
        validator: Validator,
        metric_name: str,
        metric_domain_kwargs: Optional[Union[str, dict]] = None,
        metric_value_kwargs: Optional[Union[str, dict]] = None,
        enforce_numeric_metric: Optional[Union[str, bool]] = False,
        replace_nan_with_zero: Optional[Union[str, bool]] = False,
        domain: Optional[Domain] = None,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> Dict[str, Union[Any, Number, Dict[str, Any]]]:
        metric_domain_kwargs = build_metric_domain_kwargs(
            batch_id=batch_id,
            metric_domain_kwargs=metric_domain_kwargs,
            domain=domain,
            variables=variables,
            parameters=parameters,
        )
        # Obtain value kwargs from rule state (i.e., variables and parameters); from instance variable otherwise.
        metric_value_kwargs = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=metric_value_kwargs,
            expected_return_type=None,
            variables=variables,
            parameters=parameters,
        )

        # Obtain enforce_numeric_metric from rule state (i.e., variables and parameters); from instance variable otherwise.
        enforce_numeric_metric = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=enforce_numeric_metric,
            expected_return_type=bool,
            variables=variables,
            parameters=parameters,
        )

        # Obtain replace_nan_with_zero from rule state (i.e., variables and parameters); from instance variable otherwise.
        replace_nan_with_zero = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=replace_nan_with_zero,
            expected_return_type=bool,
            variables=variables,
            parameters=parameters,
        )

        metric_configuration_arguments: Dict[str, Any] = {
            "metric_name": metric_name,
            "metric_domain_kwargs": metric_domain_kwargs,
            "metric_value_kwargs": metric_value_kwargs,
            "metric_dependencies": None,
        }
        metric_value: Union[Any, Number] = validator.get_metric(
            metric=MetricConfiguration(**metric_configuration_arguments)
        )
        if enforce_numeric_metric:
            if not is_numeric(value=metric_value):
                raise ge_exceptions.ProfilerExecutionError(
                    message=f"""Applicability of {self.__class__.__name__} is restricted to numeric-valued metrics \
(value of type "{str(type(metric_value))}" was computed).
"""
                )
            if np.isnan(metric_value):
                if not replace_nan_with_zero:
                    raise ValueError(
                        f"""Computation of metric "{metric_name}" resulted in NaN ("not a number") value.
"""
                    )
                metric_value = 0.0

        return {
            "value": metric_value,
            "details": {
                "metric_configuration": metric_configuration_arguments,
            },
        }

    def get_metrics(
        self,
        batch_ids: List[str],
        validator: Validator,
        metric_name: str,
        metric_domain_kwargs: Optional[Union[str, dict]] = None,
        metric_value_kwargs: Optional[Union[str, dict]] = None,
        enforce_numeric_metric: Optional[Union[str, bool]] = False,
        replace_nan_with_zero: Optional[Union[str, bool]] = False,
        domain: Optional[Domain] = None,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> Dict[str, Union[Union[np.ndarray, List[Union[Any, Number]]], Dict[str, Any]]]:
        domain_kwargs = build_metric_domain_kwargs(
            batch_id=None,
            metric_domain_kwargs=metric_domain_kwargs,
            domain=domain,
            variables=variables,
            parameters=parameters,
        )

        metric_domain_kwargs: dict = copy.deepcopy(domain_kwargs)

        # Obtain value kwargs from rule state (i.e., variables and parameters); from instance variable otherwise.
        metric_value_kwargs = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=metric_value_kwargs,
            expected_return_type=None,
            variables=variables,
            parameters=parameters,
        )

        # Obtain enforce_numeric_metric from rule state (i.e., variables and parameters); from instance variable otherwise.
        enforce_numeric_metric = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=enforce_numeric_metric,
            expected_return_type=bool,
            variables=variables,
            parameters=parameters,
        )

        # Obtain replace_nan_with_zero from rule state (i.e., variables and parameters); from instance variable otherwise.
        replace_nan_with_zero = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=replace_nan_with_zero,
            expected_return_type=bool,
            variables=variables,
            parameters=parameters,
        )

        metric_values: List[Union[Any, Number]] = []

        metric_value: Union[Any, Number]
        batch_id: str
        for batch_id in batch_ids:
            metric_domain_kwargs["batch_id"] = batch_id
            metric_configuration_arguments: Dict[str, Any] = {
                "metric_name": metric_name,
                "metric_domain_kwargs": metric_domain_kwargs,
                "metric_value_kwargs": metric_value_kwargs,
                "metric_dependencies": None,
            }
            metric_value = validator.get_metric(
                metric=MetricConfiguration(**metric_configuration_arguments)
            )
            if enforce_numeric_metric:
                if not is_numeric(value=metric_value):
                    raise ge_exceptions.ProfilerExecutionError(
                        message=f"""Applicability of {self.__class__.__name__} is restricted to numeric-valued metrics \
(value of type "{str(type(metric_value))}" was computed).
"""
                    )
                if np.isnan(metric_value):
                    if not replace_nan_with_zero:
                        raise ValueError(
                            f"""Computation of metric "{metric_name}" resulted in NaN ("not a number") value.
"""
                        )
                    metric_value = 0.0

            metric_values.append(metric_value)

        return {
            "metric_values": metric_values,
            "details": {
                "metric_configuration": {
                    "metric_name": metric_name,
                    "domain_kwargs": domain_kwargs,
                    "metric_value_kwargs": metric_value_kwargs,
                    "metric_dependencies": None,
                },
                "num_batches": len(metric_values),
            },
        }

    @property
    def parameter_name(self) -> str:
        return self._parameter_name

    @property
    def data_context(self) -> DataContext:
        return self._data_context

    @property
    def name(self) -> str:
        return f"{self.parameter_name}_parameter_builder"
