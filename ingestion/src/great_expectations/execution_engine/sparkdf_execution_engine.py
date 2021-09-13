import copy
import datetime
import hashlib
import logging
import uuid
import warnings
from functools import reduce
from typing import Any, Callable, Dict, Iterable, Optional, Tuple, Union

from great_expectations.core.batch import BatchMarkers
from great_expectations.core.batch_spec import (
    AzureBatchSpec,
    BatchSpec,
    GCSBatchSpec,
    PathBatchSpec,
    RuntimeDataBatchSpec,
)
from great_expectations.core.id_dict import IDDict
from great_expectations.core.util import AzureUrl, get_or_create_spark_application
from great_expectations.exceptions import exceptions as ge_exceptions
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.execution_engine.execution_engine import MetricDomainTypes

from ..exceptions import (
    BatchSpecError,
    ExecutionEngineError,
    GreatExpectationsError,
    ValidationError,
)
from ..expectations.row_conditions import parse_condition_to_spark
from ..validator.validation_graph import MetricConfiguration
from .sparkdf_batch_data import SparkDFBatchData

logger = logging.getLogger(__name__)

try:
    import pyspark
    import pyspark.sql.functions as F
    from pyspark import SparkContext
    from pyspark.sql import DataFrame, SparkSession
    from pyspark.sql.readwriter import DataFrameReader
    from pyspark.sql.types import (
        BooleanType,
        DateType,
        FloatType,
        IntegerType,
        StringType,
        StructField,
        StructType,
    )
except ImportError:
    pyspark = None
    SparkContext = None
    SparkSession = None
    DataFrame = None
    DataFrameReader = None
    F = None
    StructType = (None,)
    StructField = (None,)
    IntegerType = (None,)
    FloatType = (None,)
    StringType = (None,)
    DateType = (None,)
    BooleanType = (None,)

    logger.debug(
        "Unable to load pyspark; install optional spark dependency for support."
    )


class SparkDFExecutionEngine(ExecutionEngine):
    """
    This class holds an attribute `spark_df` which is a spark.sql.DataFrame.

    --ge-feature-maturity-info--

        id: validation_engine_pyspark_self_managed
        title: Validation Engine - pyspark - Self-Managed
        icon:
        short_description: Use Spark DataFrame to validate data
        description: Use Spark DataFrame to validate data
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_batches/how_to_load_a_spark_dataframe_as_a_batch.html
        maturity: Production
        maturity_details:
            api_stability: Stable
            implementation_completeness: Moderate
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A -> see relevant Datasource evaluation
            documentation_completeness: Complete
            bug_risk: Low/Moderate
            expectation_completeness: Moderate

        id: validation_engine_databricks
        title: Validation Engine - Databricks
        icon:
        short_description: Use Spark DataFrame in a Databricks cluster to validate data
        description: Use Spark DataFrame in a Databricks cluster to validate data
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_batches/how_to_load_a_spark_dataframe_as_a_batch.html
        maturity: Beta
        maturity_details:
            api_stability: Stable
            implementation_completeness: Low (dbfs-specific handling)
            unit_test_coverage: N/A -> implementation not different
            integration_infrastructure_test_coverage: Minimal (we've tested a bit, know others have used it)
            documentation_completeness: Moderate (need docs on managing project configuration via dbfs/etc.)
            bug_risk: Low/Moderate
            expectation_completeness: Moderate

        id: validation_engine_emr_spark
        title: Validation Engine - EMR - Spark
        icon:
        short_description: Use Spark DataFrame in an EMR cluster to validate data
        description: Use Spark DataFrame in an EMR cluster to validate data
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_batches/how_to_load_a_spark_dataframe_as_a_batch.html
        maturity: Experimental
        maturity_details:
            api_stability: Stable
            implementation_completeness: Low (need to provide guidance on "known good" paths, and we know there are many "knobs" to tune that we have not explored/tested)
            unit_test_coverage: N/A -> implementation not different
            integration_infrastructure_test_coverage: Unknown
            documentation_completeness: Low (must install specific/latest version but do not have docs to that effect or of known useful paths)
            bug_risk: Low/Moderate
            expectation_completeness: Moderate

        id: validation_engine_spark_other
        title: Validation Engine - Spark - Other
        icon:
        short_description: Use Spark DataFrame to validate data
        description: Use Spark DataFrame to validate data
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_batches/how_to_load_a_spark_dataframe_as_a_batch.html
        maturity: Experimental
        maturity_details:
            api_stability: Stable
            implementation_completeness: Other (we haven't tested possibility, known glue deployment)
            unit_test_coverage: N/A -> implementation not different
            integration_infrastructure_test_coverage: Unknown
            documentation_completeness: Low (must install specific/latest version but do not have docs to that effect or of known useful paths)
            bug_risk: Low/Moderate
            expectation_completeness: Moderate

    --ge-feature-maturity-info--
    """

    recognized_batch_definition_keys = {"limit"}

    recognized_batch_spec_defaults = {
        "reader_method",
        "reader_options",
    }

    def __init__(
        self,
        *args,
        persist=True,
        spark_config=None,
        force_reuse_spark_context=False,
        **kwargs,
    ):
        # Creation of the Spark DataFrame is done outside this class
        self._persist = persist

        if spark_config is None:
            spark_config = {}

        spark: SparkSession = get_or_create_spark_application(
            spark_config=spark_config,
            force_reuse_spark_context=force_reuse_spark_context,
        )

        spark_config = dict(spark_config)
        spark_config.update({k: v for (k, v) in spark.sparkContext.getConf().getAll()})

        self._spark_config = spark_config
        self.spark = spark

        azure_options: dict = kwargs.pop("azure_options", {})
        self._azure_options = azure_options

        super().__init__(*args, **kwargs)

        self._config.update(
            {
                "persist": self._persist,
                "spark_config": spark_config,
                "azure_options": azure_options,
            }
        )

    @property
    def dataframe(self):
        """If a batch has been loaded, returns a Spark Dataframe containing the data within the loaded batch"""
        if not self.active_batch_data:
            raise ValueError(
                "Batch has not been loaded - please run load_batch() to load a batch."
            )

        return self.active_batch_data.dataframe

    def load_batch_data(self, batch_id: str, batch_data: Any) -> None:
        if isinstance(batch_data, DataFrame):
            batch_data = SparkDFBatchData(self, batch_data)
        elif isinstance(batch_data, SparkDFBatchData):
            pass
        else:
            raise GreatExpectationsError(
                "SparkDFExecutionEngine requires batch data that is either a DataFrame or a SparkDFBatchData object"
            )
        super().load_batch_data(batch_id=batch_id, batch_data=batch_data)

    def get_batch_data_and_markers(
        self, batch_spec: BatchSpec
    ) -> Tuple[Any, BatchMarkers]:  # batch_data
        # We need to build a batch_markers to be used in the dataframe
        batch_markers: BatchMarkers = BatchMarkers(
            {
                "ge_load_time": datetime.datetime.now(datetime.timezone.utc).strftime(
                    "%Y%m%dT%H%M%S.%fZ"
                )
            }
        )

        """
        As documented in Azure DataConnector implementations, Pandas and Spark execution engines utilize separate path
        formats for accessing Azure Blob Storage service.  However, Pandas and Spark execution engines utilize identical
        path formats for accessing all other supported cloud storage services (AWS S3 and Google Cloud Storage).
        Moreover, these formats (encapsulated in S3BatchSpec and GCSBatchSpec) extend PathBatchSpec (common to them).
        Therefore, at the present time, all cases with the exception of Azure Blob Storage , are handled generically.
        """

        batch_data: Any
        if isinstance(batch_spec, RuntimeDataBatchSpec):
            # batch_data != None is already checked when RuntimeDataBatchSpec is instantiated
            batch_data = batch_spec.batch_data
            if isinstance(batch_data, str):
                raise ge_exceptions.ExecutionEngineError(
                    f"""SparkDFExecutionEngine has been passed a string type batch_data, "{batch_data}", which is illegal.
Please check your config."""
                )
            batch_spec.batch_data = "SparkDataFrame"

        elif isinstance(batch_spec, AzureBatchSpec):
            reader_method: str = batch_spec.reader_method
            reader_options: dict = batch_spec.reader_options or {}
            path: str = batch_spec.path
            azure_url = AzureUrl(path)
            try:
                credential = self._azure_options.get("credential")
                storage_account_url = azure_url.account_url
                if credential:
                    self.spark.conf.set(
                        "fs.wasb.impl",
                        "org.apache.hadoop.fs.azure.NativeAzureFileSystem",
                    )
                    self.spark.conf.set(
                        "fs.azure.account.key." + storage_account_url, credential
                    )
                reader: DataFrameReader = self.spark.read.options(**reader_options)
                reader_fn: Callable = self._get_reader_fn(
                    reader=reader,
                    reader_method=reader_method,
                    path=path,
                )
                batch_data = reader_fn(path)
            except AttributeError:
                raise ExecutionEngineError(
                    """
                    Unable to load pyspark. Pyspark is required for SparkDFExecutionEngine.
                    """
                )

        elif isinstance(batch_spec, PathBatchSpec):
            reader_method: str = batch_spec.reader_method
            reader_options: dict = batch_spec.reader_options or {}
            path: str = batch_spec.path
            try:
                reader: DataFrameReader = self.spark.read.options(**reader_options)
                reader_fn: Callable = self._get_reader_fn(
                    reader=reader,
                    reader_method=reader_method,
                    path=path,
                )
                batch_data = reader_fn(path)
            except AttributeError:
                raise ExecutionEngineError(
                    """
                    Unable to load pyspark. Pyspark is required for SparkDFExecutionEngine.
                    """
                )
            # pyspark will raise an AnalysisException error if path is incorrect
            except pyspark.sql.utils.AnalysisException:
                raise ExecutionEngineError(
                    f"""Unable to read in batch from the following path: {path}. Please check your configuration."""
                )

        else:
            raise BatchSpecError(
                """
                Invalid batch_spec: batch_data is required for a SparkDFExecutionEngine to operate.
                """
            )

        batch_data = self._apply_splitting_and_sampling_methods(batch_spec, batch_data)
        typed_batch_data = SparkDFBatchData(execution_engine=self, dataframe=batch_data)

        return typed_batch_data, batch_markers

    def _apply_splitting_and_sampling_methods(self, batch_spec, batch_data):
        if batch_spec.get("splitter_method"):
            splitter_fn = getattr(self, batch_spec.get("splitter_method"))
            splitter_kwargs: dict = batch_spec.get("splitter_kwargs") or {}
            batch_data = splitter_fn(batch_data, **splitter_kwargs)

        if batch_spec.get("sampling_method"):
            sampling_fn = getattr(self, batch_spec.get("sampling_method"))
            sampling_kwargs: dict = batch_spec.get("sampling_kwargs") or {}
            batch_data = sampling_fn(batch_data, **sampling_kwargs)
        return batch_data

    @staticmethod
    def guess_reader_method_from_path(path):
        """Based on a given filepath, decides a reader method. Currently supports tsv, csv, and parquet. If none of these
        file extensions are used, returns ExecutionEngineError stating that it is unable to determine the current path.

        Args:
            path - A given file path

        Returns:
            A dictionary entry of format {'reader_method': reader_method}

        """
        if path.endswith(".csv") or path.endswith(".tsv"):
            return "csv"
        elif path.endswith(".parquet"):
            return "parquet"

        raise ExecutionEngineError(
            "Unable to determine reader method from path: %s" % path
        )

    def _get_reader_fn(self, reader, reader_method=None, path=None):
        """Static helper for providing reader_fn

        Args:
            reader: the base spark reader to use; this should have had reader_options applied already
            reader_method: the name of the reader_method to use, if specified
            path (str): the path to use to guess reader_method if it was not specified

        Returns:
            ReaderMethod to use for the filepath

        """
        if reader_method is None and path is None:
            raise ExecutionEngineError(
                "Unable to determine spark reader function without reader_method or path"
            )

        if reader_method is None:
            reader_method = self.guess_reader_method_from_path(path=path)

        reader_method_op: str = reader_method.lower()
        try:
            if reader_method_op == "delta":
                return reader.format(reader_method_op).load
            return getattr(reader, reader_method_op)
        except AttributeError:
            raise ExecutionEngineError(
                "Unable to find reader_method %s in spark." % reader_method,
            )

    def get_domain_records(
        self,
        domain_kwargs: dict,
    ) -> DataFrame:
        """
        Uses the given domain kwargs (which include row_condition, condition_parser, and ignore_row_if directives) to
        obtain and/or query a batch. Returns in the format of a Spark DataFrame.

        Args:
            domain_kwargs (dict) - A dictionary consisting of the domain kwargs specifying which data to obtain

        Returns:
            A DataFrame (the data on which to compute)
        """
        table = domain_kwargs.get("table", None)
        if table:
            raise ValueError(
                "SparkDFExecutionEngine does not currently support multiple named tables."
            )

        batch_id = domain_kwargs.get("batch_id")
        if batch_id is None:
            # We allow no batch id specified if there is only one batch
            if self.active_batch_data:
                data = self.active_batch_data.dataframe
            else:
                raise ValidationError(
                    "No batch is specified, but could not identify a loaded batch."
                )
        else:
            if batch_id in self.loaded_batch_data_dict:
                data = self.loaded_batch_data_dict[batch_id].dataframe
            else:
                raise ValidationError(f"Unable to find batch with batch_id {batch_id}")

        # Filtering by row condition.
        row_condition = domain_kwargs.get("row_condition", None)
        if row_condition:
            condition_parser = domain_kwargs.get("condition_parser", None)
            if condition_parser == "spark":
                data = data.filter(row_condition)
            elif condition_parser == "great_expectations__experimental__":
                parsed_condition = parse_condition_to_spark(row_condition)
                data = data.filter(parsed_condition)
            else:
                raise GreatExpectationsError(
                    f"unrecognized condition_parser {str(condition_parser)} for Spark execution engine"
                )

        if "column" in domain_kwargs:
            return data

        if (
            "column_A" in domain_kwargs
            and "column_B" in domain_kwargs
            and "ignore_row_if" in domain_kwargs
        ):
            # noinspection PyPep8Naming
            column_A_name = domain_kwargs["column_A"]
            # noinspection PyPep8Naming
            column_B_name = domain_kwargs["column_B"]

            ignore_row_if = domain_kwargs["ignore_row_if"]
            if ignore_row_if == "both_values_are_missing":
                ignore_condition = (
                    F.col(column_A_name).isNull() & F.col(column_B_name).isNull()
                )
                data = data.filter(~ignore_condition)
            elif ignore_row_if == "either_value_is_missing":
                ignore_condition = (
                    F.col(column_A_name).isNull() | F.col(column_B_name).isNull()
                )
                data = data.filter(~ignore_condition)
            else:
                if ignore_row_if not in ["neither", "never"]:
                    raise ValueError(
                        f'Unrecognized value of ignore_row_if ("{ignore_row_if}").'
                    )

                if ignore_row_if == "never":
                    warnings.warn(
                        f"""The correct "no-action" value of the "ignore_row_if" directive for the column pair case is \
"neither" (the use of "{ignore_row_if}" will be deprecated).  Please update code accordingly.
""",
                        DeprecationWarning,
                    )

            return data

        if "column_list" in domain_kwargs and "ignore_row_if" in domain_kwargs:
            column_list = domain_kwargs["column_list"]
            ignore_row_if = domain_kwargs["ignore_row_if"]
            if ignore_row_if == "all_values_are_missing":
                conditions = [
                    F.col(column_name).isNull() for column_name in column_list
                ]
                ignore_condition = reduce(lambda a, b: a & b, conditions)
                data = data.filter(~ignore_condition)
            elif ignore_row_if == "any_value_is_missing":
                conditions = [
                    F.col(column_name).isNull() for column_name in column_list
                ]
                ignore_condition = reduce(lambda a, b: a | b, conditions)
                data = data.filter(~ignore_condition)
            else:
                if ignore_row_if != "never":
                    raise ValueError(
                        f'Unrecognized value of ignore_row_if ("{ignore_row_if}").'
                    )

            return data

        return data

    def get_compute_domain(
        self,
        domain_kwargs: dict,
        domain_type: Union[str, MetricDomainTypes],
        accessor_keys: Optional[Iterable[str]] = None,
    ) -> Tuple[DataFrame, dict, dict]:
        """Uses a given batch dictionary and domain kwargs (which include a row condition and a condition parser)
        to obtain and/or query a batch. Returns in the format of a Spark DataFrame.

        Args:
            domain_kwargs (dict) - A dictionary consisting of the domain kwargs specifying which data to obtain
            domain_type (str or MetricDomainTypes) - an Enum value indicating which metric domain the user would
            like to be using, or a corresponding string value representing it. String types include "identity",
            "column", "column_pair", "table" and "other". Enum types include capitalized versions of these from the
            class MetricDomainTypes.
            accessor_keys (str iterable) - keys that are part of the compute domain but should be ignored when
            describing the domain and simply transferred with their associated values into accessor_domain_kwargs.

        Returns:
            A tuple including:
              - a DataFrame (the data on which to compute)
              - a dictionary of compute_domain_kwargs, describing the DataFrame
              - a dictionary of accessor_domain_kwargs, describing any accessors needed to
                identify the domain within the compute domain
        """
        data = self.get_domain_records(
            domain_kwargs=domain_kwargs,
        )
        # Extracting value from enum if it is given for future computation
        domain_type = MetricDomainTypes(domain_type)

        compute_domain_kwargs = copy.deepcopy(domain_kwargs)
        accessor_domain_kwargs = {}
        table = domain_kwargs.get("table", None)
        if table:
            raise ValueError(
                "SparkDFExecutionEngine does not currently support multiple named tables."
            )

        # Warning user if accessor keys are in any domain that is not of type table, will be ignored
        if (
            domain_type != MetricDomainTypes.TABLE
            and accessor_keys is not None
            and len(list(accessor_keys)) > 0
        ):
            logger.warning(
                'Accessor keys ignored since Metric Domain Type is not "table"'
            )

        if domain_type == MetricDomainTypes.TABLE:
            if accessor_keys is not None and len(list(accessor_keys)) > 0:
                for key in accessor_keys:
                    accessor_domain_kwargs[key] = compute_domain_kwargs.pop(key)
            if len(compute_domain_kwargs.keys()) > 0:
                # Warn user if kwarg not "normal".
                unexpected_keys: set = set(compute_domain_kwargs.keys()).difference(
                    {
                        "batch_id",
                        "table",
                        "row_condition",
                        "condition_parser",
                    }
                )
                if len(unexpected_keys) > 0:
                    unexpected_keys_str: str = ", ".join(
                        map(lambda element: f'"{element}"', unexpected_keys)
                    )
                    logger.warning(
                        f'Unexpected key(s) {unexpected_keys_str} found in domain_kwargs for domain type "{domain_type.value}".'
                    )
            return data, compute_domain_kwargs, accessor_domain_kwargs

        elif domain_type == MetricDomainTypes.COLUMN:
            if "column" not in compute_domain_kwargs:
                raise GreatExpectationsError(
                    "Column not provided in compute_domain_kwargs"
                )

            accessor_domain_kwargs["column"] = compute_domain_kwargs.pop("column")

        elif domain_type == MetricDomainTypes.COLUMN_PAIR:
            if not (
                "column_A" in compute_domain_kwargs
                and "column_B" in compute_domain_kwargs
            ):
                raise GreatExpectationsError(
                    "column_A or column_B not found within compute_domain_kwargs"
                )

            accessor_domain_kwargs["column_A"] = compute_domain_kwargs.pop("column_A")
            accessor_domain_kwargs["column_B"] = compute_domain_kwargs.pop("column_B")

        elif domain_type == MetricDomainTypes.MULTICOLUMN:
            if "column_list" not in domain_kwargs:
                raise ge_exceptions.GreatExpectationsError(
                    "column_list not found within domain_kwargs"
                )

            column_list = compute_domain_kwargs.pop("column_list")

            if len(column_list) < 2:
                raise ge_exceptions.GreatExpectationsError(
                    "column_list must contain at least 2 columns"
                )

            accessor_domain_kwargs["column_list"] = column_list

        return data, compute_domain_kwargs, accessor_domain_kwargs

    def add_column_row_condition(
        self, domain_kwargs, column_name=None, filter_null=True, filter_nan=False
    ):
        if filter_nan is False:
            return super().add_column_row_condition(
                domain_kwargs=domain_kwargs,
                column_name=column_name,
                filter_null=filter_null,
                filter_nan=filter_nan,
            )

        # We explicitly handle filter_nan for spark using a spark-native condition
        if "row_condition" in domain_kwargs and domain_kwargs["row_condition"]:
            raise GreatExpectationsError(
                "ExecutionEngine does not support updating existing row_conditions."
            )

        new_domain_kwargs = copy.deepcopy(domain_kwargs)
        assert "column" in domain_kwargs or column_name is not None
        if column_name is not None:
            column = column_name
        else:
            column = domain_kwargs["column"]
        if filter_null and filter_nan:
            new_domain_kwargs[
                "row_condition"
            ] = f"NOT isnan({column}) AND {column} IS NOT NULL"
        elif filter_null:
            new_domain_kwargs["row_condition"] = f"{column} IS NOT NULL"
        elif filter_nan:
            new_domain_kwargs["row_condition"] = f"NOT isnan({column})"
        else:
            logger.warning(
                "add_column_row_condition called without specifying a desired row condition"
            )

        new_domain_kwargs["condition_parser"] = "spark"
        return new_domain_kwargs

    def resolve_metric_bundle(
        self,
        metric_fn_bundle: Iterable[Tuple[MetricConfiguration, Callable, dict]],
    ) -> dict:
        """For each metric name in the given metric_fn_bundle, finds the domain of the metric and calculates it using a
        metric function from the given provider class.

                Args:
                    metric_fn_bundle - A batch containing MetricEdgeKeys and their corresponding functions
                    metrics (dict) - A dictionary containing metrics and corresponding parameters

                Returns:
                    A dictionary of the collected metrics over their respective domains
        """
        resolved_metrics = {}
        aggregates: Dict[Tuple, dict] = {}
        for (
            metric_to_resolve,
            engine_fn,
            compute_domain_kwargs,
            accessor_domain_kwargs,
            metric_provider_kwargs,
        ) in metric_fn_bundle:
            if not isinstance(compute_domain_kwargs, IDDict):
                compute_domain_kwargs = IDDict(compute_domain_kwargs)
            domain_id = compute_domain_kwargs.to_id()
            if domain_id not in aggregates:
                aggregates[domain_id] = {
                    "column_aggregates": [],
                    "ids": [],
                    "domain_kwargs": compute_domain_kwargs,
                }
            aggregates[domain_id]["column_aggregates"].append(engine_fn)
            aggregates[domain_id]["ids"].append(metric_to_resolve.id)
        for aggregate in aggregates.values():
            compute_domain_kwargs = aggregate["domain_kwargs"]
            df = self.get_domain_records(
                domain_kwargs=compute_domain_kwargs,
            )
            assert len(aggregate["column_aggregates"]) == len(aggregate["ids"])
            condition_ids = []
            aggregate_cols = []
            for idx in range(len(aggregate["column_aggregates"])):
                column_aggregate = aggregate["column_aggregates"][idx]
                aggregate_id = str(uuid.uuid4())
                condition_ids.append(aggregate_id)
                aggregate_cols.append(column_aggregate)
            res = df.agg(*aggregate_cols).collect()
            assert (
                len(res) == 1
            ), "all bundle-computed metrics must be single-value statistics"
            assert len(aggregate["ids"]) == len(
                res[0]
            ), "unexpected number of metrics returned"
            logger.debug(
                f"SparkDFExecutionEngine computed {len(res[0])} metrics on domain_id {IDDict(compute_domain_kwargs).to_id()}"
            )
            for idx, id in enumerate(aggregate["ids"]):
                resolved_metrics[id] = res[0][idx]

        return resolved_metrics

    def head(self, n=5):
        """Returns dataframe head. Default is 5"""
        return self.dataframe.limit(n).toPandas()

    @staticmethod
    def _split_on_whole_table(
        df,
    ):
        return df

    @staticmethod
    def _split_on_column_value(df, column_name: str, batch_identifiers: dict):
        return df.filter(F.col(column_name) == batch_identifiers[column_name])

    @staticmethod
    def _split_on_converted_datetime(
        df,
        column_name: str,
        batch_identifiers: dict,
        date_format_string: str = "yyyy-MM-dd",
    ):
        matching_string = batch_identifiers[column_name]
        res = (
            df.withColumn(
                "date_time_tmp", F.from_unixtime(F.col(column_name), date_format_string)
            )
            .filter(F.col("date_time_tmp") == matching_string)
            .drop("date_time_tmp")
        )
        return res

    @staticmethod
    def _split_on_divided_integer(
        df, column_name: str, divisor: int, batch_identifiers: dict
    ):
        """Divide the values in the named column by `divisor`, and split on that"""
        matching_divisor = batch_identifiers[column_name]
        res = (
            df.withColumn(
                "div_temp", (F.col(column_name) / divisor).cast(IntegerType())
            )
            .filter(F.col("div_temp") == matching_divisor)
            .drop("div_temp")
        )
        return res

    @staticmethod
    def _split_on_mod_integer(df, column_name: str, mod: int, batch_identifiers: dict):
        """Divide the values in the named column by `divisor`, and split on that"""
        matching_mod_value = batch_identifiers[column_name]
        res = (
            df.withColumn("mod_temp", (F.col(column_name) % mod).cast(IntegerType()))
            .filter(F.col("mod_temp") == matching_mod_value)
            .drop("mod_temp")
        )
        return res

    @staticmethod
    def _split_on_multi_column_values(df, column_names: list, batch_identifiers: dict):
        """Split on the joint values in the named columns"""
        for column_name in column_names:
            value = batch_identifiers.get(column_name)
            if not value:
                raise ValueError(
                    f"In order for SparkDFExecutionEngine to `_split_on_multi_column_values`, "
                    f"all values in  column_names must also exist in batch_identifiers. "
                    f"{column_name} was not found in batch_identifiers."
                )
            df = df.filter(F.col(column_name) == value)
        return df

    @staticmethod
    def _split_on_hashed_column(
        df,
        column_name: str,
        hash_digits: int,
        batch_identifiers: dict,
        hash_function_name: str = "sha256",
    ):
        """Split on the hashed value of the named column"""
        try:
            getattr(hashlib, hash_function_name)
        except (TypeError, AttributeError) as e:
            raise (
                ge_exceptions.ExecutionEngineError(
                    f"""The splitting method used with SparkDFExecutionEngine has a reference to an invalid hash_function_name.
                    Reference to {hash_function_name} cannot be found."""
                )
            )

        def _encrypt_value(to_encode):
            hash_func = getattr(hashlib, hash_function_name)
            hashed_value = hash_func(to_encode.encode()).hexdigest()[-1 * hash_digits :]
            return hashed_value

        encrypt_udf = F.udf(_encrypt_value, StringType())
        res = (
            df.withColumn("encrypted_value", encrypt_udf(column_name))
            .filter(F.col("encrypted_value") == batch_identifiers["hash_value"])
            .drop("encrypted_value")
        )
        return res

    ### Sampling methods ###
    @staticmethod
    def _sample_using_random(df, p: float = 0.1, seed: int = 1):
        """Take a random sample of rows, retaining proportion p"""
        res = (
            df.withColumn("rand", F.rand(seed=seed))
            .filter(F.col("rand") < p)
            .drop("rand")
        )
        return res

    @staticmethod
    def _sample_using_mod(
        df,
        column_name: str,
        mod: int,
        value: int,
    ):
        """Take the mod of named column, and only keep rows that match the given value"""
        res = (
            df.withColumn("mod_temp", (F.col(column_name) % mod).cast(IntegerType()))
            .filter(F.col("mod_temp") == value)
            .drop("mod_temp")
        )
        return res

    @staticmethod
    def _sample_using_a_list(
        df,
        column_name: str,
        value_list: list,
    ):
        """Match the values in the named column against value_list, and only keep the matches"""
        return df.where(F.col(column_name).isin(value_list))

    @staticmethod
    def _sample_using_hash(
        df,
        column_name: str,
        hash_digits: int = 1,
        hash_value: str = "f",
        hash_function_name: str = "md5",
    ):
        try:
            getattr(hashlib, str(hash_function_name))
        except (TypeError, AttributeError) as e:
            raise (
                ge_exceptions.ExecutionEngineError(
                    f"""The sampling method used with SparkDFExecutionEngine has a reference to an invalid hash_function_name.
                    Reference to {hash_function_name} cannot be found."""
                )
            )

        def _encrypt_value(to_encode):
            to_encode_str = str(to_encode)
            hash_func = getattr(hashlib, hash_function_name)
            hashed_value = hash_func(to_encode_str.encode()).hexdigest()[
                -1 * hash_digits :
            ]
            return hashed_value

        encrypt_udf = F.udf(_encrypt_value, StringType())
        res = (
            df.withColumn("encrypted_value", encrypt_udf(column_name))
            .filter(F.col("encrypted_value") == hash_value)
            .drop("encrypted_value")
        )
        return res
