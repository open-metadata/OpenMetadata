#  Copyright 2024 Collate
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
Helpers module for messaging sources
"""

import re
import traceback
from collections.abc import Collection

from metadata.utils.logger import utils_logger

logger = utils_logger()


def merge_and_clean_protobuf_schema(schema_text: str | None) -> str | None:
    """
    Remove the import and extra syntax lines for a schema with references
    """
    try:
        lines = schema_text.splitlines() if schema_text else []
        new_lines = []
        for i, line in enumerate(lines):
            is_import = re.search(r'import ".*";', line)
            is_well_known_type_import = re.search(r'import "google/protobuf/.*\.proto";', line)
            if (not is_import or is_well_known_type_import) and not re.search(r"option .*;", line):
                if re.search(r'\s*syntax\s*=\s*"proto\d+";\s*', line) and i != 0:
                    continue
                new_lines.append(line)
        return "\n".join(new_lines)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Failed to merge and clean protobuf schema: {exc}")
    return None


def clean_protobuf_schema(schema_text: str, imports: Collection[str]) -> str:
    """
    Drop the lines of one Protobuf file that protoc cannot resolve on its own: option lines, and
    imports that are neither in `imports` nor well-known types.
    """
    lines = []
    for line in schema_text.splitlines():
        imported = re.match(r'\s*import\s+(?:public\s+|weak\s+)?"(.*)";', line)
        is_unresolved_import = (
            imported is not None
            and imported.group(1) not in imports
            and not imported.group(1).startswith("google/protobuf/")
        )
        if not is_unresolved_import and not re.match(r"\s*option\s.*;", line):
            lines.append(line)
    return "\n".join(lines)
