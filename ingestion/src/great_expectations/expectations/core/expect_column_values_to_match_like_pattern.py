from typing import Optional

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.util import substitute_none_for_missing
from ..expectation import ColumnMapExpectation, InvalidExpectationConfigurationError

try:
    import sqlalchemy as sa
except ImportError:
    pass


class ExpectColumnValuesToMatchLikePattern(ColumnMapExpectation):
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column map expectation"],
        "contributors": [
            "@great_expectations",
        ],
        "requirements": [],
    }

    map_metric = "column_values.match_like_pattern"
    success_keys = (
        "mostly",
        "like_pattern",
    )

    default_kwarg_values = {
        "like_pattern": None,
        "row_condition": None,
        "condition_parser": None,  # we expect this to be explicitly set whenever a row_condition is passed
        "mostly": 1,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": True,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)
        try:
            assert "like_pattern" in configuration.kwargs, "Must provide like_pattern"
            assert isinstance(
                configuration.kwargs.get("like_pattern"), (str, dict)
            ), "like_pattern must be a string"
            if isinstance(configuration.kwargs.get("like_pattern"), dict):
                assert "$PARAMETER" in configuration.kwargs.get(
                    "like_pattern"
                ), 'Evaluation Parameter dict for like_pattern kwarg must have "$PARAMETER" key.'

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
            ["column", "mostly", "row_condition", "condition_parser"],
        )
