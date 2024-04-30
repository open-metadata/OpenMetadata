#  Copyright 2024 Collate
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
Helpers module for messaging sources
"""

import re
import traceback
from typing import Optional

from metadata.utils.logger import utils_logger

logger = utils_logger()


def merge_and_clean_protobuf_schema(schema_text: Optional[str]) -> Optional[str]:
    """
    Remove the import and extra syntax lines for a schema with references
    """
    try:
        lines = schema_text.splitlines() if schema_text else []
        new_lines = []
        for i, line in enumerate(lines):
            if not re.search(r'import ".*";', line) and not re.search(
                r"option .*;", line
            ):
                if re.search(r'\s*syntax\s*=\s*"proto\d+";\s*', line) and i != 0:
                    continue
                new_lines.append(line)
        return "\n".join(new_lines)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Failed to merge and clean protobuf schema: {exc}")
    return None
