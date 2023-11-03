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
Custom thread pool Executor
"""

import queue
from concurrent.futures import ThreadPoolExecutor


class CustomThreadPoolExecutor(ThreadPoolExecutor):
    """In python 3.9 shutdown will stop the pool Executor.
    We replicate it here to add support in 3.7 and 3.8
    """

    def shutdown39(self, wait=True, *, cancel_futures=False):
        """replicate shutdown from 3.9

        Args:
            wait (bool, optional): Defaults to True.
            cancel_futures (bool, optional): Defaults to False.
        """
        with self._shutdown_lock:
            self._shutdown = True
            if cancel_futures:
                # Drain all work items from the queue, and then cancel their
                # associated futures.
                while True:
                    try:
                        work_item = self._work_queue.get_nowait()
                    except queue.Empty:
                        break
                    if work_item is not None:
                        work_item.future.cancel()

            # Send a wake-up to prevent threads calling
            # _work_queue.get(block=True) from permanently blocking.
            self._work_queue.put(None)
        if wait:
            for thread_ in self._threads:
                thread_.join()
