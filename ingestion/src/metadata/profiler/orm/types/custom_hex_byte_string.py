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
Expand sqlalchemy types to map them to OpenMetadata DataType
"""
# pylint: disable=duplicate-code,abstract-method
import traceback
from typing import Optional

import chardet
from sqlalchemy.sql.sqltypes import String, TypeDecorator

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
NULL_BYTE = "\x00"


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
        if not isinstance(value, (bytes, bytearray)):
            raise TypeError(
                f"HexByteString columns support only bytes values. Received {type(value).__name__}."
            )

    def process_result_value(self, value: Optional[bytes], dialect) -> Optional[str]:
        """This is executed during result retrieval

        Args:
            value: database record
            dialect: database dialect
        Returns:
            hex string representation of the byte value
        """
        if not value:
            return None
        self.validate(value)

        bytes_value = bytes(value)
        detected_encoding = chardet.detect(bytes_value).get("encoding")
        if detected_encoding:
            try:
                # Decode the bytes value with the detected encoding and replace errors with "?"
                # if bytes cannot be decoded e.g. b"\x66\x67\x67\x9c", if detected_encoding="utf-8"
                # will result in 'foo�' (instead of failing)
                str_value = bytes_value.decode(
                    encoding=detected_encoding, errors="replace"
                )
                # Replace NULL_BYTE with empty string to avoid errors with
                # the database client (should be O(n))
                str_value = (
                    str_value.replace(NULL_BYTE, "")
                    if NULL_BYTE in str_value
                    else str_value
                )
                return str_value
            except Exception as exc:
                logger.debug("Failed to parse bytes value as string: %s", exc)
                logger.debug(traceback.format_exc())

        return value.hex()

    def process_literal_param(self, value, dialect):
        self.validate(value)
        return value
