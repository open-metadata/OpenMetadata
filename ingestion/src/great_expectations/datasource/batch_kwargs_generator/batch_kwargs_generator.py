import logging
import warnings

from great_expectations.core.id_dict import BatchKwargs

logger = logging.getLogger(__name__)


class BatchKwargsGenerator:
    r"""
        BatchKwargsGenerators produce identifying information, called "batch_kwargs" that datasources
        can use to get individual batches of data. They add flexibility in how to obtain data
        such as with time-based partitioning, downsampling, or other techniques appropriate
        for the datasource.

        For example, a batch kwargs generator could produce a SQL query that logically represents "rows in
        the Events table with a timestamp on February 7, 2012," which a SqlAlchemyDatasource
        could use to materialize a SqlAlchemyDataset corresponding to that batch of data and
        ready for validation.

        A batch is a sample from a data asset, sliced according to a particular rule. For
        example, an hourly slide of the Events table or “most recent `users` records.”

        A Batch is the primary unit of validation in the Great Expectations DataContext.
        Batches include metadata that identifies how they were constructed--the same “batch_kwargs”
        assembled by the batch kwargs generator, While not every datasource will enable re-fetching a
        specific batch of data, GE can store snapshots of batches or store metadata from an
        external data version control system.

        Example Generator Configurations follow::

            my_datasource_1:
              class_name: PandasDatasource
              batch_kwargs_generators:
                # This generator will provide two data assets, corresponding to the globs defined under the "file_logs"
                # and "data_asset_2" keys. The file_logs asset will be partitioned according to the match group
                # defined in partition_regex
                default:
                  class_name: GlobReaderBatchKwargsGenerator
                  base_directory: /var/logs
                  reader_options:
                    sep: "
                  globs:
                    file_logs:
                      glob: logs/*.gz
                      partition_regex: logs/file_(\d{0,4})_\.log\.gz
                    data_asset_2:
                      glob: data/*.csv

            my_datasource_2:
              class_name: PandasDatasource
              batch_kwargs_generators:
                # This generator will create one data asset per subdirectory in /data
                # Each asset will have partitions corresponding to the filenames in that subdirectory
                default:
                  class_name: SubdirReaderBatchKwargsGenerator
                  reader_options:
                    sep: "
                  base_directory: /data

            my_datasource_3:
              class_name: SqlalchemyDatasource
              batch_kwargs_generators:
                # This generator will search for a file named with the name of the requested data asset and the
                # .sql suffix to open with a query to use to generate data
                 default:
                    class_name: QueryBatchKwargsGenerator

    --ge-feature-maturity-info--

        id: batch_kwargs_generator_manual
        title: Batch Kwargs Generator - Manual
        icon:
        short_description: Manually configure how files on a filesystem are presented as batches of data
        description: Manually configure how files on a filesystem are presented as batches of data
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: Mostly Stable (key generator functionality will remain but batch API changes still possible)
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Minimal
            bug_risk: Moderate

        id: batch_kwargs_generator_s3
        title: Batch Kwargs Generator - S3
        icon:
        short_description: Present files on S3 as batches of data
        description: Present files on S3 as batches of data for profiling and validation
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: Mostly Stable (expect changes in partitioning)
            implementation_completeness: Partial
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Complete
            documentation_completeness: Minimal
            bug_risk: Moderate

        id: batch_kwargs_generator_glob_reader
        title: Batch Kwargs Generator - Glob Reader
        icon:
        short_description: A configurable way to present files in a directory as batches of data
        description: A configurable way to present files in a directory as batches of data
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: Mostly Stable (expect changes in partitioning)
            implementation_completeness: Partial
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Minimal
            bug_risk: Moderate

        id: batch_kwargs_generator_table
        title: Batch Kwargs Generator - Table
        icon:
        short_description: Present database tables as batches of data
        description: Present database tables as batches of data for validation and profiling
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: Unstable (no existing native support for "partitioning")
            implementation_completeness: Minimal
            unit_test_coverage: Partial
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Partial
            bug_risk: Low

        id: batch_kwargs_generator_query
        title: Batch Kwargs Generator - Query
        icon:
        short_description: Present the result sets of SQL queries as batches of data
        description: Present the result sets of SQL queries as batches of data for validation and profiling
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: Unstable (expect changes in query template configuration and query storage)
            implementation_completeness: Complete
            unit_test_coverage: Partial
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Partial
            bug_risk: Moderate

        id: batch_kwargs_generator_subdir_reader
        title: Batch Kwargs Generator - Subdir Reader
        icon:
        short_description: Present the files in a directory as batches of data
        description: Present the files in a directory as batches of data for profiling and validation.
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: Mostly Stable (new configuration options likely)
            implementation_completeness: Partial
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Minimal
            bug_risk: Low

    --ge-feature-maturity-info--
    """

    _batch_kwargs_type = BatchKwargs
    recognized_batch_parameters = set()

    def __init__(self, name, datasource):
        self._name = name
        self._generator_config = {"class_name": self.__class__.__name__}
        self._data_asset_iterators = {}
        if datasource is None:
            raise ValueError("datasource must be provided for a BatchKwargsGenerator")
        self._datasource = datasource

    @property
    def name(self):
        return self._name

    def _get_iterator(self, data_asset_name, **kwargs):
        raise NotImplementedError

    def get_available_data_asset_names(self):
        """Return the list of asset names known by this batch kwargs generator.

        Returns:
            A list of available names
        """
        raise NotImplementedError

    # TODO: deprecate generator_asset argument
    def get_available_partition_ids(self, generator_asset=None, data_asset_name=None):
        """
        Applies the current _partitioner to the batches available on data_asset_name and returns a list of valid
        partition_id strings that can be used to identify batches of data.

        Args:
            data_asset_name: the data asset whose partitions should be returned.

        Returns:
            A list of partition_id strings
        """
        raise NotImplementedError

    def get_config(self):
        return self._generator_config

    # TODO: deprecate generator_asset argument
    def reset_iterator(self, generator_asset=None, data_asset_name=None, **kwargs):
        assert (generator_asset and not data_asset_name) or (
            not generator_asset and data_asset_name
        ), "Please provide either generator_asset or data_asset_name."
        if generator_asset:
            warnings.warn(
                "The 'generator_asset' argument will be deprecated and renamed to 'data_asset_name'. "
                "Please update code accordingly.",
                DeprecationWarning,
            )
            data_asset_name = generator_asset

        self._data_asset_iterators[data_asset_name] = (
            self._get_iterator(data_asset_name=data_asset_name, **kwargs),
            kwargs,
        )

    # TODO: deprecate generator_asset argument
    def get_iterator(self, generator_asset=None, data_asset_name=None, **kwargs):
        assert (generator_asset and not data_asset_name) or (
            not generator_asset and data_asset_name
        ), "Please provide either generator_asset or data_asset_name."
        if generator_asset:
            warnings.warn(
                "The 'generator_asset' argument will be deprecated and renamed to 'data_asset_name'. "
                "Please update code accordingly.",
                DeprecationWarning,
            )
            data_asset_name = generator_asset

        if data_asset_name in self._data_asset_iterators:
            data_asset_iterator, passed_kwargs = self._data_asset_iterators[
                data_asset_name
            ]
            if passed_kwargs != kwargs:
                logger.warning(
                    "Asked to yield batch_kwargs using different supplemental kwargs. Please reset iterator to "
                    "use different supplemental kwargs."
                )
            return data_asset_iterator
        else:
            self.reset_iterator(data_asset_name=data_asset_name, **kwargs)
            return self._data_asset_iterators[data_asset_name][0]

    def build_batch_kwargs(self, data_asset_name=None, partition_id=None, **kwargs):
        if (not kwargs.get("name") and not data_asset_name) or (
            kwargs.get("name") and data_asset_name
        ):
            raise ValueError("Please provide either name or data_asset_name.")
        if kwargs.get("name"):
            warnings.warn(
                "The 'name' argument will be deprecated and renamed to 'data_asset_name'. "
                "Please update code accordingly.",
                DeprecationWarning,
            )
            data_asset_name = kwargs.pop("name")

        """The key workhorse. Docs forthcoming."""
        if data_asset_name is not None:
            batch_parameters = {"data_asset_name": data_asset_name}
        else:
            batch_parameters = {}
        if partition_id is not None:
            batch_parameters["partition_id"] = partition_id
        batch_parameters.update(kwargs)
        param_keys = set(batch_parameters.keys())
        recognized_params = (
            self.recognized_batch_parameters
            | self._datasource.recognized_batch_parameters
        )
        if not param_keys <= recognized_params:
            logger.warning(
                "Unrecognized batch_parameter(s): %s"
                % str(param_keys - recognized_params)
            )

        batch_kwargs = self._build_batch_kwargs(batch_parameters)
        batch_kwargs["data_asset_name"] = data_asset_name
        # Track the datasource *in batch_kwargs* when building from a context so that the context can easily reuse them.
        batch_kwargs["datasource"] = self._datasource.name
        return batch_kwargs

    def _build_batch_kwargs(self, batch_parameters):
        raise NotImplementedError

    # TODO: deprecate generator_asset argument
    def yield_batch_kwargs(self, data_asset_name=None, generator_asset=None, **kwargs):
        assert (generator_asset and not data_asset_name) or (
            not generator_asset and data_asset_name
        ), "Please provide either generator_asset or data_asset_name."
        if generator_asset:
            warnings.warn(
                "The 'generator_asset' argument will be deprecated and renamed to 'data_asset_name'. "
                "Please update code accordingly.",
                DeprecationWarning,
            )
            data_asset_name = generator_asset

        if data_asset_name not in self._data_asset_iterators:
            self.reset_iterator(data_asset_name=data_asset_name, **kwargs)
        data_asset_iterator, passed_kwargs = self._data_asset_iterators[data_asset_name]
        if passed_kwargs != kwargs:
            logger.warning(
                "Asked to yield batch_kwargs using different supplemental kwargs. Resetting iterator to "
                "use new supplemental kwargs."
            )
            self.reset_iterator(data_asset_name=data_asset_name, **kwargs)
            data_asset_iterator, passed_kwargs = self._data_asset_iterators[
                data_asset_name
            ]
        try:
            batch_kwargs = next(data_asset_iterator)
            batch_kwargs["datasource"] = self._datasource.name
            return batch_kwargs
        except StopIteration:
            self.reset_iterator(data_asset_name=data_asset_name, **kwargs)
            data_asset_iterator, passed_kwargs = self._data_asset_iterators[
                data_asset_name
            ]
            if passed_kwargs != kwargs:
                logger.warning(
                    "Asked to yield batch_kwargs using different batch parameters. Resetting iterator to "
                    "use different batch parameters."
                )
                self.reset_iterator(data_asset_name=data_asset_name, **kwargs)
                data_asset_iterator, passed_kwargs = self._data_asset_iterators[
                    data_asset_name
                ]
            try:
                batch_kwargs = next(data_asset_iterator)
                batch_kwargs["datasource"] = self._datasource.name
                return batch_kwargs
            except StopIteration:
                # This is a degenerate case in which no kwargs are actually being generated
                logger.warning(
                    "No batch_kwargs found for data_asset_name %s" % data_asset_name
                )
                return {}
        except TypeError:
            # If we don't actually have an iterator we can generate, even after resetting, just return empty
            logger.warning(
                "Unable to generate batch_kwargs for data_asset_name %s"
                % data_asset_name
            )
            return {}
