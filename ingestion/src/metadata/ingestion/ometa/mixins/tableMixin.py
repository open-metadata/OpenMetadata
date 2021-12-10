"""
Mixin class containing Table specific methods

To be used by OpenMetadata class
"""
import logging
from typing import List

from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.table import (
    DataModel,
    Table,
    TableData,
    TableJoins,
    TableProfile,
)
from metadata.ingestion.models.table_queries import TableUsageRequest
from metadata.ingestion.ometa.client import REST

logger = logging.getLogger(__name__)


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
        resp = self.client.put(
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
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/sampleData",
            data=sample_data.json(),
        )
        return TableData(**resp["sampleData"])

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

    def publish_table_usage(
        self, table: Table, table_usage_request: TableUsageRequest
    ) -> None:
        """
        POST usage details for a Table

        :param table: Table Entity to update
        :param table_usage_request: Usage data to add
        """
        resp = self.client.post(
            f"/usage/table/{table.id.__root__}", data=table_usage_request.json()
        )
        logger.debug("published table usage {}".format(resp))

    def publish_frequently_joined_with(
        self, table: Table, table_join_request: TableJoins
    ) -> None:
        """
        POST frequently joined with for a table

        :param table: Table Entity to update
        :param table_join_request: Join data to add
        """
        logger.info("table join request {}".format(table_join_request.json()))
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.__root__}/joins",
            data=table_join_request.json(),
        )
        logger.debug("published frequently joined with {}".format(resp))
