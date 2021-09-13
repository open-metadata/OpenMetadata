import logging
from typing import Optional

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap

import great_expectations.exceptions as ge_exceptions
from great_expectations.data_context.store import GeCloudStoreBackend
from great_expectations.data_context.store.store import Store
from great_expectations.data_context.store.tuple_store_backend import TupleStoreBackend
from great_expectations.data_context.types.base import BaseYamlConfig
from great_expectations.data_context.types.resource_identifiers import (
    ConfigurationIdentifier,
)
from great_expectations.data_context.util import load_class
from great_expectations.util import (
    filter_properties_dict,
    verify_dynamic_loading_support,
)

yaml = YAML()

yaml.indent(mapping=2, sequence=4, offset=2)
yaml.default_flow_style = False

logger = logging.getLogger(__name__)


class ConfigurationStore(Store):

    """
    Configuration Store provides a way to store any Marshmallow Schema compatible Configuration (using the YAML format).
    """

    _key_class = ConfigurationIdentifier

    _configuration_class = BaseYamlConfig

    def __init__(
        self,
        store_name: str,
        store_backend: Optional[dict] = None,
        overwrite_existing: bool = False,
        runtime_environment: Optional[dict] = None,
    ):
        if not issubclass(self._configuration_class, BaseYamlConfig):
            raise ge_exceptions.DataContextError(
                "Invalid configuration: A configuration_class needs to inherit from the BaseYamlConfig class."
            )

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
            if issubclass(store_backend_class, TupleStoreBackend):
                # Provide defaults for this common case
                store_backend["filepath_template"] = store_backend.get(
                    "filepath_template", "{0}.yml"
                )

        super().__init__(
            store_backend=store_backend,
            runtime_environment=runtime_environment,
            store_name=store_name,
        )

        # Gather the call arguments of the present function (include the "module_name" and add the "class_name"), filter
        # out the Falsy values, and set the instance "_config" variable equal to the resulting dictionary.
        self._config = {
            "store_name": store_name,
            "store_backend": store_backend,
            "overwrite_existing": overwrite_existing,
            "runtime_environment": runtime_environment,
            "module_name": self.__class__.__module__,
            "class_name": self.__class__.__name__,
        }
        filter_properties_dict(properties=self._config, clean_falsy=True, inplace=True)

        self._overwrite_existing = overwrite_existing

    def remove_key(self, key):
        return self.store_backend.remove_key(key)

    def serialize(self, key, value):
        if self.ge_cloud_mode:
            # GeCloudStoreBackend expects a json str
            config_schema = value.get_schema_class()()
            return config_schema.dump(value)
        return value.to_yaml_str()

    def deserialize(self, key, value):
        config = value
        if isinstance(value, str):
            config: CommentedMap = yaml.load(value)
        try:
            return self._configuration_class.from_commented_map(commented_map=config)
        except ge_exceptions.InvalidBaseYamlConfigError:
            # Just to be explicit about what we intended to catch
            raise

    @property
    def overwrite_existing(self) -> bool:
        return self._overwrite_existing

    @overwrite_existing.setter
    def overwrite_existing(self, overwrite_existing: bool):
        self._overwrite_existing = overwrite_existing

    @property
    def config(self) -> dict:
        return self._config

    def self_check(self, pretty_print: bool = True) -> dict:
        # Provide visibility into parameters that ConfigurationStore was instantiated with.
        report_object: dict = {"config": self.config}

        if pretty_print:
            print("Checking for existing keys...")

        report_object["keys"] = sorted(
            key.configuration_key for key in self.list_keys()
        )

        report_object["len_keys"] = len(report_object["keys"])
        len_keys: int = report_object["len_keys"]

        if pretty_print:
            if report_object["len_keys"] == 0:
                print(f"\t{len_keys} keys found")
            else:
                print(f"\t{len_keys} keys found:")
                for key in report_object["keys"][:10]:
                    print("\t\t" + str(key))
            if len_keys > 10:
                print("\t\t...")
            print()

        self.serialization_self_check(pretty_print=pretty_print)

        return report_object

    def serialization_self_check(self, pretty_print: bool):
        raise NotImplementedError
