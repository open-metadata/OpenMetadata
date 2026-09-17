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

import multiprocessing
import sys
import threading
from unittest.mock import patch

import filelock  # noqa: F401  installs the os.fork audit hook the API server runs under
import pytest

from openmetadata_managed_apis.api.utils import (
    ScanDagsTask,
    clean_dag_id,
    sanitize_task_id,
    scan_dags_job_background,
)
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


# get_all_start_methods() lists the platform default first, without pinning the context.
@pytest.mark.skipif(
    (multiprocessing.get_start_method(allow_none=True) or multiprocessing.get_all_start_methods()[0]) != "fork",
    reason="The race is in os.fork, and a non-fork child would not inherit the no-op scan patch",
)
def test_concurrent_dag_scans_can_fork():
    """
    A bulk re-deploy runs one deploy per API-server thread, and each deploy forks a DAG scan.
    Two of those forks overlapping must not fail the deploy that lost the race (#33514).
    """
    errors = []

    def deploy(barrier):
        barrier.wait()
        try:
            scan_dags_job_background()
        except RuntimeError as exc:
            errors.append(exc)

    switch_interval = sys.getswitchinterval()
    # Switch threads as often as possible so the forks overlap on every round.
    sys.setswitchinterval(1e-6)
    try:
        with patch.object(ScanDagsTask, "run", lambda self: None):
            for _ in range(50):
                barrier = threading.Barrier(2)
                threads = [threading.Thread(target=deploy, args=(barrier,)) for _ in range(2)]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join()
    finally:
        sys.setswitchinterval(switch_interval)
        for child in multiprocessing.active_children():
            child.join()

    assert errors == []
