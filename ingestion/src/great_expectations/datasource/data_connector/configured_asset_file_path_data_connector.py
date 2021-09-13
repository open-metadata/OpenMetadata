import logging
from copy import deepcopy
from typing import Dict, List, Optional, Union

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.batch import BatchDefinition
from great_expectations.core.batch_spec import PathBatchSpec
from great_expectations.data_context.types.base import assetConfigSchema
from great_expectations.data_context.util import instantiate_class_from_config
from great_expectations.datasource.data_connector.asset.asset import Asset
from great_expectations.datasource.data_connector.file_path_data_connector import (
    FilePathDataConnector,
)
from great_expectations.execution_engine import ExecutionEngine

logger = logging.getLogger(__name__)


class ConfiguredAssetFilePathDataConnector(FilePathDataConnector):
    """
    The ConfiguredAssetFilePathDataConnector is one of two classes (InferredAssetFilePathDataConnector being the
    other) designed for connecting to filesystem-like data. This includes files on disk, but also things
    like S3 object stores, etc:

    A ConfiguredAssetFilePathDataConnector requires an explicit listing of each DataAsset you want to connect to.
    This allows more fine-tuning, but also requires more setup.

    *Note*: ConfiguredAssetFilePathDataConnector is not meant to be used on its own, but extended. Currently
    ConfiguredAssetFilesystemDataConnector, ConfiguredAssetS3DataConnector, ConfiguredAssetAzureDataConnector, and
    ConfiguredAssetGCSDataConnector are subclasses of ConfiguredAssetFilePathDataConnector.

    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        assets: dict,
        execution_engine: Optional[ExecutionEngine] = None,
        default_regex: Optional[dict] = None,
        sorters: Optional[list] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        Base class for DataConnectors that connect to filesystem-like data by taking in
        configured `assets` as a dictionary. This class supports the configuration of default_regex and
        sorters for filtering and sorting data_references.

        Args:
            name (str): name of ConfiguredAssetFilePathDataConnector
            datasource_name (str): Name of datasource that this DataConnector is connected to
            assets (dict): configured assets as a dictionary. These can each have their own regex and sorters
            execution_engine (ExecutionEngine): Execution Engine object to actually read the data
            default_regex (dict): Optional dict the filter and organize the data_references.
            sorters (list): Optional list if you want to sort the data_references
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        logger.debug(f'Constructing ConfiguredAssetFilePathDataConnector "{name}".')
        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            default_regex=default_regex,
            sorters=sorters,
            batch_spec_passthrough=batch_spec_passthrough,
        )

        if assets is None:
            assets = {}
        _assets: Dict[str, Union[dict, Asset]] = assets
        self._assets = _assets
        self._build_assets_from_config(config=assets)

    @property
    def assets(self) -> Dict[str, Union[dict, Asset]]:
        return self._assets

    def _build_assets_from_config(self, config: Dict[str, dict]):
        for name, asset_config in config.items():
            if asset_config is None:
                asset_config = {}
            asset_config.update({"name": name})
            new_asset: Asset = self._build_asset_from_config(
                config=asset_config,
            )
            self.assets[name] = new_asset

    def _build_asset_from_config(self, config: dict):
        runtime_environment: dict = {"data_connector": self}
        config = assetConfigSchema.load(config)
        config = assetConfigSchema.dump(config)
        asset: Asset = instantiate_class_from_config(
            config=config,
            runtime_environment=runtime_environment,
            config_defaults={},
        )
        if not asset:
            raise ge_exceptions.ClassInstantiationError(
                module_name="great_expectations.datasource.data_connector.asset",
                package_name=None,
                class_name=config["class_name"],
            )
        return asset

    def get_available_data_asset_names(self) -> List[str]:
        """
        Return the list of asset names known by this DataConnector.

        Returns:
            A list of available names
        """
        return list(self.assets.keys())

    def _refresh_data_references_cache(self):

        # Map data_references to batch_definitions
        self._data_references_cache = {}

        for data_asset_name in self.get_available_data_asset_names():
            self._data_references_cache[data_asset_name] = {}

            for data_reference in self._get_data_reference_list(
                data_asset_name=data_asset_name
            ):
                mapped_batch_definition_list: List[
                    BatchDefinition
                ] = self._map_data_reference_to_batch_definition_list(
                    data_reference=data_reference,
                    data_asset_name=data_asset_name,
                )
                self._data_references_cache[data_asset_name][
                    data_reference
                ] = mapped_batch_definition_list

    def _get_data_reference_list(
        self, data_asset_name: Optional[str] = None
    ) -> List[str]:
        """
        List objects in the underlying data store to create a list of data_references.
        This method is used to refresh the cache.
        """
        asset: Optional[Asset] = self._get_asset(data_asset_name=data_asset_name)
        path_list: List[str] = self._get_data_reference_list_for_asset(asset=asset)
        return path_list

    def get_data_reference_list_count(self) -> int:
        """
        Returns the list of data_references known by this DataConnector by looping over all data_asset_names in
        _data_references_cache

        Returns:
            number of data_references known by this DataConnector.
        """
        total_references: int = sum(
            len(self._data_references_cache[data_asset_name])
            for data_asset_name in self._data_references_cache
        )

        return total_references

    def get_unmatched_data_references(self) -> List[str]:
        """
        Returns the list of data_references unmatched by configuration by looping through items in _data_references_cache
        and returning data_reference that do not have an associated data_asset.

        Returns:
            list of data_references that are not matched by configuration.
        """
        unmatched_data_references: List[str] = []
        for (
            data_asset_name,
            data_reference_sub_cache,
        ) in self._data_references_cache.items():
            unmatched_data_references += [
                k for k, v in data_reference_sub_cache.items() if v is None
            ]

        return unmatched_data_references

    def _get_batch_definition_list_from_cache(self) -> List[BatchDefinition]:
        batch_definition_list: List[BatchDefinition] = [
            batch_definitions[0]
            for data_reference_sub_cache in self._data_references_cache.values()
            for batch_definitions in data_reference_sub_cache.values()
            if batch_definitions is not None
        ]
        return batch_definition_list

    def _get_full_file_path(
        self, path: str, data_asset_name: Optional[str] = None
    ) -> str:
        asset: Optional[Asset] = None
        if data_asset_name:
            asset = self._get_asset(data_asset_name=data_asset_name)
        return self._get_full_file_path_for_asset(path=path, asset=asset)

    def _get_regex_config(self, data_asset_name: Optional[str] = None) -> dict:
        regex_config: dict = deepcopy(self._default_regex)
        asset: Optional[Asset] = None
        if data_asset_name:
            asset = self._get_asset(data_asset_name=data_asset_name)
        if asset is not None:
            # Override the defaults
            if asset.pattern:
                regex_config["pattern"] = asset.pattern
            if asset.group_names:
                regex_config["group_names"] = asset.group_names
        return regex_config

    def _get_asset(self, data_asset_name: str) -> Asset:
        asset: Optional[Asset] = None
        if (
            data_asset_name is not None
            and self.assets
            and data_asset_name in self.assets
        ):
            asset = self.assets[data_asset_name]
        return asset

    def _get_data_reference_list_for_asset(self, asset: Optional[Asset]) -> List[str]:
        raise NotImplementedError

    def _get_full_file_path_for_asset(self, path: str, asset: Optional[Asset]) -> str:
        raise NotImplementedError

    def build_batch_spec(self, batch_definition: BatchDefinition) -> PathBatchSpec:
        """
        Build BatchSpec from batch_definition by calling DataConnector's build_batch_spec function.

        Args:
            batch_definition (BatchDefinition): to be used to build batch_spec

        Returns:
            BatchSpec built from batch_definition
        """

        data_asset_name: str = batch_definition.data_asset_name
        if (
            data_asset_name in self.assets
            and self.assets[data_asset_name].batch_spec_passthrough
            and isinstance(self.assets[data_asset_name].batch_spec_passthrough, dict)
        ):
            # batch_spec_passthrough from data_asset
            batch_spec_passthrough = deepcopy(
                self.assets[data_asset_name]["batch_spec_passthrough"]
            )
            batch_definition_batch_spec_passthrough = (
                deepcopy(batch_definition.batch_spec_passthrough) or {}
            )
            # batch_spec_passthrough from Batch Definition supersedes batch_spec_passthrough from data_asset
            batch_spec_passthrough.update(batch_definition_batch_spec_passthrough)
            batch_definition.batch_spec_passthrough = batch_spec_passthrough

        batch_spec: PathBatchSpec = super().build_batch_spec(
            batch_definition=batch_definition
        )

        return batch_spec
