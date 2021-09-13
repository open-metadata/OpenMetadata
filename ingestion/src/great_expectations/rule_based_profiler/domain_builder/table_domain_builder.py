from typing import List, Optional

from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.rule_based_profiler.domain_builder import Domain, DomainBuilder
from great_expectations.rule_based_profiler.parameter_builder import ParameterContainer


class TableDomainBuilder(DomainBuilder):
    """
    The interface method of TableDomainBuilder emits a single Domain object, corresponding to the implied Batch (table).

    Note that for appropriate use-cases, it should be readily possible to build a multi-batch implementation, where a
    separate Domain object is emitted for each individual Batch (using its respective batch_id).  (This is future work.)
    """

    def _get_domains(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> List[Domain]:
        domains: List[Domain] = [
            Domain(
                domain_type=MetricDomainTypes.TABLE,
            )
        ]

        return domains
