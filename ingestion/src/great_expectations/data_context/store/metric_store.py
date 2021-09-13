import json

from great_expectations.core.metric import ValidationMetricIdentifier
from great_expectations.core.util import ensure_json_serializable
from great_expectations.data_context.store.database_store_backend import (
    DatabaseStoreBackend,
)
from great_expectations.data_context.store.store import Store
from great_expectations.util import (
    filter_properties_dict,
    load_class,
    verify_dynamic_loading_support,
)


class MetricStore(Store):
    """
    A MetricStore stores ValidationMetric information to be used between runs.
    """

    _key_class = ValidationMetricIdentifier

    def __init__(self, store_backend=None, store_name=None):
        if store_backend is not None:
            store_backend_module_name = store_backend.get(
                "module_name", "great_expectations.data_context.store"
            )
            store_backend_class_name = store_backend.get(
                "class_name", "InMemoryStoreBackend"
            )
            verify_dynamic_loading_support(module_name=store_backend_module_name)
            store_backend_class = load_class(
                store_backend_class_name, store_backend_module_name
            )

            if issubclass(store_backend_class, DatabaseStoreBackend):
                # Provide defaults for this common case
                if "table_name" not in store_backend:
                    store_backend["table_name"] = store_backend.get(
                        "table_name", "ge_metrics"
                    )
                if "key_columns" not in store_backend:
                    store_backend["key_columns"] = store_backend.get(
                        "key_columns",
                        [
                            "run_name",
                            "run_time",
                            "data_asset_name",
                            "expectation_suite_identifier",
                            "metric_name",
                            "metric_kwargs_id",
                        ],
                    )

        super().__init__(store_backend=store_backend, store_name=store_name)

    # noinspection PyMethodMayBeStatic
    def _validate_value(self, value):
        # Values must be json serializable since they must be inputs to expectation configurations
        ensure_json_serializable(value)

    def serialize(self, key, value):
        return json.dumps({"value": value})

    def deserialize(self, key, value):
        if value:
            return json.loads(value)["value"]


class EvaluationParameterStore(MetricStore):
    def __init__(self, store_backend=None, store_name=None):
        if store_backend is not None:
            store_backend_module_name = store_backend.get(
                "module_name", "great_expectations.data_context.store"
            )
            store_backend_class_name = store_backend.get(
                "class_name", "InMemoryStoreBackend"
            )
            verify_dynamic_loading_support(module_name=store_backend_module_name)
            store_backend_class = load_class(
                store_backend_class_name, store_backend_module_name
            )

            # Store Backend Class was loaded successfully; verify that it is of a correct subclass.
            if issubclass(store_backend_class, DatabaseStoreBackend):
                # Provide defaults for this common case
                store_backend["table_name"] = store_backend.get(
                    "table_name", "ge_evaluation_parameters"
                )
        super().__init__(store_backend=store_backend, store_name=store_name)

        # Gather the call arguments of the present function (include the "module_name" and add the "class_name"), filter
        # out the Falsy values, and set the instance "_config" variable equal to the resulting dictionary.
        self._config = {
            "store_backend": store_backend,
            "store_name": store_name,
            "module_name": self.__class__.__module__,
            "class_name": self.__class__.__name__,
        }
        filter_properties_dict(properties=self._config, clean_falsy=True, inplace=True)

    def get_bind_params(self, run_id):
        params = {}
        for k in self._store_backend.list_keys(run_id.to_tuple()):
            key = self.tuple_to_key(k)
            params[key.to_evaluation_parameter_urn()] = self.get(key)
        return params

    @property
    def config(self) -> dict:
        return self._config
