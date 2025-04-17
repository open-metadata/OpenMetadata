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

# pylint: disable=abstract-method

"""
Expand sqlalchemy types to map them to OpenMetadata DataType
"""
from sqlalchemy.sql.sqltypes import String, TypeDecorator

from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CustomIP(TypeDecorator):
    """
    Convert RowVersion
    """

    impl = String
    cache_ok = True
