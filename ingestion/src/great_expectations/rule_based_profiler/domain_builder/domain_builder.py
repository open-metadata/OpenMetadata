from abc import ABC, abstractmethod
from typing import List, Optional, Union

import great_expectations.exceptions as ge_exceptions
from great_expectations import DataContext
from great_expectations.rule_based_profiler.domain_builder import Domain
from great_expectations.rule_based_profiler.parameter_builder import ParameterContainer
from great_expectations.rule_based_profiler.util import (
    get_batch_ids as get_batch_ids_from_batch_request,
)
from great_expectations.rule_based_profiler.util import (
    get_validator as get_validator_from_batch_request,
)
from great_expectations.validator.validator import Validator


class DomainBuilder(ABC):
    """
    A DomainBuilder provides methods to get domains based on one or more batches of data.
    """

    def __init__(
        self,
        data_context: DataContext,
        batch_request: Optional[Union[dict, str]] = None,
    ):
        """
        Args:
            data_context: DataContext
            batch_request: specified in DomainBuilder configuration to get Batch objects for domain computation.
        """

        if data_context is None:
            raise ge_exceptions.ProfilerExecutionError(
                message=f"{self.__class__.__name__} requires a data_context, but none was provided."
            )

        self._data_context = data_context
        self._batch_request = batch_request

    def get_domains(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> List[Domain]:
        """
        Note: Please do not overwrite the public "get_domains()" method.  If a child class needs to check parameters,
        then please do so in its implementation of the (private) "_get_domains()" method, or in a utility method.
        """
        return self._get_domains(variables=variables)

    @abstractmethod
    def _get_domains(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> List[Domain]:
        """
        _get_domains is the primary workhorse for the DomainBuilder
        """

        pass

    def get_validator(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> Optional[Validator]:
        return get_validator_from_batch_request(
            purpose="domain_builder",
            data_context=self.data_context,
            batch_request=self._batch_request,
            domain=None,
            variables=variables,
            parameters=None,
        )

    def _get_batch_ids(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> Optional[List[str]]:
        return get_batch_ids_from_batch_request(
            data_context=self.data_context,
            batch_request=self._batch_request,
            domain=None,
            variables=variables,
            parameters=None,
        )

    def get_batch_id(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> Optional[str]:
        batch_ids: Optional[List[str]] = self._get_batch_ids(
            variables=variables,
        )
        num_batch_ids: int = len(batch_ids)
        if num_batch_ids != 1:
            raise ge_exceptions.ProfilerExecutionError(
                message=f"""{self.__class__.__name__}.get_batch_id() expected to return exactly one batch_id \
({num_batch_ids} were retrieved).
"""
            )

        return batch_ids[0]

    @property
    def data_context(self) -> DataContext:
        return self._data_context
