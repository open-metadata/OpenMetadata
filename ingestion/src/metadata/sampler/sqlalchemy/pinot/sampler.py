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
Helper module to handle data sampling for PinotDB profiler
"""
import uuid
from typing import Dict, List, Optional, Union

from sqlalchemy import Column, literal, types
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.compiler import IdentifierPreparer
from sqlalchemy.sql.functions import FunctionElement
from sqlalchemy.sql.operators import ColumnOperators

from metadata.generated.schema.entity.data.table import (
    Constraint,
    ConstraintType,
    Table,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.orm.functions.cast import CastFn
from metadata.profiler.orm.functions.concat import ConcatFn
from metadata.profiler.orm.functions.md5 import MD5
from metadata.profiler.orm.functions.substr import Substr
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.lists import intersperse
from metadata.utils.logger import profiler_interface_registry_logger

BYTE_INTEGER_VALUE = 256

logger = profiler_interface_registry_logger()

RANDOM_LABEL = "random"


class PinotDBSampler(SQASampler):
    """
    Generates a sample of the data using hash-based pseudo-random sampling.

    PinotDB does not universally support RANDOM() function across all versions
    and query engines. This sampler uses HASH() function on table columns to
    generate deterministic pseudo-random values for sampling.

    Tiered column selection strategy:
    1. PRIMARY KEY columns (best cardinality - unique per row)
    2. UNIQUE constraint columns (high cardinality)
    3. ALL columns concatenated (maximum cardinality fallback)
    """

    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        sample_config: Optional[SampleConfig] = None,
        partition_details: Optional[Dict] = None,
        sample_query: Optional[str] = None,
        storage_config: DataStorageConfig = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        salt: Optional[str] = None,
        **kwargs,
    ):
        from pinotdb.sqlalchemy import PinotDialect

        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            sample_config=sample_config,
            partition_details=partition_details,
            sample_query=sample_query,
            storage_config=storage_config,
            sample_data_count=sample_data_count,
            **kwargs,
        )

        self._identifier_preparer = IdentifierPreparer(PinotDialect())
        if salt is None:
            salt = uuid.uuid4().hex[0:6]
        self._salt = salt

    def _get_sampling_columns(self) -> List[Column]:
        """
        Select columns for hash-based sampling using tiered strategy.

        Returns:
            List of column names to use for hash-based sampling
        """
        columns = []
        if self.entity.tableConstraints:
            for constraint in self.entity.tableConstraints:
                if constraint.constraintType == ConstraintType.PRIMARY_KEY:
                    logger.debug(
                        f"Using PRIMARY KEY columns for sampling: {constraint.columns}"
                    )
                    columns = constraint.columns
                    break

            for constraint in self.entity.tableConstraints:
                if constraint.constraintType == ConstraintType.UNIQUE:
                    logger.debug(
                        f"Using UNIQUE constraint columns for sampling: {constraint.columns}"
                    )
                    columns = constraint.columns
                    break
        else:
            for column in self.entity.columns:
                if column.constraint == Constraint.PRIMARY_KEY:
                    logger.debug(
                        f"Using PRIMARY KEY column for sampling: {column.name.root}"
                    )
                    columns = [column.name.root]

        if not columns:
            columns = [col.name.root for col in self.entity.columns]
            logger.debug(
                "No PRIMARY KEY or UNIQUE constraints found, using all columns for sampling"
            )

        return [getattr(self._table, col_name) for col_name in columns]

    def _build_hash_expression(self, columns: List[Column]) -> FunctionElement:
        """
        Build HASH expression for pseudo-random value generation.

        Args:
            columns: List of column names to hash

        Returns:
            SQL expression string for hash-based random value ('00'-'ff')
        """
        if len(columns) == 0:
            raise ValueError("No columns specified")

        safe_cols = [CastFn(col, types.String()) for col in columns]

        if len(safe_cols) == 1:
            expression = safe_cols[0]
        else:
            values_to_concat = intersperse(safe_cols, literal(self._salt, types.String))

            expression = ConcatFn(*values_to_concat, type_=types.String)

        return Substr(MD5(expression), 0, 2)

    def _get_sample_delimiter(self) -> str:
        profile_sample_percentage = (
            self.sample_config.profileSample
            if self.sample_config.profileSample is not None
            else 100
        )

        byte_percent = int(BYTE_INTEGER_VALUE * profile_sample_percentage / 100)

        if byte_percent == BYTE_INTEGER_VALUE:
            # Hex representation '100' would be lower than e.g: 'ff' or '1f'
            # Return something greater than '00' and 'ff'
            return "xx"

        return format(byte_percent, "02x")  # within hex range '00' and 'ff'

    def get_random_modulo_column(self, mod: int) -> ColumnElement:
        sampling_columns = self._get_sampling_columns()

        return self._build_hash_expression(sampling_columns)

    def random_filtering_criterion(self, column: Column) -> ColumnOperators:
        """Generate a random filtering criterion"""
        profile_sample = self._get_sample_delimiter()
        return column <= CastFn(literal(profile_sample), types.String())
