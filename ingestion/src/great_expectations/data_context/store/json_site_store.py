import random
import uuid
from json import dumps, loads
from typing import Dict

from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
    ExpectationSuiteValidationResultSchema,
)
from great_expectations.data_context.store import GeCloudStoreBackend
from great_expectations.data_context.store.database_store_backend import (
    DatabaseStoreBackend,
)
from great_expectations.data_context.store.store import Store
from great_expectations.data_context.store.tuple_store_backend import TupleStoreBackend
from great_expectations.data_context.types.resource_identifiers import (
    ExpectationSuiteIdentifier,
    GeCloudIdentifier,
    ValidationResultIdentifier,
)
from great_expectations.data_context.util import load_class
from great_expectations.render.types import RenderedDocumentContent
from great_expectations.util import (
    filter_properties_dict,
    verify_dynamic_loading_support,
)


class JsonSiteStore(Store):
    """
    A JsonSiteStore manages the JSON artifacts of our renderers, which allows us to render them into final views in HTML by GE Cloud.

    """

    def __init__(self, store_backend=None, runtime_environment=None, store_name=None):

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

        super().__init__(
            store_backend=store_backend,
            runtime_environment=runtime_environment,
            store_name=store_name,
        )

        # Gather the call arguments of the present function (include the "module_name" and add the "class_name"), filter
        # out the Falsy values, and set the instance "_config" variable equal to the resulting dictionary.
        self._config = {
            "store_backend": store_backend,
            "runtime_environment": runtime_environment,
            "store_name": store_name,
            "module_name": self.__class__.__module__,
            "class_name": self.__class__.__name__,
        }
        filter_properties_dict(properties=self._config, clean_falsy=True, inplace=True)

    def ge_cloud_response_json_to_object_dict(self, response_json: Dict) -> Dict:
        """
        This method takes full json response from GE cloud and outputs a dict appropriate for
        deserialization into a GE object
        """
        ge_cloud_json_site_id = response_json["data"]["id"]
        json_site_dict = response_json["data"]["attributes"]["rendered_data_doc"]
        json_site_dict["ge_cloud_id"] = ge_cloud_json_site_id

        return json_site_dict

    def serialize(self, key, value):
        return value.to_json_dict()

    def deserialize(self, key, value):
        return RenderedDocumentContent(**loads(value))

    def self_check(self, pretty_print):
        NotImplementedError(
            f"The test method is not implemented for Store class {self.__class__.__name__}."
        )

    @property
    def config(self) -> dict:
        return self._config
