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
Cypher statements used by the Neo4j source
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing_extensions import LiteralString

NEO4J_HOME_DATABASE: LiteralString = "CALL db.info() YIELD name RETURN name"

NEO4J_NODE_TYPE_PROPERTIES: LiteralString = (
    "CALL db.schema.nodeTypeProperties() "
    "YIELD nodeType, propertyName, propertyTypes, mandatory "
    "RETURN nodeType, propertyName, propertyTypes, mandatory"
)

NEO4J_REL_TYPE_PROPERTIES: LiteralString = (
    "CALL db.schema.relTypeProperties() "
    "YIELD relType, propertyName, propertyTypes, mandatory "
    "RETURN relType, propertyName, propertyTypes, mandatory"
)

NEO4J_TEST_NODE_LABELS: LiteralString = "CALL db.labels() YIELD label RETURN label LIMIT $limit"

NEO4J_TEST_RELATIONSHIP_TYPES: LiteralString = (
    "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType LIMIT $limit"
)
