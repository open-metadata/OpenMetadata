from typing import Dict, Optional

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.types import RenderedStringTemplateContent
from ...render.util import ordinal, substitute_none_for_missing
from ..expectation import InvalidExpectationConfigurationError, TableExpectation


class ExpectColumnToExist(TableExpectation):
    """Expect the specified column to exist.

    expect_column_to_exist is a :func:`expectation \
    <great_expectations.validator.validator.Validator.expectation>`, not a
    ``column_map_expectation`` or ``column_aggregate_expectation``.

    Args:
        column (str): \
            The column name.

    Other Parameters:
        column_index (int or None): \
            If not None, checks the order of the columns. The expectation will fail if the \
            column is not in location column_index (zero-indexed).
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
            A JSON-serializable dictionary (nesting allowed) that will be included in the output without modification. \
            For more detail, see :ref:`meta`.

    Returns:
        An ExpectationSuiteValidationResult

        Exact fields vary depending on the values passed to :ref:`result_format <result_format>` and
        :ref:`include_config`, :ref:`catch_exceptions`, and :ref:`meta`.

    """

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "table expectation"],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    metric_dependencies = ("table.columns",)
    success_keys = (
        "column",
        "column_index",
    )
    domain_keys = (
        "batch_id",
        "table",
    )
    default_kwarg_values = {
        "column": None,
        "column_index": None,
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
            assert "column" in configuration.kwargs, "A column name must be provided"
            assert isinstance(
                configuration.kwargs["column"], str
            ), "Column name must be a string"
            assert (
                isinstance(configuration.kwargs.get("column_index"), (int, dict))
                or configuration.kwargs.get("column_index") is None
            ), "column_index must be an integer or None"
            if isinstance(configuration.kwargs.get("column_index"), dict):
                assert "$PARAMETER" in configuration.kwargs.get(
                    "column_index"
                ), 'Evaluation Parameter dict for column_index kwarg must have "$PARAMETER" key.'
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
            ["column", "column_index"],
        )

        if params["column_index"] is None:
            if include_column_name:
                template_str = "$column is a required field."
            else:
                template_str = "is a required field."
        else:
            params["column_indexth"] = ordinal(params["column_index"])
            if include_column_name:
                template_str = "$column must be the $column_indexth field."
            else:
                template_str = "must be the $column_indexth field."

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
        actual_columns = metrics.get("table.columns")
        expected_column_name = self.get_success_kwargs().get("column")
        expected_column_index = self.get_success_kwargs().get("column_index")

        if expected_column_index:
            try:
                success = actual_columns[expected_column_index] == expected_column_name
            except IndexError:
                success = False
        else:
            success = expected_column_name in actual_columns

        return {"success": success}
