import warnings

from great_expectations.render.renderer import ValidationResultsPageRenderer
from great_expectations.render.view import DefaultMarkdownPageView
from great_expectations.validation_operators.types.validation_operator_result import (
    ValidationOperatorResult,
)


def render_multiple_validation_result_pages_markdown(
    validation_operator_result: ValidationOperatorResult,
    run_info_at_end: bool = True,
) -> str:
    """
    Loop through and render multiple validation results to markdown.
    Args:
        validation_operator_result: (ValidationOperatorResult) Result of validation operator run
        run_info_at_end: move run info below expectation results
    Returns:
        string containing formatted markdown validation results
    """

    warnings.warn(
        "This 'render_multiple_validation_result_pages_markdown' function will be deprecated "
        "Please use ValidationResultsPageRenderer.render_validation_operator_result() instead."
        "E.g. to replicate the functionality of rendering a ValidationOperatorResult to markdown:"
        "validation_results_page_renderer = ValidationResultsPageRenderer("
        "    run_info_at_end=run_info_at_end"
        ")"
        "rendered_document_content_list = validation_results_page_renderer.render_validation_operator_result("
        "   validation_operator_result=validation_operator_result"
        ")"
        'return " ".join(DefaultMarkdownPageView().render(rendered_document_content_list))'
        "Please update code accordingly.",
        DeprecationWarning,
    )

    validation_results_page_renderer = ValidationResultsPageRenderer(
        run_info_at_end=run_info_at_end
    )
    rendered_document_content_list = (
        validation_results_page_renderer.render_validation_operator_result(
            validation_operator_result=validation_operator_result
        )
    )

    return " ".join(DefaultMarkdownPageView().render(rendered_document_content_list))
