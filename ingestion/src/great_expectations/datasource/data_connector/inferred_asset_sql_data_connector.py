from typing import Dict, List, Optional

from great_expectations.datasource.data_connector.asset import Asset
from great_expectations.datasource.data_connector.configured_asset_sql_data_connector import (
    ConfiguredAssetSqlDataConnector,
)
from great_expectations.execution_engine import ExecutionEngine

try:
    import sqlalchemy as sa
    from sqlalchemy.exc import OperationalError
except ImportError:
    sa = None


class InferredAssetSqlDataConnector(ConfiguredAssetSqlDataConnector):
    """
    A DataConnector that infers data_asset names by introspecting a SQL database
    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        execution_engine: Optional[ExecutionEngine] = None,
        data_asset_name_prefix: Optional[str] = "",
        data_asset_name_suffix: Optional[str] = "",
        include_schema_name: Optional[bool] = False,
        splitter_method: Optional[str] = None,
        splitter_kwargs: Optional[dict] = None,
        sampling_method: Optional[str] = None,
        sampling_kwargs: Optional[dict] = None,
        excluded_tables: Optional[list] = None,
        included_tables: Optional[list] = None,
        skip_inapplicable_tables: Optional[bool] = True,
        introspection_directives: Optional[dict] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        InferredAssetDataConnector for connecting to data on a SQL database

        Args:
            name (str): The name of this DataConnector
            datasource_name (str): The name of the Datasource that contains it
            execution_engine (ExecutionEngine): An ExecutionEngine
            data_asset_name_prefix (str): An optional prefix to prepend to inferred data_asset_names
            data_asset_name_suffix (str): An optional suffix to append to inferred data_asset_names
            include_schema_name (bool): Should the data_asset_name include the schema as a prefix?
            splitter_method (str): A method to split the target table into multiple Batches
            splitter_kwargs (dict): Keyword arguments to pass to splitter_method
            sampling_method (str): A method to downsample within a target Batch
            sampling_kwargs (dict): Keyword arguments to pass to sampling_method
            excluded_tables (List): A list of tables to ignore when inferring data asset_names
            included_tables (List): If not None, only include tables in this list when inferring data asset_names
            skip_inapplicable_tables (bool):
                If True, tables that can't be successfully queried using sampling and splitter methods are excluded from inferred data_asset_names.
                If False, the class will throw an error during initialization if any such tables are encountered.
            introspection_directives (Dict): Arguments passed to the introspection method to guide introspection
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        self._data_asset_name_prefix = data_asset_name_prefix
        self._data_asset_name_suffix = data_asset_name_suffix
        self._include_schema_name = include_schema_name
        self._splitter_method = splitter_method
        self._splitter_kwargs = splitter_kwargs
        self._sampling_method = sampling_method
        self._sampling_kwargs = sampling_kwargs
        self._excluded_tables = excluded_tables
        self._included_tables = included_tables
        self._skip_inapplicable_tables = skip_inapplicable_tables

        self._introspection_directives = introspection_directives or {}

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            assets=None,
            batch_spec_passthrough=batch_spec_passthrough,
        )

        # This cache will contain a "config" for each data_asset discovered via introspection.
        # This approach ensures that ConfiguredAssetSqlDataConnector._assets and _introspected_assets_cache store objects of the same "type"
        # Note: We should probably turn them into AssetConfig objects
        self._introspected_assets_cache = {}
        self._refresh_introspected_assets_cache(
            self._data_asset_name_prefix,
            self._data_asset_name_suffix,
            self._include_schema_name,
            self._splitter_method,
            self._splitter_kwargs,
            self._sampling_method,
            self._sampling_kwargs,
            self._excluded_tables,
            self._included_tables,
            self._skip_inapplicable_tables,
        )

    @property
    def assets(self) -> Dict[str, Asset]:
        return self._introspected_assets_cache

    def _refresh_data_references_cache(self):
        self._refresh_introspected_assets_cache(
            self._data_asset_name_prefix,
            self._data_asset_name_suffix,
            self._include_schema_name,
            self._splitter_method,
            self._splitter_kwargs,
            self._sampling_method,
            self._sampling_kwargs,
            self._excluded_tables,
            self._included_tables,
            self._skip_inapplicable_tables,
        )

        super()._refresh_data_references_cache()

    def _refresh_introspected_assets_cache(
        self,
        data_asset_name_prefix: str = None,
        data_asset_name_suffix: str = None,
        include_schema_name: bool = False,
        splitter_method: str = None,
        splitter_kwargs: dict = None,
        sampling_method: str = None,
        sampling_kwargs: dict = None,
        excluded_tables: List = None,
        included_tables: List = None,
        skip_inapplicable_tables: bool = True,
    ):
        introspected_table_metadata = self._introspect_db(
            **self._introspection_directives
        )
        for metadata in introspected_table_metadata:
            if (excluded_tables is not None) and (
                metadata["schema_name"] + "." + metadata["table_name"]
                in excluded_tables
            ):
                continue

            if (included_tables is not None) and (
                metadata["schema_name"] + "." + metadata["table_name"]
                not in included_tables
            ):
                continue

            if include_schema_name:
                data_asset_name = (
                    data_asset_name_prefix
                    + metadata["schema_name"]
                    + "."
                    + metadata["table_name"]
                    + data_asset_name_suffix
                )
            else:
                data_asset_name = (
                    data_asset_name_prefix
                    + metadata["table_name"]
                    + data_asset_name_suffix
                )

            data_asset_config = {
                "schema_name": metadata["schema_name"],
                "table_name": metadata["table_name"],
            }
            if not splitter_method is None:
                data_asset_config["splitter_method"] = splitter_method
            if not splitter_kwargs is None:
                data_asset_config["splitter_kwargs"] = splitter_kwargs
            if not sampling_method is None:
                data_asset_config["sampling_method"] = sampling_method
            if not sampling_kwargs is None:
                data_asset_config["sampling_kwargs"] = sampling_kwargs

            # Attempt to fetch a list of batch_identifiers from the table
            try:
                self._get_batch_identifiers_list_from_data_asset_config(
                    data_asset_name,
                    data_asset_config,
                )
            except OperationalError as e:
                # If it doesn't work, then...
                if skip_inapplicable_tables:
                    # No harm done. Just don't include this table in the list of assets.
                    continue

                else:
                    # We're being strict. Crash now.
                    raise ValueError(
                        f"Couldn't execute a query against table {metadata['table_name']} in schema {metadata['schema_name']}"
                    ) from e

            # Store an asset config for each introspected data asset.
            self._introspected_assets_cache[data_asset_name] = data_asset_config

    def _introspect_db(
        self,
        schema_name: str = None,
        ignore_information_schemas_and_system_tables: bool = True,
        information_schemas: List[str] = [
            "INFORMATION_SCHEMA",  # snowflake, mssql, mysql, oracle
            "information_schema",  # postgres, redshift, mysql
            "performance_schema",  # mysql
            "sys",  # mysql
            "mysql",  # mysql
        ],
        system_tables: List[str] = ["sqlite_master"],  # sqlite
        include_views=True,
    ):
        engine = self._execution_engine.engine
        inspector = sa.inspect(engine)

        selected_schema_name = schema_name

        tables = []
        for schema_name in inspector.get_schema_names():
            if (
                ignore_information_schemas_and_system_tables
                and schema_name in information_schemas
            ):
                continue

            if selected_schema_name is not None and schema_name != selected_schema_name:
                continue

            for table_name in inspector.get_table_names(schema=schema_name):

                if (ignore_information_schemas_and_system_tables) and (
                    table_name in system_tables
                ):
                    continue

                tables.append(
                    {
                        "schema_name": schema_name,
                        "table_name": table_name,
                        "type": "table",
                    }
                )

            # Note Abe 20201112: This logic is currently untested.
            if include_views:
                # Note: this is not implemented for bigquery
                try:
                    view_names = inspector.get_view_names(schema=schema_name)
                except NotImplementedError:
                    # Not implemented by Athena dialect
                    pass
                else:
                    for view_name in view_names:

                        if ignore_information_schemas_and_system_tables and (
                            view_name in system_tables
                        ):
                            continue

                        tables.append(
                            {
                                "schema_name": schema_name,
                                "table_name": view_name,
                                "type": "view",
                            }
                        )

        return tables
