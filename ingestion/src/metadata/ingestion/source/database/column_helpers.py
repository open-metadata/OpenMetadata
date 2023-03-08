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
Helpers functions to handle columns when we extract
their raw information from the source
"""


def remove_table_from_column_name(table_name: str, raw_column_name: str) -> str:
    """
    Given a column `table.column`, return only `column`.

    Note that we might have columns which have real dots
    "." in the name, so we cannot just split.
    """
    return raw_column_name.replace(table_name + ".", "")
