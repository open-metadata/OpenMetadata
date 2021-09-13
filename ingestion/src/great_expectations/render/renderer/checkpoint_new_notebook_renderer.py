from typing import Dict

import nbformat

from great_expectations import DataContext
from great_expectations.render.renderer.notebook_renderer import BaseNotebookRenderer


class CheckpointNewNotebookRenderer(BaseNotebookRenderer):
    def __init__(self, context: DataContext, checkpoint_name: str):
        super().__init__(context=context)
        self.context = context
        self.checkpoint_name = checkpoint_name

    def _find_datasource_with_asset(self) -> Dict[str, str]:
        """
        Find a Datasource with a configured Asset.

        Useful to pre-populate a working sample Checkpoint for notebook users.
        """
        datasource_candidate = None
        for datasource_name, datasource in self.context.datasources.items():
            for (
                data_connector_name,
                data_connector,
            ) in datasource.data_connectors.items():
                if len(data_connector.get_available_data_asset_names()) > 0:
                    datasource_candidate = {
                        "datasource_name": datasource_name,
                        "data_connector_name": data_connector_name,
                        "asset_name": list(
                            data_connector.get_available_data_asset_names()
                        )[0],
                    }
                    break
        return datasource_candidate

    def _add_header(self):
        self.add_markdown_cell(
            f"""# Create Your Checkpoint
Use this notebook to configure a new Checkpoint and add it to your project:

**Checkpoint Name**: `{self.checkpoint_name}`"""
        )

    def _add_imports(self):
        self.add_code_cell(
            """from ruamel.yaml import YAML
import great_expectations as ge
from pprint import pprint

yaml = YAML()
context = ge.get_context()
""",
            lint=True,
        )

    def _add_optional_customize_your_config(self):
        self.add_markdown_cell(
            """# Customize Your Configuration
The following cells show examples for listing your current configuration. You can replace values in the sample configuration with these values to customize your Checkpoint."""
        )
        self.add_code_cell(
            """# Run this cell to print out the names of your Datasources, Data Connectors and Data Assets
pprint(context.get_available_data_asset_names())""",
            lint=True,
        )
        self.add_code_cell("context.list_expectation_suite_names()")

    def _add_sample_checkpoint_config(self):
        self.add_markdown_cell(
            """# Create a Checkpoint Configuration

**If you are new to Great Expectations or the Checkpoint feature**, you should start with SimpleCheckpoint because it includes default configurations like a default list of post validation actions.

In the cell below we have created a sample Checkpoint configuration using **your configuration** and **SimpleCheckpoint** to run a single validation of a single Expectation Suite against a single Batch of data.

To keep it simple, we are just choosing the first available instance of each of the following items you have configured in your Data Context:
* Datasource
* DataConnector
* DataAsset
* Partition
* Expectation Suite

Of course this is purely an example, you may edit this to your heart's content.

**My configuration is not so simple - are there more advanced options?**

Glad you asked! Checkpoints are very versatile. For example, you can validate many Batches in a single Checkpoint, validate Batches against different Expectation Suites or against many Expectation Suites, control the specific post-validation actions based on Expectation Suite / Batch / results of validation among other features. Check out our documentation on Checkpoints for more details and for instructions on how to implement other more advanced features including using the **Checkpoint** class:
- https://docs.greatexpectations.io/en/latest/reference/core_concepts/checkpoints_and_actions.html
- https://docs.greatexpectations.io/en/latest/guides/how_to_guides/validation/how_to_create_a_new_checkpoint.html
- https://docs.greatexpectations.io/en/latest/guides/how_to_guides/validation/how_to_create_a_new_checkpoint_using_test_yaml_config.html"""
        )
        try:
            first_datasource_with_asset = self._find_datasource_with_asset()
            first_datasource_name = first_datasource_with_asset["datasource_name"]
            first_data_connector_name = first_datasource_with_asset[
                "data_connector_name"
            ]
            first_asset_name = first_datasource_with_asset["asset_name"]

            first_expectation_suite = self.context.list_expectation_suites()[0]
            first_expectation_suite_name = (
                first_expectation_suite.expectation_suite_name
            )
            sample_yaml_str = f'my_checkpoint_name = "{self.checkpoint_name}" # This was populated from your CLI command.\n\n'
            sample_yaml_str += f'yaml_config = f"""'
            sample_yaml_str += "\nname: {my_checkpoint_name}"
            sample_yaml_str += f"""
config_version: 1.0
class_name: SimpleCheckpoint
run_name_template: "%Y%m%d-%H%M%S-my-run-name-template"
validations:
  - batch_request:
      datasource_name: {first_datasource_name}
      data_connector_name: {first_data_connector_name}
      data_asset_name: {first_asset_name}
      data_connector_query:
        index: -1
    expectation_suite_name: {first_expectation_suite_name}
"""
            sample_yaml_str += '"""'
            sample_yaml_str += f"\nprint(yaml_config)"

            self.add_code_cell(
                sample_yaml_str,
                lint=True,
            )
        except:
            # For any error
            self.add_markdown_cell(
                "Sorry, we were unable to create a sample configuration. Perhaps you don't have a Datasource or Expectation Suite configured."
            )

    def _add_test_and_save_your_checkpoint_configuration(self):
        self.add_markdown_cell(
            """# Test Your Checkpoint Configuration
Here we will test your Checkpoint configuration to make sure it is valid.

This `test_yaml_config()` function is meant to enable fast dev loops. If your configuration is correct, this cell will show a message that you successfully instantiated a Checkpoint. You can continually edit your Checkpoint config yaml and re-run the cell to check until the new config is valid.

If you instead wish to use python instead of yaml to configure your Checkpoint, you can use `context.add_checkpoint()` and specify all the required parameters."""
        )
        self.add_code_cell(
            f"""my_checkpoint = context.test_yaml_config(yaml_config=yaml_config)""",
            lint=True,
        )

    def _add_review_checkpoint(self):
        self.add_markdown_cell(
            """# Review Your Checkpoint

You can run the following cell to print out the full yaml configuration. For example, if you used **SimpleCheckpoint**  this will show you the default action list."""
        )
        self.add_code_cell(
            "print(my_checkpoint.get_substituted_config().to_yaml_str())", lint=True
        )

    def _add_add_checkpoint(self):
        self.add_markdown_cell(
            """# Add Your Checkpoint

Run the following cell to save this Checkpoint to your Checkpoint Store."""
        )
        self.add_code_cell(
            f"context.add_checkpoint(**yaml.load(yaml_config))",
            lint=True,
        )

    def _add_optional_run_checkpoint(self):
        self.add_markdown_cell(
            """# Run Your Checkpoint & Open Data Docs(Optional)

You may wish to run the Checkpoint now and review its output in Data Docs. If so uncomment and run the following cell."""
        )
        self.add_code_cell(
            "# context.run_checkpoint(checkpoint_name=my_checkpoint_name)\n# context.open_data_docs()",
            lint=True,
        )

    def render(self) -> nbformat.NotebookNode:
        self._notebook: nbformat.NotebookNode = nbformat.v4.new_notebook()
        self._add_header()
        self._add_imports()
        self._add_sample_checkpoint_config()
        self._add_optional_customize_your_config()
        self._add_test_and_save_your_checkpoint_configuration()
        self._add_review_checkpoint()
        self._add_add_checkpoint()
        self._add_optional_run_checkpoint()

        return self._notebook

    def render_to_disk(
        self,
        notebook_file_path: str,
    ) -> None:
        self.render()
        self.write_notebook_to_disk(self._notebook, notebook_file_path)
