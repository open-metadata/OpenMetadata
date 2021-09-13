import copy
from typing import Dict, List, Optional

from great_expectations.core import ExpectationConfiguration
from great_expectations.rule_based_profiler.domain_builder import Domain, DomainBuilder
from great_expectations.rule_based_profiler.expectation_configuration_builder import (
    ExpectationConfigurationBuilder,
)
from great_expectations.rule_based_profiler.parameter_builder import (
    ParameterBuilder,
    ParameterContainer,
)


class Rule:
    def __init__(
        self,
        name: str,
        domain_builder: Optional[DomainBuilder] = None,
        parameter_builders: Optional[List[ParameterBuilder]] = None,
        expectation_configuration_builders: Optional[
            List[ExpectationConfigurationBuilder]
        ] = None,
        variables: Optional[ParameterContainer] = None,
    ):
        """
        Sets Profiler rule name, domain builders, parameters builders, configuration builders,
        and other necessary instance data (variables)
        :param name: A string representing the name of the ProfilerRule
        :param domain_builder: A Domain Builder object used to build rule data domain
        :param parameter_builders: A Parameter Builder list used to configure necessary rule evaluation parameters for
        every configuration
        :param expectation_configuration_builders: A list of Expectation Configuration Builders
        :param variables: Any instance data required to verify a rule
        """
        self._name = name
        self._domain_builder = domain_builder
        self._parameter_builders = parameter_builders
        self._expectation_configuration_builders = expectation_configuration_builders
        self._variables = variables

        self._parameters = {}

    def generate(
        self,
    ) -> List[ExpectationConfiguration]:
        """
        Builds a list of Expectation Configurations, returning a single Expectation Configuration entry for every
        ConfigurationBuilder available based on the instantiation.

        :return: List of Corresponding Expectation Configurations representing every configured rule
        """
        expectation_configurations: List[ExpectationConfiguration] = []

        domains: List[Domain] = self._domain_builder.get_domains(
            variables=self.variables
        )

        domain: Domain
        for domain in domains:
            parameter_container: ParameterContainer = ParameterContainer(
                parameter_nodes=None
            )
            self._parameters[domain.id] = parameter_container
            parameter_builder: ParameterBuilder
            for parameter_builder in self._parameter_builders:
                parameter_builder.build_parameters(
                    parameter_container=parameter_container,
                    domain=domain,
                    variables=self.variables,
                    parameters=self.parameters,
                )

            expectation_configuration_builder: ExpectationConfigurationBuilder
            for (
                expectation_configuration_builder
            ) in self._expectation_configuration_builders:
                expectation_configurations.append(
                    expectation_configuration_builder.build_expectation_configuration(
                        domain=domain,
                        variables=self.variables,
                        parameters=self.parameters,
                    )
                )

        return expectation_configurations

    @property
    def variables(self) -> ParameterContainer:
        # Returning a copy of the "self._variables" state variable in order to prevent write-before-read hazard.
        return copy.deepcopy(self._variables)

    @property
    def parameters(self) -> Dict[str, ParameterContainer]:
        # Returning a copy of the "self._parameters" state variable in order to prevent write-before-read hazard.
        return copy.deepcopy(self._parameters)
