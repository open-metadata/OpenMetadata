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
Test helper functions
"""
from openmetadata_managed_apis.api.utils import clean_dag_id
from openmetadata_managed_apis.workflows.ingestion.common import clean_name_tag


def test_clean_dag_id():
    """
    To make sure airflow can parse it
    """
    assert clean_dag_id("hello") == "hello"
    assert clean_dag_id("hello(world)") == "hello_world_"
    assert clean_dag_id("hello-world") == "hello-world"
    assert clean_dag_id("%%&^++hello__") == "_hello__"


def test_clean_tag():
    """We can properly tag airflow DAGs"""

    assert clean_name_tag("hello") == "hello"
    assert clean_name_tag("hello(world)") == "hello(world)"
    assert clean_name_tag("service.pipeline") == "pipeline"
    assert clean_name_tag(f"service.{'a' * 200}") == "a" * 90
