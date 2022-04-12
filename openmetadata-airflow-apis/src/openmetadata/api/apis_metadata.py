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
from typing import Any, Dict, Optional

APIS_METADATA = [
    {
        "name": "deploy_dag",
        "description": "Deploy a new DAG File to the DAGs directory",
        "http_method": "POST",
        "form_enctype": "multipart/form-data",
        "arguments": [],
        "post_arguments": [
            {
                "name": "workflow_config",
                "description": "Workflow config to deploy",
                "form_input_type": "file",
                "required": True,
            },
        ],
    },
    {
        "name": "trigger_dag",
        "description": "Trigger a DAG",
        "http_method": "POST",
        "arguments": [],
        "post_arguments": [
            {
                "name": "workflow_name",
                "description": "Workflow name to run",
                "required": True,
            },
        ],
    },
]


def get_metadata_api(name: str) -> Optional[Dict[str, Any]]:
    """
    Return the APIS_METADATA dict for a
    given name
    """
    return next(iter(api for api in APIS_METADATA if api["name"] == name), None)
