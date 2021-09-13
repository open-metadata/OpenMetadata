import copy
import datetime
import inspect
import json
import logging
import traceback
import warnings
from collections import defaultdict, namedtuple
from collections.abc import Hashable
from typing import Any, Dict, Iterable, List, Optional, Set

import pandas as pd
from dateutil.parser import parse
from tqdm.auto import tqdm

from great_expectations import __version__ as ge_version
from great_expectations.core.batch import Batch
from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.core.expectation_suite import (
    ExpectationSuite,
    expectationSuiteSchema,
)
from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
    ExpectationValidationResult,
)
from great_expectations.core.id_dict import BatchSpec
from great_expectations.core.run_identifier import RunIdentifier
from great_expectations.data_asset.util import recursively_convert_to_json_serializable
from great_expectations.dataset import PandasDataset, SparkDFDataset, SqlAlchemyDataset
from great_expectations.dataset.sqlalchemy_dataset import SqlAlchemyBatchReference
from great_expectations.exceptions import (
    GreatExpectationsError,
    InvalidExpectationConfigurationError,
)
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.execution_engine.pandas_batch_data import PandasBatchData
from great_expectations.expectations.registry import (
    get_expectation_impl,
    get_metric_provider,
    list_registered_expectation_implementations,
)
from great_expectations.marshmallow__shade import ValidationError
from great_expectations.types import ClassConfig
from great_expectations.util import load_class, verify_dynamic_loading_support
from great_expectations.validator.validation_graph import (
    MetricConfiguration,
    MetricEdge,
    ValidationGraph,
)

logger = logging.getLogger(__name__)
logging.captureWarnings(True)


class Validator:
    def __init__(
        self,
        execution_engine,
        interactive_evaluation=True,
        expectation_suite=None,
        expectation_suite_name=None,
        data_context=None,
        batches=None,
        **kwargs,
    ):
        """
        Initialize the DataAsset.

        :param profiler (profiler class) = None: The profiler that should be run on the data_asset to
            build a baseline expectation suite.

        Note: DataAsset is designed to support multiple inheritance (e.g. PandasDataset inherits from both a
        Pandas DataFrame and Dataset which inherits from DataAsset), so it accepts generic *args and **kwargs arguments
        so that they can also be passed to other parent classes. In python 2, there isn't a clean way to include all of
        *args, **kwargs, and a named kwarg...so we use the inelegant solution of popping from kwargs, leaving the
        support for the profiler parameter not obvious from the signature.

        """

        self._data_context = data_context
        self._execution_engine = execution_engine
        self._expose_dataframe_methods = False
        self._validator_config = {}

        if batches is None:
            batches = tuple()

        self._batches = {}
        self.load_batch_list(batches)

        if len(batches) > 1:
            logger.debug(
                f"{len(batches)} batches will be added to this Validator. The batch_identifiers for the active "
                f"batch are {self.active_batch.batch_definition['batch_identifiers'].items()}"
            )

        self.interactive_evaluation = interactive_evaluation
        self._initialize_expectations(
            expectation_suite=expectation_suite,
            expectation_suite_name=expectation_suite_name,
        )
        self._default_expectation_args = {
            "include_config": True,
            "catch_exceptions": False,
            "result_format": "BASIC",
        }
        self._validator_config = {}

        # This special state variable tracks whether a validation run is going on, which will disable
        # saving expectation config objects
        self._active_validation = False
        if self._data_context and hasattr(
            self._data_context, "_expectation_explorer_manager"
        ):
            # TODO: verify flow of default expectation arguments
            self.set_default_expectation_argument("include_config", True)

    def __dir__(self):
        """
        This custom magic method is used to enable expectation tab completion on Validator objects.
        It also allows users to call Pandas.DataFrame methods on Validator objects
        """
        validator_attrs = set(super().__dir__())
        class_expectation_impls = set(list_registered_expectation_implementations())
        # execution_engine_expectation_impls = (
        #     {
        #         attr_name
        #         for attr_name in self.execution_engine.__dir__()
        #         if attr_name.startswith("expect_")
        #     }
        #     if self.execution_engine
        #     else set()
        # )

        combined_dir = (
            validator_attrs
            | class_expectation_impls
            # | execution_engine_expectation_impls
        )

        if self._expose_dataframe_methods:
            combined_dir | set(dir(pd.DataFrame))

        return list(combined_dir)

    @property
    def expose_dataframe_methods(self):
        return self._expose_dataframe_methods

    @expose_dataframe_methods.setter
    def expose_dataframe_methods(self, value: bool):
        self._expose_dataframe_methods = value

    def __getattr__(self, name):
        name = name.lower()
        if name.startswith("expect_") and get_expectation_impl(name):
            return self.validate_expectation(name)
        elif (
            self._expose_dataframe_methods
            and isinstance(self.active_batch.data, PandasBatchData)
            and hasattr(pd.DataFrame, name)
        ):
            return getattr(self.active_batch.data.dataframe, name)
        else:
            raise AttributeError(
                f"'{type(self).__name__}'  object has no attribute '{name}'"
            )

    def validate_expectation(self, name):
        """
        Given the name of an Expectation, obtains the Class-first Expectation implementation and utilizes the expectation's
                validate method to obtain a validation result. Also adds in the runtime configuration

                        Args:
                            name (str): The name of the Expectation being validated

                        Returns:
                            The Expectation's validation result
        """

        def inst_expectation(*args, **kwargs):
            try:
                expectation_impl = get_expectation_impl(name)
                allowed_config_keys = expectation_impl.get_allowed_config_keys()
                expectation_kwargs = recursively_convert_to_json_serializable(kwargs)
                meta = None
                # This section uses Expectation class' legacy_method_parameters attribute to maintain support for passing
                # positional arguments to expectation methods
                legacy_arg_names = expectation_impl.legacy_method_parameters.get(
                    name, tuple()
                )
                for idx, arg in enumerate(args):
                    try:
                        arg_name = legacy_arg_names[idx]
                        if arg_name in allowed_config_keys:
                            expectation_kwargs[arg_name] = arg
                        if arg_name == "meta":
                            meta = arg
                    except IndexError:
                        raise InvalidExpectationConfigurationError(
                            f"Invalid positional argument: {arg}"
                        )

                # this is used so that exceptions are caught appropriately when they occur in expectation config
                basic_configuration_keys = {
                    "result_format",
                    "include_config",
                    "catch_exceptions",
                }
                basic_default_expectation_args = {
                    k: v
                    for k, v in self.default_expectation_args.items()
                    if k in basic_configuration_keys
                }
                basic_runtime_configuration = copy.deepcopy(
                    basic_default_expectation_args
                )
                basic_runtime_configuration.update(
                    {k: v for k, v in kwargs.items() if k in basic_configuration_keys}
                )

                configuration = ExpectationConfiguration(
                    expectation_type=name, kwargs=expectation_kwargs, meta=meta
                )

                # runtime_configuration = configuration.get_runtime_kwargs()
                expectation = expectation_impl(configuration)
                """Given an implementation and a configuration for any Expectation, returns its validation result"""

                if not self.interactive_evaluation and not self._active_validation:
                    validation_result = ExpectationValidationResult(
                        expectation_config=copy.deepcopy(expectation.configuration)
                    )
                else:
                    validation_result = expectation.validate(
                        validator=self,
                        evaluation_parameters=self._expectation_suite.evaluation_parameters,
                        data_context=self._data_context,
                        runtime_configuration=basic_runtime_configuration,
                    )

                # If validate has set active_validation to true, then we do not save the config to avoid
                # saving updating expectation configs to the same suite during validation runs
                if self._active_validation is True:
                    stored_config = configuration.get_raw_configuration()
                else:
                    # Append the expectation to the config.
                    stored_config = self._expectation_suite.add_expectation(
                        configuration.get_raw_configuration()
                    )

                # If there was no interactive evaluation, success will not have been computed.
                if validation_result.success is not None:
                    # Add a "success" object to the config
                    stored_config.success_on_last_run = validation_result.success

                if self._data_context is not None:
                    validation_result = self._data_context.update_return_obj(
                        self, validation_result
                    )

            except Exception as err:
                if basic_runtime_configuration.get("catch_exceptions"):
                    raised_exception = True
                    exception_traceback = traceback.format_exc()
                    exception_message = f"{type(err).__name__}: {str(err)}"

                    validation_result = ExpectationValidationResult(
                        expectation_config=configuration,
                        success=False,
                    )

                    validation_result.exception_info = {
                        "raised_exception": raised_exception,
                        "exception_message": exception_message,
                        "exception_traceback": exception_traceback,
                    }

                else:
                    raise err
            return validation_result

        inst_expectation.__name__ = name
        return inst_expectation

    @property
    def execution_engine(self):
        """Returns the execution engine being used by the validator at the given time"""
        return self._execution_engine

    def list_available_expectation_types(self):
        """Returns a list of all expectations available to the validator"""
        keys = dir(self)
        return [
            expectation for expectation in keys if expectation.startswith("expect_")
        ]

    def get_metrics(self, metrics: Dict[str, MetricConfiguration]) -> Dict[str, Any]:
        """Return a dictionary with the requested metrics"""
        graph = ValidationGraph()
        resolved_metrics = {}
        for metric_name, metric_configuration in metrics.items():
            provider_cls, _ = get_metric_provider(
                metric_configuration.metric_name, self.execution_engine
            )
            for key in provider_cls.domain_keys:
                if (
                    key not in metric_configuration.metric_domain_kwargs
                    and key in provider_cls.default_kwarg_values
                ):
                    metric_configuration.metric_domain_kwargs[
                        key
                    ] = provider_cls.default_kwarg_values[key]
            for key in provider_cls.value_keys:
                if (
                    key not in metric_configuration.metric_value_kwargs
                    and key in provider_cls.default_kwarg_values
                ):
                    metric_configuration.metric_value_kwargs[
                        key
                    ] = provider_cls.default_kwarg_values[key]
            self.build_metric_dependency_graph(
                graph,
                child_node=metric_configuration,
                configuration=None,
                execution_engine=self._execution_engine,
                runtime_configuration=None,
            )
        self.resolve_validation_graph(graph, resolved_metrics)
        return {
            metric_name: resolved_metrics[metric_configuration.id]
            for (metric_name, metric_configuration) in metrics.items()
        }

    def get_metric(self, metric: MetricConfiguration) -> Any:
        """return the value of the requested metric."""
        return self.get_metrics({"_": metric})["_"]

    def build_metric_dependency_graph(
        self,
        graph: ValidationGraph,
        child_node: MetricConfiguration,
        configuration: Optional[ExpectationConfiguration],
        execution_engine: "ExecutionEngine",
        parent_node: Optional[MetricConfiguration] = None,
        runtime_configuration: Optional[dict] = None,
    ) -> None:
        """Obtain domain and value keys for metrics and proceeds to add these metrics to the validation graph
        until all metrics have been added."""

        # metric_kwargs = get_metric_kwargs(metric_name)
        metric_impl = get_metric_provider(
            child_node.metric_name, execution_engine=execution_engine
        )[0]
        metric_dependencies = metric_impl.get_evaluation_dependencies(
            metric=child_node,
            configuration=configuration,
            execution_engine=execution_engine,
            runtime_configuration=runtime_configuration,
        )
        child_node.metric_dependencies = metric_dependencies

        if parent_node:
            graph.add(
                MetricEdge(
                    parent_node,
                    child_node,
                )
            )

        if len(metric_dependencies) == 0:
            graph.add(
                MetricEdge(
                    child_node,
                    None,
                )
            )

        else:
            for metric_dependency in metric_dependencies.values():
                if metric_dependency.id == child_node.id:
                    logger.warning(
                        f"Metric {str(child_node.id)} has created a circular dependency"
                    )
                    continue
                self.build_metric_dependency_graph(
                    graph,
                    metric_dependency,
                    configuration,
                    execution_engine,
                    child_node,
                    runtime_configuration=runtime_configuration,
                )

    def graph_validate(
        self,
        configurations: List[ExpectationConfiguration],
        metrics: dict = None,
        runtime_configuration: dict = None,
    ) -> List[ExpectationValidationResult]:
        """Obtains validation dependencies for each metric using the implementation of their associated expectation,
        then proceeds to add these dependencies to the validation graph, supply readily available metric implementations
        to fulfill current metric requirements, and validate these metrics.

                Args:
                    batches (Dict[str, Batch]): A Dictionary of batches and their corresponding names that will be used
                    for Expectation Validation.
                    configurations(List[ExpectationConfiguration]): A list of needed Expectation Configurations that will
                    be used to supply domain and values for metrics.
                    execution_engine (ExecutionEngine): An Execution Engine that will be used for extraction of metrics
                    from the registry.
                    metrics (dict): A list of currently registered metrics in the registry
                    runtime_configuration (dict): A dictionary of runtime keyword arguments, controlling semantics
                    such as the result_format.

                Returns:
                    A list of Validations, validating that all necessary metrics are available.
        """
        graph = ValidationGraph()
        if runtime_configuration is None:
            runtime_configuration = {}

        if runtime_configuration.get("catch_exceptions", True):
            catch_exceptions = True
        else:
            catch_exceptions = False

        processed_configurations = []
        evrs = []
        for configuration in configurations:
            # Validating
            try:
                assert (
                    configuration.expectation_type is not None
                ), "Given configuration should include expectation type"
            except AssertionError as e:
                raise InvalidExpectationConfigurationError(str(e))

            evaluated_config = copy.deepcopy(configuration)
            evaluated_config.kwargs.update({"batch_id": self.active_batch_id})

            expectation_impl = get_expectation_impl(evaluated_config.expectation_type)
            validation_dependencies = expectation_impl().get_validation_dependencies(
                evaluated_config, self._execution_engine, runtime_configuration
            )["metrics"]

            try:
                for metric in validation_dependencies.values():
                    self.build_metric_dependency_graph(
                        graph,
                        metric,
                        evaluated_config,
                        self._execution_engine,
                        runtime_configuration=runtime_configuration,
                    )
                processed_configurations.append(evaluated_config)
            except Exception as err:
                if catch_exceptions:
                    raised_exception = True
                    exception_traceback = traceback.format_exc()
                    result = ExpectationValidationResult(
                        success=False,
                        exception_info={
                            "raised_exception": raised_exception,
                            "exception_traceback": exception_traceback,
                            "exception_message": str(err),
                        },
                        expectation_config=evaluated_config,
                    )
                    evrs.append(result)
                else:
                    raise err

        if metrics is None:
            metrics = {}

        # Since metrics can serve multiple expectations in a suite and are resolved together through validation graph,
        # an exception occurring as part of resolving the combined validation graph impacts all expectations in suite.
        try:
            metrics = self.resolve_validation_graph(
                graph, metrics, runtime_configuration
            )
        except Exception as err:
            if catch_exceptions:
                raised_exception = True
                exception_traceback = traceback.format_exc()
                for configuration in processed_configurations:
                    result = ExpectationValidationResult(
                        success=False,
                        exception_info={
                            "raised_exception": raised_exception,
                            "exception_traceback": exception_traceback,
                            "exception_message": str(err),
                        },
                        expectation_config=configuration,
                    )
                    evrs.append(result)
                return evrs
            else:
                raise err
        for configuration in processed_configurations:
            try:
                result = configuration.metrics_validate(
                    metrics,
                    execution_engine=self._execution_engine,
                    runtime_configuration=runtime_configuration,
                )
                evrs.append(result)
            except Exception as err:
                if catch_exceptions:
                    raised_exception = True
                    exception_traceback = traceback.format_exc()

                    result = ExpectationValidationResult(
                        success=False,
                        exception_info={
                            "raised_exception": raised_exception,
                            "exception_traceback": exception_traceback,
                            "exception_message": str(err),
                        },
                        expectation_config=configuration,
                    )
                    evrs.append(result)
                else:
                    raise err
        return evrs

    def resolve_validation_graph(self, graph, metrics, runtime_configuration=None):
        done: bool = False
        pbar = None
        while not done:
            ready_metrics, needed_metrics = self._parse_validation_graph(graph, metrics)
            if pbar is None:
                pbar = tqdm(
                    total=len(ready_metrics) + len(needed_metrics),
                    desc="Calculating Metrics",
                    disable=len(graph._edges) < 3,
                )
                pbar.update(0)
            metrics.update(
                self._resolve_metrics(
                    execution_engine=self._execution_engine,
                    metrics_to_resolve=ready_metrics,
                    metrics=metrics,
                    runtime_configuration=runtime_configuration,
                )
            )
            pbar.update(len(ready_metrics))
            if len(ready_metrics) + len(needed_metrics) == 0:
                done = True
        pbar.close()

        return metrics

    def _parse_validation_graph(self, validation_graph, metrics):
        """Given validation graph, returns the ready and needed metrics necessary for validation using a traversal of
        validation graph (a graph structure of metric ids) edges"""
        unmet_dependency_ids = set()
        unmet_dependency = set()
        maybe_ready_ids = set()
        maybe_ready = set()

        for edge in validation_graph.edges:
            if edge.left.id not in metrics:
                if edge.right is None or edge.right.id in metrics:
                    if edge.left.id not in maybe_ready_ids:
                        maybe_ready_ids.add(edge.left.id)
                        maybe_ready.add(edge.left)
                else:
                    if edge.left.id not in unmet_dependency_ids:
                        unmet_dependency_ids.add(edge.left.id)
                        unmet_dependency.add(edge.left)

        return maybe_ready - unmet_dependency, unmet_dependency

    def _resolve_metrics(
        self,
        execution_engine: "ExecutionEngine",
        metrics_to_resolve: Iterable[MetricConfiguration],
        metrics: Dict,
        runtime_configuration: dict = None,
    ):
        """A means of accessing the Execution Engine's resolve_metrics method, where missing metric configurations are
        resolved"""
        return execution_engine.resolve_metrics(
            metrics_to_resolve, metrics, runtime_configuration
        )

    def _initialize_expectations(
        self,
        expectation_suite: ExpectationSuite = None,
        expectation_suite_name: str = None,
    ):
        """Instantiates `_expectation_suite` as empty by default or with a specified expectation `config`.
        In addition, this always sets the `default_expectation_args` to:
            `include_config`: False,
            `catch_exceptions`: False,
            `output_format`: 'BASIC'

        By default, initializes data_asset_type to the name of the implementing class, but subclasses
        that have interoperable semantics (e.g. Dataset) may override that parameter to clarify their
        interoperability.

        Args:
            expectation_suite (json): \
                A json-serializable expectation config. \
                If None, creates default `_expectation_suite` with an empty list of expectations and \
                key value `data_asset_name` as `data_asset_name`.

            expectation_suite_name (string): \
                The name to assign to the `expectation_suite.expectation_suite_name`

        Returns:
            None
        """
        # Checking type of expectation_suite.
        # Check for expectation_suite_name is already done by ExpectationSuiteIdentifier
        if expectation_suite and not isinstance(expectation_suite, ExpectationSuite):
            raise TypeError(
                "expectation_suite must be of type ExpectationSuite, not {}".format(
                    type(expectation_suite)
                )
            )
        if expectation_suite is not None:
            if isinstance(expectation_suite, dict):
                expectation_suite = expectationSuiteSchema.load(expectation_suite)
            else:
                expectation_suite = copy.deepcopy(expectation_suite)
            self._expectation_suite = expectation_suite

            if expectation_suite_name is not None:
                if (
                    self._expectation_suite.expectation_suite_name
                    != expectation_suite_name
                ):
                    logger.warning(
                        "Overriding existing expectation_suite_name {n1} with new name {n2}".format(
                            n1=self._expectation_suite.expectation_suite_name,
                            n2=expectation_suite_name,
                        )
                    )
                self._expectation_suite.expectation_suite_name = expectation_suite_name

        else:
            if expectation_suite_name is None:
                expectation_suite_name = "default"
            self._expectation_suite = ExpectationSuite(
                expectation_suite_name=expectation_suite_name
            )

        self._expectation_suite.execution_engine_type = type(
            self.execution_engine
        ).__name__

    def append_expectation(self, expectation_config):
        """This method is a thin wrapper for ExpectationSuite.append_expectation"""
        warnings.warn(
            "append_expectation is deprecated, and will be removed in a future release. "
            + "Please use ExpectationSuite.add_expectation instead.",
            DeprecationWarning,
        )
        self._expectation_suite.append_expectation(expectation_config)

    def find_expectation_indexes(
        self,
        expectation_configuration: ExpectationConfiguration,
        match_type: str = "domain",
    ) -> List[int]:
        """This method is a thin wrapper for ExpectationSuite.find_expectation_indexes"""
        warnings.warn(
            "find_expectation_indexes is deprecated, and will be removed in a future release. "
            + "Please use ExpectationSuite.find_expectation_indexes instead.",
            DeprecationWarning,
        )
        return self._expectation_suite.find_expectation_indexes(
            expectation_configuration=expectation_configuration, match_type=match_type
        )

    def find_expectations(
        self,
        expectation_configuration: ExpectationConfiguration,
        match_type: str = "domain",
    ) -> List[ExpectationConfiguration]:
        """This method is a thin wrapper for ExpectationSuite.find_expectations()"""
        warnings.warn(
            "find_expectations is deprecated, and will be removed in a future release. "
            + "Please use ExpectationSuite.find_expectation_indexes instead.",
            DeprecationWarning,
        )
        return self._expectation_suite.find_expectations(
            expectation_configuration=expectation_configuration, match_type=match_type
        )

    def remove_expectation(
        self,
        expectation_configuration: ExpectationConfiguration,
        match_type: str = "domain",
        remove_multiple_matches: bool = False,
    ) -> List[ExpectationConfiguration]:
        """This method is a thin wrapper for ExpectationSuite.remove()"""
        warnings.warn(
            "DataAsset.remove_expectations is deprecated, and will be removed in a future release. "
            + "Please use ExpectationSuite.remove_expectation instead.",
            DeprecationWarning,
        )
        return self._expectation_suite.remove_expectation(
            expectation_configuration=expectation_configuration,
            match_type=match_type,
            remove_multiple_matches=remove_multiple_matches,
        )

    def set_config_value(self, key, value):
        """Setter for config value"""
        self._validator_config[key] = value

    def get_config_value(self, key):
        """Getter for config value"""
        return self._validator_config.get(key)

    def load_batch_list(self, batch_list: List[Batch]):
        for batch in batch_list:
            try:
                assert isinstance(
                    batch, Batch
                ), "batches provided to Validator must be Great Expectations Batch objects"
            except AssertionError as e:
                logger.warning(str(e))
            self._execution_engine.load_batch_data(batch.id, batch.data)
            self._batches[batch.id] = batch
            # We set the active_batch_id in each iteration of the loop to keep in sync with the active_batch_id for the
            # execution_engine. The final active_batch_id will be that of the final batch loaded.
            self.active_batch_id = batch.id

        return batch_list

    @property
    def batches(self) -> Dict[str, Batch]:
        """Getter for batches"""
        return self._batches

    @property
    def loaded_batch_ids(self) -> List[str]:
        return self.execution_engine.loaded_batch_data_ids

    @property
    def active_batch(self) -> Batch:
        """Getter for active batch"""
        active_batch_id: str = self.active_batch_id
        batch: Batch = self.batches.get(active_batch_id) if active_batch_id else None
        return batch

    @property
    def active_batch_spec(self) -> Optional[BatchSpec]:
        """Getter for active batch's batch_spec"""
        if not self.active_batch:
            return None
        else:
            return self.active_batch.batch_spec

    @property
    def active_batch_id(self) -> str:
        """Getter for active batch id"""
        active_engine_batch_id = self._execution_engine.active_batch_data_id
        if active_engine_batch_id != self._active_batch_id:
            logger.debug(
                "This validator has a different active batch id than its Execution Engine."
            )
        return self._active_batch_id

    @active_batch_id.setter
    def active_batch_id(self, batch_id):
        assert set(self.batches.keys()).issubset(set(self.loaded_batch_ids))
        available_batch_ids: Set[str] = set(self.batches.keys()).union(
            set(self.loaded_batch_ids)
        )
        if batch_id not in available_batch_ids:
            raise ValueError(
                f"""batch_id {batch_id} not found in loaded batches.  Batches must first be loaded before they can be \
set as active.
"""
            )
        else:
            self._active_batch_id = batch_id

    @property
    def active_batch_markers(self):
        """Getter for active batch's batch markers"""
        if not self.active_batch:
            return None
        else:
            return self.active_batch.batch_markers

    @property
    def active_batch_definition(self):
        """Getter for the active batch's batch definition"""
        if not self.active_batch:
            return None
        else:
            return self.active_batch.batch_definition

    def discard_failing_expectations(self):
        """Removes any expectations from the validator where the validation has failed"""
        res = self.validate(only_return_failures=True).results
        if any(res):
            for item in res:
                self.remove_expectation(
                    expectation_configuration=item.expectation_config,
                    match_type="runtime",
                )
            warnings.warn("Removed %s expectations that were 'False'" % len(res))

    def get_default_expectation_arguments(self):
        """Fetch default expectation arguments for this data_asset

        Returns:
            A dictionary containing all the current default expectation arguments for a data_asset

            Ex::

                {
                    "include_config" : True,
                    "catch_exceptions" : False,
                    "result_format" : 'BASIC'
                }

        See also:
            set_default_expectation_arguments
        """
        return self._default_expectation_args

    @property
    def default_expectation_args(self):
        """A getter for default Expectation arguments"""
        return self._default_expectation_args

    def set_default_expectation_argument(self, argument, value):
        """
        Set a default expectation argument for this data_asset

        Args:
            argument (string): The argument to be replaced
            value : The New argument to use for replacement

        Returns:
            None

        See also:
            get_default_expectation_arguments
        """

        self._default_expectation_args[argument] = value

    def get_expectations_config(
        self,
        discard_failed_expectations=True,
        discard_result_format_kwargs=True,
        discard_include_config_kwargs=True,
        discard_catch_exceptions_kwargs=True,
        suppress_warnings=False,
    ):
        """
        Returns an expectation configuration, providing an option to discard failed expectation and discard/ include'
        different result aspects, such as exceptions and result format.
        """
        warnings.warn(
            "get_expectations_config is deprecated, and will be removed in a future release. "
            + "Please use get_expectation_suite instead.",
            DeprecationWarning,
        )
        return self.get_expectation_suite(
            discard_failed_expectations,
            discard_result_format_kwargs,
            discard_include_config_kwargs,
            discard_catch_exceptions_kwargs,
            suppress_warnings,
        )

    def get_expectation_suite(
        self,
        discard_failed_expectations=True,
        discard_result_format_kwargs=True,
        discard_include_config_kwargs=True,
        discard_catch_exceptions_kwargs=True,
        suppress_warnings=False,
        suppress_logging=False,
    ):
        """Returns _expectation_config as a JSON object, and perform some cleaning along the way.

        Args:
            discard_failed_expectations (boolean): \
                Only include expectations with success_on_last_run=True in the exported config.  Defaults to `True`.
            discard_result_format_kwargs (boolean): \
                In returned expectation objects, suppress the `result_format` parameter. Defaults to `True`.
            discard_include_config_kwargs (boolean): \
                In returned expectation objects, suppress the `include_config` parameter. Defaults to `True`.
            discard_catch_exceptions_kwargs (boolean): \
                In returned expectation objects, suppress the `catch_exceptions` parameter.  Defaults to `True`.
            suppress_warnings (boolean): \
                If true, do not include warnings in logging information about the operation.
            suppress_logging (boolean): \
                If true, do not create a log entry (useful when using get_expectation_suite programmatically)

        Returns:
            An expectation suite.

        Note:
            get_expectation_suite does not affect the underlying expectation suite at all. The returned suite is a \
             copy of _expectation_suite, not the original object.
        """

        expectation_suite = copy.deepcopy(self._expectation_suite)
        expectations = expectation_suite.expectations

        discards = defaultdict(int)

        if discard_failed_expectations:
            new_expectations = []

            for expectation in expectations:
                # Note: This is conservative logic.
                # Instead of retaining expectations IFF success==True, it discard expectations IFF success==False.
                # In cases where expectation.success is missing or None, expectations are *retained*.
                # Such a case could occur if expectations were loaded from a config file and never run.
                if expectation.success_on_last_run is False:
                    discards["failed_expectations"] += 1
                else:
                    new_expectations.append(expectation)

            expectations = new_expectations

        message = "\t%d expectation(s) included in expectation_suite." % len(
            expectations
        )

        if discards["failed_expectations"] > 0 and not suppress_warnings:
            message += (
                " Omitting %d expectation(s) that failed when last run; set "
                "discard_failed_expectations=False to include them."
                % discards["failed_expectations"]
            )

        for expectation in expectations:
            # FIXME: Factor this out into a new function. The logic is duplicated in remove_expectation,
            #  which calls _copy_and_clean_up_expectation
            expectation.success_on_last_run = None

            if discard_result_format_kwargs:
                if "result_format" in expectation.kwargs:
                    del expectation.kwargs["result_format"]
                    discards["result_format"] += 1

            if discard_include_config_kwargs:
                if "include_config" in expectation.kwargs:
                    del expectation.kwargs["include_config"]
                    discards["include_config"] += 1

            if discard_catch_exceptions_kwargs:
                if "catch_exceptions" in expectation.kwargs:
                    del expectation.kwargs["catch_exceptions"]
                    discards["catch_exceptions"] += 1

        settings_message = ""

        if discards["result_format"] > 0 and not suppress_warnings:
            settings_message += " result_format"

        if discards["include_config"] > 0 and not suppress_warnings:
            settings_message += " include_config"

        if discards["catch_exceptions"] > 0 and not suppress_warnings:
            settings_message += " catch_exceptions"

        if (
            len(settings_message) > 1
        ):  # Only add this if we added one of the settings above.
            settings_message += " settings filtered."

        expectation_suite.expectations = expectations
        if not suppress_logging:
            logger.info(message + settings_message)
        return expectation_suite

    def save_expectation_suite(
        self,
        filepath=None,
        discard_failed_expectations=True,
        discard_result_format_kwargs=True,
        discard_include_config_kwargs=True,
        discard_catch_exceptions_kwargs=True,
        suppress_warnings=False,
    ):
        """Writes ``_expectation_config`` to a JSON file.

           Writes the DataAsset's expectation config to the specified JSON ``filepath``. Failing expectations \
           can be excluded from the JSON expectations config with ``discard_failed_expectations``. The kwarg key-value \
           pairs :ref:`result_format`, :ref:`include_config`, and :ref:`catch_exceptions` are optionally excluded from \
           the JSON expectations config.

           Args:
               filepath (string): \
                   The location and name to write the JSON config file to.
               discard_failed_expectations (boolean): \
                   If True, excludes expectations that do not return ``success = True``. \
                   If False, all expectations are written to the JSON config file.
               discard_result_format_kwargs (boolean): \
                   If True, the :ref:`result_format` attribute for each expectation is not written to the JSON config \
                   file.
               discard_include_config_kwargs (boolean): \
                   If True, the :ref:`include_config` attribute for each expectation is not written to the JSON config \
                   file.
               discard_catch_exceptions_kwargs (boolean): \
                   If True, the :ref:`catch_exceptions` attribute for each expectation is not written to the JSON \
                   config file.
               suppress_warnings (boolean): \
                  It True, all warnings raised by Great Expectations, as a result of dropped expectations, are \
                  suppressed.

        """
        expectation_suite = self.get_expectation_suite(
            discard_failed_expectations,
            discard_result_format_kwargs,
            discard_include_config_kwargs,
            discard_catch_exceptions_kwargs,
            suppress_warnings,
        )
        if filepath is None and self._data_context is not None:
            self._data_context.save_expectation_suite(expectation_suite)
        elif filepath is not None:
            with open(filepath, "w") as outfile:
                json.dump(
                    expectationSuiteSchema.dump(expectation_suite),
                    outfile,
                    indent=2,
                    sort_keys=True,
                )
        else:
            raise ValueError(
                "Unable to save config: filepath or data_context must be available."
            )

    def validate(
        self,
        expectation_suite=None,
        run_id=None,
        data_context=None,
        evaluation_parameters=None,
        catch_exceptions=True,
        result_format=None,
        only_return_failures=False,
        run_name=None,
        run_time=None,
    ):
        """Generates a JSON-formatted report describing the outcome of all expectations.

        Use the default expectation_suite=None to validate the expectations config associated with the DataAsset.

        Args:
            expectation_suite (json or None): \
                If None, uses the expectations config generated with the DataAsset during the current session. \
                If a JSON file, validates those expectations.
            run_name (str): \
                Used to identify this validation result as part of a collection of validations. \
                See DataContext for more information.
            data_context (DataContext): \
                A datacontext object to use as part of validation for binding evaluation parameters and \
                registering validation results.
            evaluation_parameters (dict or None): \
                If None, uses the evaluation_paramters from the expectation_suite provided or as part of the \
                data_asset. If a dict, uses the evaluation parameters in the dictionary.
            catch_exceptions (boolean): \
                If True, exceptions raised by tests will not end validation and will be described in the returned \
                report.
            result_format (string or None): \
                If None, uses the default value ('BASIC' or as specified). \
                If string, the returned expectation output follows the specified format ('BOOLEAN_ONLY','BASIC', \
                etc.).
            only_return_failures (boolean): \
                If True, expectation results are only returned when ``success = False`` \

        Returns:
            A JSON-formatted dictionary containing a list of the validation results. \
            An example of the returned format::

            {
              "results": [
                {
                  "unexpected_list": [unexpected_value_1, unexpected_value_2],
                  "expectation_type": "expect_*",
                  "kwargs": {
                    "column": "Column_Name",
                    "output_format": "SUMMARY"
                  },
                  "success": true,
                  "raised_exception: false.
                  "exception_traceback": null
                },
                {
                  ... (Second expectation results)
                },
                ... (More expectations results)
              ],
              "success": true,
              "statistics": {
                "evaluated_expectations": n,
                "successful_expectations": m,
                "unsuccessful_expectations": n - m,
                "success_percent": m / n
              }
            }

        Notes:
           If the configuration object was built with a different version of great expectations then the \
           current environment. If no version was found in the configuration file.

        Raises:
           AttributeError - if 'catch_exceptions'=None and an expectation throws an AttributeError
        """
        try:
            validation_time = datetime.datetime.now(datetime.timezone.utc).strftime(
                "%Y%m%dT%H%M%S.%fZ"
            )
            assert not (run_id and run_name) and not (
                run_id and run_time
            ), "Please provide either a run_id or run_name and/or run_time."
            if isinstance(run_id, str) and not run_name:
                warnings.warn(
                    "String run_ids will be deprecated in the future. Please provide a run_id of type "
                    "RunIdentifier(run_name=None, run_time=None), or a dictionary containing run_name "
                    "and run_time (both optional). Instead of providing a run_id, you may also provide"
                    "run_name and run_time separately.",
                    DeprecationWarning,
                )
                try:
                    run_time = parse(run_id)
                except (ValueError, TypeError):
                    pass
                run_id = RunIdentifier(run_name=run_id, run_time=run_time)
            elif isinstance(run_id, dict):
                run_id = RunIdentifier(**run_id)
            elif not isinstance(run_id, RunIdentifier):
                run_id = RunIdentifier(run_name=run_name, run_time=run_time)

            self._active_validation = True

            # If a different validation data context was provided, override
            validate__data_context = self._data_context
            if data_context is None and self._data_context is not None:
                data_context = self._data_context
            elif data_context is not None:
                # temporarily set self._data_context so it is used inside the expectation decorator
                self._data_context = data_context

            if expectation_suite is None:
                expectation_suite = self.get_expectation_suite(
                    discard_failed_expectations=False,
                    discard_result_format_kwargs=False,
                    discard_include_config_kwargs=False,
                    discard_catch_exceptions_kwargs=False,
                )
            elif isinstance(expectation_suite, str):
                try:
                    with open(expectation_suite) as infile:
                        expectation_suite = expectationSuiteSchema.loads(infile.read())
                except ValidationError:
                    raise
                except OSError:
                    raise GreatExpectationsError(
                        "Unable to load expectation suite: IO error while reading %s"
                        % expectation_suite
                    )
            elif not isinstance(expectation_suite, ExpectationSuite):
                logger.error(
                    "Unable to validate using the provided value for expectation suite; does it need to be "
                    "loaded from a dictionary?"
                )
                if getattr(data_context, "_usage_statistics_handler", None):
                    handler = data_context._usage_statistics_handler
                    handler.send_usage_message(
                        event="data_asset.validate",
                        event_payload=handler._batch_anonymizer.anonymize_batch_info(
                            self
                        ),
                        success=False,
                    )
                return ExpectationValidationResult(success=False)

            # Evaluation parameter priority is
            # 1. from provided parameters
            # 2. from expectation configuration
            # 3. from data context
            # So, we load them in reverse order

            if data_context is not None:
                runtime_evaluation_parameters = (
                    data_context.evaluation_parameter_store.get_bind_params(run_id)
                )
            else:
                runtime_evaluation_parameters = {}

            if expectation_suite.evaluation_parameters:
                runtime_evaluation_parameters.update(
                    expectation_suite.evaluation_parameters
                )

            if evaluation_parameters is not None:
                runtime_evaluation_parameters.update(evaluation_parameters)

            # Convert evaluation parameters to be json-serializable
            runtime_evaluation_parameters = recursively_convert_to_json_serializable(
                runtime_evaluation_parameters
            )

            # Warn if our version is different from the version in the configuration
            # TODO: Deprecate "great_expectations.__version__"
            suite_ge_version = expectation_suite.meta.get(
                "great_expectations_version"
            ) or expectation_suite.meta.get("great_expectations.__version__")

            # Group expectations by column
            columns = {}

            for expectation in expectation_suite.expectations:
                expectation.process_evaluation_parameters(
                    evaluation_parameters=runtime_evaluation_parameters,
                    interactive_evaluation=self.interactive_evaluation,
                    data_context=self._data_context,
                )
                if "column" in expectation.kwargs and isinstance(
                    expectation.kwargs["column"], Hashable
                ):
                    column = expectation.kwargs["column"]
                else:
                    column = "_nocolumn"
                if column not in columns:
                    columns[column] = []
                columns[column].append(expectation)

            expectations_to_evaluate = []
            for col in columns:
                expectations_to_evaluate.extend(columns[col])

            runtime_configuration = copy.deepcopy(self.default_expectation_args)

            if catch_exceptions is not None:
                runtime_configuration.update({"catch_exceptions": catch_exceptions})

            if result_format is not None:
                runtime_configuration.update({"result_format": result_format})

            results = self.graph_validate(
                expectations_to_evaluate,
                runtime_configuration=runtime_configuration,
            )
            statistics = _calc_validation_statistics(results)

            if only_return_failures:
                abbrev_results = []
                for exp in results:
                    if not exp.success:
                        abbrev_results.append(exp)
                results = abbrev_results

            expectation_suite_name = expectation_suite.expectation_suite_name

            result = ExpectationSuiteValidationResult(
                results=results,
                success=statistics.success,
                statistics={
                    "evaluated_expectations": statistics.evaluated_expectations,
                    "successful_expectations": statistics.successful_expectations,
                    "unsuccessful_expectations": statistics.unsuccessful_expectations,
                    "success_percent": statistics.success_percent,
                },
                evaluation_parameters=runtime_evaluation_parameters,
                meta={
                    "great_expectations_version": ge_version,
                    "expectation_suite_name": expectation_suite_name,
                    "run_id": run_id,
                    "batch_spec": self.active_batch_spec,
                    "batch_markers": self.active_batch_markers,
                    "active_batch_definition": self.active_batch_definition,
                    "validation_time": validation_time,
                },
            )

            self._data_context = validate__data_context
        except Exception as e:
            if getattr(data_context, "_usage_statistics_handler", None):
                handler = data_context._usage_statistics_handler
                handler.send_usage_message(
                    event="data_asset.validate",
                    event_payload=handler._batch_anonymizer.anonymize_batch_info(self),
                    success=False,
                )
            raise
        finally:
            self._active_validation = False

        if getattr(data_context, "_usage_statistics_handler", None):
            handler = data_context._usage_statistics_handler
            handler.send_usage_message(
                event="data_asset.validate",
                event_payload=handler._batch_anonymizer.anonymize_batch_info(self),
                success=True,
            )
        return result

    def get_evaluation_parameter(self, parameter_name, default_value=None):
        """
        Get an evaluation parameter value that has been stored in meta.

        Args:
            parameter_name (string): The name of the parameter to store.
            default_value (any): The default value to be returned if the parameter is not found.

        Returns:
            The current value of the evaluation parameter.
        """
        if parameter_name in self._expectation_suite.evaluation_parameters:
            return self._expectation_suite.evaluation_parameters[parameter_name]
        else:
            return default_value

    def set_evaluation_parameter(self, parameter_name, parameter_value):
        """
        Provide a value to be stored in the data_asset evaluation_parameters object and used to evaluate
        parameterized expectations.

        Args:
            parameter_name (string): The name of the kwarg to be replaced at evaluation time
            parameter_value (any): The value to be used
        """
        self._expectation_suite.evaluation_parameters.update(
            {parameter_name: parameter_value}
        )

    def add_citation(
        self,
        comment,
        batch_spec=None,
        batch_markers=None,
        batch_definition=None,
        citation_date=None,
    ):
        """Adds a citation to an existing Expectation Suite within the validator"""
        if batch_spec is None:
            batch_spec = self.batch_spec
        if batch_markers is None:
            batch_markers = self.active_batch_markers
        if batch_definition is None:
            batch_definition = self.active_batch_definition
        self._expectation_suite.add_citation(
            comment,
            batch_spec=batch_spec,
            batch_markers=batch_markers,
            batch_definition=batch_definition,
            citation_date=citation_date,
        )

    @property
    def expectation_suite_name(self):
        """Gets the current expectation_suite name of this data_asset as stored in the expectations configuration."""
        return self._expectation_suite.expectation_suite_name

    @expectation_suite_name.setter
    def expectation_suite_name(self, expectation_suite_name):
        """Sets the expectation_suite name of this data_asset as stored in the expectations configuration."""
        self._expectation_suite.expectation_suite_name = expectation_suite_name

    def test_expectation_function(self, function, *args, **kwargs):
        """Test a generic expectation function

        Args:
            function (func): The function to be tested. (Must be a valid expectation function.)
            *args          : Positional arguments to be passed the the function
            **kwargs       : Keyword arguments to be passed the the function

        Returns:
            A JSON-serializable expectation result object.

        Notes:
            This function is a thin layer to allow quick testing of new expectation functions, without having to \
            define custom classes, etc. To use developed expectations from the command-line tool, you will still need \
            to define custom classes, etc.

            Check out :ref:`how_to_guides__creating_and_editing_expectations__how_to_create_custom_expectations` for more information.
        """

        argspec = inspect.getfullargspec(function)[0][1:]

        new_function = self.expectation(argspec)(function)
        return new_function(self, *args, **kwargs)

    def columns(self, domain_kwargs: Optional[Dict[str, Any]] = None) -> List[str]:
        if domain_kwargs is None:
            domain_kwargs = {
                "batch_id": self.execution_engine.active_batch_data_id,
            }

        columns: List[str] = self.get_metric(
            metric=MetricConfiguration(
                metric_name="table.columns",
                metric_domain_kwargs=domain_kwargs,
            )
        )

        return columns

    def head(
        self,
        n_rows: Optional[int] = 5,
        domain_kwargs: Optional[Dict[str, Any]] = None,
        fetch_all: Optional[bool] = False,
    ) -> pd.DataFrame:
        if domain_kwargs is None:
            domain_kwargs = {
                "batch_id": self.execution_engine.active_batch_data_id,
            }

        data: Any = self.get_metric(
            metric=MetricConfiguration(
                metric_name="table.head",
                metric_domain_kwargs=domain_kwargs,
                metric_value_kwargs={
                    "n_rows": n_rows,
                    "fetch_all": fetch_all,
                },
            )
        )

        df: pd.DataFrame
        if isinstance(
            self.execution_engine, (PandasExecutionEngine, SqlAlchemyExecutionEngine)
        ):
            df = pd.DataFrame(data=data)
        elif isinstance(self.execution_engine, SparkDFExecutionEngine):
            rows: List[Dict[str, Any]] = [datum.asDict() for datum in data]
            df = pd.DataFrame(data=rows)
        else:
            raise GreatExpectationsError(
                "Unsupported or unknown ExecutionEngine type encountered in Validator class."
            )

        return df.reset_index(drop=True, inplace=False)


ValidationStatistics = namedtuple(
    "ValidationStatistics",
    [
        "evaluated_expectations",
        "successful_expectations",
        "unsuccessful_expectations",
        "success_percent",
        "success",
    ],
)


def _calc_validation_statistics(validation_results):
    """
    Calculate summary statistics for the validation results and
    return ``ExpectationStatistics``.
    """
    # calc stats
    successful_expectations = sum(exp.success for exp in validation_results)
    evaluated_expectations = len(validation_results)
    unsuccessful_expectations = evaluated_expectations - successful_expectations
    success = successful_expectations == evaluated_expectations
    try:
        success_percent = successful_expectations / evaluated_expectations * 100
    except ZeroDivisionError:
        # success_percent = float("nan")
        success_percent = None

    return ValidationStatistics(
        successful_expectations=successful_expectations,
        evaluated_expectations=evaluated_expectations,
        unsuccessful_expectations=unsuccessful_expectations,
        success=success,
        success_percent=success_percent,
    )


class BridgeValidator:
    """This is currently helping bridge APIs"""

    def __init__(self, batch, expectation_suite, expectation_engine=None, **kwargs):
        """Builds an expectation_engine object using an expectation suite and a batch, with the expectation engine being
        determined either by the user or by the type of batch data (pandas dataframe, SqlAlchemy table, etc.)

        Args:
            batch (Batch): A Batch in Pandas, Spark, or SQL format
            expectation_suite (ExpectationSuite): The Expectation Suite available to the validator within the current Data
            Context
            expectation_engine (ExecutionEngine): The current Execution Engine being utilized. If this is not set, it is
            determined by the type of data within the given batch
        """
        self.batch = batch
        self.expectation_suite = expectation_suite

        if isinstance(expectation_engine, dict):
            expectation_engine = ClassConfig(**expectation_engine)

        if isinstance(expectation_engine, ClassConfig):
            module_name = expectation_engine.module_name or "great_expectations.dataset"
            verify_dynamic_loading_support(module_name=module_name)
            expectation_engine = load_class(
                class_name=expectation_engine.class_name, module_name=module_name
            )

        self.expectation_engine = expectation_engine
        if self.expectation_engine is None:
            # Guess the engine
            try:
                import pandas as pd

                if isinstance(batch.data, pd.DataFrame):
                    self.expectation_engine = PandasDataset
            except ImportError:
                pass
        if self.expectation_engine is None:
            if isinstance(batch.data, SqlAlchemyBatchReference):
                self.expectation_engine = SqlAlchemyDataset

        if self.expectation_engine is None:
            try:
                import pyspark

                if isinstance(batch.data, pyspark.sql.DataFrame):
                    self.expectation_engine = SparkDFDataset
            except ImportError:
                pass

        if self.expectation_engine is None:
            raise ValueError(
                "Unable to identify expectation_engine. It must be a subclass of DataAsset."
            )

        self.init_kwargs = kwargs

    def get_dataset(self):
        """
        Bridges between Execution Engines in providing access to the batch data. Validates that Dataset classes
        contain proper type of data (i.e. a Pandas Dataset does not contain SqlAlchemy data)
        """
        if issubclass(self.expectation_engine, PandasDataset):
            import pandas as pd

            if not isinstance(self.batch["data"], pd.DataFrame):
                raise ValueError(
                    "PandasDataset expectation_engine requires a Pandas Dataframe for its batch"
                )

            return self.expectation_engine(
                self.batch.data,
                expectation_suite=self.expectation_suite,
                batch_kwargs=self.batch.batch_kwargs,
                batch_parameters=self.batch.batch_parameters,
                batch_markers=self.batch.batch_markers,
                data_context=self.batch.data_context,
                **self.init_kwargs,
                **self.batch.batch_kwargs.get("dataset_options", {}),
            )

        elif issubclass(self.expectation_engine, SqlAlchemyDataset):
            if not isinstance(self.batch.data, SqlAlchemyBatchReference):
                raise ValueError(
                    "SqlAlchemyDataset expectation_engine requires a SqlAlchemyBatchReference for its batch"
                )

            init_kwargs = self.batch.data.get_init_kwargs()
            init_kwargs.update(self.init_kwargs)
            return self.expectation_engine(
                batch_kwargs=self.batch.batch_kwargs,
                batch_parameters=self.batch.batch_parameters,
                batch_markers=self.batch.batch_markers,
                data_context=self.batch.data_context,
                expectation_suite=self.expectation_suite,
                **init_kwargs,
                **self.batch.batch_kwargs.get("dataset_options", {}),
            )

        elif issubclass(self.expectation_engine, SparkDFDataset):
            import pyspark

            if not isinstance(self.batch.data, pyspark.sql.DataFrame):
                raise ValueError(
                    "SparkDFDataset expectation_engine requires a spark DataFrame for its batch"
                )

            return self.expectation_engine(
                spark_df=self.batch.data,
                expectation_suite=self.expectation_suite,
                batch_kwargs=self.batch.batch_kwargs,
                batch_parameters=self.batch.batch_parameters,
                batch_markers=self.batch.batch_markers,
                data_context=self.batch.data_context,
                **self.init_kwargs,
                **self.batch.batch_kwargs.get("dataset_options", {}),
            )
