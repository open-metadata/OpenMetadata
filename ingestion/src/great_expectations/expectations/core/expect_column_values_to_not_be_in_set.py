from typing import Dict, Optional

import numpy as np
import pandas as pd

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.execution_engine import PandasExecutionEngine
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.types import RenderedStringTemplateContent
from ...render.util import (
    num_to_str,
    parse_row_condition_string_pandas_engine,
    substitute_none_for_missing,
)
from ..expectation import ColumnMapExpectation, InvalidExpectationConfigurationError


class ExpectColumnValuesToNotBeInSet(ColumnMapExpectation):
    """Expect column entries to not be in the set.

    For example:
    ::

        # my_df.my_col = [1,2,2,3,3,3]
        >>> my_df.expect_column_values_to_not_be_in_set(
            "my_col",
            [1,2]
        )
        {
          "success": false
          "result": {
            "unexpected_count": 3
            "unexpected_percent": 50.0,
            "unexpected_percent_nonmissing": 50.0,
            "partial_unexpected_list": [
              1, 2, 2
            ],
          },
        }

    expect_column_values_to_not_be_in_set is a \
    :func:`column_map_expectation <great_expectations.execution_engine.execution_engine.MetaExecutionEngine
    .column_map_expectation>`.

    Args:
        column (str): \
            The column name.
        value_set (set-like): \
            A set of objects used for comparison.

    Keyword Args:
        mostly (None or a float between 0 and 1): \
            Return `"success": True` if at least mostly fraction of values match the expectation. \
            For more detail, see :ref:`mostly`.

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

    See Also:
        :func:`expect_column_values_to_be_in_set \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_values_to_be_in_set>`

    """

    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column map expectation"],
        "contributors": [
            "@great_expectations",
        ],
        "requirements": [],
    }

    map_metric = "column_values.not_in_set"
    success_keys = (
        "value_set",
        "mostly",
        "parse_strings_as_datetimes",
    )

    default_kwarg_values = {
        "row_condition": None,
        "condition_parser": None,  # we expect this to be explicitly set whenever a row_condition is passed
        "mostly": 1,
        "parse_strings_as_datetimes": None,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": False,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)
        if configuration is None:
            configuration = self.configuration
        try:
            assert "value_set" in configuration.kwargs, "value_set is required"
            assert isinstance(
                configuration.kwargs["value_set"], (list, set, dict)
            ), "value_set must be a list or a set"
            if isinstance(configuration.kwargs["value_set"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["value_set"]
                ), 'Evaluation Parameter dict for value_set kwarg must have "$PARAMETER" key.'
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
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
            [
                "column",
                "value_set",
                "mostly",
                "parse_strings_as_datetimes",
                "row_condition",
                "condition_parser",
            ],
        )

        if params["value_set"] is None or len(params["value_set"]) == 0:
            values_string = "[ ]"
        else:
            for i, v in enumerate(params["value_set"]):
                params["v__" + str(i)] = v

            values_string = " ".join(
                ["$v__" + str(i) for i, v in enumerate(params["value_set"])]
            )

        template_str = "values must not belong to this set: " + values_string

        if params["mostly"] is not None:
            params["mostly_pct"] = num_to_str(
                params["mostly"] * 100, precision=15, no_scientific=True
            )
            # params["mostly_pct"] = "{:.14f}".format(params["mostly"]*100).rstrip("0").rstrip(".")
            template_str += ", at least $mostly_pct % of the time."
        else:
            template_str += "."

        if params.get("parse_strings_as_datetimes"):
            template_str += " Values should be parsed as datetimes."

        if include_column_name:
            template_str = "$column " + template_str

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

    # @PandasExecutionEngine.column_map_metric(
    #     metric_name="column_values.not_in_set",
    #     metric_domain_keys=ColumnMapExpectation.domain_keys,
    #     metric_value_keys=("value_set",),
    #     metric_dependencies=tuple(),
    #     filter_column_isnull=True,
    # )
    def _pandas_column_values_not_in_set(
        self,
        series: pd.Series,
        metrics: Dict,
        metric_domain_kwargs: Dict,
        metric_value_kwargs: Dict,
        runtime_configuration: dict = None,
        filter_column_isnull: bool = True,
    ):
        value_set = metric_value_kwargs["value_set"]

        if value_set is None:
            # Vacuously true
            return np.ones(len(series), dtype=np.bool_)
        if pd.api.types.is_datetime64_any_dtype(series):
            parsed_value_set = PandasExecutionEngine.parse_value_set(
                value_set=value_set
            )
        else:
            parsed_value_set = value_set

        return pd.DataFrame(
            {"column_values.not_in_set": ~series.isin(parsed_value_set)}
        )
