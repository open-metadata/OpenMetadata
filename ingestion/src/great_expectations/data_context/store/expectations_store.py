import random
import uuid
from typing import Dict

from great_expectations.core import ExpectationSuite
from great_expectations.core.expectation_suite import ExpectationSuiteSchema
from great_expectations.data_context.store import GeCloudStoreBackend
from great_expectations.data_context.store.database_store_backend import (
    DatabaseStoreBackend,
)
from great_expectations.data_context.store.store import Store
from great_expectations.data_context.store.tuple_store_backend import TupleStoreBackend
from great_expectations.data_context.types.resource_identifiers import (
    ExpectationSuiteIdentifier,
    GeCloudIdentifier,
)
from great_expectations.data_context.util import load_class
from great_expectations.util import (
    filter_properties_dict,
    verify_dynamic_loading_support,
)


class ExpectationsStore(Store):
    """
    An Expectations Store provides a way to store Expectation Suites accessible to a Data Context.

    --ge-feature-maturity-info--

        id: expectations_store_git
        title: Expectation Store - Git
        icon:
        short_description: Store Expectations in Git
        description: Use a git repository to store expectation suites.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_metadata_stores/how_to_configure_an_expectation_store_on_a_filesystem.html#additional-notes
        maturity: Production
        maturity_details:
            api_stability: Stable
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Complete
            bug_risk: Low

        id: expectations_store_filesystem
        title: Expectation Store - Filesystem
        icon:
        short_description: Filesystem-based Expectations Store
        description: Filesystem-based Expectations Store
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_metadata_stores/how_to_configure_an_expectation_store_on_a_filesystem.html
        maturity: Production
        maturity_details:
            api_stability: Stable
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Complete
            bug_risk: Low

        id: expectations_store_s3
        title: Expectation Store - S3
        icon:
        short_description: S3
        description: Use an Amazon Web Services S3 bucket to store expectations.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_metadata_stores/how_to_configure_an_expectation_store_in_amazon_s3.html
        maturity: Beta
        maturity_details:
            api_stability: Stable
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Complete
            bug_risk: Low

        id: expectations_store_gcs
        title: Expectation Store - GCS
        icon:
        short_description: Cloud Storage
        description: Use a Google Cloud Platform Cloud Storage bucket to store expectations.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_metadata_stores/how_to_configure_an_expectation_store_in_gcs.html
        maturity: Beta
        maturity_details:
            api_stability: Stable
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Partial
            bug_risk: Low

        id: expectations_store_azure_blob_storage
        title: Expectation Store - Azure
        icon:
        short_description: Azure Blob Storage
        description:  Use Microsoft Azure Blob Storage to store expectations.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_metadata_stores/how_to_configure_an_expectation_store_in_azure_blob_storage.html
        maturity: N/A
        maturity_details:
            api_stability: Stable
            implementation_completeness: Minimal
            unit_test_coverage: Minimal
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Minimal
            bug_risk: Moderate

    --ge-feature-maturity-info--
    """

    _key_class = ExpectationSuiteIdentifier

    def __init__(self, store_backend=None, runtime_environment=None, store_name=None):
        self._expectationSuiteSchema = ExpectationSuiteSchema()

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
                store_backend["filepath_suffix"] = store_backend.get(
                    "filepath_suffix", ".json"
                )
            elif issubclass(store_backend_class, DatabaseStoreBackend):
                # Provide defaults for this common case
                store_backend["table_name"] = store_backend.get(
                    "table_name", "ge_expectations_store"
                )
                store_backend["key_columns"] = store_backend.get(
                    "key_columns", ["expectation_suite_name"]
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
        ge_cloud_expectation_suite_id = response_json["data"]["id"]
        expectation_suite_dict = response_json["data"]["attributes"]["suite"]
        expectation_suite_dict["ge_cloud_id"] = ge_cloud_expectation_suite_id

        return expectation_suite_dict

    def remove_key(self, key):
        return self.store_backend.remove_key(key)

    def serialize(self, key, value):
        if self.ge_cloud_mode:
            # GeCloudStoreBackend expects a json str
            return self._expectationSuiteSchema.dump(value)
        return self._expectationSuiteSchema.dumps(value, indent=2, sort_keys=True)

    def deserialize(self, key, value):
        if isinstance(value, dict):
            return self._expectationSuiteSchema.load(value)
        else:
            return self._expectationSuiteSchema.loads(value)

    def self_check(self, pretty_print):
        return_obj = {}

        if pretty_print:
            print("Checking for existing keys...")

        return_obj["keys"] = self.list_keys()
        return_obj["len_keys"] = len(return_obj["keys"])
        len_keys = return_obj["len_keys"]

        if pretty_print:
            if return_obj["len_keys"] == 0:
                print(f"\t{len_keys} keys found")
            else:
                print(f"\t{len_keys} keys found:")
                for key in return_obj["keys"][:10]:
                    print("\t\t" + str(key))
            if len_keys > 10:
                print("\t\t...")
            print()

        test_key_name = "test-key-" + "".join(
            [random.choice(list("0123456789ABCDEF")) for i in range(20)]
        )
        if self.ge_cloud_mode:
            test_key: GeCloudIdentifier = self.key_class(
                resource_type="contract", ge_cloud_id=str(uuid.uuid4())
            )
        else:
            test_key: ExpectationSuiteIdentifier = self.key_class(test_key_name)
        test_value = ExpectationSuite(test_key_name)

        if pretty_print:
            print(f"Attempting to add a new test key: {test_key}...")
        self.set(key=test_key, value=test_value)
        if pretty_print:
            print("\tTest key successfully added.")
            print()

        if pretty_print:
            print(
                f"Attempting to retrieve the test value associated with key: {test_key}..."
            )
        test_value = self.get(
            key=test_key,
        )
        if pretty_print:
            print("\tTest value successfully retrieved.")
            print()

        if pretty_print:
            print(f"Cleaning up test key and value: {test_key}...")

        test_value = self.remove_key(
            # key=self.key_to_tuple(test_key),
            key=self.key_to_tuple(test_key),
        )
        if pretty_print:
            print("\tTest key and value successfully removed.")
            print()

        return return_obj
