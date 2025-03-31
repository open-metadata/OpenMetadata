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
import base64
import traceback
from typing import List, Optional, Type, TypeVar

from pydantic import BaseModel, validate_call

from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.tests.createCustomMetric import (
    CreateCustomMetricRequest,
)
from metadata.generated.schema.entity.data.table import (
    ColumnProfile,
    DataModel,
    SystemProfile,
    Table,
    TableData,
    TableJoins,
    TableProfile,
    TableProfilerConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.utils import model_str, quote
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

LRU_CACHE_SIZE = 4096
T = TypeVar("T", bound=BaseModel)


class OMetaTableMixin:
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    # pylint: disable=too-many-nested-blocks
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
            # Pre-process sample data to handle binary/non-UTF-8 data before serialization
            if sample_data and sample_data.rows:

                for row in sample_data.rows:
                    if not row:
                        continue
                    for col_idx, value in enumerate(row):
                        # Handle binary data explicitly
                        if isinstance(value, bytes):
                            # Convert binary data to Base64-encoded string
                            try:
                                row[
                                    col_idx
                                ] = f"[base64]{base64.b64encode(value).decode('ascii', errors='ignore')}"
                            except Exception as _:
                                row[col_idx] = f"[binary]{value}"

            try:
                data = sample_data.model_dump_json()
            except Exception as _:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error serializing sample data for {table.fullyQualifiedName.root}"
                    " please check if the data is valid"
                )
                return None

            # Now safely serialize to JSON
            resp = self.client.put(
                f"{self.get_suffix(Table)}/{table.id.root}/sampleData",
                data=data,
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT sample data for {table.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return TableData(**resp["sampleData"])
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {table.fullyQualifiedName.root}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {table.fullyQualifiedName.root}: {exc}"
                )

        return None

    def get_sample_data(self, table: Table) -> Optional[Table]:
        """
        GET call for the /sampleData endpoint for a given Table

        Returns a Table entity with TableData (sampleData informed)
        """
        resp = None
        try:
            resp = self.client.get(
                f"{self.get_suffix(Table)}/{table.id.root}/sampleData",
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to GET sample data for {table.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return Table(**resp)
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {table.fullyQualifiedName.root}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {table.fullyQualifiedName.root}: {exc}"
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
            f"{self.get_suffix(Table)}/{table.id.root}/tableProfile",
            data=profile_request.model_dump_json(),
        )
        return Table(**resp)

    def ingest_table_data_model(self, table: Table, data_model: DataModel) -> Table:
        """
        PUT data model for a table

        :param table: Table Entity to update
        :param data_model: Model to add
        """
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.root}/dataModel",
            data=data_model.model_dump_json(),
        )
        return Table(**resp)

    def publish_table_usage(
        self, table: Table, table_usage_request: UsageRequest
    ) -> None:
        """
        POST usage details for a Table

        :param table: Table Entity to update
        :param table_usage_request: Usage data to add
        """
        resp = self.client.post(
            f"/usage/table/{table.id.root}", data=table_usage_request.model_dump_json()
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

        logger.info("table join request %s", table_join_request.model_dump_json())
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table.id.root}/joins",
            data=table_join_request.model_dump_json(),
        )
        logger.debug("published frequently joined with %s", resp)

    def _create_or_update_table_profiler_config(
        self,
        table_id: Uuid,
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
            f"{self.get_suffix(Table)}/{model_str(table_id)}/tableProfilerConfig",
            data=table_profiler_config.model_dump_json(),
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
                table.id,
                table_profiler_config=table_profiler_config,
            )

        return None

    @validate_call
    def get_profile_data(
        self,
        fqn: str,
        start_ts: int,
        end_ts: int,
        limit=100,
        after=None,
        profile_type: Type[T] = TableProfile,
    ) -> EntityList[T]:
        """Get profile data

        Args:
            fqn (str): fullyQualifiedName
            start_ts (int): start timestamp
            end_ts (int): end timestamp
            limit (int, optional): limit of record to return. Defaults to 100.
            after (_type_, optional): use for API pagination. Defaults to None.
            profile_type (Union[Type[TableProfile], Type[ColumnProfile]], optional):
                Profile type to retrieve. Defaults to TableProfile.

        Raises:
            TypeError: if `profile_type` is not TableProfile or ColumnProfile

        Returns:
            EntityList: EntityList list object
        """
        url_after = f"&after={after}" if after else ""
        profile_type_url = profile_type.__name__[0].lower() + profile_type.__name__[1:]

        resp = self.client.get(
            f"{self.get_suffix(Table)}/{quote(fqn)}/{profile_type_url}?limit={limit}{url_after}",
            data={"startTs": start_ts, "endTs": end_ts},
        )

        if profile_type in (TableProfile, SystemProfile):
            data: List[T] = [profile_type(**datum) for datum in resp["data"]]  # type: ignore
        elif profile_type is ColumnProfile:
            split_fqn = fqn.split(".")
            if len(split_fqn) < 5:
                raise ValueError(f"{fqn} is not a column fqn")
            data: List[T] = [ColumnProfile(**datum) for datum in resp["data"]]  # type: ignore
        else:
            raise TypeError(
                f"{profile_type} is not an accepeted type."
                "Type must be `TableProfile` or `ColumnProfile`"
            )
        total = resp["paging"]["total"]
        after = resp["paging"]["after"] if "after" in resp["paging"] else None

        return EntityList(entities=data, total=total, after=after)

    def get_latest_table_profile(
        self, fqn: FullyQualifiedEntityName
    ) -> Optional[Table]:
        """Get the latest profile data for a table

        Args:
            fqn (str): table fully qualified name

        Returns:
            Optional[Table]: OM table object
        """
        return self._get(Table, f"{quote(fqn)}/tableProfile/latest")

    def create_or_update_custom_metric(
        self, custom_metric: CreateCustomMetricRequest, table_id: str
    ) -> Table:
        """Create or update custom metric. If custom metric name matches an existing
        one then it will be updated.

        Args:
            custom_metric (CreateCustomMetricRequest): custom metric to be create or updated
        """
        resp = self.client.put(
            f"{self.get_suffix(Table)}/{table_id}/customMetric",
            data=custom_metric.model_dump_json(),
        )
        return Table(**resp)
