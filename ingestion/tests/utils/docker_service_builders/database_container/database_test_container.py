#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Base database (supporting SQA) test container for integration tests"""

from ...sqa import SQATestUtils
from ..abstract_test_container import AbstractTestContainer


class DataBaseTestContainer(AbstractTestContainer):
    def __init__(self):
        self.sqa_test_utils = SQATestUtils(self.get_connection_url())
        self.sesssion = self.sqa_test_utils.session
        self.engine = self.sqa_test_utils.engine
        self.sqa_test_utils.create_user_table()
        self.sqa_test_utils.load_user_data()
