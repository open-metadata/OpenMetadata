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
Helpers functions to handle columns when we extract
their raw information from the source
"""


def truncate_column_name(col_name: str):
    """
    OpenMetadata table column specification limits column name to 128 characters.
    To allow ingestion of tables we set name to truncate to 128 characters if its longer
    and use displayName to have the raw column name
    """
    return col_name[:256]
