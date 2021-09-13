import logging
from copy import deepcopy
from typing import Any, List, Optional, Tuple

from great_expectations.core.batch import BatchDefinition, BatchMarkers, BatchRequest
from great_expectations.core.id_dict import BatchSpec
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.validator.validation_graph import MetricConfiguration
from great_expectations.validator.validator import Validator

logger = logging.getLogger(__name__)


class DataConnector:
    """
    DataConnectors produce identifying information, called "batch_spec" that ExecutionEngines
    can use to get individual batches of data. They add flexibility in how to obtain data
    such as with time-based partitioning, downsampling, or other techniques appropriate
    for the Datasource.

    For example, a DataConnector could produce a SQL query that logically represents "rows in
    the Events table with a timestamp on February 7, 2012," which a SqlAlchemyDatasource
    could use to materialize a SqlAlchemyDataset corresponding to that batch of data and
    ready for validation.

    A batch is a sample from a data asset, sliced according to a particular rule. For
    example, an hourly slide of the Events table or “most recent `users` records.”

    A Batch is the primary unit of validation in the Great Expectations DataContext.
    Batches include metadata that identifies how they were constructed--the same “batch_spec”
    assembled by the data connector, While not every Datasource will enable re-fetching a
    specific batch of data, GE can store snapshots of batches or store metadata from an
    external data version control system.
    """

    def __init__(
        self,
        name: str,
        datasource_name: str,
        execution_engine: Optional[ExecutionEngine] = None,
        batch_spec_passthrough: Optional[dict] = None,
    ):
        """
        Base class for DataConnectors

        Args:
            name (str): required name for DataConnector
            datasource_name (str): required name for datasource
            execution_engine (ExecutionEngine): optional reference to ExecutionEngine
            batch_spec_passthrough (dict): dictionary with keys that will be added directly to batch_spec
        """
        self._name = name
        self._datasource_name = datasource_name
        self._execution_engine = execution_engine

        # This is a dictionary which maps data_references onto batch_requests.
        self._data_references_cache = {}

        self._data_context_root_directory = None
        self._batch_spec_passthrough = batch_spec_passthrough or {}

    @property
    def batch_spec_passthrough(self) -> dict:
        return self._batch_spec_passthrough

    @property
    def name(self) -> str:
        return self._name

    @property
    def datasource_name(self) -> str:
        return self._datasource_name

    @property
    def execution_engine(self) -> ExecutionEngine:
        return self._execution_engine

    @property
    def data_context_root_directory(self) -> str:
        return self._data_context_root_directory

    @data_context_root_directory.setter
    def data_context_root_directory(self, data_context_root_directory: str):
        self._data_context_root_directory = data_context_root_directory

    def get_batch_data_and_metadata(
        self,
        batch_definition: BatchDefinition,
    ) -> Tuple[Any, BatchSpec, BatchMarkers,]:  # batch_data
        """
        Uses batch_definition to retrieve batch_data and batch_markers by building a batch_spec from batch_definition,
        then using execution_engine to return batch_data and batch_markers

        Args:
            batch_definition (BatchDefinition): required batch_definition parameter for retrieval

        """
        batch_spec: BatchSpec = self.build_batch_spec(batch_definition=batch_definition)
        batch_data, batch_markers = self._execution_engine.get_batch_data_and_markers(
            batch_spec=batch_spec
        )
        self._execution_engine.load_batch_data(batch_definition.id, batch_data)
        return (
            batch_data,
            batch_spec,
            batch_markers,
        )

    # TODO: <Alex>9/2/2021: batch_definition->batch_spec translation should move to corresponding ExecutionEngine</Alex>
    def build_batch_spec(self, batch_definition: BatchDefinition) -> BatchSpec:
        """
        Builds batch_spec from batch_definition by generating batch_spec params and adding any pass_through params

        Args:
            batch_definition (BatchDefinition): required batch_definition parameter for retrieval
        Returns:
            BatchSpec object built from BatchDefinition

        """
        batch_spec_params: dict = (
            self._generate_batch_spec_parameters_from_batch_definition(
                batch_definition=batch_definition
            )
        )
        # batch_spec_passthrough via Data Connector config
        batch_spec_passthrough: dict = deepcopy(self.batch_spec_passthrough)

        # batch_spec_passthrough from batch_definition supersedes batch_spec_passthrough from Data Connector config
        if isinstance(batch_definition.batch_spec_passthrough, dict):
            batch_spec_passthrough.update(batch_definition.batch_spec_passthrough)

        batch_spec_params.update(batch_spec_passthrough)
        batch_spec: BatchSpec = BatchSpec(**batch_spec_params)
        return batch_spec

    def _refresh_data_references_cache(
        self,
    ):
        raise NotImplementedError

    def _get_data_reference_list(
        self, data_asset_name: Optional[str] = None
    ) -> List[str]:
        """
        List objects in the underlying data store to create a list of data_references.
        This method is used to refresh the cache by classes that extend this base DataConnector class

        Args:
            data_asset_name (str): optional data_asset_name to retrieve more specific results

        """
        raise NotImplementedError

    def _get_data_reference_list_from_cache_by_data_asset_name(
        self, data_asset_name: str
    ) -> List[Any]:
        """
        Fetch data_references corresponding to data_asset_name from the cache.
        """
        raise NotImplementedError

    def get_data_reference_list_count(self) -> int:
        raise NotImplementedError

    def get_unmatched_data_references(self) -> List[Any]:
        raise NotImplementedError

    def get_available_data_asset_names(self) -> List[str]:
        """Return the list of asset names known by this data connector.

        Returns:
            A list of available names
        """
        raise NotImplementedError

    def get_batch_definition_list_from_batch_request(
        self,
        batch_request: BatchRequest,
    ) -> List[BatchDefinition]:
        raise NotImplementedError

    def _map_data_reference_to_batch_definition_list(
        self, data_reference: Any, data_asset_name: Optional[str] = None
    ) -> Optional[List[BatchDefinition]]:
        raise NotImplementedError

    def _map_batch_definition_to_data_reference(
        self, batch_definition: BatchDefinition
    ) -> Any:
        raise NotImplementedError

    def _generate_batch_spec_parameters_from_batch_definition(
        self, batch_definition: BatchDefinition
    ) -> dict:
        raise NotImplementedError

    def self_check(self, pretty_print=True, max_examples=3):
        """
        Checks the configuration of the current DataConnector by doing the following :

        1. refresh or create data_reference_cache
        2. print batch_definition_count and example_data_references for each data_asset_names
        3. also print unmatched data_references, and allow the user to modify the regex or glob configuration if necessary
        4. select a random data_reference and attempt to retrieve and print the first few rows to user

        When used as part of the test_yaml_config() workflow, the user will be able to know if the data_connector is properly configured,
        and if the associated execution_engine can properly retrieve data using the configuration.

        Args:
            pretty_print (bool): should the output be printed?
            max_examples (int): how many data_references should be printed?

        Returns:
            report_obj (dict): dictionary containing self_check output

        """
        if len(self._data_references_cache) == 0:
            self._refresh_data_references_cache()

        if pretty_print:
            print("\t" + self.name, ":", self.__class__.__name__)
            print()

        asset_names = self.get_available_data_asset_names()
        asset_names.sort()
        len_asset_names = len(asset_names)

        report_obj = {
            "class_name": self.__class__.__name__,
            "data_asset_count": len_asset_names,
            "example_data_asset_names": asset_names[:max_examples],
            "data_assets": {}
            # "data_reference_count": self.
        }

        if pretty_print:
            print(
                f"\tAvailable data_asset_names ({min(len_asset_names, max_examples)} of {len_asset_names}):"
            )

        for asset_name in asset_names[:max_examples]:
            data_reference_list = (
                self._get_data_reference_list_from_cache_by_data_asset_name(
                    data_asset_name=asset_name
                )
            )
            len_batch_definition_list = len(data_reference_list)
            example_data_references = data_reference_list[:max_examples]

            if pretty_print:
                print(
                    f"\t\t{asset_name} ({min(len_batch_definition_list, max_examples)} of {len_batch_definition_list}):",
                    example_data_references,
                )

            report_obj["data_assets"][asset_name] = {
                "batch_definition_count": len_batch_definition_list,
                "example_data_references": example_data_references,
            }

        unmatched_data_references = self.get_unmatched_data_references()
        len_unmatched_data_references = len(unmatched_data_references)
        if pretty_print:
            print(
                f"\n\tUnmatched data_references ({min(len_unmatched_data_references, max_examples)} of {len_unmatched_data_references}):{unmatched_data_references[:max_examples]}\n"
            )

        report_obj["unmatched_data_reference_count"] = len_unmatched_data_references
        report_obj["example_unmatched_data_references"] = unmatched_data_references[
            :max_examples
        ]

        # FIXME: (Sam) Removing this temporarily since it's not supported by
        # some backends (e.g. BigQuery) and returns empty results for some
        # (e.g. MSSQL) - this needs some more work to be useful for all backends
        #
        # # Choose an example data_reference
        # if pretty_print:
        #     print("\n\tChoosing an example data reference...")
        #
        # example_data_reference = None
        #
        # available_references = report_obj["data_assets"].items()
        # if len(available_references) == 0:
        #     if pretty_print:
        #         print(f"\t\tNo references available.")
        #     return report_obj
        #
        # data_asset_name: Optional[str] = None
        # for tmp_data_asset_name, data_asset_return_obj in available_references:
        #     if data_asset_return_obj["batch_definition_count"] > 0:
        #         example_data_reference = random.choice(
        #             data_asset_return_obj["example_data_references"]
        #         )
        #         data_asset_name = tmp_data_asset_name
        #         break
        #
        # if example_data_reference is not None:
        #     if pretty_print:
        #         print(f"\t\tReference chosen: {example_data_reference}")
        #
        #     # ...and fetch it.
        #     if data_asset_name is None:
        #         raise ValueError(
        #             "The data_asset_name for the chosen example data reference cannot be null."
        #         )
        #     report_obj["example_data_reference"] = self._self_check_fetch_batch(
        #         pretty_print=pretty_print,
        #         example_data_reference=example_data_reference,
        #         data_asset_name=data_asset_name,
        #     )
        # else:
        #     report_obj["example_data_reference"] = {}

        return report_obj

    def _self_check_fetch_batch(
        self,
        pretty_print: bool,
        example_data_reference: Any,
        data_asset_name: str,
    ):
        """
        Helper function for self_check() to retrieve batch using example_data_reference and data_asset_name,
        all while printing helpful messages. First 5 rows of batch_data are printed by default.

        Args:
            pretty_print (bool): print to console?
            example_data_reference (Any): data_reference to retrieve
            data_asset_name (str): data_asset_name to retrieve

        """
        if pretty_print:
            print(f"\n\t\tFetching batch data...")

        batch_definition_list: List[
            BatchDefinition
        ] = self._map_data_reference_to_batch_definition_list(
            data_reference=example_data_reference,
            data_asset_name=data_asset_name,
        )
        assert len(batch_definition_list) == 1
        batch_definition: BatchDefinition = batch_definition_list[0]

        # _execution_engine might be None for some tests
        if batch_definition is None or self._execution_engine is None:
            return {}

        batch_data: Any
        batch_spec: BatchSpec
        batch_data, batch_spec, _ = self.get_batch_data_and_metadata(
            batch_definition=batch_definition
        )

        # Note: get_batch_data_and_metadata will have loaded the data into the currently-defined execution engine.
        # Consequently, when we build a Validator, we do not need to specifically load the batch into it to
        # resolve metrics.
        validator: Validator = Validator(execution_engine=batch_data.execution_engine)
        data: Any = validator.get_metric(
            metric=MetricConfiguration(
                metric_name="table.head",
                metric_domain_kwargs={
                    "batch_id": batch_definition.id,
                },
                metric_value_kwargs={
                    "n_rows": 5,
                },
            )
        )
        n_rows: int = validator.get_metric(
            metric=MetricConfiguration(
                metric_name="table.row_count",
                metric_domain_kwargs={
                    "batch_id": batch_definition.id,
                },
            )
        )

        if pretty_print and data is not None:
            print(f"\n\t\tShowing 5 rows")
            print(data)

        return {
            "batch_spec": batch_spec,
            "n_rows": n_rows,
        }

    def _validate_batch_request(self, batch_request: BatchRequest):
        """
        Validate batch_request by checking:
            1. if configured datasource_name matches batch_request's datasource_name
            2. if current data_connector_name matches batch_request's data_connector_name
        Args:
            batch_request (BatchRequest): batch_request to validate

        """
        if batch_request.datasource_name != self.datasource_name:
            raise ValueError(
                f"""datasource_name in BatchRequest: "{batch_request.datasource_name}" does not match DataConnector datasource_name: "{self.datasource_name}"."""
            )
        if batch_request.data_connector_name != self.name:
            raise ValueError(
                f"""data_connector_name in BatchRequest: "{batch_request.data_connector_name}" does not match DataConnector name: "{self.name}"."""
            )
