#  Copyright 2025 Collate
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
Snowflake constants
"""

from sqlalchemy.sql.sqltypes import BOOLEANTYPE, VARCHAR

DEFAULT_STREAM_COLUMNS = [
    {
        "name": "METADATA$ACTION",
        "type": VARCHAR(length=16777216),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "TEXT(16777216)",
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "METADATA$ISUPDATE",
        "type": BOOLEANTYPE,
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "BOOLEAN",
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "METADATA$ROW_ID",
        "type": VARCHAR(length=16777216),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "TEXT(16777216)",
        "comment": None,
        "primary_key": False,
    },
]
