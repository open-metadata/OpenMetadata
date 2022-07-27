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
Test helper functions
"""
from unittest import TestCase

from openmetadata.helpers import clean_dag_id


class TestHelpers(TestCase):
    """
    Methods to validate helpers on REST APIs
    """

    def test_clean_dag_id(self):
        """
        To make sure airflow can parse it
        """
        self.assertEqual(clean_dag_id("hello"), "hello")
        self.assertEqual(clean_dag_id("hello(world)"), "hello_world_")
        self.assertEqual(clean_dag_id("hello-world"), "hello-world")
        self.assertEqual(clean_dag_id("%%&^++hello__"), "_hello__")
