import json
import logging
import re
import traceback

import altair as alt
import pandas as pd

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.core.expectation_validation_result import (
    ExpectationValidationResult,
)
from great_expectations.data_context.util import instantiate_class_from_config
from great_expectations.exceptions import ClassInstantiationError
from great_expectations.expectations.core.expect_column_kl_divergence_to_be_less_than import (
    ExpectColumnKlDivergenceToBeLessThan,
)
from great_expectations.expectations.registry import get_renderer_impl
from great_expectations.render.renderer.content_block import (
    ExceptionListContentBlockRenderer,
)
from great_expectations.render.renderer.renderer import Renderer
from great_expectations.render.types import (
    RenderedBulletListContent,
    RenderedGraphContent,
    RenderedHeaderContent,
    RenderedSectionContent,
    RenderedStringTemplateContent,
    RenderedTableContent,
    TextContent,
    ValueListContent,
)
from great_expectations.util import load_class, verify_dynamic_loading_support

logger = logging.getLogger(__name__)


def convert_to_string_and_escape(var):
    return re.sub(r"\$", r"$$", str(var))


class ColumnSectionRenderer(Renderer):
    def __init__(self):
        super().__init__()

    @classmethod
    def _get_column_name(cls, ge_object):
        # This is broken out for ease of locating future validation here
        if isinstance(ge_object, list):
            candidate_object = ge_object[0]
        else:
            candidate_object = ge_object
        try:
            if isinstance(candidate_object, ExpectationConfiguration):
                return candidate_object.kwargs["column"]
            elif isinstance(candidate_object, ExpectationValidationResult):
                return candidate_object.expectation_config.kwargs["column"]
            else:
                raise ValueError(
                    "Provide a column section renderer an expectation, list of expectations, evr, or list of evrs."
                )
        except KeyError:
            return "Table-Level Expectations"


class ProfilingResultsColumnSectionRenderer(ColumnSectionRenderer):
    def __init__(self, properties_table_renderer=None, runtime_environment=None):
        super().__init__()
        if properties_table_renderer is None:
            properties_table_renderer = {
                "class_name": "ProfilingColumnPropertiesTableContentBlockRenderer"
            }
        module_name = "great_expectations.render.renderer.content_block"
        self._properties_table_renderer = instantiate_class_from_config(
            config=properties_table_renderer,
            runtime_environment=runtime_environment,
            config_defaults={"module_name": module_name},
        )
        if not self._properties_table_renderer:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=properties_table_renderer["class_name"],
            )

        self.content_block_function_names = [
            "_render_header",
            "_render_properties_table",
            "_render_quantile_table",
            "_render_stats_table",
            "_render_values_set",
            "_render_histogram",
            "_render_value_counts_bar_chart",
            "_render_failed",
        ]

    # Note: Seems awkward to pass section_name and column_type into this renderer.
    # Can't we figure that out internally?
    def render(self, evrs, section_name=None, column_type=None):
        if section_name is None:
            column = self._get_column_name(evrs)
        else:
            column = section_name

        content_blocks = []

        for content_block_function_name in self.content_block_function_names:
            try:
                if content_block_function_name == "_render_header":
                    content_blocks.append(
                        getattr(self, content_block_function_name)(evrs, column_type)
                    )
                else:
                    content_blocks.append(
                        getattr(self, content_block_function_name)(evrs)
                    )
            except Exception as e:
                exception_message = f"""\
An unexpected Exception occurred during data docs rendering.  Because of this error, certain parts of data docs will \
not be rendered properly and/or may not appear altogether.  Please use the trace, included in this message, to \
diagnose and repair the underlying issue.  Detailed information follows:
                """
                exception_traceback = traceback.format_exc()
                exception_message += f'{type(e).__name__}: "{str(e)}".  Traceback: "{exception_traceback}".'
                logger.error(exception_message)

        # NOTE : Some render* functions return None so we filter them out
        populated_content_blocks = list(filter(None, content_blocks))

        return RenderedSectionContent(
            **{
                "section_name": column,
                "content_blocks": populated_content_blocks,
            }
        )

    @classmethod
    def _render_header(cls, evrs, column_type=None):
        # NOTE: This logic is brittle
        try:
            column_name = evrs[0].expectation_config.kwargs["column"]
        except KeyError:
            column_name = "Table-level expectations"

        return RenderedHeaderContent(
            **{
                "content_block_type": "header",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": convert_to_string_and_escape(column_name),
                            "tooltip": {
                                "content": "expect_column_to_exist",
                                "placement": "top",
                            },
                            "tag": "h5",
                            "styling": {"classes": ["m-0", "p-0"]},
                        },
                    }
                ),
                "subheader": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Type: {column_type}".format(
                                column_type=column_type
                            ),
                            "tooltip": {
                                "content": "expect_column_values_to_be_of_type <br>expect_column_values_to_be_in_type_list",
                            },
                            "tag": "h6",
                            "styling": {"classes": ["mt-1", "mb-0"]},
                        },
                    }
                ),
                # {
                #     "template": column_type,
                # },
                "styling": {
                    "classes": ["col-12", "p-0"],
                    "header": {"classes": ["alert", "alert-secondary"]},
                },
            }
        )

    @classmethod
    def _render_expectation_types(cls, evrs, content_blocks):
        # NOTE: The evr-fetching function is an kinda similar to the code other_section_
        # renderer.ProfilingResultsOverviewSectionRenderer._render_expectation_types

        # type_counts = defaultdict(int)

        # for evr in evrs:
        #     type_counts[evr.expectation_config.expectation_type] += 1

        # bullet_list = sorted(type_counts.items(), key=lambda kv: -1*kv[1])

        bullet_list = [
            {
                "content_block_type": "string_template",
                "string_template": {
                    "template": "$expectation_type $is_passing",
                    "params": {
                        "expectation_type": evr.expectation_config.expectation_type,
                        "is_passing": str(evr.success),
                    },
                    "styling": {
                        "classes": [
                            "list-group-item",
                            "d-flex",
                            "justify-content-between",
                            "align-items-center",
                        ],
                        "params": {
                            "is_passing": {
                                "classes": ["badge", "badge-secondary", "badge-pill"],
                            }
                        },
                    },
                },
            }
            for evr in evrs
        ]

        content_blocks.append(
            RenderedBulletListContent(
                **{
                    "content_block_type": "bullet_list",
                    "header": RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {
                                "template": 'Expectation types <span class="mr-3 triangle"></span>',
                                "tag": "h6",
                            },
                        }
                    ),
                    "bullet_list": bullet_list,
                    "styling": {
                        "classes": ["col-12", "mt-1"],
                        "header": {
                            "classes": ["collapsed"],
                            "attributes": {
                                "data-toggle": "collapse",
                                "href": "#{{content_block_id}}-body",
                                "role": "button",
                                "aria-expanded": "true",
                                "aria-controls": "collapseExample",
                            },
                            "styles": {
                                "cursor": "pointer",
                            },
                        },
                        "body": {
                            "classes": ["list-group", "collapse"],
                        },
                    },
                }
            )
        )

    def _render_properties_table(self, evrs):
        evr_list = [
            self._find_evr_by_type(
                evrs, "expect_column_unique_value_count_to_be_between"
            ),
            self._find_evr_by_type(
                evrs, "expect_column_proportion_of_unique_values_to_be_between"
            ),
            self._find_evr_by_type(evrs, "expect_column_values_to_not_be_null"),
            self._find_evr_by_type(evrs, "expect_column_values_to_not_match_regex"),
        ]
        evrs = [evr for evr in evr_list if (evr is not None)]

        if len(evrs) > 0:
            new_content_block = self._properties_table_renderer.render(evrs)
            new_content_block.header = RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {"template": "Properties", "tag": "h6"},
                }
            )
            new_content_block.styling = {
                "classes": ["col-3", "mt-1", "pl-1", "pr-1"],
                "body": {
                    "classes": ["table", "table-sm", "table-unbordered"],
                    "styles": {"width": "100%"},
                },
            }
            return new_content_block

    @classmethod
    def _render_quantile_table(cls, evrs):
        quantile_evr = cls._find_evr_by_type(
            evrs, "expect_column_quantile_values_to_be_between"
        )

        if not quantile_evr or quantile_evr.exception_info["raised_exception"]:
            return

        quantile_table_renderer = get_renderer_impl(
            object_name="expect_column_quantile_values_to_be_between",
            renderer_type="renderer.descriptive.quantile_table",
        )[1]
        return quantile_table_renderer(result=quantile_evr)

    @classmethod
    def _render_stats_table(cls, evrs):
        expectation_renderers = {
            "expect_column_mean_to_be_between": "renderer.descriptive.stats_table.mean_row",
            "expect_column_min_to_be_between": "renderer.descriptive.stats_table.min_row",
            "expect_column_max_to_be_between": "renderer.descriptive.stats_table.max_row",
        }

        table_rows = []

        for expectation_type, renderer_type in expectation_renderers.items():
            evr = cls._find_evr_by_type(evrs, expectation_type)
            if evr and not evr.exception_info["raised_exception"]:
                renderer_impl = get_renderer_impl(
                    object_name=expectation_type, renderer_type=renderer_type
                )[1]
                table_rows.append(renderer_impl(result=evr))

        if len(table_rows) > 0:
            return RenderedTableContent(
                **{
                    "content_block_type": "table",
                    "header": RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {"template": "Statistics", "tag": "h6"},
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
        else:
            return

    @classmethod
    def _render_values_set(cls, evrs):
        set_evr = cls._find_evr_by_type(evrs, "expect_column_values_to_be_in_set")

        if not set_evr or set_evr.exception_info["raised_exception"]:
            return
        if (
            set_evr
            and "partial_unexpected_counts" not in set_evr.result
            and "partial_unexpected_list" not in set_evr.result
        ):
            return

        return get_renderer_impl(
            object_name="expect_column_values_to_be_in_set",
            renderer_type="renderer.descriptive.example_values_block",
        )[1](result=set_evr)

    def _render_histogram(self, evrs):
        # NOTE: This code is very brittle
        kl_divergence_evr = self._find_evr_by_type(
            evrs, "expect_column_kl_divergence_to_be_less_than"
        )
        # print(json.dumps(kl_divergence_evr, indent=2))
        if (
            kl_divergence_evr is None
            or kl_divergence_evr.result is None
            or "details" not in kl_divergence_evr.result
        ):
            return

        return get_renderer_impl(
            object_name="expect_column_kl_divergence_to_be_less_than",
            renderer_type="renderer.descriptive.histogram",
        )[1](result=kl_divergence_evr)

    @classmethod
    def _render_value_counts_bar_chart(cls, evrs):
        distinct_values_set_evr = cls._find_evr_by_type(
            evrs, "expect_column_distinct_values_to_be_in_set"
        )
        if (
            not distinct_values_set_evr
            or distinct_values_set_evr.exception_info["raised_exception"]
        ):
            return

        return get_renderer_impl(
            object_name="expect_column_distinct_values_to_be_in_set",
            renderer_type="renderer.descriptive.value_counts_bar_chart",
        )[1](result=distinct_values_set_evr)

    @classmethod
    def _render_failed(cls, evrs):
        return ExceptionListContentBlockRenderer.render(evrs, include_column_name=False)

    @classmethod
    def _render_unrecognized(cls, evrs, content_blocks):
        unrendered_blocks = []
        new_block = None
        for evr in evrs:
            if evr.expectation_config.expectation_type not in [
                "expect_column_to_exist",
                "expect_column_values_to_be_of_type",
                "expect_column_values_to_be_in_set",
                "expect_column_unique_value_count_to_be_between",
                "expect_column_proportion_of_unique_values_to_be_between",
                "expect_column_values_to_not_be_null",
                "expect_column_max_to_be_between",
                "expect_column_mean_to_be_between",
                "expect_column_min_to_be_between",
            ]:
                new_block = TextContent(**{"content_block_type": "text", "text": []})
                new_block["content"].append(
                    """
    <div class="alert alert-primary" role="alert">
        Warning! Unrendered EVR:<br/>
    <pre>"""
                    + json.dumps(evr, indent=2)
                    + """</pre>
    </div>
                """
                )

        if new_block is not None:
            unrendered_blocks.append(new_block)

        # print(unrendered_blocks)
        content_blocks += unrendered_blocks


class ValidationResultsColumnSectionRenderer(ColumnSectionRenderer):
    def __init__(self, table_renderer=None):
        super().__init__()
        if table_renderer is None:
            table_renderer = {
                "class_name": "ValidationResultsTableContentBlockRenderer"
            }
        module_name = table_renderer.get(
            "module_name", "great_expectations.render.renderer.content_block"
        )
        verify_dynamic_loading_support(module_name=module_name)
        class_name = table_renderer.get("class_name")
        self._table_renderer = load_class(
            class_name=class_name, module_name=module_name
        )

    @classmethod
    def _render_header(cls, validation_results):
        column = cls._get_column_name(validation_results)

        new_block = RenderedHeaderContent(
            **{
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": convert_to_string_and_escape(column),
                            "tag": "h5",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "styling": {
                    "classes": ["col-12", "p-0"],
                    "header": {"classes": ["alert", "alert-secondary"]},
                },
            }
        )

        return validation_results, new_block

    def _render_table(self, validation_results, evaluation_parameters=None):
        new_block = self._table_renderer.render(
            validation_results,
            include_column_name=False,
            evaluation_parameters=evaluation_parameters,
        )
        return [], new_block

    def render(self, validation_results, evaluation_parameters=None):
        column = self._get_column_name(validation_results)
        content_blocks = []
        remaining_evrs, content_block = self._render_header(validation_results)
        content_blocks.append(content_block)
        remaining_evrs, content_block = self._render_table(
            remaining_evrs, evaluation_parameters
        )
        content_blocks.append(content_block)
        return RenderedSectionContent(
            **{"section_name": column, "content_blocks": content_blocks}
        )


class ExpectationSuiteColumnSectionRenderer(ColumnSectionRenderer):
    def __init__(self, bullet_list_renderer=None):
        super().__init__()
        if bullet_list_renderer is None:
            bullet_list_renderer = {
                "class_name": "ExpectationSuiteBulletListContentBlockRenderer"
            }
        module_name = bullet_list_renderer.get(
            "module_name", "great_expectations.render.renderer.content_block"
        )
        verify_dynamic_loading_support(module_name=module_name)
        class_name = bullet_list_renderer.get("class_name")
        self._bullet_list_renderer = load_class(
            class_name=class_name, module_name=module_name
        )

    @classmethod
    def _render_header(cls, expectations):
        column = cls._get_column_name(expectations)

        new_block = RenderedHeaderContent(
            **{
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": convert_to_string_and_escape(column),
                            "tag": "h5",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "styling": {
                    "classes": ["col-12"],
                    "header": {"classes": ["alert", "alert-secondary"]},
                },
            }
        )

        return expectations, new_block

    def _render_bullet_list(self, expectations):

        new_block = self._bullet_list_renderer.render(
            expectations,
            include_column_name=False,
        )

        return [], new_block

    def render(self, expectations):
        column = self._get_column_name(expectations)

        content_blocks = []
        remaining_expectations, header_block = self._render_header(expectations)
        content_blocks.append(header_block)
        # remaining_expectations, content_blocks = cls._render_column_type(
        # remaining_expectations, content_blocks)
        remaining_expectations, bullet_block = self._render_bullet_list(
            remaining_expectations
        )
        content_blocks.append(bullet_block)

        # NOTE : Some render* functions return None so we filter them out
        populated_content_blocks = list(filter(None, content_blocks))
        return RenderedSectionContent(
            section_name=column, content_blocks=populated_content_blocks
        )
