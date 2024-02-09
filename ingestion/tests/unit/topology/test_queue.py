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
Check queue operations
"""
from unittest import TestCase

from metadata.ingestion.models.topology import Queue, QueueItem

MAIN_THREAD = "1"
OTHER_THREAD = "2"


class QueueTest(TestCase):
    """Validate queue ops"""

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        self.queue = Queue()

    def test_queue(self):
        """Asserts Queue works as expected"""
        # Assert it returns False when Queue is Empty
        self.assertFalse(self.queue.has_tasks())

        # Assert it returns False when ThreadID doesn't exist/has no tasks
        self.assertFalse(self.queue.has_tasks(MAIN_THREAD))
        # ------------------------------------------------------------------

        # Create a new QueueItem and add it to the queue
        self.queue.add(QueueItem(thread_id=MAIN_THREAD, item=1))

        # Assert it returns True since the Queue is not Empty
        self.assertTrue(self.queue.has_tasks())

        # Assert it returns True for the Thread that has an item
        self.assertTrue(self.queue.has_tasks(MAIN_THREAD))

        # Assert it returns False for a Thread without items on the Queue
        self.assertFalse(self.queue.has_tasks(OTHER_THREAD))

    def test_process(self):
        """Asserts Queue Process process all the items."""

        # Assert Queue starts Empty
        self.assertFalse(self.queue.has_tasks())

        items = [
            {"thread": MAIN_THREAD, "item": 0},
            {"thread": MAIN_THREAD, "item": 1},
            {"thread": OTHER_THREAD, "item": 2},
            {"thread": MAIN_THREAD, "item": 3},
            {"thread": OTHER_THREAD, "item": 4},
        ]

        for item in items:
            self.queue.add(QueueItem(thread_id=item["thread"], item=item["item"]))

        # Assert Queue has tasks
        self.assertTrue(self.queue.has_tasks())
        self.assertTrue(self.queue.has_tasks(MAIN_THREAD))
        self.assertTrue(self.queue.has_tasks(OTHER_THREAD))

        # Process Items
        queued_items = self.queue.process()
        results = []

        while True:
            try:
                results.append(next(queued_items))
            except StopIteration:
                break

        # Assert Queue is empty
        self.assertFalse(self.queue.has_tasks())
        self.assertFalse(self.queue.has_tasks(MAIN_THREAD))
        self.assertFalse(self.queue.has_tasks(OTHER_THREAD))

        # Assert Queue returned all values
        self.assertEqual(results, [0, 1, 2, 3, 4])
