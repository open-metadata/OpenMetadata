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
SQL Queries used during ingestion
"""

import textwrap

COUCHBASE_GET_INDEX_KEYS = textwrap.dedent(
    """ select * from system:indexes where {condition}"""
)


COUCHBASE_GET_DATA = textwrap.dedent(
    """ select * from `{database_name}`.`{schema_name}`.`{table_name}` {condition} limit {sample_size} """
)
