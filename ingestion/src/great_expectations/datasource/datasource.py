import copy
import logging
import warnings

from ruamel.yaml import YAML

from great_expectations.data_context.util import (
    instantiate_class_from_config,
    load_class,
    verify_dynamic_loading_support,
)
from great_expectations.exceptions import ClassInstantiationError
from great_expectations.types import ClassConfig

logger = logging.getLogger(__name__)
yaml = YAML()
yaml.default_flow_style = False


class LegacyDatasource:
    """
    A Datasource connects to a compute environment and one or more storage environments and produces batches of data
    that Great Expectations can validate in that compute environment.

    Each Datasource provides Batches connected to a specific compute environment, such as a
    SQL database, a Spark cluster, or a local in-memory Pandas DataFrame.

    Datasources use Batch Kwargs to specify instructions for how to access data from relevant sources such as an
    existing object from a DAG runner, a SQL database, S3 bucket, or local filesystem.

    To bridge the gap between those worlds, Datasources interact closely with *generators* which
    are aware of a source of data and can produce produce identifying information, called
    "batch_kwargs" that datasources can use to get individual batches of data. They add flexibility
    in how to obtain data such as with time-based partitioning, downsampling, or other techniques
    appropriate for the datasource.

    For example, a batch kwargs generator could produce a SQL query that logically represents "rows in the Events
    table with a timestamp on February 7, 2012," which a SqlAlchemyDatasource could use to materialize
    a SqlAlchemyDataset corresponding to that batch of data and ready for validation.

    Since opinionated DAG managers such as airflow, dbt, prefect.io, dagster can also act as datasources
    and/or batch kwargs generators for a more generic datasource.

    When adding custom expectations by subclassing an existing DataAsset type, use the data_asset_type parameter
    to configure the datasource to load and return DataAssets of the custom type.

    --ge-feature-maturity-info--

        id: datasource_s3
        title: Datasource - S3
        icon:
        short_description: S3
        description: Support for connecting to Amazon Web Services S3 as an external datasource.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_datasources/how_to_configure_a_pandas_s3_datasource.html
        maturity: Production
        maturity_details:
            api_stability: medium
            implementation_completeness: Complete
            unit_test_coverage:: Complete
            integration_infrastructure_test_coverage: None
            documentation_completeness: Minimal/Spotty
            bug_risk: Low

        id: datasource_filesystem
        title: Datasource - Filesystem
        icon:
        short_description: File-based datsource
        description: Support for using a mounted filesystem as an external datasource.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_datasources/how_to_configure_a_pandas_filesystem_datasource.html
        maturity: Production
        maturity_details:
            api_stability: Medium
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Partial
            documentation_completeness: Partial
            bug_risk: Low (Moderate for Windows users because of path issues)

        id: datasource_gcs
        title: Datasource - GCS
        icon:
        short_description: GCS
        description: Support for Google Cloud Storage as an external datasource
        how_to_guide_url:
        maturity: Experimental
        maturity_details:
            api_stability: Medium (supported via native ‘gs://' syntax in Pandas and Pyspark; medium because we expect configuration to evolve)
            implementation_completeness: Medium (works via passthrough, not via CLI)
            unit_test_coverage: Minimal
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Minimal
            bug_risk: Moderate

        id: datasource_azure_blob_storage
        title: Datasource - Azure Blob Storage
        icon:
        short_description: Azure Blob Storage
        description: Support for Microsoft Azure Blob Storage as an external datasource
        how_to_guide_url:
        maturity: In Roadmap (Sub-Experimental - "Not Impossible")
        maturity_details:
            api_stability: N/A (Supported on Databricks Spark via ‘wasb://' / ‘wasps://' url; requires local download first for Pandas)
            implementation_completeness: Minimal
            unit_test_coverage: N/A
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Minimal
            bug_risk: Unknown
    --ge-feature-maturity-info--
    """

    recognized_batch_parameters = {"limit"}

    @classmethod
    def from_configuration(cls, **kwargs):
        """
        Build a new datasource from a configuration dictionary.

        Args:
            **kwargs: configuration key-value pairs

        Returns:
            datasource (Datasource): the newly-created datasource

        """
        return cls(**kwargs)

    @classmethod
    def build_configuration(
        cls,
        class_name,
        module_name="great_expectations.datasource",
        data_asset_type=None,
        batch_kwargs_generators=None,
        **kwargs
    ):
        """
        Build a full configuration object for a datasource, potentially including batch kwargs generators with defaults.

        Args:
            class_name: The name of the class for which to build the config
            module_name: The name of the module in which the datasource class is located
            data_asset_type: A ClassConfig dictionary
            batch_kwargs_generators: BatchKwargGenerators configuration dictionary
            **kwargs: Additional kwargs to be part of the datasource constructor's initialization

        Returns:
            A complete datasource configuration.

        """
        verify_dynamic_loading_support(module_name=module_name)
        class_ = load_class(class_name=class_name, module_name=module_name)
        configuration = class_.build_configuration(
            data_asset_type=data_asset_type,
            batch_kwargs_generators=batch_kwargs_generators,
            **kwargs
        )
        return configuration

    def __init__(
        self,
        name,
        data_context=None,
        data_asset_type=None,
        batch_kwargs_generators=None,
        **kwargs
    ):
        """
        Build a new datasource.

        Args:
            name: the name for the datasource
            data_context: data context to which to connect
            data_asset_type (ClassConfig): the type of DataAsset to produce
            batch_kwargs_generators: BatchKwargGenerators to add to the datasource
        """
        self._data_context = data_context
        self._name = name
        if isinstance(data_asset_type, str):
            warnings.warn(
                "String-only configuration for data_asset_type is deprecated. Use module_name and class_name instead.",
                DeprecationWarning,
            )
        self._data_asset_type = data_asset_type
        self._datasource_config = kwargs
        self._batch_kwargs_generators = {}

        self._datasource_config["data_asset_type"] = data_asset_type
        if batch_kwargs_generators is not None:
            self._datasource_config["batch_kwargs_generators"] = batch_kwargs_generators

    @property
    def name(self):
        """
        Property for datasource name
        """
        return self._name

    @property
    def config(self):
        return copy.deepcopy(self._datasource_config)

    @property
    def data_context(self):
        """
        Property for attached DataContext
        """
        return self._data_context

    def _build_generators(self):
        """
        Build batch kwargs generator objects from the datasource configuration.

        Returns:
            None
        """
        try:
            for generator in self._datasource_config["batch_kwargs_generators"].keys():
                self.get_batch_kwargs_generator(generator)
        except KeyError:
            pass

    def add_batch_kwargs_generator(self, name, class_name, **kwargs):
        """Add a BatchKwargGenerator to the datasource.

        Args:
            name (str): the name of the new BatchKwargGenerator to add
            class_name: class of the BatchKwargGenerator to add
            kwargs: additional keyword arguments will be passed directly to the new BatchKwargGenerator's constructor

        Returns:
             BatchKwargGenerator (BatchKwargGenerator)
        """
        kwargs["class_name"] = class_name
        generator = self._build_batch_kwargs_generator(**kwargs)
        if "batch_kwargs_generators" not in self._datasource_config:
            self._datasource_config["batch_kwargs_generators"] = {}
        self._datasource_config["batch_kwargs_generators"][name] = kwargs

        return generator

    def _build_batch_kwargs_generator(self, **kwargs):
        """Build a BatchKwargGenerator using the provided configuration and return the newly-built generator."""
        generator = instantiate_class_from_config(
            config=kwargs,
            runtime_environment={"datasource": self},
            config_defaults={
                "module_name": "great_expectations.datasource.batch_kwargs_generator"
            },
        )
        if not generator:
            raise ClassInstantiationError(
                module_name="great_expectations.datasource.batch_kwargs_generator",
                package_name=None,
                class_name=kwargs["class_name"],
            )

        return generator

    def get_batch_kwargs_generator(self, name):
        """Get the (named) BatchKwargGenerator from a datasource)

        Args:
            name (str): name of BatchKwargGenerator (default value is 'default')

        Returns:
            BatchKwargGenerator (BatchKwargGenerator)
        """
        if name in self._batch_kwargs_generators:
            return self._batch_kwargs_generators[name]
        elif (
            "batch_kwargs_generators" in self._datasource_config
            and name in self._datasource_config["batch_kwargs_generators"]
        ):
            generator_config = copy.deepcopy(
                self._datasource_config["batch_kwargs_generators"][name]
            )
        else:
            raise ValueError(
                "Unable to load batch kwargs generator %s -- no configuration found or invalid configuration."
                % name
            )
        generator = self._build_batch_kwargs_generator(**generator_config)
        self._batch_kwargs_generators[name] = generator
        return generator

    def list_batch_kwargs_generators(self):
        """List currently-configured BatchKwargGenerator for this datasource.

        Returns:
            List(dict): each dictionary includes "name" and "type" keys
        """
        generators = []

        if "batch_kwargs_generators" in self._datasource_config:
            for key, value in self._datasource_config[
                "batch_kwargs_generators"
            ].items():
                generators.append({"name": key, "class_name": value["class_name"]})

        return generators

    # TODO: move to data connector
    def process_batch_parameters(self, limit=None, dataset_options=None):
        """Use datasource-specific configuration to translate any batch parameters into batch kwargs at the datasource
        level.

        Args:
            limit (int): a parameter all datasources must accept to allow limiting a batch to a smaller number of rows.
            dataset_options (dict): a set of kwargs that will be passed to the constructor of a dataset built using
                these batch_kwargs

        Returns:
            batch_kwargs: Result will include both parameters passed via argument and configured parameters.
        """
        batch_kwargs = self._datasource_config.get("batch_kwargs", {})

        if limit is not None:
            batch_kwargs["limit"] = limit

        if dataset_options is not None:
            # Then update with any locally-specified reader options
            if not batch_kwargs.get("dataset_options"):
                batch_kwargs["dataset_options"] = {}
            batch_kwargs["dataset_options"].update(dataset_options)

        return batch_kwargs

    # TODO: move to execution engine or make a wrapper
    def get_batch(self, batch_kwargs, batch_parameters=None):
        """Get a batch of data from the datasource.

        Args:
            batch_kwargs: the BatchKwargs to use to construct the batch
            batch_parameters: optional parameters to store as the reference description of the batch. They should
                reflect parameters that would provide the passed BatchKwargs.


        Returns:
            Batch

        """
        raise NotImplementedError

    def get_available_data_asset_names(self, batch_kwargs_generator_names=None):
        """
        Returns a dictionary of data_asset_names that the specified batch kwarg
        generator can provide. Note that some batch kwargs generators may not be
        capable of describing specific named data assets, and some (such as
        filesystem glob batch kwargs generators) require the user to configure
        data asset names.

        Args:
            batch_kwargs_generator_names: the BatchKwargGenerator for which to get available data asset names.

        Returns:
            dictionary consisting of sets of generator assets available for the specified generators:
            ::

                {
                  generator_name: {
                    names: [ (data_asset_1, data_asset_1_type), (data_asset_2, data_asset_2_type) ... ]
                  }
                  ...
                }

        """
        available_data_asset_names = {}
        if batch_kwargs_generator_names is None:
            batch_kwargs_generator_names = [
                generator["name"] for generator in self.list_batch_kwargs_generators()
            ]
        elif isinstance(batch_kwargs_generator_names, str):
            batch_kwargs_generator_names = [batch_kwargs_generator_names]

        for generator_name in batch_kwargs_generator_names:
            generator = self.get_batch_kwargs_generator(generator_name)
            available_data_asset_names[
                generator_name
            ] = generator.get_available_data_asset_names()
        return available_data_asset_names

    # TODO: move to dataconnector
    def build_batch_kwargs(
        self, batch_kwargs_generator, data_asset_name=None, partition_id=None, **kwargs
    ):
        if kwargs.get("name"):
            if data_asset_name:
                raise ValueError(
                    "Cannot provide both 'name' and 'data_asset_name'. Please use 'data_asset_name' only."
                )
            warnings.warn(
                "name is being deprecated as a batch_parameter. Please use data_asset_name instead.",
                DeprecationWarning,
            )
            data_asset_name = kwargs.pop("name")
        generator_obj = self.get_batch_kwargs_generator(batch_kwargs_generator)
        if partition_id is not None:
            kwargs["partition_id"] = partition_id
        return generator_obj.build_batch_kwargs(
            data_asset_name=data_asset_name, **kwargs
        )
