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
Validate Server Mixin version methods
"""

from unittest import TestCase

from metadata.__version__ import (
    get_client_version_from_string,
    get_server_version_from_string,
)


class OMetaVersionTest(TestCase):
    """
    Check version methods
    """

    def test_get_version_from_string(self):
        """
        We should be able to parse regular version responses
        """
        self.assertEqual("0.11.0", get_server_version_from_string("0.11.0.dev0"))
        self.assertEqual("0.11.0", get_server_version_from_string("0.11.0"))
        self.assertEqual("1111.11.111", get_server_version_from_string("1111.11.111"))
        self.assertEqual(
            "1111.11.111", get_server_version_from_string("1111.11.111-SNAPSHOT")
        )
        self.assertEqual("0.11.1", get_server_version_from_string("0.11.1.0.0.1.patch"))

    def test_get_client_version_from_string(self):
        """
        We should be able to parse regular version responses
        """
        self.assertEqual("0.13.2.5", get_client_version_from_string("0.13.2.5.dev0"))
        self.assertEqual("0.11.0.1", get_client_version_from_string("0.11.0.1"))
        self.assertEqual(
            "1111.11.111.1", get_client_version_from_string("1111.11.111.1")
        )
        self.assertEqual(
            "1111.11.111.2", get_client_version_from_string("1111.11.111.2-SNAPSHOT")
        )
        self.assertEqual(
            "0.11.1.0", get_client_version_from_string("0.11.1.0.0.1.patch")
        )
