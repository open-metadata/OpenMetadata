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
Openlineage Source Model module
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Union  # noqa: UP035


@dataclass
class OpenLineageEvent:
    """
    An object containing data extracted from raw OpenLineage event. Used as a basis for all abstract methods of
    OpenlineageSource connector.
    """

    run_facet: Dict  # noqa: UP006
    job: Dict  # noqa: UP006
    event_type: str
    inputs: List[Any]  # noqa: UP006
    outputs: List[Any]  # noqa: UP006


@dataclass
class TableFQN:
    """
    Fully Qualified Name of a Table.
    """

    value: str


@dataclass
class TopicFQN:
    """
    Fully Qualified Name of a Topic.
    """

    value: str


@dataclass
class PipelineFQN:
    """
    Fully Qualified Name of a Pipeline.
    """

    value: str


@dataclass
class ColumnFQN:
    """
    Fully Qualified Name of a Column.
    """

    value: str


@dataclass
class LineageNode:
    """
    A node being a part of Lineage information.
    """

    uuid: str
    fqn: Union[TableFQN, TopicFQN, PipelineFQN]  # noqa: UP007
    node_type: str = "table"


@dataclass
class LineageEdge:
    """
    An object describing connection of two nodes in the Lineage information.
    """

    from_node: LineageNode
    to_node: LineageNode


@dataclass
class TableDetails:
    """
    Minimal table information.
    """

    name: str
    schema: str
    database: Optional[str] = None  # noqa: UP045


@dataclass
class ResolvedTable:
    """
    An OpenLineage dataset resolved to an existing OpenMetadata table.

    The fqn is the matched Table FQN; the details field holds the identity
    candidate (top-level or symlink) that produced the match.
    """

    fqn: str
    details: TableDetails


@dataclass
class TopicDetails:
    """
    Minimal topic information extracted from OpenLineage events.
    broker_hostname is extracted from the OpenLineage kafka:// namespace
    and used to match against messaging service bootstrapServers.
    """

    name: str
    broker_hostname: str


@dataclass
class EntityDetails:
    """
    Union type for either table or topic details.
    """

    entity_type: str
    table_details: Optional[TableDetails] = None  # noqa: UP045
    topic_details: Optional[TopicDetails] = None  # noqa: UP045


class EventType(str, Enum):
    """
    List of used OpenLineage event types.
    """

    START = "START"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    ABORT = "ABORT"
    FAIL = "FAIL"
    OTHER = "OTHER"


class SymlinkType(str, Enum):
    """
    OpenLineage symlink identifier types.

    TABLE is a logical/catalog identity (Hive, Glue catalog) and is what
    OpenMetadata database services hold. LOCATION is a physical path
    (S3, HDFS) which this connector cannot resolve to a table or topic.

    Source: https://github.com/OpenLineage/OpenLineage/blob/main/client/java/
            src/main/java/io/openlineage/client/utils/DatasetIdentifier.java
    """

    TABLE = "TABLE"
    LOCATION = "LOCATION"
