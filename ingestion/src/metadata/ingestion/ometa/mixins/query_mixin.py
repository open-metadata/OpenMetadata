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
Mixin class containing Query specific methods

To be used by OpenMetadata class
"""

from typing import List, Optional, Union

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str


class OMetaQueryMixin:
    """
    OpenMetadata API methods related to Queries.

    To be inherited by OpenMetadata
    """

    def ingest_entity_queries_data(
        self, entity: Union[Table, Dashboard], queries: List[CreateQueryRequest]
    ) -> None:
        """
        PUT queries for an entity

        :param entity: Entity to update
        :param queries: CreateQueryRequest to add
        """
        for create_query in queries:
            query = self.client.put(self.get_suffix(Query), data=create_query.json())
            if query and query.get("id"):
                table_ref = EntityReference(
                    id=entity.id.__root__,
                    type="table",
                    fullyQualifiedName=entity.fullyQualifiedName.__root__,
                    displayName=entity.displayName,
                    description=entity.description.__root__,
                    deleted=entity.deleted,
                    href=entity.href.__root__,
                )
                # convert object to json array string
                table_ref_json = "[" + table_ref.json() + "]"
                self.client.put(
                    f"{self.get_suffix(Query)}/{query.get('id')}/usage",
                    data=table_ref_json,
                )

    def get_entity_queries(
        self, entity_id: Union[Uuid, str], fields: Optional[List[str]] = None
    ) -> Optional[List[Query]]:
        """Get the queries attached to a table

        Args:
            entity_id (Union[Uuid,str]): entity id of given entity
            fields (Optional[List[str]]): list of fields to be included in response


        Returns:
            Optional[List[Query]]: List of queries
        """
        fields_str = "&fields=" + ",".join(fields) if fields else ""
        res = self.client.get(
            f"{self.get_suffix(Query)}?entityId={model_str(entity_id)}&{fields_str}"
        )
        if res and res.get("data"):
            return [Query(**query) for query in res.get("data")]
        return None
