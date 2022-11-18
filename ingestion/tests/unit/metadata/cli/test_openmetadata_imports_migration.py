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
test import migration cli script
"""
import os
from pathlib import Path
from unittest import TestCase

from metadata.cli.openmetadata_imports_migration import (
    run_openmetadata_imports_migration,
)


class TestOpenmetadataImportsMigration(TestCase):
    """Test class for the cli scrip test"""

    store = dict()
    resources_path = Path(__file__).parent.absolute() / "resources"

    @classmethod
    def setUpClass(cls) -> None:
        for root, _, filenames in os.walk(cls.resources_path):
            for filename in filenames:
                with open(os.path.join(root, filename), "r", encoding="utf-8") as fle:
                    cls.store[os.path.join(root, filename)] = fle.read()

    def test_run_openmetadata_imports_migration(self):
        """test the run openmetadata function"""
        run_openmetadata_imports_migration(self.resources_path, True)
        failures = []

        for root, _, filenames in os.walk(self.resources_path):
            for filename in filenames:
                if os.path.splitext(filename)[1] == ".py":
                    with open(
                        os.path.join(root, filename), "r", encoding="utf-8"
                    ) as fle:
                        data = fle.read()
                        if "from openmetadata_managed_apis." not in data:
                            failures.append(filename)
                        if "/opt/airflow/dag_generated_configs" not in data:
                            failures.append(filename)

        assert not failures

    @classmethod
    def tearDownClass(cls) -> None:
        for file_path, file_content in cls.store.items():
            with open(file_path, "w", encoding="utf-8") as fle:
                fle.write(file_content)
