import logging
import os
import re
from typing import List, Optional

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.batch import BatchDefinition
from great_expectations.core.batch_spec import AzureBatchSpec, PathBatchSpec
from great_expectations.datasource.data_connector.asset import Asset
from great_expectations.datasource.data_connector.configured_asset_file_path_data_connector import (
    ConfiguredAssetFilePathDataConnector,
)
from great_expectations.datasource.data_connector.util import list_azure_keys
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
)

logger = logging.getLogger(__name__)

try:
    from azure.storage.blob import BlobServiceClient
except ImportError:
    BlobServiceClient = None
    logger.debug(
        "Unable to load BlobServiceClient connection object; install optional Azure Storage Blob dependency for support"
    )


class ConfiguredAssetAzureDataConnector(ConfiguredAssetFilePathDataConnector):
    """
    Extension of ConfiguredAssetFilePathDataConnector used to connect to Azure

    DataConnectors produce identifying information, called "batch_spec" that ExecutionEngines
    can use to get individual batches of data. They add flexibility in how to obtain data
    such as with time-based partitioning, splitting and sampling, or other techniques appropriate
    for obtaining batches of data.

    The ConfiguredAssetAzureDataConnector is one of two classes (InferredAssetAzureDataConnector being the
    other one) designed for connecting to data on Azure.

    A ConfiguredAssetAzureDataConnector requires an explicit specification of each DataAsset you want to connect to.
    This allows more fine-tuning, but also requires more setup. Please note that in order to maintain consistency
    with Azure's official SDK, we utilize terms like "container" and "name_starts_with".

    As much of the interaction with the SDK is done through a BlobServiceClient, please refer to the official
    docs if a greater understanding of the supported authentication methods and general functionality is desired.
    Source: https://docs.microsoft.com/en-us/python/api/azure-storage-blob/azure.storage.blob.blobserviceclient?view=azure-python
    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        container: str,
        assets: dict,
        execution_engine: Optional[ExecutionEngine] = None,
        default_regex: Optional[dict] = None,
        sorters: Optional[list] = None,
        name_starts_with: str = "",
        delimiter: str = "/",
        azure_options: Optional[dict] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        ConfiguredAssetDataConnector for connecting to Azure.

        Args:
            name (str): required name for DataConnector
            datasource_name (str): required name for datasource
            container (str): container name for Azure Blob Storage
            assets (dict): dict of asset configuration (required for ConfiguredAssetDataConnector)
            execution_engine (ExecutionEngine): optional reference to ExecutionEngine
            default_regex (dict): optional regex configuration for filtering data_references
            sorters (list): optional list of sorters for sorting data_references
            name_starts_with (str): Azure prefix
            delimiter (str): Azure delimiter
            azure_options (dict): wrapper object for **kwargs
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        logger.debug(f'Constructing ConfiguredAssetAzureDataConnector "{name}".')

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            assets=assets,
            default_regex=default_regex,
            sorters=sorters,
            batch_spec_passthrough=batch_spec_passthrough,
        )
        self._container = container
        self._name_starts_with = os.path.join(name_starts_with, "")
        self._delimiter = delimiter

        if azure_options is None:
            azure_options = {}

        # Thanks to schema validation, we are guaranteed to have one of `conn_str` or `account_url` to
        # use in authentication (but not both). If the format or content of the provided keys is invalid,
        # the assignment of `self._account_name` and `self._azure` will fail and an error will be raised.
        conn_str: Optional[str] = azure_options.get("conn_str")
        account_url: Optional[str] = azure_options.get("account_url")
        assert bool(conn_str) ^ bool(
            account_url
        ), "You must provide one of `conn_str` or `account_url` to the `azure_options` key in your config (but not both)"

        try:
            if conn_str is not None:
                self._account_name = re.search(
                    r".*?AccountName=(.+?);.*?", conn_str
                ).group(1)
                self._azure = BlobServiceClient.from_connection_string(**azure_options)
            elif account_url is not None:
                self._account_name = re.search(
                    r"(?:https?://)?(.+?).blob.core.windows.net", account_url
                ).group(1)
                self._azure = BlobServiceClient(**azure_options)
        except (TypeError, AttributeError):
            raise ImportError(
                "Unable to load Azure BlobServiceClient (it is required for ConfiguredAssetAzureDataConnector). \
                Please ensure that you have provided the appropriate keys to `azure_options` for authentication."
            )

    def build_batch_spec(self, batch_definition: BatchDefinition) -> AzureBatchSpec:
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
        return AzureBatchSpec(batch_spec)

    def _get_data_reference_list_for_asset(self, asset: Optional[Asset]) -> List[str]:
        query_options: dict = {
            "container": self._container,
            "name_starts_with": self._name_starts_with,
            "delimiter": self._delimiter,
        }
        if asset is not None:
            if asset.container:
                query_options["container"] = asset.container
            if asset.name_starts_with:
                query_options["name_starts_with"] = asset.name_starts_with
            if asset.delimiter:
                query_options["delimiter"] = asset.delimiter

        path_list: List[str] = list_azure_keys(
            azure=self._azure,
            query_options=query_options,
            recursive=False,
        )
        return path_list

    def _get_full_file_path_for_asset(
        self, path: str, asset: Optional[Asset] = None
    ) -> str:
        # asset isn't used in this method.
        # It's only kept for compatibility with parent methods.
        # Pandas and Spark execution engines utilize separate path formats for accessing Azure Blob Storage service.
        full_path: str
        if isinstance(self.execution_engine, PandasExecutionEngine):
            full_path = os.path.join(
                f"{self._account_name}.blob.core.windows.net", self._container, path
            )
        elif isinstance(self.execution_engine, SparkDFExecutionEngine):
            full_path = os.path.join(
                f"{self._container}@{self._account_name}.blob.core.windows.net", path
            )
            full_path = f"wasbs://{full_path}"
        else:
            raise ge_exceptions.DataConnectorError(
                f"""Illegal ExecutionEngine type "{str(type(self.execution_engine))}" used in \
"{self.__class__.__name__}".
"""
            )

        return full_path
