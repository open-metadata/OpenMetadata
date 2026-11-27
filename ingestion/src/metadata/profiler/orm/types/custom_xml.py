#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""XML read back as text, with metric computation still switched off"""

from sqlalchemy import TEXT


class XML(TEXT):
    """An XML document, sampled as the string every driver returns.

    The class name is what keeps metrics off: `NOT_COMPUTE` lists `DataType.XML.value`
    and both `core._prepare_column_metrics` and `UniqueCount` test
    `column.type.__class__.__name__` against that set. Mapping XML onto plain `TEXT`
    would read the samples correctly but start running distinct/unique/histogram/length
    metrics on a type most dialects cannot group or compare.
    """
