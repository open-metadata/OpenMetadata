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
Test module for loading configs
"""
import json
import os
from pathlib import Path
from unittest import TestCase, mock

from metadata.config.common import ConfigurationError, load_config_file


class TestConfig(TestCase):
    """
    Check config reading
    """

    basedir = os.path.join(os.path.dirname(__file__), "resources", "config")

    def test_basic(self):
        """
        Load basic config file
        """
        basic_file = Path(os.path.join(self.basedir, "basic.json"))
        loaded = load_config_file(basic_file)

        with basic_file.open() as file:
            expected = json.loads(file.read())

        assert loaded == expected

    def test_invalid(self):
        """
        Fail with non existent file
        """
        no_file = Path(os.path.join(self.basedir, "random.json"))

        with self.assertRaises(ConfigurationError):
            load_config_file(no_file)

    def test_bad_suffix(self):
        """
        Fail if not valid suffix
        """
        bad_suffix = Path(os.path.join(self.basedir, "basic.random"))

        with self.assertRaises(ConfigurationError):
            load_config_file(bad_suffix)

    @mock.patch.dict(os.environ, {"PASSWORD": "super_safe"})
    def test_env(self):
        """
        We can load env vars correctly
        """
        pwd_file = Path(os.path.join(self.basedir, "env_ok.json"))
        loaded = load_config_file(pwd_file)

        assert loaded["source"]["config"]["secret"] == "super_safe"

    def test_dollar_string(self):
        """
        String with $ should not be expanded
        """
        dollar_file = Path(os.path.join(self.basedir, "dollar.json"))
        loaded = load_config_file(dollar_file)

        assert loaded["source"]["config"]["secret"] == "te$t"
