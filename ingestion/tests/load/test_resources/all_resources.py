"""Test class to run all resources load test"""

import importlib.util
import inspect
import logging
from pathlib import Path
from typing import List

from locust import HttpUser, TaskSet, constant

TASKS_DIR = "tasks"

logger = logging.getLogger(__name__)


def get_all_tasks_set() -> List:
    resource_classes = []
    wd = Path(__file__).parent.joinpath(TASKS_DIR)
    for file_path in wd.glob("*.py"):
        if not str(file_path).startswith("base_"):
            module_path = str(file_path)
            module_name = file_path.stem
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            if not spec:
                logger.error(f"Could not load module {module_name}")
                continue
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)  # type: ignore

            for _, obj in inspect.getmembers(module, inspect.isclass):
                if obj.__module__ == module_name:
                    resource_classes.append(obj)

    return resource_classes


class AllResources(TaskSet):
    """Execute tasks for all resources"""

    @classmethod
    def set_tasks(cls):
        tasks = get_all_tasks_set()
        cls.tasks = set(tasks)


class All(HttpUser):
    host = "http://localhost:8585"
    wait_time = constant(1)  # closed workload
    AllResources.set_tasks()
    tasks = [AllResources]
