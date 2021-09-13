from copy import deepcopy
from typing import Dict, Optional

from great_expectations.core import ExpectationConfiguration
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.expectations.expectation import TableExpectation
from great_expectations.expectations.util import render_evaluation_parameter_string
from great_expectations.render.renderer.renderer import renderer
from great_expectations.render.types import RenderedStringTemplateContent
from great_expectations.render.util import num_to_str, substitute_none_for_missing


class ExpectTableRowCountToEqualOtherTable(TableExpectation):
    """Expect the number of rows to equal the number in another table.

    expect_table_row_count_to_equal_other_table is a :func:`expectation \
    <great_expectations.validator.validator.Validator.expectation>`, not a
    ``column_map_expectation`` or ``column_aggregate_expectation``.

    Args:
        other_table_name (str): \
            The name of the other table.

    Other Parameters:
        result_format (string or None): \
            Which output mode to use: `BOOLEAN_ONLY`, `BASIC`, `COMPLETE`, or `SUMMARY`.
            For more detail, see :ref:`result_format <result_format>`.
        include_config (boolean): \
            If True, then include the expectation config as part of the result object. \
            For more detail, see :ref:`include_config`.
        catch_exceptions (boolean or None): \
            If True, then catch exceptions and include them as part of the result object. \
            For more detail, see :ref:`catch_exceptions`.
        meta (dict or None): \
            A JSON-serializable dictionary (nesting allowed) that will be included in the output without \
            modification. For more detail, see :ref:`meta`.

    Returns:
        An ExpectationSuiteValidationResult

        Exact fields vary depending on the values passed to :ref:`result_format <result_format>` and
        :ref:`include_config`, :ref:`catch_exceptions`, and :ref:`meta`.

    See Also:
        expect_table_row_count_to_be_between
    """

    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "table expectation", "multi-table expectation"],
        "contributors": [
            "@great_expectations",
        ],
        "requirements": [],
    }

    metric_dependencies = ("table.row_count",)
    success_keys = ("other_table_name",)
    default_kwarg_values = {
        "other_table_name": None,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": False,
    }

    @classmethod
    @renderer(renderer_type="renderer.prescriptive")
    @render_evaluation_parameter_string
    def _prescriptive_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")
        params = substitute_none_for_missing(configuration.kwargs, ["other_table_name"])
        template_str = "Row count must equal the row count of table $other_table_name."

        return [
            RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {
                        "template": template_str,
                        "params": params,
                        "styling": styling,
                    },
                }
            )
        ]

    @classmethod
    @renderer(renderer_type="renderer.diagnostic.observed_value")
    def _diagnostic_observed_value_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        if not result.result.get("observed_value"):
            return "--"

        self_table_row_count = num_to_str(result.result["observed_value"]["self"])
        other_table_row_count = num_to_str(result.result["observed_value"]["other"])

        return RenderedStringTemplateContent(
            **{
                "content_block_type": "string_template",
                "string_template": {
                    "template": "Row Count: $self_table_row_count<br>Other Table Row Count: $other_table_row_count",
                    "params": {
                        "self_table_row_count": self_table_row_count,
                        "other_table_row_count": other_table_row_count,
                    },
                    "styling": {"classes": ["mb-2"]},
                },
            }
        )

    def get_validation_dependencies(
        self,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        dependencies = super().get_validation_dependencies(
            configuration, execution_engine, runtime_configuration
        )
        other_table_name = configuration.kwargs.get("other_table_name")
        # create copy of table.row_count metric and modify "table" metric domain kwarg to be other table name
        table_row_count_metric_config_other = deepcopy(
            dependencies["metrics"]["table.row_count"]
        )
        table_row_count_metric_config_other.metric_domain_kwargs[
            "table"
        ] = other_table_name
        # rename original "table.row_count" metric to "table.row_count.self"
        dependencies["metrics"]["table.row_count.self"] = dependencies["metrics"].pop(
            "table.row_count"
        )
        # add a new metric dependency named "table.row_count.other" with modified metric config
        dependencies["metrics"][
            "table.row_count.other"
        ] = table_row_count_metric_config_other

        return dependencies

    def _validate(
        self,
        configuration: ExpectationConfiguration,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine: ExecutionEngine = None,
    ):
        table_row_count_self = metrics["table.row_count.self"]
        table_row_count_other = metrics["table.row_count.other"]

        return {
            "success": table_row_count_self == table_row_count_other,
            "result": {
                "observed_value": {
                    "self": table_row_count_self,
                    "other": table_row_count_other,
                }
            },
        }
