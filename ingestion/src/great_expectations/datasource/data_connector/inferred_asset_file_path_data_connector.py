import copy
import logging
from typing import List, Optional

from great_expectations.core.batch import BatchDefinition, BatchRequestBase
from great_expectations.core.batch_spec import BatchSpec, PathBatchSpec
from great_expectations.datasource.data_connector.file_path_data_connector import (
    FilePathDataConnector,
)
from great_expectations.execution_engine import ExecutionEngine

logger = logging.getLogger(__name__)


class InferredAssetFilePathDataConnector(FilePathDataConnector):
    """
    The InferredAssetFilePathDataConnector is one of two classes (ConfiguredAssetFilePathDataConnector being the
    other one) designed for connecting to filesystem-like data. This includes files on disk, but also things
    like S3 object stores, etc:

    InferredAssetFilePathDataConnector is a base class that operates on file paths and determines
    the data_asset_name implicitly (e.g., through the combination of the regular expressions pattern and group names)

    *Note*: InferredAssetFilePathDataConnector is not meant to be used on its own, but extended. Currently
    InferredAssetFilesystemDataConnector, InferredAssetS3DataConnector, InferredAssetAzureDataConnector, and
    InferredAssetGCSDataConnector are subclasses of InferredAssetFilePathDataConnector.
    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        execution_engine: Optional[ExecutionEngine] = None,
        default_regex: Optional[dict] = None,
        sorters: Optional[list] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        Base class for DataConnectors that connect to filesystem-like data. This class supports the configuration of default_regex
        and sorters for filtering and sorting data_references.

        Args:
            name (str): name of ConfiguredAssetFilePathDataConnector
            datasource_name (str): Name of datasource that this DataConnector is connected to
            execution_engine (ExecutionEngine): ExecutionEngine object to actually read the data
            default_regex (dict): Optional dict the filter and organize the data_references.
            sorters (list): Optional list if you want to sort the data_references
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        logger.debug(f'Constructing InferredAssetFilePathDataConnector "{name}".')

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            default_regex=default_regex,
            sorters=sorters,
            batch_spec_passthrough=batch_spec_passthrough,
        )

    def _refresh_data_references_cache(self):
        """refreshes data_reference cache"""
        # Map data_references to batch_definitions
        self._data_references_cache = {}

        for data_reference in self._get_data_reference_list():
            mapped_batch_definition_list: List[
                BatchDefinition
            ] = self._map_data_reference_to_batch_definition_list(
                data_reference=data_reference, data_asset_name=None
            )
            self._data_references_cache[data_reference] = mapped_batch_definition_list

    def get_data_reference_list_count(self) -> int:
        """
        Returns the list of data_references known by this DataConnector by looping over all data_asset_names in
        _data_references_cache

        Returns:
            number of data_references known by this DataConnector
        """
        return len(self._data_references_cache)

    def get_unmatched_data_references(self) -> List[str]:
        """
        Returns the list of data_references unmatched by configuration by looping through items in _data_references_cache
        and returning data_references that do not have an associated data_asset.

        Returns:
            list of data_references that are not matched by configuration.
        """
        return [k for k, v in self._data_references_cache.items() if v is None]

    def get_available_data_asset_names(self) -> List[str]:
        """
        Return the list of asset names known by this DataConnector

        Returns:
            A list of available names
        """
        if len(self._data_references_cache) == 0:
            self._refresh_data_references_cache()

        # This will fetch ALL batch_definitions in the cache
        batch_definition_list: List[
            BatchDefinition
        ] = self._get_batch_definition_list_from_batch_request(
            batch_request=BatchRequestBase(
                datasource_name=self.datasource_name,
                data_connector_name=self.name,
                data_asset_name="",
            )
        )

        data_asset_names: List[str] = [
            batch_definition.data_asset_name
            for batch_definition in batch_definition_list
        ]

        return list(set(data_asset_names))

    def build_batch_spec(self, batch_definition: BatchDefinition) -> PathBatchSpec:
        """
        Build BatchSpec from batch_definition by calling DataConnector's build_batch_spec function.

        Args:
            batch_definition (BatchDefinition): to be used to build batch_spec

        Returns:
            BatchSpec built from batch_definition
        """
        batch_spec: BatchSpec = super().build_batch_spec(
            batch_definition=batch_definition
        )

        return PathBatchSpec(batch_spec)

    def _get_batch_definition_list_from_cache(self) -> List[BatchDefinition]:
        batch_definition_list: List[BatchDefinition] = [
            batch_definitions[0]
            for batch_definitions in self._data_references_cache.values()
            if batch_definitions is not None
        ]
        return batch_definition_list

    def _get_regex_config(self, data_asset_name: Optional[str] = None) -> dict:
        regex_config: dict = copy.deepcopy(self._default_regex)
        return regex_config
