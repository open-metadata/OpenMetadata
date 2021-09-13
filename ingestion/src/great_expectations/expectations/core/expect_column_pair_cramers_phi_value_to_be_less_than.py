from great_expectations.expectations.expectation import TableExpectation
from great_expectations.expectations.util import render_evaluation_parameter_string
from great_expectations.render.renderer.renderer import renderer
from great_expectations.render.types import (
    RenderedStringTemplateContent,
    RenderedTableContent,
)
from great_expectations.render.util import num_to_str, substitute_none_for_missing


class ExpectColumnPairCramersPhiValueToBeLessThan(TableExpectation):

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": [
            "core expectation",
            "multi-column expectation",
            "needs migration to modular expectations api",
        ],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    metric_dependencies = tuple()
    success_keys = (
        "column_A",
        "column_B",
        "threshold",
    )
    default_kwarg_values = {
        "column_A": None,
        "column_B": None,
        "bins_A": None,
        "bins_B": None,
        "n_bins_A": None,
        "n_bins_B": None,
        "threshold": 0.1,
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
        **kwargs,
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")
        params = substitute_none_for_missing(
            configuration.kwargs, ["column_A", "column_B"]
        )
        if (params["column_A"] is None) or (params["column_B"] is None):
            template_str = " unrecognized kwargs for expect_column_pair_cramers_phi_value_to_be_less_than: missing column."
        else:
            template_str = "Values in $column_A and $column_B must be independent."
        rendered_string_template_content = RenderedStringTemplateContent(
            **{
                "content_block_type": "string_template",
                "string_template": {
                    "template": template_str,
                    "params": params,
                    "styling": styling,
                },
            }
        )

        return [rendered_string_template_content]

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
        observed_value = result.result.get("observed_value")
        column_A = result.expectation_config.kwargs["column_A"]
        column_B = result.expectation_config.kwargs["column_B"]
        crosstab = result.result.get("details", {}).get("crosstab")

        if observed_value is not None:
            observed_value = num_to_str(observed_value, precision=3, use_locale=True)
            if crosstab is not None:
                table = [[""] + list(crosstab.columns)]
                for col in range(len(crosstab)):
                    table.append([crosstab.index[col]] + list(crosstab.iloc[col, :]))

                return RenderedTableContent(
                    **{
                        "content_block_type": "table",
                        "header": f"Observed cramers phi of {observed_value}. \n"
                        f"Crosstab between {column_A} (rows) and {column_B} (columns):",
                        "table": table,
                        "styling": {
                            "body": {
                                "classes": [
                                    "table",
                                    "table-sm",
                                    "table-unbordered",
                                    "col-4",
                                    "mt-2",
                                ],
                            }
                        },
                    }
                )
            else:
                return observed_value
        else:
            return "--"
