import json
import logging
from typing import Dict

from great_expectations.core.data_context_key import DataContextKey
from great_expectations.data_context.store.ge_cloud_store_backend import (
    GeCloudStoreBackend,
)
from great_expectations.data_context.store.store_backend import StoreBackend
from great_expectations.data_context.types.resource_identifiers import GeCloudIdentifier
from great_expectations.data_context.util import instantiate_class_from_config
from great_expectations.exceptions import ClassInstantiationError, DataContextError

logger = logging.getLogger(__name__)


class Store:
    """A store is responsible for reading and writing Great Expectations objects
    to appropriate backends. It provides a generic API that the DataContext can
    use independently of any particular ORM and backend.

    An implementation of a store will generally need to define the following:
      - serialize
      - deserialize
      - _key_class (class of expected key type)

    All keys must have a to_tuple() method.
    """

    _key_class = DataContextKey

    def __init__(
        self, store_backend=None, runtime_environment=None, store_name="no_store_name"
    ):
        """
        Runtime environment may be necessary to instantiate store backend elements.
        Args:
            store_backend:
            runtime_environment:
            store_name: store name given in the DataContextConfig (via either in-code or yaml configuration)
        """
        if store_backend is None:
            store_backend = {"class_name": "InMemoryStoreBackend"}
        self._store_name = store_name
        logger.debug("Building store_backend.")
        module_name = "great_expectations.data_context.store"
        self._store_backend = instantiate_class_from_config(
            config=store_backend,
            runtime_environment=runtime_environment or {},
            config_defaults={
                "module_name": module_name,
                "store_name": self._store_name,
            },
        )
        if not self._store_backend:
            raise ClassInstantiationError(
                module_name=module_name, package_name=None, class_name=store_backend
            )
        if not isinstance(self._store_backend, StoreBackend):
            raise DataContextError(
                "Invalid StoreBackend configuration: expected a StoreBackend instance."
            )
        self._use_fixed_length_key = self._store_backend.fixed_length_key

    def ge_cloud_response_json_to_object_dict(self, response_json: Dict) -> Dict:
        """
        This method takes full json response from GE cloud and outputs a dict appropriate for
        deserialization into a GE object
        """
        return response_json

    def _validate_key(self, key):
        # STORE_BACKEND_ID_KEY always validated
        if key == StoreBackend.STORE_BACKEND_ID_KEY:
            return
        elif not isinstance(key, self.key_class):
            raise TypeError(
                "key must be an instance of %s, not %s"
                % (self.key_class.__name__, type(key))
            )

    @property
    def ge_cloud_mode(self):
        return isinstance(self._store_backend, GeCloudStoreBackend)

    @property
    def store_backend(self):
        return self._store_backend

    @property
    def store_name(self):
        return self._store_name

    @property
    def store_backend_id(self) -> str:
        """
        Report the store_backend_id of the currently-configured StoreBackend
        Returns:
            store_backend_id which is a UUID(version=4)
        """
        return self._store_backend.store_backend_id

    @property
    def key_class(self):
        if self.ge_cloud_mode:
            return GeCloudIdentifier
        return self._key_class

    @property
    def store_backend_id_warnings_suppressed(self):
        """
        Report the store_backend_id of the currently-configured StoreBackend, suppressing warnings for invalid configurations.
        Returns:
            store_backend_id which is a UUID(version=4)
        """
        return self._store_backend.store_backend_id_warnings_suppressed

    # noinspection PyMethodMayBeStatic
    def serialize(self, key, value):
        return value

    # noinspection PyMethodMayBeStatic
    def key_to_tuple(self, key):
        if self._use_fixed_length_key:
            return key.to_fixed_length_tuple()
        return key.to_tuple()

    def tuple_to_key(self, tuple_):
        if tuple_ == StoreBackend.STORE_BACKEND_ID_KEY:
            return StoreBackend.STORE_BACKEND_ID_KEY[0]
        if self._use_fixed_length_key:
            return self.key_class.from_fixed_length_tuple(tuple_)
        return self.key_class.from_tuple(tuple_)

    # noinspection PyMethodMayBeStatic
    def deserialize(self, key, value):
        return value

    def get(self, key):
        if key == StoreBackend.STORE_BACKEND_ID_KEY:
            return self._store_backend.get(key)
        elif self.ge_cloud_mode:
            self._validate_key(key)
            value = self._store_backend.get(self.key_to_tuple(key))
            # TODO [Robby] MER-285: Handle non-200 http errors
            if value:
                value = self.ge_cloud_response_json_to_object_dict(response_json=value)
        else:
            self._validate_key(key)
            value = self._store_backend.get(self.key_to_tuple(key))

        if value:
            return self.deserialize(key, value)
        else:
            return None

    def set(self, key, value, **kwargs):
        if key == StoreBackend.STORE_BACKEND_ID_KEY:
            return self._store_backend.set(key, value, **kwargs)
        else:
            self._validate_key(key)
            return self._store_backend.set(
                self.key_to_tuple(key), self.serialize(key, value), **kwargs
            )

    def list_keys(self):
        keys_without_store_backend_id = [
            key
            for key in self._store_backend.list_keys()
            if not key == StoreBackend.STORE_BACKEND_ID_KEY
        ]
        return [self.tuple_to_key(key) for key in keys_without_store_backend_id]

    def has_key(self, key):
        if key == StoreBackend.STORE_BACKEND_ID_KEY:
            return self._store_backend.has_key(key)
        else:
            if self._use_fixed_length_key:
                return self._store_backend.has_key(key.to_fixed_length_tuple())
            return self._store_backend.has_key(key.to_tuple())

    def self_check(self, pretty_print):
        NotImplementedError(
            f"The test method is not implemented for Store class {self.__class__.__name__}."
        )

    @property
    def config(self) -> dict:
        raise NotImplementedError
