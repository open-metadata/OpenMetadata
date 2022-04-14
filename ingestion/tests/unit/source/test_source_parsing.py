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
Test that we can properly parse source configs
"""
import os
import json

from pathlib import Path
from unittest import TestCase

from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.source.amundsen import AmundsenSource
from metadata.ingestion.source.mysql import MysqlSource


class SourceParseTest(TestCase):
    this_dir = os.path.dirname(os.path.realpath(__file__))
    workflows_dir = Path(this_dir).parent.parent.parent / "examples" / "workflows"

    def test_amundsen(self):
        with open(self.workflows_dir / "amundsen.json") as workflow_json:
            config = json.load(workflow_json)
            workflow = Workflow.create(config)

            assert isinstance(workflow.source, AmundsenSource)

    def test_mysql(self):
        with open(self.workflows_dir / "mysql.json") as workflow_json:
            config = json.load(workflow_json)
            workflow = Workflow.create(config)

            assert isinstance(workflow.source, MysqlSource)
