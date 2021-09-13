import logging
import warnings
from copy import deepcopy

from great_expectations.datasource.batch_kwargs_generator.batch_kwargs_generator import (
    BatchKwargsGenerator,
)
from great_expectations.exceptions import BatchKwargsError, InvalidBatchKwargsError

logger = logging.getLogger(__name__)


class ManualBatchKwargsGenerator(BatchKwargsGenerator):
    """ManualBatchKwargsGenerator returns manually-configured batch_kwargs for named data assets. It provides a
    convenient way to capture complete batch requests without requiring the configuration of a more
    fully-featured batch kwargs generator.

    A fully configured ManualBatchKwargsGenerator in yml might look like the following::

        my_datasource:
          class_name: PandasDatasource
          batch_kwargs_generators:
            my_generator:
              class_name: ManualBatchKwargsGenerator
              assets:
                asset1:
                  - partition_id: 1
                    path: /data/file_1.csv
                    reader_options:
                      sep: ;
                  - partition_id: 2
                    path: /data/file_2.csv
                    reader_options:
                      header: 0
                logs:
                  path: data/log.csv
    """

    recognized_batch_parameters = {"data_asset_name", "partition_id"}

    def __init__(self, name="default", datasource=None, assets=None):
        logger.debug(f"Constructing ManualBatchKwargsGenerator {name!r}")
        super().__init__(name, datasource=datasource)

        if assets is None:
            assets = {}

        self._assets = assets

    @property
    def assets(self):
        return self._assets

    def get_available_data_asset_names(self):
        return {"names": [(key, "manual") for key in self.assets.keys()]}

    def _get_data_asset_config(self, data_asset_name):
        if data_asset_name is None:
            return

        elif data_asset_name in self.assets:
            return self.assets[data_asset_name]

        raise InvalidBatchKwargsError(
            "No asset definition for requested asset %s" % data_asset_name
        )

    def _get_iterator(self, data_asset_name, **kwargs):
        datasource_batch_kwargs = self._datasource.process_batch_parameters(**kwargs)
        asset_definition = deepcopy(self._get_data_asset_config(data_asset_name))
        if isinstance(asset_definition, list):
            for batch_request in asset_definition:
                batch_request.update(datasource_batch_kwargs)
            return iter(asset_definition)
        else:
            asset_definition.update(datasource_batch_kwargs)
            return iter([asset_definition])

    # TODO: deprecate generator_asset argument
    def get_available_partition_ids(self, generator_asset=None, data_asset_name=None):
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

        partition_ids = []
        asset_definition = self._get_data_asset_config(data_asset_name=data_asset_name)
        if isinstance(asset_definition, list):
            for batch_request in asset_definition:
                try:
                    partition_ids.append(batch_request["partition_id"])
                except KeyError:
                    pass
        elif isinstance(asset_definition, dict):
            try:
                partition_ids.append(asset_definition["partition_id"])
            except KeyError:
                pass
        return partition_ids

    def _build_batch_kwargs(self, batch_parameters):
        """Build batch kwargs from a partition id."""
        partition_id = batch_parameters.pop("partition_id", None)
        batch_kwargs = self._datasource.process_batch_parameters(batch_parameters)
        if partition_id:
            asset_definition = self._get_data_asset_config(
                data_asset_name=batch_parameters.get("data_asset_name")
            )
            if isinstance(asset_definition, list):
                for batch_request in asset_definition:
                    try:
                        if batch_request["partition_id"] == partition_id:
                            batch_kwargs = deepcopy(batch_request)
                            batch_kwargs.pop("partition_id")
                    except KeyError:
                        pass
            elif isinstance(asset_definition, dict):
                try:
                    if asset_definition["partition_id"] == partition_id:
                        batch_kwargs = deepcopy(asset_definition)
                        batch_kwargs.pop("partition_id")
                except KeyError:
                    pass
        else:
            batch_kwargs = next(
                self._get_iterator(
                    data_asset_name=batch_parameters.get("data_asset_name")
                )
            )

        if batch_kwargs is not None:
            return batch_kwargs
        else:
            raise BatchKwargsError(
                "Unable to find batch_kwargs for given batch_parameters",
                batch_parameters,
            )
