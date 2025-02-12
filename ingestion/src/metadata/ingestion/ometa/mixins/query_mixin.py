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
import hashlib
import json
from typing import List, Optional, Union

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.masker import mask_query
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str


class OMetaQueryMixin:
    """
    OpenMetadata API methods related to Queries.

    To be inherited by OpenMetadata
    """

    client: REST

    def _get_query_hash(self, query: str) -> str:
        result = hashlib.md5(query.encode())
        return str(result.hexdigest())

    def _get_or_create_query(self, query: CreateQueryRequest) -> Optional[Query]:
        if query.query.root is None:
            return None
        query_hash = self._get_query_hash(query=query.query.root)
        query_entity = self.get_by_name(entity=Query, fqn=query_hash)
        if query_entity is None:
            resp = self.client.put(self.get_suffix(Query), data=query.model_dump_json())
            if resp and resp.get("id"):
                query_entity = Query(**resp)
        return query_entity

    def ingest_entity_queries_data(
        self, entity: Union[Table, Dashboard], queries: List[CreateQueryRequest]
    ) -> None:
        """
        PUT queries for an entity

        :param entity: Entity to update
        :param queries: CreateQueryRequest to add
        """
        for create_query in queries:
            if not create_query.exclude_usage:
                create_query.query.root = mask_query(
                    create_query.query.root, create_query.dialect
                )
                query = self._get_or_create_query(create_query)
                if query:
                    # Add Query Usage
                    table_ref = EntityReference(id=entity.id.root, type="table")
                    # convert object to json array string
                    table_ref_json = "[" + table_ref.model_dump_json() + "]"
                    self.client.put(
                        f"{self.get_suffix(Query)}/{model_str(query.id)}/usage",
                        data=table_ref_json,
                    )

                    # Add Query Users
                    user_fqn_list = create_query.users
                    if user_fqn_list:
                        self.client.put(
                            f"{self.get_suffix(Query)}/{model_str(query.id)}/users",
                            data=json.dumps(
                                [model_str(user_fqn) for user_fqn in user_fqn_list]
                            ),
                        )

                    # Add Query used by
                    user_list = create_query.usedBy
                    if user_list:
                        self.client.put(
                            f"{self.get_suffix(Query)}/{model_str(query.id)}/usedBy",
                            data=json.dumps(user_list),
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
