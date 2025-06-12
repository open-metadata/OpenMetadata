#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  You may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Spark Sampler for PySpark DataFrames
"""
import random
from typing import List, Optional

from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator,
)
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    PartitionIntervalTypes,
    ProfileSampleType,
    TableData,
)
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.class_helper import get_service_type_from_source_type
from metadata.utils.logger import profiler_logger
from metadata.utils.service_spec.service_spec import import_connection_class
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_logger()


class SparkSampler(SamplerInterface):
    """
    Sampler for Spark (PySpark DataFrames).
    Implements all required methods from SamplerInterface.
    Sampling will use SparkSQL and DataFrame APIs.
    """

    def __init__(self, *args, **kwargs):
        processing_engine = kwargs.pop("processing_engine", None)
        if not processing_engine:
            raise ValueError("Processing engine is required for Spark sampler.")

        super().__init__(*args, **kwargs)
        self._processing_engine = processing_engine

        self._set_spark_session()
        self.table_name = self.entity.name.root
        self._dataframe = None  # Placeholder for main DataFrame

    def _set_spark_session(self):
        from pyspark.sql import SparkSession  # pylint: disable=import-outside-toplevel

        spark_session_builder = SparkSession.builder.appName(
            "OpenMetadata Profiler"
        ).master(self._processing_engine.master)

        # TODO: Add Logic to get the Jars from the processing engine configuration
        spark_session_builder = spark_session_builder.config(
            "spark.jars",
            "/Users/ices2/Workspace/scratch/spark/mysql-connector-j-8.4.0.jar",
        )

        if self._processing_engine.config:
            for (
                key,
                value,
            ) in self._processing_engine.config.root.model_dump().items():
                spark_session_builder = spark_session_builder.config(key, value)

        self._spark = spark_session_builder.getOrCreate()

    @property
    def spark(self):
        if not self._spark:
            self._set_spark_session()
        return self._spark

    @property
    def raw_dataset(self):
        """Return the raw Spark DataFrame for the table."""
        if not self._dataframe:
            source_type = self.service_connection_config.type.value.lower()
            service_type = get_service_type_from_source_type(source_type)
            self._dataframe = import_connection_class(service_type, source_type)(
                self.service_connection_config
            ).get_spark_dataframe_loader(self.spark, self.table_name)()
        return self._dataframe

    def get_client(self):
        """Return the SparkSession client."""
        return self.spark

    def _rdn_sample_from_user_query(self):
        """Get random sample from user query using SparkSQL/DataFrame API."""
        self.raw_dataset.createOrReplaceTempView(self.table_name)
        if not self.sample_query:
            raise ValueError(
                "Sample query is required for `_rdn_sample_from_user_query`."
            )
        return self.spark.sql(self.sample_query)

    def _get_table_data(self, df) -> TableData:
        """Get table data from dataframe"""
        if self.sample_limit:
            df = df.limit(self.sample_limit or 100)

        cols = [ColumnName(col) for col in df.columns]
        rows = df.collect()

        data = [list(row) for row in rows]

        return TableData(columns=cols, rows=data)

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Fetch sample data from user query using SparkSQL/DataFrame API."""
        df = self._rdn_sample_from_user_query()
        return self._get_table_data(df)

    def _partitioned_dataset(self):
        """Get partitioned table"""
        if not self.partition_details or not self.partition_details.partitionColumnName:
            return self.raw_dataset

        partition_field = self.partition_details.partitionColumnName
        df = self.raw_dataset

        if (
            self.partition_details.partitionIntervalType
            == PartitionIntervalTypes.COLUMN_VALUE
        ):
            return df.filter(
                df[partition_field].isin(self.partition_details.partitionValues)
            )

        if (
            self.partition_details.partitionIntervalType
            == PartitionIntervalTypes.INTEGER_RANGE
        ):
            if (
                not self.partition_details.partitionIntegerRangeStart
                or not self.partition_details.partitionIntegerRangeEnd
            ):
                raise ValueError(
                    "Partition integer range start and end are required for `_partitioned_table`."
                )
            return df.filter(
                df[partition_field].between(
                    self.partition_details.partitionIntegerRangeStart,
                    self.partition_details.partitionIntegerRangeEnd,
                )
            )

        if self.partition_details.partitionIntervalType in {
            PartitionIntervalTypes.INGESTION_TIME,
            PartitionIntervalTypes.TIME_UNIT,
        }:
            if (
                not self.partition_details.partitionInterval
                or not self.partition_details.partitionIntervalUnit
            ):
                raise ValueError(
                    "Partition interval and interval unit are required for `_partitioned_table`."
                )
            threshold = TableRowInsertedCountToBeBetweenValidator.get_threshold_date_dt(
                self.partition_details.partitionIntervalUnit.value,
                self.partition_details.partitionInterval,
            )
            return df.filter(df[partition_field] >= threshold)

        logger.warning(
            f"{self.partition_details.partitionIntervalType} is not a supported partition type. "
            "Partitioning will be ignored. Use one of "
            f"{', '.join(list(PartitionIntervalTypes.__members__))}"
        )
        return self.raw_dataset

    def _get_sampled_dataframe(self):
        """Get sampled dataframe"""
        df = self.raw_dataset

        if self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
            return df.sample(fraction=(self.sample_config.profileSample or 100) / 100)

        sample_size = int(self.sample_config.profileSample or 100)
        sample_rdd = df.rdd.takeSample(False, sample_size, seed=random.randint(0, 100))
        return self.spark.createDataFrame(sample_rdd)

    def get_dataset(self, **kwargs):
        """Get random sample from the Spark DataFrame."""
        if self.sample_query:
            return self._rdn_sample_from_user_query()

        if self.partition_details:
            self._dataframe = self._partitioned_dataset()

        if not self.sample_config.profileSample or (
            self.sample_config.profileSample == 100
            and self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE
        ):
            return self.raw_dataset
        return self._get_sampled_dataframe()

    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]]) -> TableData:
        """Fetch sample data for the given columns from the Spark DataFrame."""
        if self.sample_query:
            return self._fetch_sample_data_from_user_query()

        return self._get_table_data(self.raw_dataset)

    def get_columns(self) -> List[SQALikeColumn]:
        """Get columns from the Spark DataFrame."""
        sqalike_columns = []
        df = self.raw_dataset

        if df is not None:
            for field in df.schema.fields:
                column_name = field.name
                sqalike_columns.append(
                    SQALikeColumn(
                        column_name, self.spark_type_to_omdatatype(str(field.dataType))
                    )
                )
        return sqalike_columns

    @staticmethod
    def spark_type_to_omdatatype(spark_type: str) -> DataType:
        """
        Map Spark SQL type string to OpenMetadata DataType enum.
        """
        mapping = {
            # Numeric types
            "byte": DataType.TINYINT,
            "short": DataType.SMALLINT,
            "integer": DataType.INT,
            "long": DataType.BIGINT,
            "float": DataType.FLOAT,
            "double": DataType.DOUBLE,
            "decimal": DataType.DECIMAL,
            # String types
            "string": DataType.STRING,
            "varchar": DataType.VARCHAR,
            "char": DataType.CHAR,
            # Boolean
            "boolean": DataType.BOOLEAN,
            # Binary
            "binary": DataType.BINARY,
            # Date/time
            "date": DataType.DATE,
            "timestamp": DataType.TIMESTAMP,
            "timestamp_ntz": DataType.TIMESTAMP,
            "timestamp_ltz": DataType.TIMESTAMP,
            "timestamp_tz": DataType.TIMESTAMPZ,
            "time": DataType.TIME,
            # Complex types
            "array": DataType.ARRAY,
            "map": DataType.MAP,
            "struct": DataType.STRUCT,
            # JSON/variant
            "json": DataType.JSON,
            # Fallbacks
            "null": DataType.NULL,
        }

        # Remove any parameters, e.g., decimal(10,2) -> decimal
        base_type = spark_type.split("(")[0].lower()
        return mapping.get(base_type, DataType.UNKNOWN)
