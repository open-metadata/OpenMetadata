from typing import Any, Dict, List, Union

import nbformat

from great_expectations import DataContext
from great_expectations.core.batch import BatchRequest
from great_expectations.render.renderer.suite_edit_notebook_renderer import (
    SuiteEditNotebookRenderer,
)


class SuiteProfileNotebookRenderer(SuiteEditNotebookRenderer):
    def __init__(
        self,
        context: DataContext,
        expectation_suite_name: str,
        batch_request: Union[str, Dict[str, Union[str, int, Dict[str, Any]]]],
    ):
        super().__init__(context=context)

        if batch_request is None:
            batch_request = {}
        self.batch_request = batch_request

        self.validator = context.get_validator(
            batch_request=BatchRequest(**batch_request),
            expectation_suite_name=expectation_suite_name,
        )

        self.expectation_suite_name = self.validator.expectation_suite_name

    # noinspection PyMethodOverriding
    def add_header(self):
        self.add_markdown_cell(
            markdown=f"""# Initialize a new Expectation Suite by profiling a batch of your data.
This process helps you avoid writing lots of boilerplate when authoring suites by allowing you to select columns and other factors that you care about and letting a profiler write some candidate expectations for you to adjust.

**Expectation Suite Name**: `{self.expectation_suite_name}`
"""
        )
        self.add_code_cell(
            code=f"""\
import datetime

import pandas as pd

import great_expectations as ge
import great_expectations.jupyter_ux
from great_expectations.core.batch import BatchRequest
from great_expectations.profile.user_configurable_profiler import UserConfigurableProfiler
from great_expectations.checkpoint import SimpleCheckpoint
from great_expectations.exceptions import DataContextError

context = ge.data_context.DataContext()

batch_request = {self.batch_request}

expectation_suite_name = "{self.expectation_suite_name}"

validator = context.get_validator(
    batch_request=BatchRequest(**batch_request),
    expectation_suite_name=expectation_suite_name
)
column_names = [f'"{{column_name}}"' for column_name in validator.columns()]
print(f"Columns: {{', '.join(column_names)}}.")
validator.head(n_rows=5, fetch_all=False)
""",
            lint=True,
        )

    def _add_available_columns_list(self):
        column_names: List[str]
        column_name: str
        column_names = [
            f'    "{column_name}"\n,' for column_name in self.validator.columns()
        ]
        code: str = f'ignored_columns = [\n{"".join(column_names)}]'
        self.add_code_cell(code=code, lint=True)

    def add_footer(self):
        self.add_markdown_cell(
            markdown="""# Save & review your new Expectation Suite

Let's save the draft expectation suite as a JSON file in the
`great_expectations/expectations` directory of your project and rebuild the Data
 Docs site to make it easy to review your new suite."""
        )
        code_cell: str = """\
print(validator.get_expectation_suite(discard_failed_expectations=False))
validator.save_expectation_suite(discard_failed_expectations=False)

checkpoint_config = {
    "class_name": "SimpleCheckpoint",
    "validations": [
        {
            "batch_request": batch_request,
            "expectation_suite_name": expectation_suite_name
        }
    ]
}
checkpoint = SimpleCheckpoint(
    f"_tmp_checkpoint_{expectation_suite_name}",
    context,
    **checkpoint_config
)
checkpoint_result = checkpoint.run()

context.build_data_docs()

validation_result_identifier = checkpoint_result.list_validation_result_identifiers()[0]
context.open_data_docs(resource_identifier=validation_result_identifier)
"""
        self.add_code_cell(code=code_cell, lint=True)
        self.add_markdown_cell(
            markdown=f"""## Next steps
After you review this initial Expectation Suite in Data Docs you
should edit this suite to make finer grained adjustments to the expectations.
This can be done by running `great_expectations suite edit {self.expectation_suite_name}`."""
        )

    # noinspection PyMethodOverriding
    def render(self) -> nbformat.NotebookNode:
        self._notebook = nbformat.v4.new_notebook()
        self.add_header()
        self.add_markdown_cell(
            markdown="""# Select columns

Select the columns on which you would like to set expectations and those which you would like to ignore.

Great Expectations will choose which expectations might make sense for a column based on the **data type** and **cardinality** of the data in each selected column.

Simply comment out columns that are important and should be included. You can select multiple lines and
use a jupyter keyboard shortcut to toggle each line: **Linux/Windows**:
`Ctrl-/`, **macOS**: `Cmd-/`"""
        )
        self._add_available_columns_list()
        self.add_markdown_cell(
            markdown="""# Run the data profiler

The suites generated here are **not meant to be production suites** -- they are **a starting point to build upon**.

**To get to a production-grade suite, you will definitely want to [edit this
suite](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/creating_and_editing_expectations/how_to_edit_an_expectation_suite_using_a_disposable_notebook.html?utm_source=notebook&utm_medium=profile_based_expectations)
after this initial step gets you started on the path towards what you want.**

This is highly configurable depending on your goals.
You can ignore columns or exclude certain expectations, specify a threshold for creating value set expectations, or even specify semantic types for a given column.
You can find more information about [how to configure this profiler, including a list of the expectations that it uses, here.](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/creating_and_editing_expectations/how_to_create_an_expectation_suite_with_the_user_configurable_profiler.html)

"""
        )
        self._add_profiler_cell()
        self.add_footer()
        return self._notebook

    # noinspection PyMethodOverriding
    def render_to_disk(self, notebook_file_path: str):
        """
        Render a notebook to disk from an expectation suite.
        """
        self.render()
        self.write_notebook_to_disk(
            notebook=self._notebook, notebook_file_path=notebook_file_path
        )

    def _add_profiler_cell(self):
        self.add_code_cell(
            code=f"""\
profiler = UserConfigurableProfiler(
    profile_dataset=validator,
    excluded_expectations=None,
    ignored_columns=ignored_columns,
    not_null_only=False,
    primary_or_compound_key=False,
    semantic_types_dict=None,
    table_expectations_only=False,
    value_set_threshold="MANY",
)
suite = profiler.build_suite()""",
            lint=True,
        )
