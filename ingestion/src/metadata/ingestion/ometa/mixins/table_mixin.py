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
import traceback
from typing import List, Optional, Union

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.table import (
    DataModel,
    SqlQuery,
    Table,
    TableData,
    TableJoins,
    TableProfile,
)
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.utils.lru_cache import LRUCache

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
            data=str(location.id.__root__),
        )

    def ingest_table_sample_data(
        self, table: Table, sample_data: TableData
    ) -> TableData:
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
        except Exception as err:
            logger.error(
                f"Error trying to PUT sample data for {table.fullyQualifiedName.__root__} - {err}"
            )
            logger.debug(traceback.format_exc())

        if resp:
            try:
                return TableData(**resp["sampleData"])
            except UnicodeError as err:
                logger.error(
                    f"Unicode Error parsing the sample data response from {table.fullyQualifiedName.__root__} - {err}"
                )
                logger.debug(traceback.format_exc())
            except Exception as err:
                logger.error(
                    f"Error trying to parse sample data results from {table.fullyQualifiedName.__root__} - {err}"
                )

    def ingest_table_profile_data(
        self, table: Table, table_profile: List[TableProfile]
    ) -> List[TableProfile]:
        """
        PUT profile data for a table

        :param table: Table Entity to update
        :param table_profile: Profile data to add
        """
        for profile in table_profile:
            resp = self.client.put(
                f"{self.get_suffix(Table)}/{table.id.__root__}/tableProfile",
                data=profile.json(),
            )
        return [TableProfile(**t) for t in resp["tableProfile"]]

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

    def _add_tests(
        self,
        table: Table,
        test: Union[CreateTableTestRequest, CreateColumnTestRequest],
        path: str,
    ) -> Table:
        """
        Internal function to add test data

        :param table: Table instance
        :param test: TableTest or ColumnTest to add
        :param path: tableTest or columnTest str
        :return: Updated Table instance
        """
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/{path}", data=test.json()
        )

        return Table(**resp)

    def add_table_test(self, table: Table, table_test: CreateTableTestRequest) -> Table:
        """
        For a given table, PUT new TableTest definitions and results

        :param table: Table instance
        :param table_test: table test data
        :return: Updates Table instance
        """

        return self._add_tests(table=table, test=table_test, path="tableTest")

    def add_column_test(self, table: Table, col_test: CreateColumnTestRequest) -> Table:
        """
        For a given table, PUT new TableTest definitions and results

        :param table: Table instance
        :param col_test: column test data
        :return: Updates Table instance
        """

        return self._add_tests(table=table, test=col_test, path="columnTest")

    def update_profile_sample(self, fqn: str, profile_sample: float) -> Optional[Table]:
        """
        Update the profileSample property of a Table, given
        its FQN.

        :param fqn: Table FQN
        :param profile_sample: new profile sample to set
        :return: Updated table
        """
        table = self.get_by_name(entity=Table, fqn=fqn)
        if table:
            updated = CreateTableRequest(
                name=table.name,
                description=table.description,
                tableType=table.tableType,
                columns=table.columns,
                tableConstraints=table.tableConstraints,
                profileSample=profile_sample,  # Updated!
                owner=table.owner,
                databaseSchema=table.databaseSchema,
                tags=table.tags,
                viewDefinition=table.viewDefinition,
            )
            return self.create_or_update(updated)

        return None

    def update_profile_query(self, fqn: str, **kwargs) -> Optional[Table]:
        """
        Update the profileQuery property of a Table, given
        its FQN.

        :param fqn: Table FQN
        :param profile_sample: new profile sample to set
        :return: Updated table
        """
        table = self.get_by_name(entity=Table, fqn=fqn)
        if table:
            updated = CreateTableRequest(
                name=table.name,
                description=table.description,
                tableType=table.tableType,
                columns=table.columns,
                tableConstraints=table.tableConstraints,
                owner=table.owner,
                databaseSchema=table.databaseSchema,
                tags=table.tags,
                viewDefinition=table.viewDefinition,
                **kwargs,
            )
            return self.create_or_update(updated)

        return None
