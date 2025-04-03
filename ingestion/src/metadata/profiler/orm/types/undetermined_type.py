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
Undetermined types for cases where we dont have typ mappings
"""
from sqlalchemy.sql.sqltypes import String, TypeDecorator


class UndeterminedType(TypeDecorator):
    """A fallback type for undetermined types returned from the database"""

    impl = String
    cache_ok = True

    @property
    def python_type(self):
        return str

    def process_result_value(self, value, _):
        """
        We have no idea what is this type. So we just casr
        """
        return (
            f"OPENMETADATA_UNDETERMIND[{str(value)}]"
            if value
            else "OPENMETADATA_UNDETERMIND[]"
        )
