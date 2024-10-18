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
Workflow Builder
"""
import logging
import queue
import threading
from logging.handlers import QueueHandler
from queue import Queue
from threading import Thread
from typing import Tuple, Iterable

from metadata.utils.logger import METADATA_LOGGER

from webserver.repository import LocalIngestionServer


def workflow_runner() -> Tuple[Thread, Queue]:
    """Trigger the ingestion"""
    LocalIngestionServer().build_workflow()
    
    logger = logging.getLogger(METADATA_LOGGER)
    que = queue.Queue(-1)
    queue_handler = QueueHandler(que)
    logger.addHandler(queue_handler)

    task_thread = threading.Thread(target=LocalIngestionServer().run_workflow)
    task_thread.start()  # Start the task in a new thread

    return task_thread, que


def handle_log_queue(thread: Thread, que: Queue) -> Iterable[str]:
    """Handle the log queue"""
    while thread.is_alive() or not que.empty():
        try:
            record = que.get(block=False, timeout=100)
            print(record.message)
            yield record.message
        except queue.Empty:
            continue

    thread.join()

    del thread
    del que
