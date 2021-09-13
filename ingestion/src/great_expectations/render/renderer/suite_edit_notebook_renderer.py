import os
from typing import Optional, Union

import jinja2
import nbformat

from great_expectations import DataContext
from great_expectations.core.expectation_suite import ExpectationSuite
from great_expectations.core.id_dict import BatchKwargs
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
        column_expectation_code: Optional[NotebookTemplateConfig] = None,
        table_expectation_code: Optional[NotebookTemplateConfig] = None,
        context: Optional[DataContext] = None,
    ):
        super().__init__()
        custom_loader = []

        if custom_templates_module:
            try:
                custom_loader = [
                    jinja2.PackageLoader(*custom_templates_module.rsplit(".", 1))
                ]
            except ModuleNotFoundError as e:
                raise SuiteEditNotebookCustomTemplateModuleNotFoundError(
                    custom_templates_module
                ) from e

        loaders = custom_loader + [
            jinja2.PackageLoader(
                "great_expectations.render.notebook_assets", "suite_edit"
            ),
        ]
        self.template_env = None

        self.template_env = jinja2.Environment(loader=jinja2.ChoiceLoader(loaders))

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
        self.context = context

    @staticmethod
    def from_data_context(data_context):
        suite_edit_notebook_config: Optional[NotebookConfig] = None
        if data_context.notebooks and data_context.notebooks.get("suite_edit"):
            suite_edit_notebook_config = notebookConfigSchema.load(
                data_context.notebooks.get("suite_edit")
            )

        return instantiate_class_from_config(
            config=suite_edit_notebook_config.__dict__
            if suite_edit_notebook_config
            else {
                "module_name": "great_expectations.render.renderer.suite_edit_notebook_renderer",
                "class_name": "SuiteEditNotebookRenderer",
            },
            runtime_environment={"context": data_context},
            config_defaults={},
        )

    @classmethod
    def _get_expectations_by_column(cls, expectations):
        # TODO probably replace this with Suite logic at some point
        expectations_by_column = {"table_expectations": []}
        for exp in expectations:
            if "column" in exp["kwargs"]:
                col = exp["kwargs"]["column"]

                if col not in expectations_by_column.keys():
                    expectations_by_column[col] = []
                expectations_by_column[col].append(exp)
            else:
                expectations_by_column["table_expectations"].append(exp)

        return expectations_by_column

    @classmethod
    def _build_kwargs_string(cls, expectation):
        kwargs = []
        for k, v in expectation["kwargs"].items():
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

    def render_with_overwrite(
        self,
        notebook_config: Optional[NotebookTemplateConfig],
        default_file_name: str,
        **default_kwargs,
    ):
        if notebook_config:
            rendered = self.template_env.get_template(notebook_config.file_name).render(
                **{**default_kwargs, **notebook_config.template_kwargs}
            )
        else:
            rendered = self.template_env.get_template(default_file_name).render(
                **default_kwargs
            )
        return rendered

    def add_header(self, suite_name: str, batch_kwargs) -> None:
        markdown = self.render_with_overwrite(
            self.header_markdown, "HEADER.md", suite_name=suite_name
        )

        self.add_markdown_cell(markdown)

        if not batch_kwargs:
            batch_kwargs = {}
        code = self.render_with_overwrite(
            self.header_code,
            "header.py.j2",
            suite_name=suite_name,
            batch_kwargs=batch_kwargs,
            env=os.environ,
        )
        self.add_code_cell(code, lint=True)

    def add_footer(self) -> None:
        markdown = self.render_with_overwrite(self.footer_markdown, "FOOTER.md")
        self.add_markdown_cell(markdown)
        # TODO this may become confusing for users depending on what they are trying
        #  to accomplish in their dev loop
        validation_operator_name = None
        if self.context and self.context.validation_operators.get(
            "action_list_operator"
        ):
            validation_operator_name = "action_list_operator"

        code = self.render_with_overwrite(
            self.footer_code,
            "footer.py.j2",
            validation_operator_name=validation_operator_name,
        )
        self.add_code_cell(code)

    def add_expectation_cells_from_suite(self, expectations):
        expectations_by_column = self._get_expectations_by_column(expectations)
        markdown = self.render_with_overwrite(
            self.table_expectations_header_markdown, "TABLE_EXPECTATIONS_HEADER.md"
        )
        self.add_markdown_cell(markdown)
        self._add_table_level_expectations(expectations_by_column)
        # Remove the table expectations since they are dealt with
        expectations_by_column.pop("table_expectations")
        markdown = self.render_with_overwrite(
            self.column_expectations_header_markdown, "COLUMN_EXPECTATIONS_HEADER.md"
        )
        self.add_markdown_cell(markdown)
        self._add_column_level_expectations(expectations_by_column)

    def _add_column_level_expectations(self, expectations_by_column):
        if not expectations_by_column:
            markdown = self.render_with_overwrite(
                self.column_expectations_not_found_markdown,
                "COLUMN_EXPECTATIONS_NOT_FOUND.md",
            )
            self.add_markdown_cell(markdown)
            return

        for column, expectations in expectations_by_column.items():
            markdown = self.render_with_overwrite(
                self.column_expectations_markdown,
                "COLUMN_EXPECTATIONS.md",
                column=column,
            )
            self.add_markdown_cell(markdown)

            for exp in expectations:
                code = self.render_with_overwrite(
                    self.column_expectation_code,
                    "column_expectation.py.j2",
                    expectation=exp,
                    kwargs_string=self._build_kwargs_string(exp),
                    meta_args=self._build_meta_arguments(exp.meta),
                )
                self.add_code_cell(
                    code,
                    lint=True,
                )

    def _add_table_level_expectations(self, expectations_by_column):
        if not expectations_by_column["table_expectations"]:
            markdown = self.render_with_overwrite(
                self.table_expectations_not_found_markdown,
                "TABLE_EXPECTATIONS_NOT_FOUND.md",
            )
            self.add_markdown_cell(markdown)
            return

        for exp in expectations_by_column["table_expectations"]:
            code = self.render_with_overwrite(
                self.table_expectation_code,
                "table_expectation.py.j2",
                expectation=exp,
                kwargs_string=self._build_kwargs_string(exp),
                meta_args=self._build_meta_arguments(exp.meta),
            )
            self.add_code_cell(code, lint=True)

    @staticmethod
    def _build_meta_arguments(meta):
        if not meta:
            return ""

        profiler = "BasicSuiteBuilderProfiler"
        if profiler in meta.keys():
            meta.pop(profiler)

        if meta.keys():
            return f", meta={meta}"

        return ""

    def render(
        self, suite: ExpectationSuite, batch_kwargs=None
    ) -> nbformat.NotebookNode:
        """
        Render a notebook dict from an expectation suite.
        """
        if not isinstance(suite, ExpectationSuite):
            raise RuntimeWarning("render must be given an ExpectationSuite.")

        self._notebook = nbformat.v4.new_notebook()

        suite_name = suite.expectation_suite_name

        batch_kwargs = self.get_batch_kwargs(suite, batch_kwargs)
        self.add_header(suite_name, batch_kwargs)
        self.add_authoring_intro()
        self.add_expectation_cells_from_suite(suite.expectations)
        self.add_footer()

        return self._notebook

    def render_to_disk(
        self, suite: ExpectationSuite, notebook_file_path: str, batch_kwargs=None
    ) -> None:
        """
        Render a notebook to disk from an expectation suite.

        If batch_kwargs are passed they will override any found in suite
        citations.
        """
        self.render(suite, batch_kwargs)
        self.write_notebook_to_disk(self._notebook, notebook_file_path)

    def add_authoring_intro(self):
        markdown = self.render_with_overwrite(
            self.authoring_intro_markdown, "AUTHORING_INTRO.md"
        )
        self.add_markdown_cell(markdown)

    def get_batch_kwargs(
        self, suite: ExpectationSuite, batch_kwargs: Union[dict, BatchKwargs]
    ):
        if isinstance(batch_kwargs, dict):
            return self._fix_path_in_batch_kwargs(batch_kwargs)

        citations = suite.meta.get("citations")
        if not citations:
            return self._fix_path_in_batch_kwargs(batch_kwargs)

        citations = suite.get_citations(require_batch_kwargs=True)
        if not citations:
            return None

        citation = citations[-1]
        batch_kwargs = citation.get("batch_kwargs")
        return self._fix_path_in_batch_kwargs(batch_kwargs)

    @staticmethod
    def _fix_path_in_batch_kwargs(batch_kwargs):
        if isinstance(batch_kwargs, BatchKwargs):
            batch_kwargs = dict(batch_kwargs)
        if batch_kwargs and "path" in batch_kwargs.keys():
            base_dir = batch_kwargs["path"]
            if base_dir[0:5] in ["s3://", "gs://"]:
                return batch_kwargs
            if not os.path.isabs(base_dir):
                batch_kwargs["path"] = os.path.join("..", "..", base_dir)

        return batch_kwargs
