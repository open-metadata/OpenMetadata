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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""


from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)


class SnowflakeTestSuiteInterface(SQATestSuiteInterface):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def create_session(self):
        super().create_session()
        self.set_session_tag(self.session)
