import logging
import os
from typing import List, Optional

from great_expectations.core.batch import BatchDefinition
from great_expectations.core.batch_spec import PathBatchSpec, S3BatchSpec
from great_expectations.exceptions.exceptions import ParserError

try:
    import boto3
except ImportError:
    boto3 = None

from great_expectations.datasource.data_connector.inferred_asset_file_path_data_connector import (
    InferredAssetFilePathDataConnector,
)
from great_expectations.datasource.data_connector.util import list_s3_keys
from great_expectations.execution_engine import ExecutionEngine

logger = logging.getLogger(__name__)

INVALID_S3_CHARS = ["*"]


class InferredAssetS3DataConnector(InferredAssetFilePathDataConnector):
    """
    Extension of InferredAssetFilePathDataConnector used to connect to S3

    The InferredAssetS3DataConnector is one of two classes (ConfiguredAssetS3DataConnector being the
    other one) designed for connecting to filesystem-like data, more specifically files on S3. It connects to assets
    inferred from bucket, prefix, and file name by default_regex.

    InferredAssetS3DataConnector that operates on S3 buckets and determines
    the data_asset_name implicitly (e.g., through the combination of the regular expressions pattern and group names)

    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        bucket: str,
        execution_engine: Optional[ExecutionEngine] = None,
        default_regex: Optional[dict] = None,
        sorters: Optional[list] = None,
        prefix: Optional[str] = "",
        delimiter: Optional[str] = "/",
        max_keys: Optional[int] = 1000,
        boto3_options: Optional[dict] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        InferredAssetS3DataConnector for connecting to S3.

        Args:
            name (str): required name for data_connector
            datasource_name (str): required name for datasource
            bucket (str): bucket for S3
            execution_engine (ExecutionEngine): optional reference to ExecutionEngine
            default_regex (dict): optional regex configuration for filtering data_references
            sorters (list): optional list of sorters for sorting data_references
            prefix (str): S3 prefix
            delimiter (str): S3 delimiter
            max_keys (int): S3 max_keys (default is 1000)
            boto3_options (dict): optional boto3 options
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        logger.debug(f'Constructing InferredAssetS3DataConnector "{name}".')

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            default_regex=default_regex,
            sorters=sorters,
            batch_spec_passthrough=batch_spec_passthrough,
        )

        self._bucket = bucket
        self._prefix = os.path.join(prefix, "")
        self._delimiter = delimiter
        self._max_keys = max_keys

        if boto3_options is None:
            boto3_options = {}

        try:
            self._s3 = boto3.client("s3", **boto3_options)
        except (TypeError, AttributeError):
            raise ImportError(
                "Unable to load boto3 (it is required for InferredAssetS3DataConnector)."
            )

    def build_batch_spec(self, batch_definition: BatchDefinition) -> S3BatchSpec:
        """
        Build BatchSpec from batch_definition by calling DataConnector's build_batch_spec function.

        Args:
            batch_definition (BatchDefinition): to be used to build batch_spec

        Returns:
            BatchSpec built from batch_definition
        """
        batch_spec: PathBatchSpec = super().build_batch_spec(
            batch_definition=batch_definition
        )
        return S3BatchSpec(batch_spec)

    def _get_data_reference_list(
        self, data_asset_name: Optional[str] = None
    ) -> List[str]:
        """
        List objects in the underlying data store to create a list of data_references.

        This method is used to refresh the cache.
        """
        query_options: dict = {
            "Bucket": self._bucket,
            "Prefix": self._prefix,
            "Delimiter": self._delimiter,
            "MaxKeys": self._max_keys,
        }

        path_list: List[str] = [
            key
            for key in list_s3_keys(
                s3=self._s3,
                query_options=query_options,
                iterator_dict={},
                recursive=True,
            )
        ]
        return path_list

    def _get_full_file_path(
        self,
        path: str,
        data_asset_name: Optional[str] = None,
    ) -> str:
        # data_asset_name isn't used in this method.
        # It's only kept for compatibility with parent methods.
        _check_valid_s3_path(path)
        return f"s3a://{os.path.join(self._bucket, path)}"


def _check_valid_s3_path(
    path: str,
) -> None:
    """Performs a basic check for validity of the S3 path"""
    bad_chars = [c for c in INVALID_S3_CHARS if c in path]
    if len(bad_chars) > 0:
        msg = (
            f"The parsed S3 path={path} contains the invalid characters {bad_chars}."
            "Please make sure your regex is correct and characters are escaped."
        )
        if "*" in bad_chars:
            msg += "Note: `*` is internally used to replace the regex for `.`."
        raise ParserError(msg)
