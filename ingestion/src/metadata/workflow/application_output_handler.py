#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Module handles the output messages for applications
"""
import time

from metadata.utils.helpers import pretty_print_time_duration
from metadata.utils.logger import ANSI, log_ansi_encoded_string
from metadata.workflow.output_handler import print_workflow_summary


def print_status(workflow: "ApplicationWorkflow") -> None:
    """
    Print the workflow results
    """
    print_workflow_summary(workflow)

    if workflow.runner.get_status().source_start_time:
        log_ansi_encoded_string(
            color=ANSI.BRIGHT_CYAN,
            bold=True,
            message="Workflow finished in time: "
            f"{pretty_print_time_duration(time.time()-workflow.runner.get_status().source_start_time)}",
        )
