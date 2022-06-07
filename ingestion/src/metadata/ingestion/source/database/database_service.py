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
Base class for ingesting database services
"""
from abc import ABC

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    ServiceTopology,
    TopologyNode,
    create_source_context,
)


class DatabaseServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Database Services.
    service -> db -> schema -> table.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        type_=DatabaseService,
        context="database_service",
        producer="yield_database_service",
        children=["database"],
    )
    database = TopologyNode(
        type_=Database,
        context="database",
        producer="yield_database",
        children=["databaseSchema"],
        consumer=["database_service"],
    )
    databaseSchema = TopologyNode(
        type_=DatabaseSchema,
        context="database_schema",
        producer="yield_database_schema",
        children=["table"],
        consumer=["database_service", "database"],
    )
    table = TopologyNode(
        type_=Table,
        context="table",
        producer="yield_table",
        consumer=["database_service", "database", "database_schema"],
    )


class DatabaseServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    topology = DatabaseServiceTopology()
    context = create_source_context(topology)
