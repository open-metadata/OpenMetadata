from typing import List, Optional

from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.rule_based_profiler.domain_builder import Domain, DomainBuilder
from great_expectations.rule_based_profiler.parameter_builder import ParameterContainer
from great_expectations.validator.validation_graph import MetricConfiguration


class ColumnDomainBuilder(DomainBuilder):
    def _get_domains(
        self,
        variables: Optional[ParameterContainer] = None,
    ) -> List[Domain]:
        """
        Obtains and returns domains for all columns of a table.
        """
        batch_id: str = self.get_batch_id(variables=variables)
        table_column_names: List[str] = self.get_validator(
            variables=variables
        ).get_metric(
            metric=MetricConfiguration(
                metric_name="table.columns",
                metric_domain_kwargs={
                    "batch_id": batch_id,
                },
                metric_value_kwargs=None,
                metric_dependencies=None,
            )
        )

        column_name: str
        domains: List[Domain] = [
            Domain(
                domain_type=MetricDomainTypes.COLUMN,
                domain_kwargs={
                    "column": column_name,
                },
            )
            for column_name in table_column_names
        ]

        return domains
