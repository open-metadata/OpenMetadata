from typing import Optional

import nbformat

from great_expectations import DataContext
from great_expectations.datasource.types import DatasourceTypes
from great_expectations.render.renderer.notebook_renderer import BaseNotebookRenderer


class DatasourceNewNotebookRenderer(BaseNotebookRenderer):
    SQL_DOCS = """\
### For SQL based Datasources:

Here we are creating an example configuration based on the database backend you specified in the CLI.  The configuration contains an **InferredAssetSqlDataConnector**, which will add a Data Asset for each table in the database, and a **RuntimeDataConnector** which can accept SQL queries. This is just an example, and you may customize this as you wish!

Also, if you would like to learn more about the **DataConnectors** used in this configuration, please see our docs on [InferredAssetDataConnectors](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/configuring_datasources/how_to_configure_an_inferredassetdataconnector.html) and [RuntimeDataConnectors](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/creating_batches/how_to_configure_a_runtime_data_connector.html). 

Credentials will not be saved until you run the last cell. The credentials will be saved in `uncommitted/config_variables.yml` which should not be added to source control."""

    FILES_DOCS = """### For files based Datasources:
Here we are creating an example configuration.  The configuration contains an **InferredAssetFilesystemDataConnector** which will add a Data Asset for each file in the base directory you provided. It also contains a **RuntimeDataConnector** which can accept filepaths.   This is just an example, and you may customize this as you wish!

Also, if you would like to learn more about the **DataConnectors** used in this configuration, including other methods to organize assets, handle multi-file assets, name assets based on parts of a filename, please see our docs on [InferredAssetDataConnectors](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/configuring_datasources/how_to_configure_an_inferredassetdataconnector.html) and [RuntimeDataConnectors](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/creating_batches/how_to_configure_a_runtime_data_connector.html). 
"""

    DOCS_INTRO = f"""## Customize Your Datasource Configuration

**If you are new to Great Expectations Datasources,** you should check out our [how-to documentation](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/configuring_datasources.html)

**My configuration is not so simple - are there more advanced options?**
Glad you asked! Datasources are versatile. Please see our [How To Guides](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/configuring_datasources.html)!

Give your datasource a unique name:"""

    def __init__(
        self,
        context: DataContext,
        datasource_type: DatasourceTypes,
        datasource_yaml: str,
        datasource_name: Optional[str] = "my_datasource",
        sql_credentials_snippet: Optional[str] = None,
    ):
        super().__init__(context=context)
        self.datasource_type = datasource_type
        self.datasource_yaml = datasource_yaml
        self.sql_credentials_code_snippet = sql_credentials_snippet
        if datasource_name is None:
            datasource_name = "my_datasource"
        self.datasource_name = datasource_name

    def _add_header(self):
        self.add_markdown_cell(
            f"""# Create a new {self.datasource_type.value} Datasource
Use this notebook to configure a new {self.datasource_type.value} Datasource and add it to your project."""
        )
        self.add_code_cell(
            """import great_expectations as ge
from great_expectations.cli.datasource import sanitize_yaml_and_save_datasource, check_if_datasource_name_exists
context = ge.get_context()""",
        )

    def _add_docs_cell(self):
        self.add_markdown_cell(self.DOCS_INTRO)
        self.add_code_cell(f'datasource_name = "{self.datasource_name}"')

        if self.datasource_type in [DatasourceTypes.PANDAS, DatasourceTypes.SPARK]:
            self.add_markdown_cell(self.FILES_DOCS)
        elif self.datasource_type == DatasourceTypes.SQL:
            self.add_markdown_cell(self.SQL_DOCS)

    def _add_sql_credentials_cell(self):
        self.add_code_cell(self.sql_credentials_code_snippet)

    def _add_template_cell(self):
        self.add_code_cell(
            f"""example_yaml = {self.datasource_yaml}
print(example_yaml)""",
            lint=True,
        )

    def _add_test_yaml_cells(self):
        self.add_markdown_cell(
            """\
# Test Your Datasource Configuration
Here we will test your Datasource configuration to make sure it is valid.

This `test_yaml_config()` function is meant to enable fast dev loops. **If your
configuration is correct, this cell will show you some snippets of the data
assets in the data source.** You can continually edit your Datasource config
yaml and re-run the cell to check until the new config is valid.

If you instead wish to use python instead of yaml to configure your Datasource,
you can use `context.add_datasource()` and specify all the required parameters."""
        )
        self.add_code_cell(
            "context.test_yaml_config(yaml_config=example_yaml)",
            lint=True,
        )

    def _add_save_datasource_cell(self):
        self.add_markdown_cell(
            """## Save Your Datasource Configuration
Here we will save your Datasource in your Data Context once you are satisfied with the configuration. Note that `overwrite_existing` defaults to False, but you may change it to True if you wish to overwrite. Please note that if you wish to include comments you must add them directly to your `great_expectations.yml`."""
        )
        self.add_code_cell(
            """sanitize_yaml_and_save_datasource(context, example_yaml, overwrite_existing=False)
context.list_datasources()""",
            lint=True,
        )
        self.add_markdown_cell("Now you can close this notebook and delete it!")

    def render(self) -> nbformat.NotebookNode:
        self._notebook: nbformat.NotebookNode = nbformat.v4.new_notebook()
        self._add_header()
        self._add_docs_cell()
        if self.datasource_type == DatasourceTypes.SQL:
            self._add_sql_credentials_cell()
        self._add_template_cell()
        self._add_test_yaml_cells()
        self._add_save_datasource_cell()
        return self._notebook

    def render_to_disk(
        self,
        notebook_file_path: str,
    ) -> None:
        self.render()
        self.write_notebook_to_disk(self._notebook, notebook_file_path)
