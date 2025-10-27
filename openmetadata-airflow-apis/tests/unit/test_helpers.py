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
from openmetadata_managed_apis.api.utils import clean_dag_id, sanitize_task_id
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


def test_sanitize_task_id():
    """
    Ensure task_id is properly sanitized to prevent path traversal attacks.
    This test validates the security fix for path traversal vulnerability.
    """
    # Security: Path traversal prevention
    assert sanitize_task_id("../../../etc/passwd") == "_etc_passwd"
    assert sanitize_task_id("../../etc/shadow") == "_etc_shadow"
    assert sanitize_task_id("/absolute/path") == "_absolute_path"
    assert sanitize_task_id("task/with/slash") == "task_with_slash"
    assert sanitize_task_id("task\\with\\backslash") == "task_with_backslash"
    assert sanitize_task_id("task\x00null") == "task_null"
    assert sanitize_task_id("../malicious") == "_malicious"
    assert sanitize_task_id("task/../traversal") == "task_traversal"

    # Valid inputs that should pass through (with underscore for special chars)
    assert sanitize_task_id("normal_task") == "normal_task"
    assert sanitize_task_id("valid-task_123") == "valid-task_123"
    assert sanitize_task_id("UPPERCASE") == "UPPERCASE"
    assert sanitize_task_id("mixedCase123") == "mixedCase123"

    # Edge cases
    assert sanitize_task_id("") is None
    assert sanitize_task_id(None) is None

    # Consistency with clean_dag_id behavior
    assert sanitize_task_id("task.with.dots") == "task_with_dots"
    assert sanitize_task_id("%%&^++task__") == "_task__"
    assert sanitize_task_id("task(with)parens") == "task_with_parens"

    # Additional security cases
    assert sanitize_task_id("task;command") == "task_command"
    assert sanitize_task_id("task|pipe") == "task_pipe"
    assert sanitize_task_id("task&background") == "task_background"
    assert sanitize_task_id("task$variable") == "task_variable"
