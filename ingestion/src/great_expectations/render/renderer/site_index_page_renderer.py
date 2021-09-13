import datetime
import json
import logging
import traceback

import tzlocal
from dateutil.parser import parse

from great_expectations.render.types import (
    RenderedBootstrapTableContent,
    RenderedDocumentContent,
    RenderedHeaderContent,
    RenderedSectionContent,
    RenderedStringTemplateContent,
    RenderedTabsContent,
)

from .call_to_action_renderer import CallToActionRenderer
from .renderer import Renderer

logger = logging.getLogger(__name__)


# FIXME : This class needs to be rebuilt to accept SiteSectionIdentifiers as input.
# FIXME : This class needs tests.
class SiteIndexPageRenderer(Renderer):
    @classmethod
    def _generate_expectation_suites_link_table(cls, index_links_dict):
        table_options = {
            "search": "true",
            "trimOnSearch": "false",
            "visibleSearch": "true",
            "rowStyle": "rowStyleLinks",
            "rowAttributes": "rowAttributesLinks",
            "sortName": "expectation_suite_name",
            "sortOrder": "asc",
            "pagination": "true",
            "iconSize": "sm",
            "toolbarAlign": "right",
        }
        table_columns = [
            {
                "field": "expectation_suite_name",
                "title": "Expectation Suites",
                "sortable": "true",
            },
        ]
        expectation_suite_link_dicts = index_links_dict.get("expectations_links", [])
        table_data = []

        for dict_ in expectation_suite_link_dicts:
            table_data.append(
                {
                    "expectation_suite_name": dict_.get("expectation_suite_name"),
                    "_table_row_link_path": dict_.get("filepath"),
                }
            )

        return RenderedBootstrapTableContent(
            **{
                "table_columns": table_columns,
                "table_data": table_data,
                "table_options": table_options,
                "styling": {
                    "classes": ["col-12", "ge-index-page-table-container"],
                    "body": {
                        "classes": [
                            "table-sm",
                            "ge-index-page-expectation_suites-table",
                        ]
                    },
                },
            }
        )

    # TODO: deprecate dual batch api support in 0.14
    @classmethod
    def _generate_profiling_results_link_table(cls, index_links_dict):
        table_options = {
            "search": "true",
            "trimOnSearch": "false",
            "visibleSearch": "true",
            "rowStyle": "rowStyleLinks",
            "rowAttributes": "rowAttributesLinks",
            "sortName": "run_time",
            "sortOrder": "desc",
            "pagination": "true",
            "filterControl": "true",
            "iconSize": "sm",
            "toolbarAlign": "right",
        }
        table_columns = [
            {
                "field": "run_time",
                "title": "Run Time",
                "sortName": "_run_time_sort",
                "sortable": "true",
                "filterControl": "datepicker",
            },
            {
                "field": "asset_name",
                "title": "Asset Name",
                "sortable": "true",
                "filterControl": "select",
            },
            {
                "field": "batch_identifier",
                "title": "Batch ID",
                "sortName": "_batch_identifier_sort",
                "sortable": "true",
                "filterControl": "input",
            },
            {
                "field": "profiler_name",
                "title": "Profiler",
                "sortable": "true",
                "filterControl": "select",
            },
        ]
        profiling_link_dicts = index_links_dict.get("profiling_links", [])
        table_data = []

        for dict_ in profiling_link_dicts:
            table_data.append(
                {
                    "run_time": cls._get_formatted_datetime(dict_.get("run_time")),
                    "_run_time_sort": cls._get_timestamp(dict_.get("run_time")),
                    "asset_name": dict_.get("asset_name"),
                    "batch_identifier": cls._render_batch_id_cell(
                        dict_.get("batch_identifier"),
                        dict_.get("batch_kwargs"),
                        dict_.get("batch_spec"),
                    ),
                    "_batch_identifier_sort": dict_.get("batch_identifier"),
                    "profiler_name": dict_.get("expectation_suite_name").split(".")[-1],
                    "_table_row_link_path": dict_.get("filepath"),
                }
            )

        return RenderedBootstrapTableContent(
            **{
                "table_columns": table_columns,
                "table_data": table_data,
                "table_options": table_options,
                "styling": {
                    "classes": ["col-12", "ge-index-page-table-container"],
                    "body": {
                        "classes": ["table-sm", "ge-index-page-profiling-results-table"]
                    },
                },
            }
        )

    # TODO: deprecate dual batch api support in 0.14
    @classmethod
    def _generate_validation_results_link_table(cls, index_links_dict):
        table_options = {
            "search": "true",
            "trimOnSearch": "false",
            "visibleSearch": "true",
            "rowStyle": "rowStyleLinks",
            "rowAttributes": "rowAttributesLinks",
            "sortName": "run_time",
            "sortOrder": "desc",
            "pagination": "true",
            "filterControl": "true",
            "iconSize": "sm",
            "toolbarAlign": "right",
        }

        table_columns = [
            {
                "field": "validation_success",
                "title": "Status",
                "sortable": "true",
                "align": "center",
                "filterControl": "select",
                "filterDataCollector": "validationSuccessFilterDataCollector",
            },
            {
                "field": "run_time",
                "title": "Run Time",
                "sortName": "_run_time_sort",
                "sortable": "true",
                "filterControl": "datepicker",
            },
            {
                "field": "run_name",
                "title": "Run Name",
                "sortable": "true",
                "filterControl": "input",
            },
            {
                "field": "asset_name",
                "title": "Asset Name",
                "sortable": "true",
                "filterControl": "select",
            },
            {
                "field": "batch_identifier",
                "title": "Batch ID",
                "sortName": "_batch_identifier_sort",
                "sortable": "true",
                "filterControl": "input",
            },
            {
                "field": "expectation_suite_name",
                "title": "Expectation Suite",
                "sortName": "_expectation_suite_name_sort",
                "sortable": "true",
                "filterControl": "select",
                "filterDataCollector": "expectationSuiteNameFilterDataCollector",
            },
        ]
        validation_link_dicts = index_links_dict.get("validations_links", [])
        table_data = []

        for dict_ in validation_link_dicts:
            table_data.append(
                {
                    "validation_success": cls._render_validation_success_cell(
                        dict_.get("validation_success")
                    ),
                    "run_time": cls._get_formatted_datetime(dict_.get("run_time")),
                    "_run_time_sort": cls._get_timestamp(dict_.get("run_time")),
                    "run_name": dict_.get("run_name"),
                    "batch_identifier": cls._render_batch_id_cell(
                        dict_.get("batch_identifier"),
                        dict_.get("batch_kwargs"),
                        dict_.get("batch_spec"),
                    ),
                    "_batch_identifier_sort": dict_.get("batch_identifier"),
                    "expectation_suite_name": cls._render_expectation_suite_cell(
                        dict_.get("expectation_suite_name"),
                        dict_.get("expectation_suite_filepath"),
                    ),
                    "_expectation_suite_name_sort": dict_.get("expectation_suite_name"),
                    "_table_row_link_path": dict_.get("filepath"),
                    "_validation_success_text": "Success"
                    if dict_.get("validation_success")
                    else "Failed",
                    "asset_name": dict_.get("asset_name"),
                }
            )

        return RenderedBootstrapTableContent(
            **{
                "table_columns": table_columns,
                "table_data": table_data,
                "table_options": table_options,
                "styling": {
                    "classes": ["col-12", "ge-index-page-table-container"],
                    "body": {
                        "classes": [
                            "table-sm",
                            "ge-index-page-validation-results-table",
                        ]
                    },
                },
            }
        )

    @classmethod
    def _render_expectation_suite_cell(
        cls, expectation_suite_name, expectation_suite_path
    ):
        return RenderedStringTemplateContent(
            **{
                "content_block_type": "string_template",
                "string_template": {
                    "template": "$link_text",
                    "params": {"link_text": expectation_suite_name},
                    "tag": "a",
                    "styling": {
                        "styles": {"word-break": "break-all"},
                        "attributes": {"href": expectation_suite_path},
                        "classes": ["ge-index-page-table-expectation-suite-link"],
                    },
                },
            }
        )

    # TODO: deprecate dual batch api support in 0.14
    @classmethod
    def _render_batch_id_cell(cls, batch_id, batch_kwargs=None, batch_spec=None):
        if batch_kwargs:
            content_title = "Batch Kwargs"
            content = json.dumps(batch_kwargs, indent=2)
        else:
            content_title = "Batch Spec"
            content = json.dumps(batch_spec, indent=2)
        return RenderedStringTemplateContent(
            **{
                "content_block_type": "string_template",
                "string_template": {
                    "template": str(batch_id),
                    "tooltip": {
                        "content": f"{content_title}:\n\n{content}",
                        "placement": "top",
                    },
                    "styling": {"classes": ["m-0", "p-0"]},
                },
            }
        )

    @classmethod
    def _get_formatted_datetime(cls, _datetime):
        if isinstance(_datetime, datetime.datetime):
            local_datetime = _datetime.astimezone(tz=tzlocal.get_localzone())
            return local_datetime.strftime("%Y-%m-%d %H:%M:%S %Z")
        elif isinstance(_datetime, str):
            dt = parse(_datetime)
            local_datetime = dt.astimezone(tz=tzlocal.get_localzone())
            return local_datetime.strftime("%Y-%m-%d %H:%M:%S %Z")
        else:
            return None

    @classmethod
    def _get_timestamp(cls, _datetime):
        if isinstance(_datetime, datetime.datetime):
            return _datetime.timestamp()
        elif isinstance(_datetime, str):
            return parse(_datetime).timestamp()
        else:
            return ""

    @classmethod
    def _render_validation_success_cell(cls, validation_success):
        return RenderedStringTemplateContent(
            **{
                "content_block_type": "string_template",
                "string_template": {
                    "template": "$validation_success",
                    "params": {"validation_success": ""},
                    "styling": {
                        "params": {
                            "validation_success": {
                                "tag": "i",
                                "classes": [
                                    "fas",
                                    "fa-check-circle",
                                    "text-success",
                                    "ge-success-icon",
                                ]
                                if validation_success
                                else [
                                    "fas",
                                    "fa-times",
                                    "text-danger",
                                    "ge-failed-icon",
                                ],
                            }
                        },
                        "classes": ["ge-index-page-table-validation-links-item"],
                    },
                },
            }
        )

    @classmethod
    def render(cls, index_links_dict):
        sections = []
        cta_object = index_links_dict.pop("cta_object", None)

        try:
            content_blocks = []
            # site name header
            site_name_header_block = RenderedHeaderContent(
                **{
                    "content_block_type": "header",
                    "header": RenderedStringTemplateContent(
                        **{
                            "content_block_type": "string_template",
                            "string_template": {
                                "template": "$title_prefix | $site_name",
                                "params": {
                                    "site_name": index_links_dict.get("site_name"),
                                    "title_prefix": "Data Docs",
                                },
                                "styling": {
                                    "params": {"title_prefix": {"tag": "strong"}}
                                },
                            },
                        }
                    ),
                    "styling": {
                        "classes": ["col-12", "ge-index-page-site-name-title"],
                        "header": {"classes": ["alert", "alert-secondary"]},
                    },
                }
            )
            content_blocks.append(site_name_header_block)

            tabs = []

            if index_links_dict.get("validations_links"):
                tabs.append(
                    {
                        "tab_name": "Validation Results",
                        "tab_content": cls._generate_validation_results_link_table(
                            index_links_dict
                        ),
                    }
                )
            if index_links_dict.get("profiling_links"):
                tabs.append(
                    {
                        "tab_name": "Profiling Results",
                        "tab_content": cls._generate_profiling_results_link_table(
                            index_links_dict
                        ),
                    }
                )
            if index_links_dict.get("expectations_links"):
                tabs.append(
                    {
                        "tab_name": "Expectation Suites",
                        "tab_content": cls._generate_expectation_suites_link_table(
                            index_links_dict
                        ),
                    }
                )

            tabs_content_block = RenderedTabsContent(
                **{
                    "tabs": tabs,
                    "styling": {
                        "classes": ["col-12", "ge-index-page-tabs-container"],
                    },
                }
            )

            content_blocks.append(tabs_content_block)

            section = RenderedSectionContent(
                **{
                    "section_name": index_links_dict.get("site_name"),
                    "content_blocks": content_blocks,
                }
            )
            sections.append(section)

            index_page_document = RenderedDocumentContent(
                **{
                    "renderer_type": "SiteIndexPageRenderer",
                    "utm_medium": "index-page",
                    "sections": sections,
                }
            )

            if cta_object:
                index_page_document.cta_footer = CallToActionRenderer.render(cta_object)

            return index_page_document

        except Exception as e:
            exception_message = f"""\
An unexpected Exception occurred during data docs rendering.  Because of this error, certain parts of data docs will \
not be rendered properly and/or may not appear altogether.  Please use the trace, included in this message, to \
diagnose and repair the underlying issue.  Detailed information follows:
            """
            exception_traceback = traceback.format_exc()
            exception_message += (
                f'{type(e).__name__}: "{str(e)}".  Traceback: "{exception_traceback}".'
            )
            logger.error(exception_message)
