import logging
from pathlib import Path
from typing import List, Optional

from great_expectations.datasource.data_connector.asset import Asset
from great_expectations.datasource.data_connector.configured_asset_file_path_data_connector import (
    ConfiguredAssetFilePathDataConnector,
)
from great_expectations.datasource.data_connector.util import (
    get_filesystem_one_level_directory_glob_path_list,
    normalize_directory_path,
)
from great_expectations.execution_engine import ExecutionEngine

logger = logging.getLogger(__name__)


class ConfiguredAssetFilesystemDataConnector(ConfiguredAssetFilePathDataConnector):
    """
    Extension of ConfiguredAssetFilePathDataConnector used to connect to Filesystem

    The ConfiguredAssetFilesystemDataConnector is one of two classes (InferredAssetFilesystemDataConnector being the
    other one) designed for connecting to data on a filesystem. It connects to assets
    defined by the `assets` configuration.

    A ConfiguredAssetFilesystemDataConnector requires an explicit listing of each DataAsset you want to connect to.
    This allows more fine-tuning, but also requires more setup.
    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        base_directory: str,
        assets: dict,
        execution_engine: Optional[ExecutionEngine] = None,
        default_regex: Optional[dict] = None,
        glob_directive: str = "**/*",
        sorters: Optional[list] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        Base class for DataConnectors that connect to data on a filesystem. This class supports the configuration of default_regex
        and sorters for filtering and sorting data_references. It takes in configured `assets` as a dictionary.

        Args:
            name (str): name of ConfiguredAssetFilesystemDataConnector
            datasource_name (str): Name of datasource that this DataConnector is connected to
            assets (dict): configured assets as a dictionary. These can each have their own regex and sorters
            execution_engine (ExecutionEngine): ExecutionEngine object to actually read the data
            default_regex (dict): Optional dict the filter and organize the data_references.
            glob_directive (str): glob for selecting files in directory (defaults to *)
            sorters (list): Optional list if you want to sort the data_references
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec

        """
        logger.debug(f'Constructing ConfiguredAssetFilesystemDataConnector "{name}".')

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            assets=assets,
            execution_engine=execution_engine,
            default_regex=default_regex,
            sorters=sorters,
            batch_spec_passthrough=batch_spec_passthrough,
        )

        self._base_directory = base_directory
        self._glob_directive = glob_directive

    def _get_data_reference_list_for_asset(self, asset: Optional[Asset]) -> List[str]:
        base_directory: str = self.base_directory
        glob_directive: str = self._glob_directive

        if asset is not None:
            if asset.base_directory:
                base_directory = normalize_directory_path(
                    dir_path=asset.base_directory, root_directory_path=base_directory
                )
            if asset.glob_directive:
                glob_directive = asset.glob_directive

        path_list: List[str] = get_filesystem_one_level_directory_glob_path_list(
            base_directory_path=base_directory, glob_directive=glob_directive
        )

        return sorted(path_list)

    def _get_full_file_path_for_asset(
        self, path: str, asset: Optional[Asset] = None
    ) -> str:
        base_directory: str = self.base_directory
        if asset is not None:
            if asset.base_directory:
                base_directory = normalize_directory_path(
                    dir_path=asset.base_directory,
                    root_directory_path=base_directory,
                )
        return str(Path(base_directory).joinpath(path))

    @property
    def base_directory(self) -> str:
        """
        Accessor method for base_directory. If directory is a relative path, interpret it as relative to the
        root directory. If it is absolute, then keep as-is.
        """
        return normalize_directory_path(
            dir_path=self._base_directory,
            root_directory_path=self.data_context_root_directory,
        )
