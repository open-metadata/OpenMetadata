from abc import ABC, abstractmethod
from typing import Dict, Optional

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.rule_based_profiler.domain_builder import Domain
from great_expectations.rule_based_profiler.parameter_builder import ParameterContainer


class ExpectationConfigurationBuilder(ABC):
    def build_expectation_configuration(
        self,
        domain: Domain,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> ExpectationConfiguration:
        return self._build_expectation_configuration(
            domain=domain, variables=variables, parameters=parameters
        )

    @abstractmethod
    def _build_expectation_configuration(
        self,
        domain: Domain,
        variables: Optional[ParameterContainer] = None,
        parameters: Optional[Dict[str, ParameterContainer]] = None,
    ) -> ExpectationConfiguration:
        pass
