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
Module containing the logic to retrieve all logs from the tasks of a last DAG run
"""
import os
from functools import lru_cache, partial
from io import StringIO
from typing import List, Optional, Tuple

from airflow.models import DagModel, TaskInstance
from airflow.utils.log.log_reader import TaskLogReader
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.utils.logger import operations_logger

logger = operations_logger()

LOG_METADATA = {
    "download_logs": False,
}
CHUNK_SIZE = 2_000_000
DOT_STR = "_DOT_"


@lru_cache(maxsize=10)
def get_log_file_info(log_file_path: str, mtime: int) -> Tuple[int, int]:
    """
    Get total size and number of chunks for a log file.
    :param log_file_path: Path to log file
    :param mtime: File modification time in seconds (used as cache key)
    :return: Tuple of (file_size_bytes, total_chunks)
    """
    file_size = os.path.getsize(log_file_path)
    total_chunks = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    return file_size, total_chunks


def read_log_chunk_from_file(file_path: str, chunk_index: int) -> Optional[str]:
    """
    Read a specific chunk from a log file without loading entire file.
    :param file_path: Path to the log file
    :param chunk_index: 0-based chunk index to read
    :return: Log chunk content or None if error
    """
    try:
        offset = chunk_index * CHUNK_SIZE
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            f.seek(offset)
            chunk = f.read(CHUNK_SIZE)
        return chunk
    except Exception as exc:
        logger.warning(f"Failed to read log chunk from {file_path}: {exc}")
        return None


def last_dag_logs(dag_id: str, task_id: str, after: Optional[int] = None) -> Response:
    """
    Validate that the DAG is registered by Airflow and have at least one Run.
    If exists, returns all logs for each task instance of the last DAG run.
    Uses file streaming to avoid loading entire log file into memory.
        :param dag_id: DAG to look for
        :param task_id: Task to fetch logs from
        :param after: log stream cursor
        :return: Response with log and pagination
    """
    dag_model = DagModel.get_dagmodel(dag_id=dag_id)

    if not dag_model:
        return ApiResponse.not_found(f"DAG {dag_id} not found.")

    last_dag_run = dag_model.get_last_dagrun(include_externally_triggered=True)

    if not last_dag_run:
        return ApiResponse.not_found(f"No DAG run found for {dag_id}.")

    task_instances: List[TaskInstance] = last_dag_run.get_task_instances()

    if not task_instances:
        return ApiResponse.not_found(
            f"Cannot find any task instance for the last DagRun of {dag_id}."
        )

    target_task_instance = None
    for task_instance in task_instances:
        if task_instance.task_id == task_id:
            target_task_instance = task_instance
            break

    if not target_task_instance:
        return ApiResponse.bad_request(f"Task {task_id} not found in DAG {dag_id}.")

    try_number = target_task_instance._try_number  # pylint: disable=protected-access

    task_log_reader = TaskLogReader()
    if not task_log_reader.supports_read:
        return ApiResponse.server_error("Task Log Reader does not support read logs.")

    # Try to use file streaming for better performance
    try:

        from airflow.configuration import (  # pylint: disable=import-outside-toplevel
            conf,
        )

        base_log_folder = conf.get("logging", "base_log_folder")
        # dag_id and task_id are already sanitized at route level
        # Only dots are replaced for Airflow log path compatibility
        dag_id_safe = dag_id.replace(".", DOT_STR)
        task_id_safe = task_id.replace(".", DOT_STR)

        log_relative_path = f"dag_id={dag_id_safe}/run_id={last_dag_run.run_id}/task_id={task_id_safe}/attempt={try_number}.log"
        log_file_path = os.path.join(base_log_folder, log_relative_path)

        # Security: Validate the resolved path stays within base_log_folder
        # to prevent directory traversal attacks. This provides defense-in-depth
        # even though dag_id and task_id are already sanitized at the route level.
        log_file_path_real = os.path.realpath(log_file_path)
        base_log_folder_real = os.path.realpath(base_log_folder)

        if not log_file_path_real.startswith(base_log_folder_real + os.sep):
            logger.warning(
                f"Path traversal attempt detected: {log_file_path} is outside {base_log_folder}"
            )
            return ApiResponse.bad_request(
                f"Invalid log path for DAG {dag_id} and Task {task_id}."
            )

        if os.path.exists(log_file_path_real):
            stat_info = os.stat(log_file_path_real)
            file_mtime = int(stat_info.st_mtime)

            _, total_chunks = get_log_file_info(log_file_path_real, file_mtime)

            after_idx = int(after) if after is not None else 0

            if after_idx >= total_chunks:
                return ApiResponse.bad_request(
                    f"After index {after} is out of bounds. Total pagination is {total_chunks} for DAG {dag_id} and Task {task_id}."
                )

            chunk_content = read_log_chunk_from_file(log_file_path_real, after_idx)

            if chunk_content is not None:
                return ApiResponse.success(
                    {
                        task_id: chunk_content,
                        "total": total_chunks,
                        **(
                            {"after": after_idx + 1}
                            if after_idx < total_chunks - 1
                            else {}
                        ),
                    }
                )
    except Exception as exc:
        logger.debug(
            f"File streaming failed for DAG {dag_id}, falling back to TaskLogReader: {exc}"
        )

    # Fallback to TaskLogReader if streaming fails
    return _last_dag_logs_fallback(
        dag_id, task_id, after, target_task_instance, task_log_reader, try_number
    )


def _last_dag_logs_fallback(
    dag_id: str,
    task_id: str,
    after: Optional[int],
    task_instance: TaskInstance,
    task_log_reader: TaskLogReader,
    try_number: int,
) -> Response:
    """
    Fallback to reading entire log file into memory (old behavior).
    :param dag_id: DAG to look for
    :param task_id: Task to fetch logs from
    :param after: log stream cursor
    :param task_instance: Task instance to fetch logs from
    :param task_log_reader: TaskLogReader instance
    :param try_number: Task attempt number
    :return: API Response
    """
    raw_logs_str = "".join(
        list(
            task_log_reader.read_log_stream(
                ti=task_instance,
                try_number=try_number,
                metadata=LOG_METADATA,
            )
        )
    )

    if not raw_logs_str:
        return ApiResponse.bad_request(
            f"Can't fetch logs for DAG {dag_id} and Task {task_id}."
        )

    # Split the string in chunks of size without
    # having to know the full length beforehand
    log_chunks = [
        chunk for chunk in iter(partial(StringIO(raw_logs_str).read, CHUNK_SIZE), "")
    ]

    total = len(log_chunks)
    after_idx = int(after) if after is not None else 0

    if after_idx >= total:
        return ApiResponse.bad_request(
            f"After index {after} is out of bounds. Total pagination is {total} for DAG {dag_id} and Task {task_id}."
        )

    return ApiResponse.success(
        {
            task_id: log_chunks[after_idx],
            "total": len(log_chunks),
            # Only add the after if there are more pages
            **({"after": after_idx + 1} if after_idx < total - 1 else {}),
        }
    )
