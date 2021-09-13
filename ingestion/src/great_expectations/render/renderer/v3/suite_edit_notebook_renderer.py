import os
from typing import Any, Dict, List, Optional, Union

import jinja2
import nbformat

from great_expectations import DataContext
from great_expectations.cli.batch_request import (
    standardize_batch_request_display_ordering,
)
from great_expectations.core import ExpectationConfiguration
from great_expectations.core.batch import BatchRequest
from great_expectations.core.expectation_suite import ExpectationSuite
from great_expectations.data_context.types.base import (
    NotebookConfig,
    NotebookTemplateConfig,
    notebookConfigSchema,
)
from great_expectations.data_context.util import instantiate_class_from_config
from great_expectations.exceptions import (
    SuiteEditNotebookCustomTemplateModuleNotFoundError,
)
from great_expectations.render.renderer.notebook_renderer import BaseNotebookRenderer
from great_expectations.util import filter_properties_dict


class SuiteEditNotebookRenderer(BaseNotebookRenderer):
    """
    Render a notebook that can re-create or edit a suite.

    Use cases:
    - Make an easy path to edit a suite that a Profiler created.
    - Make it easy to edit a suite where only JSON exists.
    """

    def __init__(
        self,
        custom_templates_module: Optional[str] = None,
        header_markdown: Optional[NotebookTemplateConfig] = None,
        footer_markdown: Optional[NotebookTemplateConfig] = None,
        table_expectations_header_markdown: Optional[NotebookTemplateConfig] = None,
        column_expectations_header_markdown: Optional[NotebookTemplateConfig] = None,
        table_expectations_not_found_markdown: Optional[NotebookTemplateConfig] = None,
        column_expectations_not_found_markdown: Optional[NotebookTemplateConfig] = None,
        authoring_intro_markdown: Optional[NotebookTemplateConfig] = None,
        column_expectations_markdown: Optional[NotebookTemplateConfig] = None,
        header_code: Optional[NotebookTemplateConfig] = None,
        footer_code: Optional[NotebookTemplateConfig] = None,
        table_expectation_code: Optional[NotebookTemplateConfig] = None,
        column_expectation_code: Optional[NotebookTemplateConfig] = None,
        context: Optional[DataContext] = None,
    ):
        super().__init__(context=context)
        custom_loader: list = []

        if custom_templates_module:
            try:
                path_info_list: List[str] = custom_templates_module.rsplit(".", 1)
                package_name: str = path_info_list[0]
                package_path: str = path_info_list[1]
                custom_loader: list = [
                    jinja2.PackageLoader(
                        package_name=package_name,
                        package_path=package_path,
                    ),
                ]
            except ModuleNotFoundError as e:
                raise SuiteEditNotebookCustomTemplateModuleNotFoundError(
                    custom_templates_module
                ) from e

        loaders: list = custom_loader + [
            jinja2.PackageLoader(
                package_name="great_expectations.render.v3.notebook_assets",
                package_path="suite_edit",
            ),
        ]
        self.template_env = None

        self.template_env = jinja2.Environment(
            loader=jinja2.ChoiceLoader(loaders=loaders)
        )

        self.header_markdown = header_markdown
        self.footer_markdown = footer_markdown
        self.table_expectations_header_markdown = table_expectations_header_markdown
        self.column_expectations_header_markdown = column_expectations_header_markdown
        self.table_expectations_not_found_markdown = (
            table_expectations_not_found_markdown
        )
        self.column_expectations_not_found_markdown = (
            column_expectations_not_found_markdown
        )
        self.authoring_intro_markdown = authoring_intro_markdown
        self.column_expectations_markdown = column_expectations_markdown

        self.header_code = header_code
        self.footer_code = footer_code
        self.column_expectation_code = column_expectation_code
        self.table_expectation_code = table_expectation_code

    @staticmethod
    def from_data_context(data_context: DataContext):
        suite_edit_notebook_config: Optional[NotebookConfig] = None
        if data_context.notebooks and data_context.notebooks.get("suite_edit"):
            suite_edit_notebook_config = notebookConfigSchema.load(
                data_context.notebooks.get("suite_edit")
            )

        if suite_edit_notebook_config:
            return instantiate_class_from_config(
                config=suite_edit_notebook_config.__dict__,
                runtime_environment={"context": data_context},
                config_defaults={},
            )
        return instantiate_class_from_config(
            config={
                "module_name": "great_expectations.render.renderer.v3.suite_edit_notebook_renderer",
                "class_name": "SuiteEditNotebookRenderer",
            },
            runtime_environment={"context": data_context},
            config_defaults={},
        )

    @classmethod
    def _get_expectations_by_column(
        cls, expectations: List[ExpectationConfiguration]
    ) -> Dict[str, List[ExpectationConfiguration]]:
        # TODO probably replace this with Suite logic at some point
        expectations_by_column: Dict[str, List[ExpectationConfiguration]] = {
            "table_expectations": []
        }

        expectation: ExpectationConfiguration
        column_name: str
        for expectation in expectations:
            if "column" in expectation["kwargs"]:
                column_name = expectation["kwargs"]["column"]

                if column_name not in expectations_by_column.keys():
                    expectations_by_column[column_name] = []
                expectations_by_column[column_name].append(expectation)
            else:
                expectations_by_column["table_expectations"].append(expectation)

        return expectations_by_column

    def render_with_overwrite(
        self,
        notebook_config: Optional[NotebookTemplateConfig],
        default_file_name: str,
        **default_kwargs,
    ):
        rendered: str
        if notebook_config:
            rendered = self.template_env.get_template(
                name=notebook_config.file_name
            ).render(**{**default_kwargs, **notebook_config.template_kwargs})
        else:
            rendered = self.template_env.get_template(name=default_file_name).render(
                **default_kwargs
            )
        return rendered

    def add_header(
        self,
        suite_name: str,
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ) -> None:
        markdown: str = self.render_with_overwrite(
            notebook_config=self.header_markdown,
            default_file_name="HEADER.md",
            suite_name=suite_name,
        )
        self.add_markdown_cell(markdown=markdown)

        if batch_request is None:
            batch_request = {}

        code: str = self.render_with_overwrite(
            notebook_config=self.header_code,
            default_file_name="header.py.j2",
            suite_name=suite_name,
            batch_request=batch_request,
            env=os.environ,
        )
        self.add_code_cell(code=code, lint=True)

    def add_footer(
        self,
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ) -> None:
        markdown: str = self.render_with_overwrite(
            notebook_config=self.footer_markdown,
            default_file_name="FOOTER.md",
        )
        self.add_markdown_cell(markdown=markdown)
        code: str = self.render_with_overwrite(
            notebook_config=self.footer_code,
            default_file_name="footer.py.j2",
            batch_request=batch_request,
            env=os.environ,
        )
        self.add_code_cell(code=code)

    def add_expectation_cells_from_suite(
        self,
        expectations: List[ExpectationConfiguration],
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ):
        expectations_by_column: Dict[
            str, List[ExpectationConfiguration]
        ] = self._get_expectations_by_column(expectations=expectations)

        markdown: str

        markdown = self.render_with_overwrite(
            notebook_config=self.table_expectations_header_markdown,
            default_file_name="TABLE_EXPECTATIONS_HEADER.md",
        )
        self.add_markdown_cell(markdown=markdown)
        self._add_table_level_expectations(
            expectations_by_column=expectations_by_column, batch_request=batch_request
        )

        # Remove the table expectations since they are dealt with
        expectations_by_column.pop("table_expectations")

        markdown = self.render_with_overwrite(
            notebook_config=self.column_expectations_header_markdown,
            default_file_name="COLUMN_EXPECTATIONS_HEADER.md",
        )
        self.add_markdown_cell(markdown=markdown)
        self._add_column_level_expectations(
            expectations_by_column=expectations_by_column, batch_request=batch_request
        )

    def _add_table_level_expectations(
        self,
        expectations_by_column: Dict[str, List[ExpectationConfiguration]],
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ):
        if not expectations_by_column["table_expectations"]:
            markdown: str = self.render_with_overwrite(
                notebook_config=self.table_expectations_not_found_markdown,
                default_file_name="TABLE_EXPECTATIONS_NOT_FOUND.md",
                batch_request=batch_request,
                env=os.environ,
            )
            self.add_markdown_cell(markdown=markdown)
            return

        expectation: ExpectationConfiguration
        for expectation in expectations_by_column["table_expectations"]:
            filter_properties_dict(
                properties=expectation["kwargs"], clean_falsy=True, inplace=True
            )
            code: str = self.render_with_overwrite(
                notebook_config=self.table_expectation_code,
                default_file_name="table_expectation.py.j2",
                expectation=expectation,
                batch_request=batch_request,
                env=os.environ,
                kwargs_string=self._build_kwargs_string(expectation=expectation),
                meta_args=self._build_meta_arguments(meta=expectation.meta),
            )
            self.add_code_cell(code=code, lint=True)

    def _add_column_level_expectations(
        self,
        expectations_by_column: Dict[str, List[ExpectationConfiguration]],
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ):
        if not expectations_by_column:
            markdown: str = self.render_with_overwrite(
                notebook_config=self.column_expectations_not_found_markdown,
                default_file_name="COLUMN_EXPECTATIONS_NOT_FOUND.md",
                batch_request=batch_request,
                env=os.environ,
            )
            self.add_markdown_cell(markdown=markdown)
            return

        column_name: str
        expectations: List[ExpectationConfiguration]
        for column_name, expectations in expectations_by_column.items():
            markdown: str = self.render_with_overwrite(
                notebook_config=self.column_expectations_markdown,
                default_file_name="COLUMN_EXPECTATIONS.md",
                column=column_name,
            )
            self.add_markdown_cell(markdown=markdown)

            expectation: ExpectationConfiguration
            for expectation in expectations:
                filter_properties_dict(
                    properties=expectation["kwargs"], clean_falsy=True, inplace=True
                )
                code: str = self.render_with_overwrite(
                    notebook_config=self.column_expectation_code,
                    default_file_name="column_expectation.py.j2",
                    expectation=expectation,
                    batch_request=batch_request,
                    env=os.environ,
                    kwargs_string=self._build_kwargs_string(expectation=expectation),
                    meta_args=self._build_meta_arguments(meta=expectation.meta),
                )
                self.add_code_cell(code=code, lint=True)

    @classmethod
    def _build_kwargs_string(cls, expectation: ExpectationConfiguration) -> str:
        kwargs: List[str] = []
        expectation_kwargs: dict = filter_properties_dict(
            properties=expectation["kwargs"], clean_falsy=True
        )
        for k, v in expectation_kwargs.items():
            if k == "column":
                # make the column a positional argument
                kwargs.insert(0, f"{k}='{v}'")
            elif isinstance(v, str):
                # Put strings in quotes
                kwargs.append(f"{k}='{v}'")
            else:
                # Pass other types as is
                kwargs.append(f"{k}={v}")

        return ", ".join(kwargs)

    @staticmethod
    def _build_meta_arguments(meta: Dict[str, str]) -> str:
        if not meta:
            return ""

        profiler: str = "BasicSuiteBuilderProfiler"
        if profiler in meta.keys():
            meta.pop(profiler)

        if meta.keys():
            return f", meta={meta}"

        return ""

    # noinspection PyMethodOverriding
    def render(
        self,
        suite: ExpectationSuite,
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ) -> nbformat.NotebookNode:
        """
        Render a notebook dict from an expectation suite.
        """
        if not isinstance(suite, ExpectationSuite):
            raise RuntimeWarning("render must be given an ExpectationSuite.")

        self._notebook = nbformat.v4.new_notebook()

        suite_name: str = suite.expectation_suite_name

        if (
            batch_request
            and isinstance(batch_request, dict)
            and BatchRequest(**batch_request)
        ):
            batch_request = standardize_batch_request_display_ordering(
                batch_request=batch_request
            )
        else:
            batch_request = None

        self.add_header(suite_name=suite_name, batch_request=batch_request)
        self.add_authoring_intro(batch_request=batch_request)
        self.add_expectation_cells_from_suite(
            expectations=suite.expectations, batch_request=batch_request
        )
        self.add_footer(batch_request=batch_request)

        return self._notebook

    # noinspection PyMethodOverriding
    def render_to_disk(
        self,
        suite: ExpectationSuite,
        notebook_file_path: str,
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ) -> None:
        """
        Render a notebook to disk from an expectation suite.

        If batch_request dictionary is passed, its properties will override any found in suite citations.
        """
        self.render(
            suite=suite,
            batch_request=batch_request,
        )
        self.write_notebook_to_disk(
            notebook=self._notebook, notebook_file_path=notebook_file_path
        )

    def add_authoring_intro(
        self,
        batch_request: Optional[
            Union[str, Dict[str, Union[str, int, Dict[str, Any]]]]
        ] = None,
    ):
        markdown: str = self.render_with_overwrite(
            notebook_config=self.authoring_intro_markdown,
            default_file_name="AUTHORING_INTRO.md",
            batch_request=batch_request,
            env=os.environ,
        )
        self.add_markdown_cell(markdown=markdown)
