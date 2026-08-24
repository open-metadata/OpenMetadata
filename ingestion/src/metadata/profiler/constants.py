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
Keys of the table-level results a profiler interface returns.

They are shared between the producers (the SQA table metric computers and the pandas interface) and
the consumer (`Profiler.get_profile`), which maps them onto `TableProfile`.
"""

ROW_COUNT = "rowCount"
COLUMN_COUNT = "columnCount"
COLUMN_NAMES = "columnNames"
SIZE_IN_BYTES = "sizeInBytes"
CREATE_DATETIME = "createDateTime"
