import datetime
import logging
import uuid
import warnings
from collections import Callable
from functools import partial
from io import BytesIO

import pandas as pd

from great_expectations.core.batch import Batch, BatchMarkers
from great_expectations.exceptions import BatchKwargsError
from great_expectations.types import ClassConfig

from ..core.util import S3Url
from ..execution_engine.pandas_execution_engine import hash_pandas_dataframe
from ..types.configurations import classConfigSchema
from .datasource import LegacyDatasource

logger = logging.getLogger(__name__)

HASH_THRESHOLD = 1e9


class PandasDatasource(LegacyDatasource):
    """The PandasDatasource produces PandasDataset objects and supports generators capable of
    interacting with the local filesystem (the default subdir_reader generator), and from
    existing in-memory dataframes.
    """

    recognized_batch_parameters = {
        "reader_method",
        "reader_options",
        "limit",
        "dataset_options",
        "boto3_options",
    }

    @classmethod
    def build_configuration(
        cls,
        data_asset_type=None,
        batch_kwargs_generators=None,
        boto3_options=None,
        reader_method=None,
        reader_options=None,
        limit=None,
        **kwargs,
    ):
        """
        Build a full configuration object for a datasource, potentially including generators with defaults.

        Args:
            data_asset_type: A ClassConfig dictionary
            batch_kwargs_generators: Generator configuration dictionary
            boto3_options: Optional dictionary with key-value pairs to pass to boto3 during instantiation.
            reader_method: Optional default reader_method for generated batches
            reader_options: Optional default reader_options for generated batches
            limit: Optional default limit for generated batches
            **kwargs: Additional kwargs to be part of the datasource constructor's initialization

        Returns:
            A complete datasource configuration.

        """

        if data_asset_type is None:
            data_asset_type = {
                "class_name": "PandasDataset",
                "module_name": "great_expectations.dataset",
            }
        else:
            data_asset_type = classConfigSchema.dump(ClassConfig(**data_asset_type))

        configuration = kwargs
        configuration["data_asset_type"] = data_asset_type
        if batch_kwargs_generators:
            configuration["batch_kwargs_generators"] = batch_kwargs_generators

        if boto3_options is not None:
            if isinstance(boto3_options, dict):
                configuration.update(boto3_options)
            else:
                raise ValueError(
                    "boto3_options must be a dictionary of key-value pairs to pass to boto3 upon "
                    "initialization."
                )
            configuration["boto3_options"] = boto3_options

        if reader_options is not None:
            if isinstance(reader_options, dict):
                configuration.update(reader_options)
            else:
                raise ValueError(
                    "boto3_options must be a dictionary of key-value pairs to pass to boto3 upon "
                    "initialization."
                )

        if reader_method is not None:
            configuration["reader_method"] = reader_method

        if limit is not None:
            configuration["limit"] = limit

        return configuration

    def __init__(
        self,
        name="pandas",
        data_context=None,
        data_asset_type=None,
        batch_kwargs_generators=None,
        boto3_options=None,
        reader_method=None,
        reader_options=None,
        limit=None,
        **kwargs,
    ):
        configuration_with_defaults = PandasDatasource.build_configuration(
            data_asset_type,
            batch_kwargs_generators,
            boto3_options,
            reader_method=reader_method,
            reader_options=reader_options,
            limit=limit,
            **kwargs,
        )

        data_asset_type = configuration_with_defaults.pop("data_asset_type")
        batch_kwargs_generators = configuration_with_defaults.pop(
            "batch_kwargs_generators", None
        )
        super().__init__(
            name,
            data_context=data_context,
            data_asset_type=data_asset_type,
            batch_kwargs_generators=batch_kwargs_generators,
            **configuration_with_defaults,
        )

        self._build_generators()
        self._boto3_options = configuration_with_defaults.get("boto3_options", {})
        self._reader_method = configuration_with_defaults.get("reader_method", None)
        self._reader_options = configuration_with_defaults.get("reader_options", None)
        self._limit = configuration_with_defaults.get("limit", None)

    # TODO: move to data connector
    def process_batch_parameters(
        self,
        reader_method=None,
        reader_options=None,
        limit=None,
        dataset_options=None,
    ):
        # Note that we do not pass limit up, since even that will be handled by PandasDatasource
        batch_kwargs = super().process_batch_parameters(dataset_options=dataset_options)

        # Apply globally-configured reader options first
        if self._reader_options:
            # Then update with any locally-specified reader options
            if not batch_kwargs.get("reader_options"):
                batch_kwargs["reader_options"] = {}
            batch_kwargs["reader_options"].update(self._reader_options)

        # Then update with any locally-specified reader options
        if reader_options:
            if not batch_kwargs.get("reader_options"):
                batch_kwargs["reader_options"] = {}
            batch_kwargs["reader_options"].update(reader_options)

        if self._limit:
            if not batch_kwargs.get("reader_options"):
                batch_kwargs["reader_options"] = {}
            batch_kwargs["reader_options"]["nrows"] = self._limit

        if limit is not None:
            if not batch_kwargs.get("reader_options"):
                batch_kwargs["reader_options"] = {}
            batch_kwargs["reader_options"]["nrows"] = limit

        if self._reader_method:
            batch_kwargs["reader_method"] = self._reader_method

        if reader_method is not None:
            batch_kwargs["reader_method"] = reader_method

        return batch_kwargs

    # TODO: move to execution engine or make a wrapper
    def get_batch(self, batch_kwargs, batch_parameters=None):
        # We will use and manipulate reader_options along the way
        reader_options = batch_kwargs.get("reader_options", {})

        # We need to build a batch_markers to be used in the dataframe
        batch_markers = BatchMarkers(
            {
                "ge_load_time": datetime.datetime.now(datetime.timezone.utc).strftime(
                    "%Y%m%dT%H%M%S.%fZ"
                )
            }
        )

        if "path" in batch_kwargs:
            path = batch_kwargs["path"]
            reader_method = batch_kwargs.get("reader_method")
            reader_fn = self._get_reader_fn(reader_method, path)
            df = reader_fn(path, **reader_options)

        elif "s3" in batch_kwargs:
            warnings.warn(
                "Direct GE Support for the s3 BatchKwarg will be removed in a future release. Please use a path including the s3a:// protocol instead.",
                DeprecationWarning,
            )
            try:
                import boto3

                s3 = boto3.client("s3", **self._boto3_options)
            except ImportError:
                raise BatchKwargsError(
                    "Unable to load boto3 client to read s3 asset.", batch_kwargs
                )
            raw_url = batch_kwargs["s3"]
            reader_method = batch_kwargs.get("reader_method")
            url = S3Url(raw_url)
            logger.debug(f"Fetching s3 object. Bucket: {url.bucket} Key: {url.key}")
            s3_object = s3.get_object(Bucket=url.bucket, Key=url.key)
            reader_fn = self._get_reader_fn(reader_method, url.key)
            default_reader_options = self._infer_default_options(
                reader_fn, reader_options
            )
            if not reader_options.get("encoding") and default_reader_options.get(
                "encoding"
            ):
                reader_options["encoding"] = s3_object.get(
                    "ContentEncoding", default_reader_options.get("encoding")
                )
            df = reader_fn(BytesIO(s3_object["Body"].read()), **reader_options)

        elif "dataset" in batch_kwargs and isinstance(
            batch_kwargs["dataset"], (pd.DataFrame, pd.Series)
        ):
            df = batch_kwargs.get("dataset")
            # We don't want to store the actual dataframe in kwargs; copy the remaining batch_kwargs
            batch_kwargs = {k: batch_kwargs[k] for k in batch_kwargs if k != "dataset"}
            batch_kwargs["PandasInMemoryDF"] = True
            batch_kwargs["ge_batch_id"] = str(uuid.uuid1())

        else:
            raise BatchKwargsError(
                "Invalid batch_kwargs: path, s3, or dataset is required for a PandasDatasource",
                batch_kwargs,
            )

        if df.memory_usage().sum() < HASH_THRESHOLD:
            batch_markers["pandas_data_fingerprint"] = hash_pandas_dataframe(df)

        return Batch(
            datasource_name=self.name,
            batch_kwargs=batch_kwargs,
            data=df,
            batch_parameters=batch_parameters,
            batch_markers=batch_markers,
            data_context=self._data_context,
        )

    @staticmethod
    def guess_reader_method_from_path(path):
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
        elif path.endswith(".csv.gz") or path.endswith(".csv.gz"):
            return {
                "reader_method": "read_csv",
                "reader_options": {"compression": "gzip"},
            }

        raise BatchKwargsError(
            "Unable to determine reader method from path: %s" % path, {"path": path}
        )

    def _infer_default_options(self, reader_fn: Callable, reader_options: dict) -> dict:
        """
        Allows reader options to be customized based on file context before loading to a DataFrame

        Args:
            reader_method (str): pandas reader method
            reader_options: Current options and defaults set to pass to the reader method

        Returns:
            dict: A copy of the reader options post-inference
        """
        while isinstance(reader_fn, partial):
            # reader_fn might be partial so need to unwrap to get underlying method
            reader_fn = reader_fn.func
        name = reader_fn.__name__
        if name == "read_parquet":
            return {}
        if name == "read_excel":
            return {}
        else:
            return {"encoding": "utf-8"}

    def _get_reader_fn(self, reader_method=None, path=None):
        """Static helper for parsing reader types. If reader_method is not provided, path will be used to guess the
        correct reader_method.

        Args:
            reader_method (str): the name of the reader method to use, if available.
            path (str): the to use to guess

        Returns:
            ReaderMethod to use for the filepath

        """
        if reader_method is None and path is None:
            raise BatchKwargsError(
                "Unable to determine pandas reader function without reader_method or path.",
                {"reader_method": reader_method},
            )

        reader_options = None
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
            raise BatchKwargsError(
                "Unable to find reader_method %s in pandas." % reader_method,
                {"reader_method": reader_method},
            )
