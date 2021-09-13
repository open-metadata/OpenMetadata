from copy import deepcopy
from typing import Dict, List, Optional

from great_expectations.core.batch import (
    BatchDefinition,
    BatchRequest,
    BatchSpec,
    IDDict,
)
from great_expectations.core.batch_spec import SqlAlchemyDatasourceBatchSpec
from great_expectations.datasource.data_connector.data_connector import DataConnector
from great_expectations.datasource.data_connector.util import (
    batch_definition_matches_batch_request,
)
from great_expectations.execution_engine import ExecutionEngine

try:
    import sqlalchemy as sa
except ImportError:
    sa = None


class ConfiguredAssetSqlDataConnector(DataConnector):
    """
    A DataConnector that requires explicit listing of SQL tables you want to connect to.

    Args:
        name (str): The name of this DataConnector
        datasource_name (str): The name of the Datasource that contains it
        execution_engine (ExecutionEngine): An ExecutionEngine
        assets (str): assets
        batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        execution_engine: Optional[ExecutionEngine] = None,
        assets: Optional[Dict[str, dict]] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        if assets is None:
            assets = {}
        self._assets = assets

        super().__init__(
            name=name,
            datasource_name=datasource_name,
            execution_engine=execution_engine,
            batch_spec_passthrough=batch_spec_passthrough,
        )

    @property
    def assets(self) -> Dict[str, dict]:
        return self._assets

    def add_data_asset(
        self,
        name: str,
        config: dict,
    ):
        """
        Add data_asset to DataConnector using data_asset name as key, and data_asset configuration as value.
        """
        self._assets[name] = config

    def _get_batch_identifiers_list_from_data_asset_config(
        self,
        data_asset_name,
        data_asset_config,
    ):
        if "table_name" in data_asset_config:
            table_name = data_asset_config["table_name"]
        else:
            table_name = data_asset_name

        if "splitter_method" in data_asset_config:
            splitter_fn = getattr(self, data_asset_config["splitter_method"])
            split_query = splitter_fn(
                table_name=table_name, **data_asset_config["splitter_kwargs"]
            )

            rows = self._execution_engine.engine.execute(split_query).fetchall()

            # Zip up split parameters with column names
            column_names = self._get_column_names_from_splitter_kwargs(
                data_asset_config["splitter_kwargs"]
            )
            batch_identifiers_list = [dict(zip(column_names, row)) for row in rows]

        else:
            batch_identifiers_list = [{}]

        return batch_identifiers_list

    def _refresh_data_references_cache(self):
        self._data_references_cache = {}

        for data_asset_name in self.assets:
            data_asset = self.assets[data_asset_name]
            batch_identifiers_list = (
                self._get_batch_identifiers_list_from_data_asset_config(
                    data_asset_name,
                    data_asset,
                )
            )

            # TODO Abe 20201029 : Apply sorters to batch_identifiers_list here
            # TODO Will 20201102 : add sorting code here
            self._data_references_cache[data_asset_name] = batch_identifiers_list

    def _get_column_names_from_splitter_kwargs(self, splitter_kwargs) -> List[str]:
        column_names: List[str] = []

        if "column_names" in splitter_kwargs:
            column_names = splitter_kwargs["column_names"]
        elif "column_name" in splitter_kwargs:
            column_names = [splitter_kwargs["column_name"]]

        return column_names

    def get_available_data_asset_names(self) -> List[str]:
        """
        Return the list of asset names known by this DataConnector.

        Returns:
            A list of available names
        """
        return list(self.assets.keys())

    def get_unmatched_data_references(self) -> List[str]:
        """
        Returns the list of data_references unmatched by configuration by looping through items in _data_references_cache
        and returning data_reference that do not have an associated data_asset.

        Returns:
            list of data_references that are not matched by configuration.
        """
        return []

    def get_batch_definition_list_from_batch_request(self, batch_request: BatchRequest):
        self._validate_batch_request(batch_request=batch_request)

        if len(self._data_references_cache) == 0:
            self._refresh_data_references_cache()

        batch_definition_list: List[BatchDefinition] = []
        try:
            sub_cache = self._data_references_cache[batch_request.data_asset_name]
        except KeyError as e:
            raise KeyError(
                f"data_asset_name {batch_request.data_asset_name} is not recognized."
            )

        for batch_identifiers in sub_cache:
            batch_definition: BatchDefinition = BatchDefinition(
                datasource_name=self.datasource_name,
                data_connector_name=self.name,
                data_asset_name=batch_request.data_asset_name,
                batch_identifiers=IDDict(batch_identifiers),
                batch_spec_passthrough=batch_request.batch_spec_passthrough,
            )
            if batch_definition_matches_batch_request(batch_definition, batch_request):
                batch_definition_list.append(batch_definition)

        return batch_definition_list

    def _get_data_reference_list_from_cache_by_data_asset_name(
        self, data_asset_name: str
    ) -> List[str]:
        return self._data_references_cache[data_asset_name]

    def _map_data_reference_to_batch_definition_list(
        self, data_reference, data_asset_name: Optional[str] = None  #: Any,
    ) -> Optional[List[BatchDefinition]]:
        # Note: This is a bit hacky, but it works. In sql_data_connectors, data references *are* dictionaries,
        # allowing us to invoke `IDDict(data_reference)`
        return [
            BatchDefinition(
                datasource_name=self.datasource_name,
                data_connector_name=self.name,
                data_asset_name=data_asset_name,
                batch_identifiers=IDDict(data_reference),
            )
        ]

    def build_batch_spec(
        self, batch_definition: BatchDefinition
    ) -> SqlAlchemyDatasourceBatchSpec:
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
            and self.assets[data_asset_name].get("batch_spec_passthrough")
            and isinstance(
                self.assets[data_asset_name].get("batch_spec_passthrough"), dict
            )
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

        batch_spec: BatchSpec = super().build_batch_spec(
            batch_definition=batch_definition
        )

        return SqlAlchemyDatasourceBatchSpec(batch_spec)

    def _generate_batch_spec_parameters_from_batch_definition(
        self, batch_definition: BatchDefinition
    ) -> dict:
        """
        Build BatchSpec parameters from batch_definition with the following components:
            1. data_asset_name from batch_definition
            2. batch_identifiers from batch_definition
            3. data_asset from data_connector

        Args:
            batch_definition (BatchDefinition): to be used to build batch_spec

        Returns:
            dict built from batch_definition
        """
        data_asset_name: str = batch_definition.data_asset_name
        return {
            "data_asset_name": data_asset_name,
            "table_name": data_asset_name,
            "batch_identifiers": batch_definition.batch_identifiers,
            **self.assets[data_asset_name],
        }

    # Splitter methods for listing partitions

    def _split_on_whole_table(
        self,
        table_name: str,
    ):
        """
        'Split' by returning the whole table

        Note: the table_name parameter is a required to keep the signature of this method consistent with other methods.
        """

        return sa.select([sa.true()])

    def _split_on_column_value(
        self,
        table_name: str,
        column_name: str,
    ):
        """Split using the values in the named column"""
        # query = f"SELECT DISTINCT(\"{self.column_name}\") FROM {self.table_name}"

        return sa.select([sa.func.distinct(sa.column(column_name))]).select_from(
            sa.text(table_name)
        )

    def _split_on_converted_datetime(
        self,
        table_name: str,
        column_name: str,
        date_format_string: str = "%Y-%m-%d",
    ):
        """Convert the values in the named column to the given date_format, and split on that"""
        # query = f"SELECT DISTINCT( strftime(\"{date_format_string}\", \"{self.column_name}\")) as my_var FROM {self.table_name}"

        return sa.select(
            [
                sa.func.distinct(
                    sa.func.strftime(
                        date_format_string,
                        sa.column(column_name),
                    )
                )
            ]
        ).select_from(sa.text(table_name))

    def _split_on_divided_integer(
        self, table_name: str, column_name: str, divisor: int
    ):
        """Divide the values in the named column by `divisor`, and split on that"""
        # query = f"SELECT DISTINCT(\"{self.column_name}\" / {divisor}) AS my_var FROM {self.table_name}"

        return sa.select(
            [sa.func.distinct(sa.cast(sa.column(column_name) / divisor, sa.Integer))]
        ).select_from(sa.text(table_name))

    def _split_on_mod_integer(self, table_name: str, column_name: str, mod: int):
        """Divide the values in the named column by `divisor`, and split on that"""
        # query = f"SELECT DISTINCT(\"{self.column_name}\" / {divisor}) AS my_var FROM {self.table_name}"

        return sa.select(
            [sa.func.distinct(sa.cast(sa.column(column_name) % mod, sa.Integer))]
        ).select_from(sa.text(table_name))

    def _split_on_multi_column_values(
        self,
        table_name: str,
        column_names: List[str],
    ):
        """Split on the joint values in the named columns"""
        # query = f"SELECT DISTINCT(\"{self.column_name}\") FROM {self.table_name}"

        return (
            sa.select([sa.column(column_name) for column_name in column_names])
            .distinct()
            .select_from(sa.text(table_name))
        )

    def _split_on_hashed_column(
        self,
        table_name: str,
        column_name: str,
        hash_digits: int,
    ):
        """Note: this method is experimental. It does not work with all SQL dialects."""
        # query = f"SELECT MD5(\"{self.column_name}\") = {matching_hash}) AS hashed_var FROM {self.table_name}"

        return sa.select([sa.func.md5(sa.column(column_name))]).select_from(
            sa.text(table_name)
        )
