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
openCypher statements used by the Neptune source
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing_extensions import LiteralString

# Neptune's documented property graph schema procedure. Read-only; served from the
# schema Neptune has cached, so it never scans the graph.
NEPTUNE_PG_SCHEMA: LiteralString = "CALL neptune.graph.pg_schema()"

# Starts the asynchronous schema computation. Needs write permission on the cluster.
NEPTUNE_PG_SCHEMA_COMPUTE: LiteralString = "CALL neptune.graph.pg_schema.compute()"
