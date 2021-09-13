import copy
import datetime
import hashlib
import logging
import os
import pickle
import random
import warnings
from functools import partial
from io import BytesIO
from typing import Any, Callable, Iterable, List, Optional, Tuple, Union

import pandas as pd

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.batch import BatchMarkers
from great_expectations.core.batch_spec import (
    AzureBatchSpec,
    BatchSpec,
    GCSBatchSpec,
    PathBatchSpec,
    RuntimeDataBatchSpec,
    S3BatchSpec,
)
from great_expectations.core.util import AzureUrl, GCSUrl, S3Url, sniff_s3_compression
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.execution_engine.execution_engine import MetricDomainTypes
from great_expectations.execution_engine.pandas_batch_data import PandasBatchData

logger = logging.getLogger(__name__)

try:
    import boto3
except ImportError:
    boto3 = None
    logger.debug(
        "Unable to load AWS connection object; install optional boto3 dependency for support"
    )

try:
    from azure.storage.blob import BlobServiceClient
except ImportError:
    BlobServiceClient = None
    logger.debug(
        "Unable to load Azure connection object; install optional azure dependency for support"
    )

try:
    from google.auth.exceptions import DefaultCredentialsError
    from google.cloud import storage
    from google.oauth2 import service_account
except ImportError:
    storage = None
    service_account = None
    DefaultCredentialsError = None
    logger.debug(
        "Unable to load GCS connection object; install optional google dependency for support"
    )


HASH_THRESHOLD = 1e9


class PandasExecutionEngine(ExecutionEngine):
    """
PandasExecutionEngine instantiates the great_expectations Expectations API as a subclass of a pandas.DataFrame.

For the full API reference, please see :func:`Dataset <great_expectations.data_asset.dataset.Dataset>`

Notes:
    1. Samples and Subsets of PandaDataSet have ALL the expectations of the original \
       data frame unless the user specifies the ``discard_subset_failing_expectations = True`` \
       property on the original data frame.
    2. Concatenations, joins, and merges of PandaDataSets contain NO expectations (since no autoinspection
       is performed by default).

--ge-feature-maturity-info--

    id: validation_engine_pandas
    title: Validation Engine - Pandas
    icon:
    short_description: Use Pandas DataFrame to validate data
    description: Use Pandas DataFrame to validate data
    how_to_guide_url:
    maturity: Production
    maturity_details:
        api_stability: Stable
        implementation_completeness: Complete
        unit_test_coverage: Complete
        integration_infrastructure_test_coverage: N/A -> see relevant Datasource evaluation
        documentation_completeness: Complete
        bug_risk: Low
        expectation_completeness: Complete

--ge-feature-maturity-info--
    """

    recognized_batch_spec_defaults = {
        "reader_method",
        "reader_options",
    }

    def __init__(self, *args, **kwargs):
        self.discard_subset_failing_expectations = kwargs.pop(
            "discard_subset_failing_expectations", False
        )
        boto3_options: dict = kwargs.pop("boto3_options", {})
        azure_options: dict = kwargs.pop("azure_options", {})
        gcs_options: dict = kwargs.pop("gcs_options", {})

        # Try initializing cloud provider client. If unsuccessful, we'll catch it when/if a BatchSpec is passed in.
        try:
            self._s3 = boto3.client("s3", **boto3_options)
        except (TypeError, AttributeError):
            self._s3 = None

        try:
            if "conn_str" in azure_options:
                self._azure = BlobServiceClient.from_connection_string(**azure_options)
            else:
                self._azure = BlobServiceClient(**azure_options)
        except (TypeError, AttributeError):
            self._azure = None

        # Can only configure a GCS connection by 1) seting an env var OR 2) passing explicit credentials
        if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") is None and gcs_options == {}:
            self._gcs = None
        else:
            try:
                credentials = None  # If configured with gcloud CLI / env vars
                if "filename" in gcs_options:
                    credentials = service_account.Credentials.from_service_account_file(
                        **gcs_options
                    )
                elif "info" in gcs_options:
                    credentials = service_account.Credentials.from_service_account_info(
                        **gcs_options
                    )
                self._gcs = storage.Client(credentials=credentials, **gcs_options)
            except (TypeError, AttributeError):
                self._gcs = None

        super().__init__(*args, **kwargs)

        self._config.update(
            {
                "discard_subset_failing_expectations": self.discard_subset_failing_expectations,
                "boto3_options": boto3_options,
                "azure_options": azure_options,
                "gcs_options": gcs_options,
            }
        )

    def configure_validator(self, validator):
        super().configure_validator(validator)
        validator.expose_dataframe_methods = True

    def load_batch_data(self, batch_id: str, batch_data: Any) -> None:
        if isinstance(batch_data, pd.DataFrame):
            batch_data = PandasBatchData(self, batch_data)
        elif isinstance(batch_data, PandasBatchData):
            pass
        else:
            raise ge_exceptions.GreatExpectationsError(
                "PandasExecutionEngine requires batch data that is either a DataFrame or a PandasBatchData object"
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

        batch_data: Any
        if isinstance(batch_spec, RuntimeDataBatchSpec):
            # batch_data != None is already checked when RuntimeDataBatchSpec is instantiated
            batch_data = batch_spec.batch_data
            if isinstance(batch_data, str):
                raise ge_exceptions.ExecutionEngineError(
                    f"""PandasExecutionEngine has been passed a string type batch_data, "{batch_data}", which is illegal.
Please check your config."""
                )
            if isinstance(batch_spec.batch_data, pd.DataFrame):
                df = batch_spec.batch_data
            elif isinstance(batch_spec.batch_data, PandasBatchData):
                df = batch_spec.batch_data.dataframe
            else:
                raise ValueError(
                    "RuntimeDataBatchSpec must provide a Pandas DataFrame or PandasBatchData object."
                )
            batch_spec.batch_data = "PandasDataFrame"

        elif isinstance(batch_spec, S3BatchSpec):
            if self._s3 is None:
                raise ge_exceptions.ExecutionEngineError(
                    f"""PandasExecutionEngine has been passed a S3BatchSpec,
                        but the ExecutionEngine does not have a boto3 client configured. Please check your config."""
                )
            s3_engine = self._s3
            reader_method: str = batch_spec.reader_method
            reader_options: dict = batch_spec.reader_options or {}
            path: str = batch_spec.path
            s3_url = S3Url(path)
            if "compression" not in reader_options.keys():
                inferred_compression_param = sniff_s3_compression(s3_url)
                if inferred_compression_param is not None:
                    reader_options["compression"] = inferred_compression_param
            s3_object = s3_engine.get_object(Bucket=s3_url.bucket, Key=s3_url.key)
            logger.debug(
                "Fetching s3 object. Bucket: {} Key: {}".format(
                    s3_url.bucket, s3_url.key
                )
            )
            reader_fn = self._get_reader_fn(reader_method, s3_url.key)
            buf = BytesIO(s3_object["Body"].read())
            buf.seek(0)
            df = reader_fn(buf, **reader_options)

        elif isinstance(batch_spec, AzureBatchSpec):
            if self._azure is None:
                raise ge_exceptions.ExecutionEngineError(
                    f"""PandasExecutionEngine has been passed a AzureBatchSpec,
                        but the ExecutionEngine does not have an Azure client configured. Please check your config."""
                )
            azure_engine = self._azure
            reader_method: str = batch_spec.reader_method
            reader_options: dict = batch_spec.reader_options or {}
            path: str = batch_spec.path
            azure_url = AzureUrl(path)
            blob_client = azure_engine.get_blob_client(
                container=azure_url.container, blob=azure_url.blob
            )
            azure_object = blob_client.download_blob()
            logger.debug(
                f"Fetching Azure blob. Container: {azure_url.container} Blob: {azure_url.blob}"
            )
            reader_fn = self._get_reader_fn(reader_method, azure_url.blob)
            buf = BytesIO(azure_object.readall())
            buf.seek(0)
            df = reader_fn(buf, **reader_options)

        elif isinstance(batch_spec, GCSBatchSpec):
            if self._gcs is None:
                raise ge_exceptions.ExecutionEngineError(
                    f"""PandasExecutionEngine has been passed a GCSBatchSpec,
                        but the ExecutionEngine does not have an GCS client configured. Please check your config."""
                )
            gcs_engine = self._gcs
            gcs_url = GCSUrl(batch_spec.path)
            reader_method: str = batch_spec.reader_method
            reader_options: dict = batch_spec.reader_options or {}
            gcs_bucket = gcs_engine.get_bucket(gcs_url.bucket)
            gcs_blob = gcs_bucket.blob(gcs_url.blob)
            logger.debug(
                f"Fetching GCS blob. Bucket: {gcs_url.bucket} Blob: {gcs_url.blob}"
            )
            reader_fn = self._get_reader_fn(reader_method, gcs_url.blob)
            buf = BytesIO(gcs_blob.download_as_bytes())
            buf.seek(0)
            df = reader_fn(buf, **reader_options)

        elif isinstance(batch_spec, PathBatchSpec):
            reader_method: str = batch_spec.reader_method
            reader_options: dict = batch_spec.reader_options
            path: str = batch_spec.path
            reader_fn: Callable = self._get_reader_fn(reader_method, path)
            df = reader_fn(path, **reader_options)

        else:
            raise ge_exceptions.BatchSpecError(
                f"batch_spec must be of type RuntimeDataBatchSpec, PathBatchSpec, S3BatchSpec, or AzureBatchSpec, not {batch_spec.__class__.__name__}"
            )

        df = self._apply_splitting_and_sampling_methods(batch_spec, df)
        if df.memory_usage().sum() < HASH_THRESHOLD:
            batch_markers["pandas_data_fingerprint"] = hash_pandas_dataframe(df)

        typed_batch_data = PandasBatchData(execution_engine=self, dataframe=df)

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

    @property
    def dataframe(self):
        """Tests whether or not a Batch has been loaded. If the loaded batch does not exist, raises a
        ValueError Exception
        """
        # Changed to is None because was breaking prior
        if self.active_batch_data is None:
            raise ValueError(
                "Batch has not been loaded - please run load_batch_data() to load a batch."
            )

        return self.active_batch_data.dataframe

    def _get_reader_fn(self, reader_method=None, path=None):
        """Static helper for parsing reader types. If reader_method is not provided, path will be used to guess the
        correct reader_method.

        Args:
            reader_method (str): the name of the reader method to use, if available.
            path (str): the path used to guess

        Returns:
            ReaderMethod to use for the filepath

        """
        if reader_method is None and path is None:
            raise ge_exceptions.ExecutionEngineError(
                "Unable to determine pandas reader function without reader_method or path."
            )

        reader_options = {}
        if reader_method is None:
            path_guess = self.guess_reader_method_from_path(path)
            reader_method = path_guess["reader_method"]
            reader_options = path_guess.get(
                "reader_options"
            )  # This may not be there; use None in that case

        try:
            reader_fn = getattr(pd, reader_method)
            if reader_options:
                reader_fn = partial(reader_fn, **reader_options)
            return reader_fn
        except AttributeError:
            raise ge_exceptions.ExecutionEngineError(
                f'Unable to find reader_method "{reader_method}" in pandas.'
            )

    # NOTE Abe 20201105: Any reason this shouldn't be a private method?
    @staticmethod
    def guess_reader_method_from_path(path):
        """Helper method for deciding which reader to use to read in a certain path.

        Args:
            path (str): the to use to guess

        Returns:
            ReaderMethod to use for the filepath

        """
        if path.endswith(".csv") or path.endswith(".tsv"):
            return {"reader_method": "read_csv"}
        elif path.endswith(".parquet"):
            return {"reader_method": "read_parquet"}
        elif path.endswith(".xlsx") or path.endswith(".xls"):
            return {"reader_method": "read_excel"}
        elif path.endswith(".json"):
            return {"reader_method": "read_json"}
        elif path.endswith(".pkl"):
            return {"reader_method": "read_pickle"}
        elif path.endswith(".feather"):
            return {"reader_method": "read_feather"}
        elif path.endswith(".csv.gz") or path.endswith(".tsv.gz"):
            return {
                "reader_method": "read_csv",
                "reader_options": {"compression": "gzip"},
            }

        raise ge_exceptions.ExecutionEngineError(
            f'Unable to determine reader method from path: "{path}".'
        )

    def get_domain_records(
        self,
        domain_kwargs: dict,
    ) -> pd.DataFrame:
        """
        Uses the given domain kwargs (which include row_condition, condition_parser, and ignore_row_if directives) to
        obtain and/or query a batch. Returns in the format of a Pandas DataFrame.

        Args:
            domain_kwargs (dict) - A dictionary consisting of the domain kwargs specifying which data to obtain

        Returns:
            A DataFrame (the data on which to compute)
        """
        table = domain_kwargs.get("table", None)
        if table:
            raise ValueError(
                "PandasExecutionEngine does not currently support multiple named tables."
            )

        batch_id = domain_kwargs.get("batch_id")
        if batch_id is None:
            # We allow no batch id specified if there is only one batch
            if self.active_batch_data_id is not None:
                data = self.active_batch_data.dataframe
            else:
                raise ge_exceptions.ValidationError(
                    "No batch is specified, but could not identify a loaded batch."
                )
        else:
            if batch_id in self.loaded_batch_data_dict:
                data = self.loaded_batch_data_dict[batch_id].dataframe
            else:
                raise ge_exceptions.ValidationError(
                    f"Unable to find batch with batch_id {batch_id}"
                )

        # Filtering by row condition.
        row_condition = domain_kwargs.get("row_condition", None)
        if row_condition:
            condition_parser = domain_kwargs.get("condition_parser", None)

            # Ensuring proper condition parser has been provided
            if condition_parser not in ["python", "pandas"]:
                raise ValueError(
                    "condition_parser is required when setting a row_condition,"
                    " and must be 'python' or 'pandas'"
                )
            else:
                # Querying row condition
                data = data.query(row_condition, parser=condition_parser).reset_index(
                    drop=True
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
                data = data.dropna(
                    axis=0,
                    how="all",
                    subset=[column_A_name, column_B_name],
                )
            elif ignore_row_if == "either_value_is_missing":
                data = data.dropna(
                    axis=0,
                    how="any",
                    subset=[column_A_name, column_B_name],
                )
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
                data = data.dropna(
                    axis=0,
                    how="all",
                    subset=column_list,
                )
            elif ignore_row_if == "any_value_is_missing":
                data = data.dropna(
                    axis=0,
                    how="any",
                    subset=column_list,
                )
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
    ) -> Tuple[pd.DataFrame, dict, dict]:
        """
        Uses the given domain kwargs (which include row_condition, condition_parser, and ignore_row_if directives) to
        obtain and/or query a batch.  Returns in the format of a Pandas DataFrame. If the domain is a single column,
        this is added to 'accessor domain kwargs' and used for later access

        Args:
            domain_kwargs (dict) - A dictionary consisting of the domain kwargs specifying which data to obtain
            domain_type (str or MetricDomainTypes) - an Enum value indicating which metric domain the user would
            like to be using, or a corresponding string value representing it. String types include "column",
            "column_pair", "table", and "other".  Enum types include capitalized versions of these from the
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
                "PandasExecutionEngine does not currently support multiple named tables."
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

        # If given table (this is default), get all unexpected accessor_keys (an optional parameters allowing us to
        # modify domain access)
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
                raise ge_exceptions.GreatExpectationsError(
                    "Column not provided in compute_domain_kwargs"
                )

            accessor_domain_kwargs["column"] = compute_domain_kwargs.pop("column")

        elif domain_type == MetricDomainTypes.COLUMN_PAIR:
            if not ("column_A" in domain_kwargs and "column_B" in domain_kwargs):
                raise ge_exceptions.GreatExpectationsError(
                    "column_A or column_B not found within domain_kwargs"
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

    ### Splitter methods for partitioning dataframes ###
    @staticmethod
    def _split_on_whole_table(
        df,
    ) -> pd.DataFrame:
        return df

    @staticmethod
    def _split_on_column_value(
        df, column_name: str, batch_identifiers: dict
    ) -> pd.DataFrame:

        return df[df[column_name] == batch_identifiers[column_name]]

    @staticmethod
    def _split_on_converted_datetime(
        df,
        column_name: str,
        batch_identifiers: dict,
        date_format_string: str = "%Y-%m-%d",
    ):
        """Convert the values in the named column to the given date_format, and split on that"""
        stringified_datetime_series = df[column_name].map(
            lambda x: x.strftime(date_format_string)
        )
        matching_string = batch_identifiers[column_name]
        return df[stringified_datetime_series == matching_string]

    @staticmethod
    def _split_on_divided_integer(
        df, column_name: str, divisor: int, batch_identifiers: dict
    ):
        """Divide the values in the named column by `divisor`, and split on that"""

        matching_divisor = batch_identifiers[column_name]
        matching_rows = df[column_name].map(
            lambda x: int(x / divisor) == matching_divisor
        )

        return df[matching_rows]

    @staticmethod
    def _split_on_mod_integer(df, column_name: str, mod: int, batch_identifiers: dict):
        """Divide the values in the named column by `divisor`, and split on that"""

        matching_mod_value = batch_identifiers[column_name]
        matching_rows = df[column_name].map(lambda x: x % mod == matching_mod_value)

        return df[matching_rows]

    @staticmethod
    def _split_on_multi_column_values(
        df, column_names: List[str], batch_identifiers: dict
    ):
        """Split on the joint values in the named columns"""

        subset_df = df.copy()
        for column_name in column_names:
            value = batch_identifiers.get(column_name)
            if not value:
                raise ValueError(
                    f"In order for PandasExecution to `_split_on_multi_column_values`, "
                    f"all values in column_names must also exist in batch_identifiers. "
                    f"{column_name} was not found in batch_identifiers."
                )
            subset_df = subset_df[subset_df[column_name] == value]
        return subset_df

    @staticmethod
    def _split_on_hashed_column(
        df,
        column_name: str,
        hash_digits: int,
        batch_identifiers: dict,
        hash_function_name: str = "md5",
    ):
        """Split on the hashed value of the named column"""
        try:
            hash_method = getattr(hashlib, hash_function_name)
        except (TypeError, AttributeError):
            raise (
                ge_exceptions.ExecutionEngineError(
                    f"""The splitting method used with SparkDFExecutionEngine has a reference to an invalid hash_function_name.
                    Reference to {hash_function_name} cannot be found."""
                )
            )
        matching_rows = df[column_name].map(
            lambda x: hash_method(str(x).encode()).hexdigest()[-1 * hash_digits :]
            == batch_identifiers["hash_value"]
        )
        return df[matching_rows]

    ### Sampling methods ###

    @staticmethod
    def _sample_using_random(
        df,
        p: float = 0.1,
    ):
        """Take a random sample of rows, retaining proportion p

        Note: the Random function behaves differently on different dialects of SQL
        """
        return df[df.index.map(lambda x: random.random() < p)]

    @staticmethod
    def _sample_using_mod(
        df,
        column_name: str,
        mod: int,
        value: int,
    ):
        """Take the mod of named column, and only keep rows that match the given value"""
        return df[df[column_name].map(lambda x: x % mod == value)]

    @staticmethod
    def _sample_using_a_list(
        df,
        column_name: str,
        value_list: list,
    ):
        """Match the values in the named column against value_list, and only keep the matches"""
        return df[df[column_name].isin(value_list)]

    @staticmethod
    def _sample_using_hash(
        df,
        column_name: str,
        hash_digits: int = 1,
        hash_value: str = "f",
        hash_function_name: str = "md5",
    ):
        """Hash the values in the named column, and split on that"""
        try:
            hash_func = getattr(hashlib, hash_function_name)
        except (TypeError, AttributeError):
            raise (
                ge_exceptions.ExecutionEngineError(
                    f"""The sampling method used with PandasExecutionEngine has a reference to an invalid hash_function_name.
                    Reference to {hash_function_name} cannot be found."""
                )
            )

        matches = df[column_name].map(
            lambda x: hash_func(str(x).encode()).hexdigest()[-1 * hash_digits :]
            == hash_value
        )
        return df[matches]


def hash_pandas_dataframe(df):
    try:
        obj = pd.util.hash_pandas_object(df, index=True).values
    except TypeError:
        # In case of facing unhashable objects (like dict), use pickle
        obj = pickle.dumps(df, pickle.HIGHEST_PROTOCOL)

    return hashlib.md5(obj).hexdigest()
