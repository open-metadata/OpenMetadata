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
Check queue operations
"""
from unittest import TestCase

from metadata.ingestion.models.topology import Queue


class QueueTest(TestCase):
    """Validate queue ops"""

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        self.queue = Queue()

    def test_queue(self):
        """Asserts Queue works as expected"""
        # Assert it returns False when Queue is Empty
        self.assertFalse(self.queue.has_tasks())
        # ------------------------------------------------------------------

        # Create a new QueueItem and add it to the queue
        self.queue.put(1)

        # Assert it returns True since the Queue is not Empty
        self.assertTrue(self.queue.has_tasks())

    def test_process(self):
        """Asserts Queue Process process all the items."""

        # Assert Queue starts Empty
        self.assertFalse(self.queue.has_tasks())

        items = [
            0,
            1,
            2,
            3,
            4,
        ]

        for item in items:
            self.queue.put(item)

        # Assert Queue has tasks
        self.assertTrue(self.queue.has_tasks())

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

        # Assert Queue returned all values
        self.assertEqual(results, [0, 1, 2, 3, 4])
