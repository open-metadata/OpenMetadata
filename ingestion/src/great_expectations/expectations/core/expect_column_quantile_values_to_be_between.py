from typing import Dict, Optional

import numpy as np

from great_expectations.core import ExpectationConfiguration
from great_expectations.exceptions import InvalidExpectationConfigurationError
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.expectations.expectation import ColumnExpectation
from great_expectations.expectations.util import render_evaluation_parameter_string
from great_expectations.render.renderer.renderer import renderer
from great_expectations.render.types import (
    RenderedStringTemplateContent,
    RenderedTableContent,
)
from great_expectations.render.util import (
    parse_row_condition_string_pandas_engine,
    substitute_none_for_missing,
)


class ExpectColumnQuantileValuesToBeBetween(ColumnExpectation):
    """Expect specific provided column quantiles to be between provided minimum and maximum values.

           ``quantile_ranges`` must be a dictionary with two keys:

               * ``quantiles``: (list of float) increasing ordered list of desired quantile values

               * ``value_ranges``: (list of lists): Each element in this list consists of a list with two values, a lower \
                 and upper bound (inclusive) for the corresponding quantile.


           For each provided range:

               * min_value and max_value are both inclusive.
               * If min_value is None, then max_value is treated as an upper bound only
               * If max_value is None, then min_value is treated as a lower bound only

           The length of the quantiles list and quantile_values list must be equal.

           For example:
           ::

               # my_df.my_col = [1,2,2,3,3,3,4]
               >>> my_df.expect_column_quantile_values_to_be_between(
                   "my_col",
                   {
                       "quantiles": [0., 0.333, 0.6667, 1.],
                       "value_ranges": [[0,1], [2,3], [3,4], [4,5]]
                   }
               )
               {
                 "success": True,
                   "result": {
                     "observed_value": {
                       "quantiles: [0., 0.333, 0.6667, 1.],
                       "values": [1, 2, 3, 4],
                     }
                     "element_count": 7,
                     "missing_count": 0,
                     "missing_percent": 0.0,
                     "details": {
                       "success_details": [true, true, true, true]
                     }
                   }
                 }
               }

           `expect_column_quantile_values_to_be_between` can be computationally intensive for large datasets.

           expect_column_quantile_values_to_be_between is a \
           :func:`column_aggregate_expectation
           <great_expectations.execution_engine.MetaExecutionEngine.column_aggregate_expectation>`.

           Args:
               column (str): \
                   The column name.
               quantile_ranges (dictionary): \
                   Quantiles and associated value ranges for the column. See above for details.
               allow_relative_error (boolean): \
                   Whether to allow relative error in quantile communications on backends that support or require it.

           Other Parameters:
               result_format (str or None): \
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

           Notes:
               These fields in the result object are customized for this expectation:
               ::
               details.success_details

           See Also:
               :func:`expect_column_min_to_be_between \
               <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_min_to_be_between>`

               :func:`expect_column_max_to_be_between \
               <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_max_to_be_between>`

               :func:`expect_column_median_to_be_between \
               <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_median_to_be_between>`

           """

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column aggregate expectation"],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    metric_dependencies = ("column.quantile_values",)
    success_keys = (
        "quantile_ranges",
        "allow_relative_error",
    )
    default_kwarg_values = {
        "row_condition": None,
        "allow_relative_eror": None,
        "condition_parser": None,
        "quantile_ranges": None,
        "result_format": "BASIC",
        "allow_relative_error": False,
        "include_config": True,
        "catch_exceptions": False,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)

        try:
            assert (
                "quantile_ranges" in configuration.kwargs
            ), "quantile ranges must be provided"
            assert isinstance(
                configuration.kwargs["quantile_ranges"], dict
            ), "quantile_ranges should be a dictionary"

        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))

        # Ensuring actual quantiles and their value ranges match up
        quantile_ranges = configuration.kwargs["quantile_ranges"]
        quantiles = quantile_ranges["quantiles"]
        quantile_value_ranges = quantile_ranges["value_ranges"]
        if "allow_relative_error" in configuration.kwargs:
            allow_relative_error = configuration.kwargs["allow_relative_error"]
        else:
            allow_relative_error = False

        if len(quantiles) != len(quantile_value_ranges):
            raise ValueError(
                "quntile_values and quantiles must have the same number of elements"
            )
        return True

    @classmethod
    @renderer(renderer_type="renderer.prescriptive")
    @render_evaluation_parameter_string
    def _prescriptive_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs,
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")
        params = substitute_none_for_missing(
            configuration["kwargs"],
            ["column", "quantile_ranges", "row_condition", "condition_parser"],
        )
        template_str = "quantiles must be within the following value ranges."

        if include_column_name:
            template_str = "$column " + template_str

        if params["row_condition"] is not None:
            (
                conditional_template_str,
                conditional_params,
            ) = parse_row_condition_string_pandas_engine(params["row_condition"])
            template_str = (
                conditional_template_str
                + ", then "
                + template_str[0].lower()
                + template_str[1:]
            )
            params.update(conditional_params)

        expectation_string_obj = {
            "content_block_type": "string_template",
            "string_template": {"template": template_str, "params": params},
        }

        quantiles = params["quantile_ranges"]["quantiles"]
        value_ranges = params["quantile_ranges"]["value_ranges"]

        table_header_row = ["Quantile", "Min Value", "Max Value"]
        table_rows = []

        quantile_strings = {0.25: "Q1", 0.75: "Q3", 0.50: "Median"}

        for quantile, value_range in zip(quantiles, value_ranges):
            quantile_string = quantile_strings.get(quantile, f"{quantile:3.2f}")
            table_rows.append(
                [
                    quantile_string,
                    str(value_range[0]) if value_range[0] is not None else "Any",
                    str(value_range[1]) if value_range[1] is not None else "Any",
                ]
            )

        quantile_range_table = RenderedTableContent(
            **{
                "content_block_type": "table",
                "header_row": table_header_row,
                "table": table_rows,
                "styling": {
                    "body": {
                        "classes": [
                            "table",
                            "table-sm",
                            "table-unbordered",
                            "col-4",
                            "mt-2",
                        ],
                    },
                    "parent": {"styles": {"list-style-type": "none"}},
                },
            }
        )

        return [expectation_string_obj, quantile_range_table]

    @classmethod
    @renderer(renderer_type="renderer.diagnostic.observed_value")
    def _diagnostic_observed_value_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs,
    ):
        if result.result is None or result.result.get("observed_value") is None:
            return "--"

        quantiles = result.result.get("observed_value", {}).get("quantiles", [])
        value_ranges = result.result.get("observed_value", {}).get("values", [])

        table_header_row = ["Quantile", "Value"]
        table_rows = []

        quantile_strings = {0.25: "Q1", 0.75: "Q3", 0.50: "Median"}

        for idx, quantile in enumerate(quantiles):
            quantile_string = quantile_strings.get(quantile)
            table_rows.append(
                [
                    quantile_string if quantile_string else f"{quantile:3.2f}",
                    str(value_ranges[idx]),
                ]
            )

        return RenderedTableContent(
            **{
                "content_block_type": "table",
                "header_row": table_header_row,
                "table": table_rows,
                "styling": {
                    "body": {
                        "classes": ["table", "table-sm", "table-unbordered", "col-4"],
                    }
                },
            }
        )

    @classmethod
    @renderer(renderer_type="renderer.descriptive.quantile_table")
    def _descriptive_quantile_table_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs,
    ):
        assert result, "Must pass in result."
        table_rows = []
        quantiles = result.result["observed_value"]["quantiles"]
        quantile_ranges = result.result["observed_value"]["values"]

        quantile_strings = {0.25: "Q1", 0.75: "Q3", 0.50: "Median"}

        for idx, quantile in enumerate(quantiles):
            quantile_string = quantile_strings.get(quantile)
            table_rows.append(
                [
                    {
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": quantile_string
                            if quantile_string
                            else f"{quantile:3.2f}",
                            "tooltip": {
                                "content": "expect_column_quantile_values_to_be_between \n expect_column_median_to_be_between"
                                if quantile == 0.50
                                else "expect_column_quantile_values_to_be_between"
                            },
                        },
                    },
                    quantile_ranges[idx],
                ]
            )

        return RenderedTableContent(
            **{
                "content_block_type": "table",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {"template": "Quantiles", "tag": "h6"},
                    }
                ),
                "table": table_rows,
                "styling": {
                    "classes": ["col-3", "mt-1", "pl-1", "pr-1"],
                    "body": {
                        "classes": ["table", "table-sm", "table-unbordered"],
                    },
                },
            }
        )

    def get_validation_dependencies(
        self,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        all_dependencies = super().get_validation_dependencies(
            configuration, execution_engine, runtime_configuration
        )
        # column.quantile_values expects a "quantiles" key
        all_dependencies["metrics"]["column.quantile_values"].metric_value_kwargs[
            "quantiles"
        ] = configuration.kwargs["quantile_ranges"]["quantiles"]
        return all_dependencies

    def _validate(
        self,
        configuration: ExpectationConfiguration,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine: ExecutionEngine = None,
    ):
        quantile_vals = metrics.get("column.quantile_values")
        quantile_ranges = configuration.kwargs.get("quantile_ranges")
        quantiles = quantile_ranges["quantiles"]
        quantile_value_ranges = quantile_ranges["value_ranges"]

        # We explicitly allow "None" to be interpreted as +/- infinity
        comparison_quantile_ranges = [
            [
                -np.inf if lower_bound is None else lower_bound,
                np.inf if upper_bound is None else upper_bound,
            ]
            for (lower_bound, upper_bound) in quantile_value_ranges
        ]
        success_details = [
            range_[0] <= quantile_vals[idx] <= range_[1]
            for idx, range_ in enumerate(comparison_quantile_ranges)
        ]

        return {
            "success": np.all(success_details),
            "result": {
                "observed_value": {"quantiles": quantiles, "values": quantile_vals},
                "details": {"success_details": success_details},
            },
        }
