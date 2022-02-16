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
Expand sqlalchemy types to map them to OpenMetadata DataType
"""
from sqlalchemy.sql.sqltypes import String, TypeDecorator


class HexByteString(TypeDecorator):
    """
    Convert Python bytestring to string with hexadecimal digits and back for storage.
    """

    impl = String
    cache_ok = True

    @property
    def python_type(self):
        return str

    @staticmethod
    def validate(value: bytes):
        """
        Make sure the data is of correct type
        """
        if not isinstance(value, bytes):
            raise TypeError("HexByteString columns support only bytes values.")

    def process_bind_param(self, value: bytes, dialect):
        self.validate(value)
        return value.hex()

    def process_result_value(self, value: str, dialect):
        return bytes.fromhex(value) if value else None

    def process_literal_param(self, value, dialect):
        self.validate(value)
        return value
