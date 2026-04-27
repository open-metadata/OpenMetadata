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
Mixin class containing Table specific methods

To be used by OpenMetadata class
"""

import base64
import datetime
import decimal
import ipaddress
import json
import math
import traceback
import uuid
from typing import Dict, List, Optional, Type, TypeVar

from pydantic import BaseModel, validate_call

from metadata.generated.schema.api.data.bulkCreateTable import BulkCreateTable
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.tests.createCustomMetric import (
    CreateCustomMetricRequest,
)
from metadata.generated.schema.entity.data.table import (
    Column,
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
from metadata.generated.schema.type.bulkOperationResult import BulkOperationResult
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.utils import model_str, quote
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

LRU_CACHE_SIZE = 4096
T = TypeVar("T", bound=BaseModel)


def _sanitize_sample_data_value(value):
    """
    Ensure a single cell value is safe for JSON serialization before it is
    passed to Pydantic's model_dump_json().
    """
    try:
        # --- Tier 1: JSON-native primitives — fast path ---
        if value is None or isinstance(value, (str, int, bool)):
            return value

        # Float is a special case: finite floats are JSON-safe, but inf/-inf/NaN
        # produce non-standard JSON tokens that Java's Jackson parser rejects.
        if isinstance(value, float):
            return value if math.isfinite(value) else str(value)

        # --- Tier 2: Known stdlib / common driver types ---

        # Binary data (e.g. MySQL WKB geometry columns, raw BINARY/VARBINARY)
        if isinstance(value, bytes):
            try:
                return f"[base64]{base64.b64encode(value).decode('ascii', errors='ignore')}"
            except Exception:
                logger.debug(traceback.format_exc())
                return "[binary data]"

        # IP address objects returned by clickhouse-driver for IPv4/IPv6 columns,
        # and by psycopg2 for PostgreSQL INET/CIDR columns
        if isinstance(value, (ipaddress.IPv4Address, ipaddress.IPv6Address)):
            return str(value)

        # UUID objects returned by psycopg2 / SQLAlchemy for UUID columns
        if isinstance(value, uuid.UUID):
            return str(value)

        # datetime.datetime MUST be checked before datetime.date because
        # datetime.datetime is a subclass of datetime.date — checking date first
        # would silently drop the time component.
        if isinstance(value, datetime.datetime):
            return value.isoformat()

        # datetime.date objects returned for DATE columns
        if isinstance(value, datetime.date):
            return value.isoformat()

        # Decimal objects returned for NUMERIC/DECIMAL columns by most drivers.
        # Preserve as float so the JSON payload stays numeric rather than a string.
        # Non-finite values (Infinity, -Infinity, NaN) are not valid JSON numbers,
        # so those are converted to their string representation instead.
        if isinstance(value, decimal.Decimal):
            return float(value) if value.is_finite() else str(value)

        # timedelta objects returned for INTERVAL columns (Oracle, PostgreSQL)
        if isinstance(value, datetime.timedelta):
            return str(value)

        # --- Tier 3: Container types — recurse to handle nested non-primitives ---

        # Lists cover ARRAY columns (PostgreSQL, BigQuery, Databricks, Trino)
        if isinstance(value, list):
            return [_sanitize_sample_data_value(item) for item in value]

        # Dicts cover STRUCT / MAP / HSTORE columns.
        # Keys are coerced to str because JSON requires string keys, and some
        # drivers (e.g. Databricks MAP) may return integer or other non-string keys.
        if isinstance(value, dict):
            return {str(k): _sanitize_sample_data_value(v) for k, v in value.items()}

        # --- Tier 4: Universal catch-all ---
        # Any remaining driver-specific object (psycopg2.extras.Inet,
        # psycopg2.extras.Range, cx_Oracle.LOB, spatial objects, numpy scalars,
        # etc.) is converted to its string representation rather than crashing.
        try:
            return str(value)
        except Exception:
            logger.debug(
                "Could not convert sample data value of type %s to string: %s",
                type(value).__name__,
                traceback.format_exc(),
            )
            return "[unserializable]"

    except Exception:
        # Top-level safety net: if any conversion above raised unexpectedly,
        # try a plain string cast before giving up entirely.
        logger.debug(
            "Unexpected error sanitizing sample data value of type %s: %s",
            type(value).__name__,
            traceback.format_exc(),
        )
        try:
            return str(value)
        except Exception:
            logger.debug(
                "Fallback str() also failed for type %s: %s",
                type(value).__name__,
                traceback.format_exc(),
            )
            return "[unserializable]"


class OMetaTableMixin:
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    def ingest_table_sample_data(self, table: Table, sample_data: TableData) -> Optional[TableData]:
        """
        PUT sample data for a table

        :param table: Table Entity to update
        :param sample_data: Data to add
        """
        resp = None
        try:
            # Pre-process every cell through the sanitizer so that
            # driver-specific objects (IP addresses, UUIDs, Decimals, range
            # types, spatial objects, etc.) are converted to JSON-safe
            # primitives before model_dump_json() is called.
            if sample_data and sample_data.rows:
                for row in sample_data.rows:
                    if not row:
                        continue
                    for col_idx, value in enumerate(row):
                        row[col_idx] = _sanitize_sample_data_value(value)

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
            logger.warning(f"Error trying to PUT sample data for {table.fullyQualifiedName.root}: {exc}")

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
                logger.warning(f"Error trying to parse sample data results from {table.fullyQualifiedName.root}: {exc}")

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
            logger.warning(f"Error trying to GET sample data for {table.fullyQualifiedName.root}: {exc}")

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
                logger.warning(f"Error trying to parse sample data results from {table.fullyQualifiedName.root}: {exc}")

        return None

    def delete_sample_data(self, table: Table) -> None:
        """
        DELETE call for the /sampleData endpoint for a given Table
        """
        try:
            self.client.delete(
                f"{self.get_suffix(Table)}/{table.id.root}/sampleData",
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to DELETE sample data for {table.fullyQualifiedName.root}: {exc}")

    def add_pipeline_observability(
        self, table_id: Uuid, pipeline_observability: List[PipelineObservability]
    ) -> Optional[Table]:
        """
        PUT pipeline observability data for a table (bulk method)

        :param table_id: Table ID to update
        :param pipeline_observability: Pipeline observability data to add
        """
        resp = None
        try:
            try:
                data_list = [obs.model_dump(mode="json") for obs in pipeline_observability]
                # Convert list to JSON string for requests.put()
                data = json.dumps(data_list)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error serializing pipeline observability data for table {table_id.root}: {exc}")
                return None

            resp = self.client.put(
                f"{self.get_suffix(Table)}/{table_id.root}/pipelineObservability",
                data=data,
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to PUT pipeline observability data for table {table_id.root}: {exc}")

        if resp:
            try:
                return Table(**resp)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error trying to parse pipeline observability results for table {table_id.root}: {exc}")

        return None

    def add_single_pipeline_observability(
        self, table_id: Uuid, pipeline_observability: PipelineObservability
    ) -> Optional[Table]:
        """
        PUT single pipeline observability data for a table (individual method for append/update logic)

        :param table_id: Table ID to update
        :param pipeline_observability: Single pipeline observability data to add/update
        """
        resp = None
        try:
            if pipeline_observability.pipeline and pipeline_observability.pipeline.fullyQualifiedName:
                pipeline_fqn = pipeline_observability.pipeline.fullyQualifiedName

                try:
                    data_dict = pipeline_observability.model_dump(mode="json")
                    # Convert dictionary to JSON string for requests.put()
                    data = json.dumps(data_dict)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error serializing single pipeline observability data for table {table_id.root}: {exc}"
                    )
                    return None

                resp = self.client.put(
                    f"{self.get_suffix(Table)}/{table_id.root}/pipelineObservability/{pipeline_fqn}",
                    data=data,
                )
            else:
                logger.warning(f"Pipeline FQN missing in observability data for table {table_id.root}")
                return None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to PUT single pipeline observability data for table {table_id.root}: {exc}")

        if resp:
            try:
                return Table(**resp)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse single pipeline observability results for table {table_id.root}: {exc}"
                )

        return None

    def ingest_profile_data(self, table: Table, profile_request: CreateTableProfileRequest) -> Table:
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

    def publish_table_usage(self, table: Table, table_usage_request: UsageRequest) -> None:
        """
        POST usage details for a Table

        :param table: Table Entity to update
        :param table_usage_request: Usage data to add
        """
        resp = self.client.post(f"/usage/table/{table.id.root}", data=table_usage_request.model_dump_json())
        logger.debug("published table usage %s", resp)

    def publish_frequently_joined_with(self, table: Table, table_join_request: TableJoins) -> None:
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
            raise TypeError(f"{profile_type} is not an accepeted type.Type must be `TableProfile` or `ColumnProfile`")
        total = resp["paging"]["total"]
        after = resp["paging"]["after"] if "after" in resp["paging"] else None

        return EntityList(entities=data, total=total, after=after)

    def get_latest_table_profile(self, fqn: FullyQualifiedEntityName) -> Optional[Table]:
        """Get the latest profile data for a table

        Args:
            fqn (str): table fully qualified name

        Returns:
            Optional[Table]: OM table object
        """
        return self._get(Table, f"{quote(fqn)}/tableProfile/latest")

    def create_or_update_custom_metric(self, custom_metric: CreateCustomMetricRequest, table_id: str) -> Table:
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

    def bulk_create_or_update_tables(self, bulk_request: BulkCreateTable, use_async: bool = False):
        """Bulk create or update multiple tables in a single API call.

        Args:
            bulk_request (BulkCreateTable): Bulk create request containing list of tables
            use_async (bool): Use backend async processing (default: False)

        Returns:
            BulkOperationResult: Result containing success/failure details
        """

        # Backend endpoint expects List<CreateTable> directly, not wrapped in BulkCreateTable
        # Serialize the tables list to JSON
        tables_json = json.dumps(
            [table.model_dump(mode="json", by_alias=True, exclude_none=True) for table in bulk_request.tables]
        )

        # Build URL with async parameter if requested
        url = f"{self.get_suffix(Table)}/bulk"
        if use_async:
            url += "?async=true"

        resp = self.client.put(url, data=tables_json)

        # Backend returns BulkOperationResult in both async and sync modes
        return BulkOperationResult(**resp)

    def get_table_columns(
        self,
        table_fqn: str,
        fields: Optional[List[str]] = None,
        params: Optional[Dict[str, str]] = None,
    ) -> List[Column]:
        uri = self.get_suffix(Table) + "/name/" + quote(table_fqn) + "/columns"

        url_fields = f"?fields={','.join(fields)}" if fields else ""

        resp = self.client.get(path=f"{uri}{url_fields}", data=params)

        return [Column(**elmt) for elmt in resp["data"]]
