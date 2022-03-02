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
This Model is required to ingest the sample data
from sample_data.py source.

The usual process to add new tests is either via the UI
or by using the ORM Profiler.
"""
from typing import Optional

from pydantic import BaseModel

from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest


class OMetaTableTest(BaseModel):
    table_name: str
    table_test: Optional[CreateTableTestRequest] = None
    column_test: Optional[CreateColumnTestRequest] = None
