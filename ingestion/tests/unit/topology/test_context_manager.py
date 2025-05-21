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
Check context manager operations
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.database_service import DatabaseServiceTopology

MAIN_THREAD = 1
OTHER_THREAD = 2

MOCK_DATABASE_NAME = "MyDatabase"


class TopologyContextManagerTest(TestCase):
    """Validate context manager ops"""

    def __init__(self, methodName) -> None:
        super().__init__(methodName)

        # Randomly picked up to test
        self.topology = DatabaseServiceTopology()
        with patch("threading.get_ident", return_value=MAIN_THREAD):
            self.manager = TopologyContextManager(self.topology)

    def test_main_thread_is_set_correctly(self):
        """Asserts self.main_thread is set accordingly."""
        self.assertEqual(self.manager.main_thread, MAIN_THREAD)

    def test_get_returns_correct_context(self):
        """Asserts get and get_global returns the correct context even on a different thread."""

        # Create a new thread context based on the main thread
        with patch("threading.get_ident", return_value=OTHER_THREAD):
            # Create the new thread context based on the main thread one
            self.manager.copy_from(MAIN_THREAD)

            self.manager.get_global().database = MOCK_DATABASE_NAME

            self.assertEqual(self.manager.get().database, None)
            self.assertEqual(self.manager.get_global().database, MOCK_DATABASE_NAME)

    def test_thread_is_created_correctly(self):
        """Asserts copy_from copies correctly the context from parent thread."""

        # Set the 'database' attribute
        with patch("threading.get_ident", return_value=MAIN_THREAD):
            self.manager.get().database = MOCK_DATABASE_NAME

        with patch("threading.get_ident", return_value=OTHER_THREAD):
            # Create the new thread context based on the main thread one
            self.manager.copy_from(MAIN_THREAD)

            # Check we are retrieving the right thread
            self.assertEqual(self.manager.get().database, MOCK_DATABASE_NAME)

    def test_pop_removes_the_correct_thread(self):
        """Asserts pop removes the correct thread and not another one."""

        with patch("threading.get_ident", return_value=OTHER_THREAD):
            self.manager.copy_from(MAIN_THREAD)

        self.assertEqual(
            list(self.manager.contexts.keys()), [MAIN_THREAD, OTHER_THREAD]
        )

        self.manager.pop(OTHER_THREAD)

        self.assertEqual(list(self.manager.contexts.keys()), [MAIN_THREAD])
