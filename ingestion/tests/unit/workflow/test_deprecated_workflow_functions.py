#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Validate the deprecated functions still work.
"""
from metadata.workflow.workflow_output_handler import print_init_error

from .test_base_workflow import SimpleWorkflow, config


# TODO: remove after the print_status and print_init_error functions are removed in Release 1.6
class TestDeprecatedSimpleWorkflow:
    def test_workflow_print_status(self):
        workflow = SimpleWorkflow(config=config)
        workflow.execute()
        workflow.print_status(workflow)

    def test_workflow_print_init_error(self):
        print_init_error(Exception(), config.model_dump())
