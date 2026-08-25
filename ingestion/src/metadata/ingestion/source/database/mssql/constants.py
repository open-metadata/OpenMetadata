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
MSSQL constants
"""

DEFAULT_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
MSSQL_DATEFORMAT_DATETIME_MAP = {
    "dmy": "%d-%m-%Y %H:%M:%S",
    "dym": "%d-%Y-%m %H:%M:%S",
    "ymd": DEFAULT_DATETIME_FORMAT,
    "ydm": "%Y-%d-%m %H:%M:%S",
    "mdy": "%m-%d-%Y %H:%M:%S",
    "myd": "%m-%Y-%d %H:%M:%S",
}
