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
Mixin class containing Table specific methods

To be used by OpenMetadata class
"""
import json
import traceback
from typing import List, Optional

from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.table import (
    DataModel,
    SqlQuery,
    Table,
    TableData,
    TableJoins,
    TableProfilerConfig,
)
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.uuid_encoder import UUIDEncoder

logger = ometa_logger()

LRU_CACHE_SIZE = 4096


class OMetaTableMixin:
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    def add_location(self, table: Table, location: Location) -> None:
        """
        PUT location for a table

        :param table: Table Entity to update
        :param location: Location Entity to add
        """
        self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/location",
            data=json.dumps(location.id.__root__, cls=UUIDEncoder),
        )

    def ingest_table_sample_data(
        self, table: Table, sample_data: TableData
    ) -> Optional[TableData]:
        """
        PUT sample data for a table

        :param table: Table Entity to update
        :param sample_data: Data to add
        """
        resp = None
        try:
            resp = self.client.put(
                f"{self.get_suffix(Table)}/{table.id.__root__}/sampleData",
                data=sample_data.json(),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT sample data for {table.fullyQualifiedName.__root__}: {exc}"
            )

        if resp:
            try:
                return TableData(**resp["sampleData"])
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {table.fullyQualifiedName.__root__}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {table.fullyQualifiedName.__root__}: {exc}"
                )

        return None

    def ingest_profile_data(
        self, table: Table, profile_request: CreateTableProfileRequest
    ) -> Table:
        """
        PUT profile data for a table

        :param table: Table Entity to update
        :param table_profile: Profile data to add
        """
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/tableProfile",
            data=profile_request.json(),
        )
        return Table(**resp)

    def ingest_table_data_model(self, table: Table, data_model: DataModel) -> Table:
        """
        PUT data model for a table

        :param table: Table Entity to update
        :param data_model: Model to add
        """
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/dataModel",
            data=data_model.json(),
        )
        return Table(**resp)

    def ingest_table_queries_data(
        self, table: Table, table_queries: List[SqlQuery]
    ) -> None:
        """
        PUT table queries for a table

        :param table: Table Entity to update
        :param table_queries: SqlQuery to add
        """
        seen_queries = LRUCache(LRU_CACHE_SIZE)
        for query in table_queries:
            if query.query not in seen_queries:
                self.client.put(
                    f"{self.get_suffix(Table)}/{table.id.__root__}/tableQuery",
                    data=query.json(),
                )
                seen_queries.put(query.query, None)

    def publish_table_usage(
        self, table: Table, table_usage_request: UsageRequest
    ) -> None:
        """
        POST usage details for a Table

        :param table: Table Entity to update
        :param table_usage_request: Usage data to add
        """
        resp = self.client.put(
            f"/usage/table/{table.id.__root__}", data=table_usage_request.json()
        )
        logger.debug("published table usage %s", resp)

    def publish_frequently_joined_with(
        self, table: Table, table_join_request: TableJoins
    ) -> None:
        """
        POST frequently joined with for a table

        :param table: Table Entity to update
        :param table_join_request: Join data to add
        """

        logger.info("table join request %s", table_join_request.json())
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/joins",
            data=table_join_request.json(),
        )
        logger.debug("published frequently joined with %s", resp)

    def _create_or_update_table_profiler_config(
        self,
        table: Table,
        table_profiler_config: TableProfilerConfig,
    ):
        """create or update profler config

        Args:
            table: table entity
            table_profiler_config: profiler config object,
            path: tableProfilerConfig

        Returns:

        """
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/tableProfilerConfig",
            data=table_profiler_config.json(),
        )
        return Table(**resp)

    def create_or_update_table_profiler_config(
        self, fqn: str, table_profiler_config: TableProfilerConfig
    ) -> Optional[Table]:
        """
        Update the profileSample property of a Table, given
        its FQN.

        :param fqn: Table FQN
        :param profile_sample: new profile sample to set
        :return: Updated table
        """
        table = self.get_by_name(entity=Table, fqn=fqn)
        if table:
            return self._create_or_update_table_profiler_config(
                table=table,
                table_profiler_config=table_profiler_config,
            )

        return None
