from typing import Any, Dict, Optional

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.rule_based_profiler.domain_builder import Domain
from great_expectations.rule_based_profiler.expectation_configuration_builder import (
    ExpectationConfigurationBuilder,
)
from great_expectations.rule_based_profiler.parameter_builder import ParameterContainer
from great_expectations.rule_based_profiler.util import (
    get_parameter_value_and_validate_return_type,
)


class DefaultExpectationConfigurationBuilder(ExpectationConfigurationBuilder):
    """
    Class which creates ExpectationConfiguration out of a given Expectation type and
    parameter_name-to-parameter_fully_qualified_parameter_name map (name-value pairs supplied in the kwargs dictionary).
    """

    def __init__(
        self,
        expectation_type: str,
        meta: Optional[Dict[str, Any]] = None,
        success_on_last_run: Optional[bool] = None,
        **kwargs,
    ):
        self._expectation_type = expectation_type
        self._expectation_kwargs = kwargs
        if meta is None:
            meta = {}
        if not isinstance(meta, dict):
            raise ge_exceptions.ProfilerExecutionError(
                message=f"""Argument "{meta}" in "{self.__class__.__name__}" must be of type "dictionary" \
(value of type "{str(type())}" was encountered).
"""
            )
        self._meta = meta
        self._success_on_last_run = success_on_last_run

    def _build_expectation_configuration(
        self,
        domain: Domain,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> ExpectationConfiguration:
        parameter_name: str
        fully_qualified_parameter_name: str
        expectation_kwargs: Dict[str, Any] = {
            parameter_name: get_parameter_value_and_validate_return_type(
                domain=domain,
                parameter_reference=fully_qualified_parameter_name,
                expected_return_type=None,
                variables=variables,
                parameters=parameters,
            )
            for parameter_name, fully_qualified_parameter_name in self._expectation_kwargs.items()
        }
        meta: Dict[str, Any] = get_parameter_value_and_validate_return_type(
            domain=domain,
            parameter_reference=self._meta,
            expected_return_type=dict,
            variables=variables,
            parameters=parameters,
        )
        return ExpectationConfiguration(
            expectation_type=self._expectation_type,
            kwargs=expectation_kwargs,
            meta=meta,
            success_on_last_run=self._success_on_last_run,
        )
