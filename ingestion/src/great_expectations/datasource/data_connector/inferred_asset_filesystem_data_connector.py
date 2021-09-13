import logging
from pathlib import Path
from typing import List, Optional

from great_expectations.datasource.data_connector.inferred_asset_file_path_data_connector import (
    InferredAssetFilePathDataConnector,
)
from great_expectations.datasource.data_connector.util import (
    get_filesystem_one_level_directory_glob_path_list,
    normalize_directory_path,
)
from great_expectations.execution_engine import ExecutionEngine

logger = logging.getLogger(__name__)


class InferredAssetFilesystemDataConnector(InferredAssetFilePathDataConnector):
    """
    Extension of InferredAssetFilePathDataConnector used to connect to data on a filesystem.

    The InferredAssetFilesystemDataConnector is one of two classes (ConfiguredAssetFilesystemDataConnector being the
    other one) designed for connecting to data on a filesystem. It connects to assets
    inferred from directory and file name by default_regex and glob_directive.

    InferredAssetFilesystemDataConnector that operates on file paths and determines
    the data_asset_name implicitly (e.g., through the combination of the regular expressions pattern and group names)

    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        base_directory: str,
        execution_engine: Optional[ExecutionEngine] = None,
        default_regex: Optional[dict] = None,
        glob_directive: Optional[str] = "*",
        sorters: Optional[list] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        Base class for DataConnectors that connect to filesystem-like data. This class supports the configuration of default_regex
        and sorters for filtering and sorting data_references.

        Args:
            name (str): name of InferredAssetFilesystemDataConnector
            datasource_name (str): Name of datasource that this DataConnector is connected to
            base_directory(str): base_directory for DataConnector to begin reading files
            execution_engine (ExecutionEngine): ExecutionEngine object to actually read the data
            default_regex (dict): Optional dict the filter and organize the data_references.
            sorters (list): Optional list if you want to sort the data_references
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        logger.debug(f'Constructing InferredAssetFilesystemDataConnector "{name}".')

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            default_regex=default_regex,
            sorters=sorters,
            batch_spec_passthrough=batch_spec_passthrough,
        )

        self._base_directory = base_directory
        self._glob_directive = glob_directive

    def _get_data_reference_list(
        self, data_asset_name: Optional[str] = None
    ) -> List[str]:
        """
        List objects in the underlying data store to create a list of data_references.

        This method is used to refresh the cache.
        """
        path_list: List[str] = get_filesystem_one_level_directory_glob_path_list(
            base_directory_path=self.base_directory, glob_directive=self._glob_directive
        )
        return sorted(path_list)

    def _get_full_file_path(
        self, path: str, data_asset_name: Optional[str] = None
    ) -> str:
        # data_asset_name isn't used in this method.
        # It's only kept for compatibility with parent methods.
        return str(Path(self.base_directory).joinpath(path))

    @property
    def base_directory(self):
        """
        Accessor method for base_directory. If directory is a relative path, interpret it as relative to the
        root directory. If it is absolute, then keep as-is.
        """
        return normalize_directory_path(
            dir_path=self._base_directory,
            root_directory_path=self.data_context_root_directory,
        )
