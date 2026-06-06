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

import importlib
import os
import re
import sys
import threading
import traceback
from multiprocessing import Process
from typing import Optional

from airflow import settings
from airflow.models import DagBag
from airflow.version import version as airflow_version
from flask import request
from packaging import version

from openmetadata_managed_apis.utils.logger import api_logger

logger = api_logger()


class MissingArgException(Exception):  # noqa: N818
    """
    Raised when we cannot properly validate the incoming data
    """


def import_path(path):
    module_name = os.path.basename(path).replace("-", "_")  # noqa: PTH119
    spec = importlib.util.spec_from_loader(module_name, importlib.machinery.SourceFileLoader(module_name, path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.modules[module_name] = module
    return module


def clean_dag_id(raw_dag_id: Optional[str]) -> Optional[str]:  # noqa: UP045
    """
    Given a string we want to use as a dag_id, we should
    give it a cleanup as Airflow does not support anything
    that is not alphanumeric for the name
    """
    return re.sub("[^0-9a-zA-Z-_]+", "_", raw_dag_id) if raw_dag_id else None


def sanitize_task_id(raw_task_id: Optional[str]) -> Optional[str]:  # noqa: UP045
    """
    Sanitize task_id to prevent path traversal attacks.
    Only allows alphanumeric characters, dashes, and underscores.
    :param raw_task_id: Raw task ID from user input
    :return: Sanitized task ID safe for file path construction
    """
    return re.sub("[^0-9a-zA-Z-_]+", "_", raw_task_id) if raw_task_id else None


def get_request_arg(req, arg, raise_missing: bool = True) -> Optional[str]:  # noqa: UP045
    """
    Pick up the `arg` from the flask `req`.
    E.g., GET api/v1/endpoint?key=value

    If raise_missing, throw an exception if the argument is
    not present in the request
    """
    request_argument = req.args.get(arg) or req.form.get(arg)

    if not request_argument and raise_missing:
        raise MissingArgException(f"Missing {arg} from request {req} argument")

    return request_argument


def get_arg_dag_id() -> Optional[str]:  # noqa: UP045
    """
    Try to fetch the dag_id from the args
    and clean it
    """
    raw_dag_id = get_request_arg(request, "dag_id")

    return clean_dag_id(raw_dag_id)


def get_arg_only_queued() -> Optional[str]:  # noqa: UP045
    """
    Try to fetch the only_queued from the args
    """
    return get_request_arg(request, "only_queued", raise_missing=False)


def get_request_dag_id() -> Optional[str]:  # noqa: UP045
    """
    Try to fetch the dag_id from the JSON request
    and clean it
    """
    raw_dag_id = request.get_json().get("dag_id")

    if not raw_dag_id:
        raise MissingArgException("Missing dag_id from request JSON")

    return clean_dag_id(raw_dag_id)


def get_request_conf() -> Optional[dict]:  # noqa: UP045
    """
    Try to fetch the conf from the JSON request. Return None if no conf is provided.
    """
    try:
        return request.get_json().get("conf")
    except Exception:
        return None


def get_dagbag():
    """
    Load the dagbag from Airflow settings
    """
    airflow_server = version.parse(airflow_version)

    dagbag_kwargs = {"dag_folder": settings.DAGS_FOLDER}
    if airflow_server < version.parse("3.0.0"):
        dagbag_kwargs["read_dags_from_db"] = True

    dagbag = DagBag(**dagbag_kwargs)
    dagbag.collect_dags()

    if airflow_server < version.parse("3.0.0") and hasattr(dagbag, "collect_dags_from_db"):
        dagbag.collect_dags_from_db()

    return dagbag


class ScanDagsTask(Process):
    def run(self):
        airflow_server = version.parse(airflow_version)
        if airflow_server >= version.parse("3.0.0"):
            self._run_dag_processor()
        elif airflow_server >= version.parse("2.6"):
            scheduler_job = self._run_new_scheduler_job()
            self._kill_job(scheduler_job)
        else:
            scheduler_job = self._run_old_scheduler_job()
            self._kill_job(scheduler_job)

    def _kill_job(self, job):
        """Kill the scheduler job after completion"""
        try:
            job.kill()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.info(f"Rescan Complete: Killed Job: {exc}")

    @staticmethod
    def _run_dag_processor():
        """
        Run the DAG processor for Airflow 3.0+

        In Airflow 3.0, DAG parsing logic moved from the scheduler to a
        dedicated DAG processor. We use the DagFileProcessorManager to
        trigger a single parsing run.
        """
        from airflow.dag_processing.manager import DagFileProcessorManager  # noqa: PLC0415

        processor_manager = DagFileProcessorManager(max_runs=1)
        processor_manager.run()

    @staticmethod
    def _run_new_scheduler_job() -> "Job":  # noqa: F821
        """
        Run the new scheduler job from Airflow 2.6
        """
        from airflow.jobs.job import Job, run_job  # noqa: PLC0415
        from airflow.jobs.scheduler_job_runner import SchedulerJobRunner  # noqa: PLC0415

        scheduler_job = Job()
        job_runner = SchedulerJobRunner(
            job=scheduler_job,
            num_runs=1,
        )
        scheduler_job.heartrate = 0

        # pylint: disable=protected-access
        run_job(scheduler_job, execute_callable=job_runner._execute)

        return scheduler_job

    @staticmethod
    def _run_old_scheduler_job() -> "SchedulerJob":  # noqa: F821
        """
        Run the old scheduler job before 2.6
        """
        from airflow.jobs.scheduler_job import SchedulerJob  # noqa: PLC0415

        scheduler_job = SchedulerJob(num_times_parse_dags=1)
        scheduler_job.heartrate = 0
        scheduler_job.run()

        return scheduler_job


_scan_lock = threading.Lock()
_current_scan: Optional[ScanDagsTask] = None


def _start_scan():
    """Start a new ScanDagsTask and spawn a reaper thread to join it.

    Must be called while holding _scan_lock.
    """
    global _current_scan  # pylint: disable=global-statement
    process = ScanDagsTask()
    process.start()
    _current_scan = process
    reaper = threading.Thread(target=_reap_scan, args=(process,), daemon=True)
    reaper.start()


def _reap_scan(process: ScanDagsTask):
    """Wait for the scan process to finish and release resources.

    Runs in a daemon thread.  Only joins the process and clears module
    state — never forks a new process, because forking from a non-main
    thread with the default ``fork`` start-method can deadlock.
    """
    process.join()
    with _scan_lock:
        global _current_scan  # pylint: disable=global-statement
        if _current_scan is process:
            _current_scan = None


def scan_dags_job_background():
    """
    Runs the scheduler scan in a separate process
    to not block the API call.

    Uses a per-worker guard to prevent spawning multiple concurrent
    ScanDagsTask processes from the same Python worker. Each process
    imports the full Airflow scheduler stack, so spawning duplicates
    increases memory usage and can create orphaned SchedulerJob entries
    in the Airflow DB. This guard does not coordinate across multiple
    Gunicorn workers or other processes.

    If a scan is already running when a new deploy arrives, the call
    is skipped.  Newly deployed DAGs will be discovered by the next
    deploy-triggered scan or by Airflow's periodic scheduler.
    """
    with _scan_lock:
        if _current_scan is not None and _current_scan.is_alive():
            logger.info("DAG scan already in progress, skipping")
            return
        _start_scan()
