import logging
import os
from collections import OrderedDict
from typing import List

from dateutil.parser import parse

from great_expectations.data_context.util import instantiate_class_from_config
from great_expectations.exceptions import ClassInstantiationError
from great_expectations.render.util import num_to_str

from ...core.expectation_validation_result import ExpectationSuiteValidationResult
from ...core.run_identifier import RunIdentifier
from ...validation_operators.types.validation_operator_result import (
    ValidationOperatorResult,
)
from ..types import (
    CollapseContent,
    RenderedDocumentContent,
    RenderedHeaderContent,
    RenderedMarkdownContent,
    RenderedSectionContent,
    RenderedStringTemplateContent,
    RenderedTableContent,
    TextContent,
)
from .renderer import Renderer

logger = logging.getLogger(__name__)


class ValidationResultsPageRenderer(Renderer):
    def __init__(self, column_section_renderer=None, run_info_at_end: bool = False):
        """
        Args:
            column_section_renderer:
            run_info_at_end: Move the run info (Info, Batch Markers, Batch Kwargs) to the end
                of the rendered output rather than after Statistics.
        """
        super().__init__()
        if column_section_renderer is None:
            column_section_renderer = {
                "class_name": "ValidationResultsColumnSectionRenderer"
            }
        module_name = "great_expectations.render.renderer.column_section_renderer"
        self._column_section_renderer = instantiate_class_from_config(
            config=column_section_renderer,
            runtime_environment={},
            config_defaults={
                "module_name": column_section_renderer.get("module_name", module_name)
            },
        )
        if not self._column_section_renderer:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=column_section_renderer["class_name"],
            )
        self.run_info_at_end = run_info_at_end

    def render_validation_operator_result(
        self, validation_operator_result: ValidationOperatorResult
    ) -> List[RenderedDocumentContent]:
        """
        Render a ValidationOperatorResult which can have multiple ExpectationSuiteValidationResult

        Args:
            validation_operator_result: ValidationOperatorResult

        Returns:
            List[RenderedDocumentContent]
        """
        return [
            self.render(validation_result)
            for validation_result in validation_operator_result.list_validation_results()
        ]

    # TODO: deprecate dual batch api support in 0.14
    def render(
        self,
        validation_results: ExpectationSuiteValidationResult,
        evaluation_parameters=None,
    ):
        run_id = validation_results.meta["run_id"]
        if isinstance(run_id, str):
            try:
                run_time = parse(run_id).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            except (ValueError, TypeError):
                run_time = "__none__"
            run_name = run_id
        elif isinstance(run_id, dict):
            run_name = run_id.get("run_name") or "__none__"
            try:
                run_time = parse(run_id.get("run_time")).strftime("%Y-%m-%dT%H:%M:%SZ")
            except (ValueError, TypeError):
                run_time = "__none__"
        elif isinstance(run_id, RunIdentifier):
            run_name = run_id.run_name or "__none__"
            run_time = run_id.run_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        expectation_suite_name = validation_results.meta["expectation_suite_name"]
        batch_kwargs = (
            validation_results.meta.get("batch_kwargs", {})
            or validation_results.meta.get("batch_spec", {})
            or {}
        )

        # add datasource key to batch_kwargs if missing
        if "datasource" not in batch_kwargs and "datasource" not in batch_kwargs:
            # check if expectation_suite_name follows datasource.batch_kwargs_generator.data_asset_name.suite_name pattern
            if len(expectation_suite_name.split(".")) == 4:
                if "batch_kwargs" in validation_results.meta:
                    batch_kwargs["datasource"] = expectation_suite_name.split(".")[0]
                else:
                    batch_kwargs["datasource"] = expectation_suite_name.split(".")[0]

        # Group EVRs by column
        columns = {}
        for evr in validation_results.results:
            if "column" in evr.expectation_config.kwargs:
                column = evr.expectation_config.kwargs["column"]
            else:
                column = "Table-Level Expectations"

            if column not in columns:
                columns[column] = []
            columns[column].append(evr)

        ordered_columns = Renderer._get_column_list_from_evrs(validation_results)
        overview_content_blocks = [
            self._render_validation_header(validation_results),
            self._render_validation_statistics(validation_results=validation_results),
        ]

        collapse_content_blocks = [
            self._render_validation_info(validation_results=validation_results)
        ]

        if validation_results.meta.get("batch_markers"):
            collapse_content_blocks.append(
                self._render_nested_table_from_dict(
                    input_dict=validation_results["meta"].get("batch_markers"),
                    header="Batch Markers",
                )
            )

        if validation_results.meta.get("batch_kwargs"):
            collapse_content_blocks.append(
                self._render_nested_table_from_dict(
                    input_dict=validation_results.meta.get("batch_kwargs"),
                    header="Batch Kwargs",
                )
            )

        if validation_results.meta.get("batch_parameters"):
            collapse_content_blocks.append(
                self._render_nested_table_from_dict(
                    input_dict=validation_results.meta.get("batch_parameters"),
                    header="Batch Parameters",
                )
            )

        if validation_results.meta.get("batch_spec"):
            collapse_content_blocks.append(
                self._render_nested_table_from_dict(
                    input_dict=validation_results.meta.get("batch_spec"),
                    header="Batch Spec",
                )
            )

        if validation_results.meta.get("batch_request"):
            collapse_content_blocks.append(
                self._render_nested_table_from_dict(
                    input_dict=validation_results.meta.get("batch_request"),
                    header="Batch Definition",
                )
            )

        collapse_content_block = CollapseContent(
            **{
                "collapse_toggle_link": "Show more info...",
                "collapse": collapse_content_blocks,
                "styling": {
                    "body": {"classes": ["card", "card-body"]},
                    "classes": ["col-12", "p-1"],
                },
            }
        )

        if not self.run_info_at_end:
            overview_content_blocks.append(collapse_content_block)

        sections = [
            RenderedSectionContent(
                **{
                    "section_name": "Overview",
                    "content_blocks": overview_content_blocks,
                }
            )
        ]

        if "Table-Level Expectations" in columns:
            sections += [
                self._column_section_renderer.render(
                    validation_results=columns["Table-Level Expectations"],
                    evaluation_parameters=validation_results.evaluation_parameters,
                )
            ]

        sections += [
            self._column_section_renderer.render(
                validation_results=columns[column],
                evaluation_parameters=validation_results.evaluation_parameters,
            )
            for column in ordered_columns
        ]
        if self.run_info_at_end:
            sections += [
                RenderedSectionContent(
                    **{
                        "section_name": "Run Info",
                        "content_blocks": collapse_content_blocks,
                    }
                )
            ]

        data_asset_name = batch_kwargs.get("data_asset_name")
        # Determine whether we have a custom run_name
        try:
            run_name_as_time = parse(run_name)
        except ValueError:
            run_name_as_time = None
        try:
            run_time_datetime = parse(run_time)
        except ValueError:
            run_time_datetime = None

        include_run_name: bool = False
        if run_name_as_time != run_time_datetime and run_name_as_time != "__none__":
            include_run_name = True

        page_title = "Validations / " + str(expectation_suite_name)
        if data_asset_name:
            page_title += " / " + str(data_asset_name)
        if include_run_name:
            page_title += " / " + str(run_name)
        page_title += " / " + str(run_time)

        return RenderedDocumentContent(
            **{
                "renderer_type": "ValidationResultsPageRenderer",
                "page_title": page_title,
                "batch_kwargs": batch_kwargs
                if "batch_kwargs" in validation_results.meta
                else None,
                "batch_spec": batch_kwargs
                if "batch_spec" in validation_results.meta
                else None,
                "expectation_suite_name": expectation_suite_name,
                "sections": sections,
                "utm_medium": "validation-results-page",
            }
        )

    @classmethod
    def _render_validation_header(cls, validation_results):
        success = validation_results.success
        expectation_suite_name = validation_results.meta["expectation_suite_name"]
        expectation_suite_path_components = (
            [".." for _ in range(len(expectation_suite_name.split(".")) + 3)]
            + ["expectations"]
            + str(expectation_suite_name).split(".")
        )
        expectation_suite_path = (
            os.path.join(*expectation_suite_path_components) + ".html"
        )
        # TODO: deprecate dual batch api support in 0.14
        batch_kwargs = (
            validation_results.meta.get("batch_kwargs", {})
            or validation_results.meta.get("batch_spec", {})
            or {}
        )
        data_asset_name = batch_kwargs.get("data_asset_name")

        if success:
            success = "Succeeded"
            html_success_icon = (
                '<i class="fas fa-check-circle text-success" aria-hidden="true"></i>'
            )
        else:
            success = "Failed"
            html_success_icon = (
                '<i class="fas fa-times text-danger" aria-hidden="true"></i>'
            )

        return RenderedHeaderContent(
            **{
                "content_block_type": "header",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Overview",
                            "tag": "h5",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "subheader": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "${suite_title} ${expectation_suite_name}\n ${data_asset} ${data_asset_name}\n ${status_title} ${html_success_icon} ${success}",
                            "params": {
                                "suite_title": "Expectation Suite:",
                                "data_asset": "Data asset:",
                                "data_asset_name": data_asset_name,
                                "status_title": "Status:",
                                "expectation_suite_name": expectation_suite_name,
                                "success": success,
                                "html_success_icon": html_success_icon,
                            },
                            "styling": {
                                "params": {
                                    "suite_title": {"classes": ["h6"]},
                                    "status_title": {"classes": ["h6"]},
                                    "expectation_suite_name": {
                                        "tag": "a",
                                        "attributes": {"href": expectation_suite_path},
                                    },
                                },
                                "classes": ["mb-0", "mt-1"],
                            },
                        },
                    }
                ),
                "styling": {
                    "classes": ["col-12", "p-0"],
                    "header": {"classes": ["alert", "alert-secondary"]},
                },
            }
        )

    @classmethod
    def _render_validation_info(cls, validation_results):
        run_id = validation_results.meta["run_id"]
        if isinstance(run_id, str):
            try:
                run_time = parse(run_id).strftime("%Y-%m-%dT%H:%M:%SZ")
            except (ValueError, TypeError):
                run_time = "__none__"
            run_name = run_id
        elif isinstance(run_id, dict):
            run_name = run_id.get("run_name") or "__none__"
            try:
                run_time = str(
                    parse(run_id.get("run_time")).strftime("%Y-%m-%dT%H:%M:%SZ")
                )
            except (ValueError, TypeError):
                run_time = "__none__"
        elif isinstance(run_id, RunIdentifier):
            run_name = run_id.run_name or "__none__"
            run_time = run_id.run_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        # TODO: Deprecate "great_expectations.__version__"
        ge_version = validation_results.meta.get(
            "great_expectations_version"
        ) or validation_results.meta.get("great_expectations.__version__")

        return RenderedTableContent(
            **{
                "content_block_type": "table",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Info",
                            "tag": "h6",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "table": [
                    ["Great Expectations Version", ge_version],
                    ["Run Name", run_name],
                    ["Run Time", run_time],
                ],
                "styling": {
                    "classes": ["col-12", "table-responsive", "mt-1"],
                    "body": {
                        "classes": ["table", "table-sm"],
                        "styles": {
                            "margin-bottom": "0.5rem !important",
                            "margin-top": "0.5rem !important",
                        },
                    },
                },
            }
        )

    @classmethod
    def _render_nested_table_from_dict(cls, input_dict, header=None, sub_table=False):
        table_rows = []
        for kwarg, value in input_dict.items():
            if not isinstance(value, (dict, OrderedDict)):
                table_row = [
                    RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {
                                "template": "$value",
                                "params": {"value": str(kwarg)},
                                "styling": {
                                    "default": {"styles": {"word-break": "break-all"}},
                                },
                            },
                            "styling": {
                                "parent": {
                                    "classes": ["pr-3"],
                                }
                            },
                        }
                    ),
                    RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {
                                "template": "$value",
                                "params": {"value": str(value)},
                                "styling": {
                                    "default": {"styles": {"word-break": "break-all"}},
                                },
                            },
                            "styling": {
                                "parent": {
                                    "classes": [],
                                }
                            },
                        }
                    ),
                ]
            else:
                table_row = [
                    RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {
                                "template": "$value",
                                "params": {"value": str(kwarg)},
                                "styling": {
                                    "default": {"styles": {"word-break": "break-all"}},
                                },
                            },
                            "styling": {
                                "parent": {
                                    "classes": ["pr-3"],
                                }
                            },
                        }
                    ),
                    cls._render_nested_table_from_dict(value, sub_table=True),
                ]
            table_rows.append(table_row)

        table_rows.sort(key=lambda row: row[0].string_template["params"]["value"])

        if sub_table:
            return RenderedTableContent(
                **{
                    "content_block_type": "table",
                    "table": table_rows,
                    "styling": {
                        "classes": ["col-6", "table-responsive"],
                        "body": {"classes": ["table", "table-sm", "m-0"]},
                        "parent": {"classes": ["pt-0", "pl-0", "border-top-0"]},
                    },
                }
            )
        else:
            return RenderedTableContent(
                **{
                    "content_block_type": "table",
                    "header": RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {
                                "template": header,
                                "tag": "h6",
                                "styling": {"classes": ["m-0"]},
                            },
                        }
                    ),
                    "table": table_rows,
                    "styling": {
                        "body": {
                            "classes": ["table", "table-sm"],
                            "styles": {
                                "margin-bottom": "0.5rem !important",
                                "margin-top": "0.5rem !important",
                            },
                        }
                    },
                }
            )

    @classmethod
    def _render_validation_statistics(cls, validation_results):
        statistics = validation_results.statistics
        statistics_dict = OrderedDict(
            [
                ("evaluated_expectations", "Evaluated Expectations"),
                ("successful_expectations", "Successful Expectations"),
                ("unsuccessful_expectations", "Unsuccessful Expectations"),
                ("success_percent", "Success Percent"),
            ]
        )
        table_rows = []
        for key, value in statistics_dict.items():
            if statistics.get(key) is not None:
                if key == "success_percent":
                    # table_rows.append([value, "{0:.2f}%".format(statistics[key])])
                    table_rows.append(
                        [value, num_to_str(statistics[key], precision=4) + "%"]
                    )
                else:
                    table_rows.append([value, statistics[key]])

        return RenderedTableContent(
            **{
                "content_block_type": "table",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Statistics",
                            "tag": "h6",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "table": table_rows,
                "styling": {
                    "classes": ["col-6", "table-responsive", "mt-1", "p-1"],
                    "body": {
                        "classes": ["table", "table-sm"],
                        "styles": {
                            "margin-bottom": "0.5rem !important",
                            "margin-top": "0.5rem !important",
                        },
                    },
                },
            }
        )


class ExpectationSuitePageRenderer(Renderer):
    def __init__(self, column_section_renderer=None):
        super().__init__()
        if column_section_renderer is None:
            column_section_renderer = {
                "class_name": "ExpectationSuiteColumnSectionRenderer"
            }
        module_name = "great_expectations.render.renderer.column_section_renderer"
        self._column_section_renderer = instantiate_class_from_config(
            config=column_section_renderer,
            runtime_environment={},
            config_defaults={
                "module_name": column_section_renderer.get("module_name", module_name)
            },
        )
        if not self._column_section_renderer:
            raise ClassInstantiationError(
                module_name=column_section_renderer,
                package_name=None,
                class_name=column_section_renderer["class_name"],
            )

    def render(self, expectations):
        columns, ordered_columns = self._group_and_order_expectations_by_column(
            expectations
        )
        expectation_suite_name = expectations.expectation_suite_name

        overview_content_blocks = [
            self._render_expectation_suite_header(),
            self._render_expectation_suite_info(expectations),
        ]

        table_level_expectations_content_block = self._render_table_level_expectations(
            columns
        )
        if table_level_expectations_content_block is not None:
            overview_content_blocks.append(table_level_expectations_content_block)

        asset_notes_content_block = self._render_expectation_suite_notes(expectations)
        if asset_notes_content_block is not None:
            overview_content_blocks.append(asset_notes_content_block)

        sections = [
            RenderedSectionContent(
                **{
                    "section_name": "Overview",
                    "content_blocks": overview_content_blocks,
                }
            )
        ]

        sections += [
            self._column_section_renderer.render(expectations=columns[column])
            for column in ordered_columns
            if column != "_nocolumn"
        ]
        return RenderedDocumentContent(
            **{
                "renderer_type": "ExpectationSuitePageRenderer",
                "page_title": "Expectations / " + str(expectation_suite_name),
                "expectation_suite_name": expectation_suite_name,
                "utm_medium": "expectation-suite-page",
                "sections": sections,
            }
        )

    def _render_table_level_expectations(self, columns):
        table_level_expectations = columns.get("_nocolumn")
        if not table_level_expectations:
            return None
        else:
            expectation_bullet_list = self._column_section_renderer.render(
                expectations=table_level_expectations
            ).content_blocks[1]
            expectation_bullet_list.header = RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {
                        "template": "Table-Level Expectations",
                        "tag": "h6",
                        "styling": {"classes": ["m-0"]},
                    },
                }
            )
            return expectation_bullet_list

    @classmethod
    def _render_expectation_suite_header(cls):
        return RenderedHeaderContent(
            **{
                "content_block_type": "header",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Overview",
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

    @classmethod
    def _render_expectation_suite_info(cls, expectations):
        expectation_suite_name = expectations.expectation_suite_name
        # TODO: Deprecate "great_expectations.__version__"
        ge_version = expectations.meta.get(
            "great_expectations_version"
        ) or expectations.meta.get("great_expectations.__version__")

        return RenderedTableContent(
            **{
                "content_block_type": "table",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Info",
                            "tag": "h6",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "table": [
                    ["Expectation Suite Name", expectation_suite_name],
                    ["Great Expectations Version", ge_version],
                ],
                "styling": {
                    "classes": ["col-12", "table-responsive", "mt-1"],
                    "body": {
                        "classes": ["table", "table-sm"],
                        "styles": {
                            "margin-bottom": "0.5rem !important",
                            "margin-top": "0.5rem !important",
                        },
                    },
                },
            }
        )

    # TODO: Update tests
    @classmethod
    def _render_expectation_suite_notes(cls, expectations):

        content = []

        total_expectations = len(expectations.expectations)
        columns = []
        for exp in expectations.expectations:
            if "column" in exp.kwargs:
                columns.append(exp.kwargs["column"])
        total_columns = len(set(columns))

        content += [
            # TODO: Leaving these two paragraphs as placeholders for later development.
            # "This Expectation suite was first generated by {BasicDatasetProfiler} on {date}, using version {xxx} of Great Expectations.",
            # "{name}, {name}, and {name} have also contributed additions and revisions.",
            "This Expectation suite currently contains %d total Expectations across %d columns."
            % (
                total_expectations,
                total_columns,
            ),
        ]

        if "notes" in expectations.meta:
            notes = expectations.meta["notes"]
            note_content = None

            if isinstance(notes, str):
                note_content = [notes]

            elif isinstance(notes, list):
                note_content = notes

            elif isinstance(notes, dict):
                if "format" in notes:
                    if notes["format"] == "string":
                        if isinstance(notes["content"], str):
                            note_content = [notes["content"]]
                        elif isinstance(notes["content"], list):
                            note_content = notes["content"]
                        else:
                            logger.warning(
                                "Unrecognized Expectation suite notes format. Skipping rendering."
                            )

                    elif notes["format"] == "markdown":
                        if isinstance(notes["content"], str):
                            note_content = [
                                RenderedMarkdownContent(
                                    **{
                                        "content_block_type": "markdown",
                                        "markdown": notes["content"],
                                        "styling": {"parent": {}},
                                    }
                                )
                            ]
                        elif isinstance(notes["content"], list):
                            note_content = [
                                RenderedMarkdownContent(
                                    **{
                                        "content_block_type": "markdown",
                                        "markdown": note,
                                        "styling": {"parent": {}},
                                    }
                                )
                                for note in notes["content"]
                            ]
                        else:
                            logger.warning(
                                "Unrecognized Expectation suite notes format. Skipping rendering."
                            )
                else:
                    logger.warning(
                        "Unrecognized Expectation suite notes format. Skipping rendering."
                    )

            if note_content is not None:
                content += note_content

        return TextContent(
            **{
                "content_block_type": "text",
                "header": RenderedStringTemplateContent(
                    **{
                        "content_block_type": "string_template",
                        "string_template": {
                            "template": "Notes",
                            "tag": "h6",
                            "styling": {"classes": ["m-0"]},
                        },
                    }
                ),
                "text": content,
                "styling": {
                    "classes": ["col-12", "table-responsive", "mt-1"],
                    "body": {"classes": ["table", "table-sm"]},
                },
            }
        )


class ProfilingResultsPageRenderer(Renderer):
    def __init__(self, overview_section_renderer=None, column_section_renderer=None):
        super().__init__()
        if overview_section_renderer is None:
            overview_section_renderer = {
                "class_name": "ProfilingResultsOverviewSectionRenderer"
            }
        if column_section_renderer is None:
            column_section_renderer = {
                "class_name": "ProfilingResultsColumnSectionRenderer"
            }
        module_name = "great_expectations.render.renderer.profiling_results_overview_section_renderer"
        self._overview_section_renderer = instantiate_class_from_config(
            config=overview_section_renderer,
            runtime_environment={},
            config_defaults={
                "module_name": overview_section_renderer.get("module_name", module_name)
            },
        )
        if not self._overview_section_renderer:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=overview_section_renderer["class_name"],
            )
        module_name = "great_expectations.render.renderer.column_section_renderer"
        self._column_section_renderer = instantiate_class_from_config(
            config=column_section_renderer,
            runtime_environment={},
            config_defaults={
                "module_name": column_section_renderer.get("module_name", module_name)
            },
        )
        if not self._column_section_renderer:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=column_section_renderer["class_name"],
            )

    def render(self, validation_results):
        run_id = validation_results.meta["run_id"]
        if isinstance(run_id, str):
            try:
                run_time = parse(run_id).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            except (ValueError, TypeError):
                run_time = "__none__"
            run_name = run_id
        elif isinstance(run_id, dict):
            run_name = run_id.get("run_name") or "__none__"
            run_time = run_id.get("run_time") or "__none__"
        elif isinstance(run_id, RunIdentifier):
            run_name = run_id.run_name or "__none__"
            run_time = run_id.run_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        expectation_suite_name = validation_results.meta["expectation_suite_name"]
        batch_kwargs = validation_results.meta.get(
            "batch_kwargs", {}
        ) or validation_results.meta.get("batch_spec", {})

        # add datasource key to batch_kwargs if missing
        if "datasource" not in batch_kwargs and "datasource" not in batch_kwargs:
            # check if expectation_suite_name follows datasource.batch_kwargs_generator.data_asset_name.suite_name pattern
            if len(expectation_suite_name.split(".")) == 4:
                if "batch_kwargs" in validation_results.meta:
                    batch_kwargs["datasource"] = expectation_suite_name.split(".")[0]
                else:
                    batch_kwargs["datasource"] = expectation_suite_name.split(".")[0]

        # Group EVRs by column
        # TODO: When we implement a ValidationResultSuite class, this method will move there.
        columns = self._group_evrs_by_column(validation_results)

        ordered_columns = Renderer._get_column_list_from_evrs(validation_results)
        column_types = self._overview_section_renderer._get_column_types(
            validation_results
        )

        data_asset_name = batch_kwargs.get("data_asset_name")
        # Determine whether we have a custom run_name
        try:
            run_name_as_time = parse(run_name)
        except ValueError:
            run_name_as_time = None
        try:
            run_time_datetime = parse(run_time)
        except ValueError:
            run_time_datetime = None

        include_run_name: bool = False
        if run_name_as_time != run_time_datetime and run_name_as_time != "__none__":
            include_run_name = True

        page_title = "Profiling Results / " + str(expectation_suite_name)
        if data_asset_name:
            page_title += " / " + str(data_asset_name)
        if include_run_name:
            page_title += " / " + str(run_name)
        page_title += " / " + str(run_time)

        return RenderedDocumentContent(
            **{
                "renderer_type": "ProfilingResultsPageRenderer",
                "page_title": page_title,
                "expectation_suite_name": expectation_suite_name,
                "utm_medium": "profiling-results-page",
                "batch_kwargs": batch_kwargs
                if "batch_kwargs" in validation_results.meta
                else None,
                "batch_spec": batch_kwargs
                if "batch_spec" in validation_results.meta
                else None,
                "sections": [
                    self._overview_section_renderer.render(
                        validation_results, section_name="Overview"
                    )
                ]
                + [
                    self._column_section_renderer.render(
                        columns[column],
                        section_name=column,
                        column_type=column_types.get(column),
                    )
                    for column in ordered_columns
                ],
            }
        )
