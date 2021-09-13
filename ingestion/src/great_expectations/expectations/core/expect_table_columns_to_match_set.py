from typing import Dict, Optional

from great_expectations.core import ExpectationConfiguration
from great_expectations.exceptions import InvalidExpectationConfigurationError
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.expectations.expectation import TableExpectation
from great_expectations.expectations.util import render_evaluation_parameter_string
from great_expectations.render.renderer.renderer import renderer
from great_expectations.render.types import RenderedStringTemplateContent
from great_expectations.render.util import substitute_none_for_missing


class ExpectTableColumnsToMatchSet(TableExpectation):
    """Expect the columns to exactly match an *unordered* set.

    expect_table_columns_to_match_set is a :func:`expectation \
    <great_expectations.validator.validator.Validator.expectation>`, not a
    ``column_map_expectation`` or ``column_aggregate_expectation``.

    Args:
        column_set (list of str): \
            The column names, in the correct order.
        exact_match (boolean): \
            Whether the list of columns must exactly match the observed columns.

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
    success_keys = (
        "column_set",
        "exact_match",
    )
    default_kwarg_values = {
        "column_set": None,
        "exact_match": True,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": False,
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
            assert "column_set" in configuration.kwargs, "column_set is required"
            assert (
                isinstance(configuration.kwargs["column_set"], (list, set, dict))
                or configuration.kwargs["column_set"] is None
            ), "column_set must be a list, set, or None"
            if isinstance(configuration.kwargs["column_set"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["column_set"]
                ), 'Evaluation Parameter dict for column_set kwarg must have "$PARAMETER" key.'
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
        **kwargs,
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")
        params = substitute_none_for_missing(
            configuration.kwargs, ["column_set", "exact_match"]
        )

        if params["column_set"] is None:
            template_str = "Must specify a set or list of columns."

        else:
            # standardize order of the set for output
            params["column_list"] = list(params["column_set"])

            column_list_template_str = ", ".join(
                [f"$column_list_{idx}" for idx in range(len(params["column_list"]))]
            )

            exact_match_str = "exactly" if params["exact_match"] is True else "at least"

            template_str = f"Must have {exact_match_str} these columns (in any order): {column_list_template_str}"

            for idx in range(len(params["column_list"])):
                params["column_list_" + str(idx)] = params["column_list"][idx]

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
        expected_column_set = self.get_success_kwargs(configuration).get("column_set")
        expected_column_set = (
            set(expected_column_set) if expected_column_set is not None else set()
        )
        actual_column_list = metrics.get("table.columns")
        actual_column_set = set(actual_column_list)
        exact_match = self.get_success_kwargs(configuration).get("exact_match")

        if (
            (expected_column_set is None) and (exact_match is not True)
        ) or actual_column_set == expected_column_set:
            return {"success": True, "result": {"observed_value": actual_column_list}}
        else:
            # Convert to lists and sort to lock order for testing and output rendering
            # unexpected_list contains items from the dataset columns that are not in expected_column_set
            unexpected_list = sorted(list(actual_column_set - expected_column_set))
            # missing_list contains items from expected_column_set that are not in the dataset columns
            missing_list = sorted(list(expected_column_set - actual_column_set))
            # observed_value contains items that are in the dataset columns
            observed_value = sorted(actual_column_list)

            mismatched = {}
            if len(unexpected_list) > 0:
                mismatched["unexpected"] = unexpected_list
            if len(missing_list) > 0:
                mismatched["missing"] = missing_list

            result = {
                "observed_value": observed_value,
                "details": {"mismatched": mismatched},
            }

            return_success = {
                "success": True,
                "result": result,
            }
            return_failed = {
                "success": False,
                "result": result,
            }

            if exact_match:
                return return_failed
            else:
                # Failed if there are items in the missing list (but OK to have unexpected_list)
                if len(missing_list) > 0:
                    return return_failed
                # Passed if there are no items in the missing list
                else:
                    return return_success
