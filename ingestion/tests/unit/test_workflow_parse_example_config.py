from os import walk
from pathlib import Path
from unittest import TestCase

import yaml

from metadata.ingestion.api.parser import parse_workflow_config_gracefully


class TestWorkflowParse(TestCase):
    """
    Test parsing scenarios of JSON Schemas
    """

    def test_parse_workflow_config(self):
        package_path = f"{Path(__file__).parent.parent.parent}/src/metadata/examples/workflows"
        workflow_files = [files for _, _, files in walk(package_path)]
        for yaml_file in workflow_files[0]:
            with self.subTest(file_name=yaml_file):  # noqa: SIM117
                with open(f"{package_path}/{yaml_file}", "r") as file:  # noqa: PTH123
                    file_content = file.read()
                    try:
                        parse_workflow_config_gracefully(yaml.safe_load(file_content))
                    except Exception as exc:
                        assert False, f"Error parsing {yaml_file}: {exc}"  # noqa: B011
                    finally:
                        file.close()
