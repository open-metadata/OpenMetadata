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
Utils module to parse the avro schema
"""

import traceback
from typing import Optional

import avro.schema as avroschema
from avro.schema import RecordSchema

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def parse_avro_schema(schema: str) -> Optional[RecordSchema]:
    """
    Method to parse the avro schema
    """
    try:
        parsed_schema = avroschema.parse(schema)
        return parsed_schema
    except Exception as exc:  # pylint: disable=broad-except
        logger.debug(traceback.format_exc())
        logger.warning(f"Unable to parse the avro schema: {exc}")
    return None
