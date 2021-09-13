from typing import Dict, List, Optional, Union

import altair as alt
import pandas as pd

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.execution_engine import ExecutionEngine, PandasExecutionEngine
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.types import RenderedGraphContent, RenderedStringTemplateContent
from ...render.util import (
    parse_row_condition_string_pandas_engine,
    substitute_none_for_missing,
)
from ..expectation import ColumnExpectation, InvalidExpectationConfigurationError
from ..metrics.util import parse_value_set


class ExpectColumnDistinctValuesToBeInSet(ColumnExpectation):
    """Expect the set of distinct column values to be contained by a given set.

            The success value for this expectation will match that of expect_column_values_to_be_in_set. However,
            expect_column_distinct_values_to_be_in_set is a \
            :func:`column_aggregate_expectation \
            <great_expectations.execution_engine.execution_engine.MetaExecutionEngine.column_aggregate_expectation>`.

            For example:
            ::

                # my_df.my_col = [1,2,2,3,3,3]
                >>> my_df.expect_column_distinct_values_to_be_in_set(
                    "my_col",
                    [2, 3, 4]
                )
                {
                  "success": false
                  "result": {
                    "observed_value": [1,2,3],
                    "details": {
                      "value_counts": [
                        {
                          "value": 1,
                          "count": 1
                        },
                        {
                          "value": 2,
                          "count": 1
                        },
                        {
                          "value": 3,
                          "count": 1
                        }
                      ]
                    }
                  }
                }

            Args:
                column (str): \
                    The column name.
                value_set (set-like): \
                    A set of objects used for comparison.

            Keyword Args:
                parse_strings_as_datetimes (boolean or None) : If True values provided in value_set will be parsed \
                as datetimes before making comparisons.

            Other Parameters:
                result_format (str or None): \
                    Which output mode to use: `BOOLEAN_ONLY`, `BASIC`, `COMPLETE`, or `SUMMARY`. \
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
                :func:`expect_column_distinct_values_to_contain_set \
                <great_expectations.execution_engine.execution_engine.ExecutionEngine
                .expect_column_distinct_values_to_contain_set>`

            """

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column aggregate expectation"],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    # Setting necessary computation metric dependencies and defining kwargs, as well as assigning kwargs default values\
    metric_dependencies = ("column.value_counts",)
    success_keys = (
        "value_set",
        "parse_strings_as_datetimes",
    )

    # Default values
    default_kwarg_values = {
        "value_set": None,
        "parse_strings_as_datetimes": None,
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

        params = substitute_none_for_missing(
            configuration.kwargs,
            ["column", "value_set", "row_condition", "condition_parser"],
        )

        if params["value_set"] is None or len(params["value_set"]) == 0:

            if include_column_name:
                template_str = "$column distinct values must belong to this set: [ ]"
            else:
                template_str = "distinct values must belong to a set, but that set is not specified."

        else:

            for i, v in enumerate(params["value_set"]):
                params["v__" + str(i)] = v
            values_string = " ".join(
                ["$v__" + str(i) for i, v in enumerate(params["value_set"])]
            )

            if include_column_name:
                template_str = (
                    "$column distinct values must belong to this set: "
                    + values_string
                    + "."
                )
            else:
                template_str = (
                    "distinct values must belong to this set: " + values_string + "."
                )

        if params["row_condition"] is not None:
            (
                conditional_template_str,
                conditional_params,
            ) = parse_row_condition_string_pandas_engine(params["row_condition"])
            template_str = conditional_template_str + ", then " + template_str
            params.update(conditional_params)

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
    @renderer(renderer_type="renderer.descriptive.value_counts_bar_chart")
    def _descriptive_value_counts_bar_chart_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        assert result, "Must pass in result."
        value_count_dicts = result.result["details"]["value_counts"]
        if isinstance(value_count_dicts, pd.Series):
            values = value_count_dicts.index.tolist()
            counts = value_count_dicts.tolist()
        else:
            values = [
                value_count_dict["value"] for value_count_dict in value_count_dicts
            ]
            counts = [
                value_count_dict["count"] for value_count_dict in value_count_dicts
            ]

        df = pd.DataFrame(
            {
                "value": values,
                "count": counts,
            }
        )

        if len(values) > 60:
            return None
        else:
            chart_pixel_width = (len(values) / 60.0) * 500
            if chart_pixel_width < 250:
                chart_pixel_width = 250
            chart_container_col_width = round((len(values) / 60.0) * 6)
            if chart_container_col_width < 4:
                chart_container_col_width = 4
            elif chart_container_col_width >= 5:
                chart_container_col_width = 6
            elif chart_container_col_width >= 4:
                chart_container_col_width = 5

        mark_bar_args = {}
        if len(values) == 1:
            mark_bar_args["size"] = 20

        bars = (
            alt.Chart(df)
            .mark_bar(**mark_bar_args)
            .encode(y="count:Q", x="value:O", tooltip=["value", "count"])
            .properties(height=400, width=chart_pixel_width, autosize="fit")
        )

        chart = bars.to_json()

        new_block = RenderedGraphContent(
            **{
                "content_block_type": "graph",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Value Counts",
                            "tooltip": {
                                "content": "expect_column_distinct_values_to_be_in_set"
                            },
                            "tag": "h6",
                        },
                    }
                ),
                "graph": chart,
                "styling": {
                    "classes": ["col-" + str(chart_container_col_width), "mt-1"],
                },
            }
        )

        return new_block

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        """Validating that user has inputted a value set and that configuration has been initialized"""
        super().validate_configuration(configuration)

        try:
            assert "value_set" in configuration.kwargs, "value_set is required"
            assert (
                isinstance(configuration.kwargs["value_set"], (list, set, dict))
                or configuration.kwargs["value_set"] is None
            ), "value_set must be a list, set, or None"
            if isinstance(configuration.kwargs["value_set"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["value_set"]
                ), 'Evaluation Parameter dict for value_set kwarg must have "$PARAMETER" key'
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
        return True

    def _validate(
        self,
        configuration: ExpectationConfiguration,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine: ExecutionEngine = None,
    ):
        parse_strings_as_datetimes = self.get_success_kwargs(configuration).get(
            "parse_strings_as_datetimes"
        )
        observed_value_counts = metrics.get("column.value_counts")
        observed_value_set = set(observed_value_counts.index)
        value_set = self.get_success_kwargs(configuration).get("value_set") or []

        if parse_strings_as_datetimes:
            parsed_value_set = parse_value_set(value_set)
        else:
            parsed_value_set = value_set

        expected_value_set = set(parsed_value_set)

        if not expected_value_set:
            success = True
        else:
            success = observed_value_set.issubset(expected_value_set)

        return {
            "success": success,
            "result": {
                "observed_value": sorted(list(observed_value_set)),
                "details": {"value_counts": observed_value_counts},
            },
        }
