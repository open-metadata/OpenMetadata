from itertools import zip_longest
from typing import Dict, List, Optional, Union

import numpy as np
import pandas as pd

from great_expectations.core.batch import Batch
from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.execution_engine import ExecutionEngine, PandasExecutionEngine
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.types import RenderedStringTemplateContent
from ...render.util import substitute_none_for_missing
from ..expectation import InvalidExpectationConfigurationError, TableExpectation


class ExpectTableColumnsToMatchOrderedList(TableExpectation):
    """Expect the columns to exactly match a specified list.

    expect_table_columns_to_match_ordered_list is a :func:`expectation \
    <great_expectations.validator.validator.Validator.expectation>`, not a
    ``column_map_expectation`` or ``column_aggregate_expectation``.

    Args:
        column_list (list of str): \
            The column names, in the correct order.

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

    """

    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "table expectation"],
        "contributors": [
            "@great_expectations",
        ],
        "requirements": [],
    }

    metric_dependencies = ("table.columns",)
    success_keys = ("column_list",)
    domain_keys = (
        "batch_id",
        "table",
        "row_condition",
        "condition_parser",
    )

    default_kwarg_values = {
        "row_condition": None,
        "condition_parser": None,  # we expect this to be explicitly set whenever a row_condition is passed
        "column_list": None,
        "result_format": "BASIC",
        "column": None,
        "column_index": None,
        "include_config": True,
        "catch_exceptions": False,
        "meta": None,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        """
        Validates that a configuration has been set, and sets a configuration if it has yet to be set. Ensures that
        necessary configuration arguments have been provided for the validation of the expectation.

        Args:
            configuration (OPTIONAL[ExpectationConfiguration]): \
                An optional Expectation Configuration entry that will be used to configure the expectation
        Returns:
            True if the configuration has been validated successfully. Otherwise, raises an exception
        """

        # Setting up a configuration
        super().validate_configuration(configuration)

        # Ensuring that a proper value has been provided
        try:
            assert "column_list" in configuration.kwargs, "column_list is required"
            assert (
                isinstance(configuration.kwargs["column_list"], (list, set, dict))
                or configuration.kwargs["column_list"] is None
            ), "column_list must be a list, set, or None"
            if isinstance(configuration.kwargs["column_list"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["column_list"]
                ), 'Evaluation Parameter dict for column_list kwarg must have "$PARAMETER" key.'

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
        params = substitute_none_for_missing(configuration.kwargs, ["column_list"])

        if params["column_list"] is None:
            template_str = "Must have a list of columns in a specific order, but that order is not specified."

        else:
            template_str = "Must have these columns in this order: "
            for idx in range(len(params["column_list"]) - 1):
                template_str += "$column_list_" + str(idx) + ", "
                params["column_list_" + str(idx)] = params["column_list"][idx]

            last_idx = len(params["column_list"]) - 1
            template_str += "$column_list_" + str(last_idx)
            params["column_list_" + str(last_idx)] = params["column_list"][last_idx]

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

    def _validate(
        self,
        configuration: ExpectationConfiguration,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine: ExecutionEngine = None,
    ):
        # Obtaining columns and ordered list for sake of comparison
        expected_column_list = self.get_success_kwargs(configuration).get("column_list")
        actual_column_list = metrics.get("table.columns")

        if expected_column_list is None or list(actual_column_list) == list(
            expected_column_list
        ):
            return {
                "success": True,
                "result": {"observed_value": list(actual_column_list)},
            }
        else:
            # In the case of differing column lengths between the defined expectation and the observed column set, the
            # max is determined to generate the column_index.
            number_of_columns = max(len(expected_column_list), len(actual_column_list))
            column_index = range(number_of_columns)

            # Create a list of the mismatched details
            compared_lists = list(
                zip_longest(
                    column_index, list(expected_column_list), list(actual_column_list)
                )
            )
            mismatched = [
                {"Expected Column Position": i, "Expected": k, "Found": v}
                for i, k, v in compared_lists
                if k != v
            ]
            return {
                "success": False,
                "result": {
                    "observed_value": list(actual_column_list),
                    "details": {"mismatched": mismatched},
                },
            }
