import inspect
import logging
import os
from mimetypes import guess_type

from great_expectations.data_context.types.resource_identifiers import (
    ExpectationSuiteIdentifier,
    GeCloudIdentifier,
    SiteSectionIdentifier,
    ValidationResultIdentifier,
)
from great_expectations.data_context.util import (
    file_relative_path,
    instantiate_class_from_config,
    load_class,
)
from great_expectations.exceptions import ClassInstantiationError, DataContextError
from great_expectations.util import (
    filter_properties_dict,
    verify_dynamic_loading_support,
)

from ...core.data_context_key import DataContextKey
from .ge_cloud_store_backend import GeCloudStoreBackend
from .tuple_store_backend import TupleStoreBackend

logger = logging.getLogger(__name__)


class HtmlSiteStore:
    """
    A HtmlSiteStore facilitates publishing rendered documentation built from Expectation Suites, Profiling Results, and Validation Results.

    --ge-feature-maturity-info--

        id: html_site_store_filesystem
        title: HTML Site Store - Filesystem
        icon:
        short_description: DataDocs on Filesystem
        description: For publishing rendered documentation built from Expectation Suites, Profiling Results, and Validation Results on the Filesystem
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_data_docs/how_to_host_and_share_data_docs_on_a_filesystem.html
        maturity: Production
        maturity_details:
            api_stability: Mostly Stable (profiling)
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: N/A
            documentation_completeness: Partial
            bug_risk: Low

        id: html_site_store_s3
        title: HTML Site Store - S3
        icon:
        short_description: DataDocs on S3
        description: For publishing rendered documentation built from Expectation Suites, Profiling Results, and Validation Results on S3
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_data_docs/how_to_host_and_share_data_docs_on_s3.html
        maturity: Beta
        maturity_details:
            api_stability: Mostly Stable (profiling)
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Complete
            bug_risk: Moderate

        id: html_site_store_gcs
        title: HTMLSiteStore - GCS
        icon:
        short_description: DataDocs on GCS
        description: For publishing rendered documentation built from Expectation Suites, Profiling Results, and Validation Results on GCS
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_data_docs/how_to_host_and_share_data_docs_on_gcs.html
        maturity: Beta
        maturity_details:
            api_stability: Mostly Stable (profiling)
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Partial (needs auth)
            bug_risk: Moderate (resource URL may have bugs)

        id: html_site_store_azure_blob_storage
        title: HTMLSiteStore - Azure
        icon:
        short_description: DataDocs on Azure Blob Storage
        description: For publishing rendered documentation built from Expectation Suites, Profiling Results, and Validation Results on Azure Blob Storage
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_data_docs/how_to_host_and_share_data_docs_on_azure_blob_storage.html
        maturity: N/A
        maturity_details:
            api_stability: Mostly Stable (profiling)
            implementation_completeness: Minimal
            unit_test_coverage: Minimal
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Minimal
            bug_risk: Moderate

    --ge-feature-maturity-info--
    """

    _key_class = SiteSectionIdentifier

    def __init__(self, store_backend=None, runtime_environment=None):
        store_backend_module_name = store_backend.get(
            "module_name", "great_expectations.data_context.store"
        )
        store_backend_class_name = store_backend.get(
            "class_name", "TupleFilesystemStoreBackend"
        )
        verify_dynamic_loading_support(module_name=store_backend_module_name)
        store_class = load_class(store_backend_class_name, store_backend_module_name)

        # Store Class was loaded successfully; verify that it is of a correct subclass.
        if not issubclass(store_class, (TupleStoreBackend, GeCloudStoreBackend)):
            raise DataContextError(
                "Invalid configuration: HtmlSiteStore needs a TupleStoreBackend or GeCloudStoreBackend"
            )
        if "filepath_template" in store_backend or (
            "fixed_length_key" in store_backend
            and store_backend["fixed_length_key"] is True
        ):
            logger.warning(
                "Configuring a filepath_template or using fixed_length_key is not supported in SiteBuilder: "
                "filepaths will be selected based on the type of asset rendered."
            )

        # One thing to watch for is reversibility of keys.
        # If several types are being written to overlapping directories, we could get collisions.
        module_name = "great_expectations.data_context.store"
        filepath_suffix = ".html"
        is_ge_cloud_store = store_backend["class_name"] == "GeCloudStoreBackend"
        expectation_config_defaults = {
            "module_name": module_name,
            "filepath_prefix": "expectations",
            "filepath_suffix": filepath_suffix,
            "suppress_store_backend_id": True,
        }
        if is_ge_cloud_store:
            expectation_config_defaults = {
                "module_name": module_name,
                "suppress_store_backend_id": True,
            }
        expectation_suite_identifier_obj = instantiate_class_from_config(
            config=store_backend,
            runtime_environment=runtime_environment,
            config_defaults=expectation_config_defaults,
        )
        if not expectation_suite_identifier_obj:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=store_backend["class_name"],
            )

        validation_result_config_defaults = {
            "module_name": module_name,
            "filepath_prefix": "validations",
            "filepath_suffix": filepath_suffix,
            "suppress_store_backend_id": True,
        }
        if is_ge_cloud_store:
            validation_result_config_defaults = {
                "module_name": module_name,
                "suppress_store_backend_id": True,
            }

        validation_result_idendifier_obj = instantiate_class_from_config(
            config=store_backend,
            runtime_environment=runtime_environment,
            config_defaults=validation_result_config_defaults,
        )
        if not validation_result_idendifier_obj:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=store_backend["class_name"],
            )

        filepath_template = "index.html"
        index_page_config_defaults = {
            "module_name": module_name,
            "filepath_template": filepath_template,
            "suppress_store_backend_id": True,
        }
        if is_ge_cloud_store:
            index_page_config_defaults = {
                "module_name": module_name,
                "suppress_store_backend_id": True,
            }

        index_page_obj = instantiate_class_from_config(
            config=store_backend,
            runtime_environment=runtime_environment,
            config_defaults=index_page_config_defaults,
        )
        if not index_page_obj:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=store_backend["class_name"],
            )

        static_assets_config_defaults = {
            "module_name": module_name,
            "filepath_template": None,
            "suppress_store_backend_id": True,
        }
        if is_ge_cloud_store:
            static_assets_config_defaults = {
                "module_name": module_name,
                "suppress_store_backend_id": True,
            }
        static_assets_obj = instantiate_class_from_config(
            config=store_backend,
            runtime_environment=runtime_environment,
            config_defaults=static_assets_config_defaults,
        )
        if not static_assets_obj:
            raise ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=store_backend["class_name"],
            )

        self.store_backends = {
            ExpectationSuiteIdentifier: expectation_suite_identifier_obj,
            ValidationResultIdentifier: validation_result_idendifier_obj,
            "index_page": index_page_obj,
            "static_assets": static_assets_obj,
        }

        # NOTE: Instead of using the filesystem as the source of record for keys,
        # this class tracks keys separately in an internal set.
        # This means that keys are stored for a specific session, but can't be fetched after the original
        # HtmlSiteStore instance leaves scope.
        # Doing it this way allows us to prevent namespace collisions among keys while still having multiple
        # backends that write to the same directory structure.
        # It's a pretty reasonable way for HtmlSiteStore to do its job---you just have to remember that it
        # can't necessarily set and list_keys like most other Stores.
        self.keys = set()

        # Gather the call arguments of the present function (include the "module_name" and add the "class_name"), filter
        # out the Falsy values, and set the instance "_config" variable equal to the resulting dictionary.
        self._config = {
            "store_backend": store_backend,
            "runtime_environment": runtime_environment,
            "module_name": self.__class__.__module__,
            "class_name": self.__class__.__name__,
        }
        filter_properties_dict(properties=self._config, clean_falsy=True, inplace=True)

    def get(self, key):
        self._validate_key(key)
        return self.store_backends[type(key.resource_identifier)].get(key.to_tuple())

    def set(self, key, serialized_value):
        self._validate_key(key)
        self.keys.add(key)

        return self.store_backends[type(key.resource_identifier)].set(
            key.resource_identifier.to_tuple(),
            serialized_value,
            content_encoding="utf-8",
            content_type="text/html; charset=utf-8",
        )

    def get_url_for_resource(self, resource_identifier=None, only_if_exists=True):
        """
        Return the URL of the HTML document that renders a resource
        (e.g., an expectation suite or a validation result).

        :param resource_identifier: ExpectationSuiteIdentifier, ValidationResultIdentifier
                or any other type's identifier. The argument is optional - when
                not supplied, the method returns the URL of the index page.
        :return: URL (string)
        """
        if resource_identifier is None:
            store_backend = self.store_backends["index_page"]
            key = ()
        elif isinstance(resource_identifier, ExpectationSuiteIdentifier):
            store_backend = self.store_backends[ExpectationSuiteIdentifier]
            key = resource_identifier.to_tuple()
        elif isinstance(resource_identifier, ValidationResultIdentifier):
            store_backend = self.store_backends[ValidationResultIdentifier]
            key = resource_identifier.to_tuple()
        else:
            # this method does not support getting the URL of static assets
            raise ValueError(
                f"Cannot get URL for resource {str(resource_identifier):s}"
            )

        # <WILL> : this is a hack for Taylor. Change this back. 20200924
        # if only_if_exists:
        #    return (
        #        store_backend.get_url_for_key(key)
        #        if store_backend.has_key(key)
        #        else None
        #    )
        # return store_backend.get_url_for_key(key)

        if store_backend.base_public_path:
            if only_if_exists:
                return (
                    store_backend.get_public_url_for_key(key)
                    if store_backend.has_key(key)
                    else None
                )
            else:
                return store_backend.get_public_url_for_key(key)
        else:
            if only_if_exists:
                return (
                    store_backend.get_url_for_key(key)
                    if store_backend.has_key(key)
                    else None
                )
            else:
                return store_backend.get_url_for_key(key)

    def _validate_key(self, key):
        if not isinstance(key, SiteSectionIdentifier):
            raise TypeError(
                "key: {!r} must be a SiteSectionIdentifier, not {!r}".format(
                    key,
                    type(key),
                )
            )

        for key_class in self.store_backends.keys():
            try:
                if isinstance(key.resource_identifier, key_class):
                    return

            except TypeError:
                # it's ok to have a key that is not a type (e.g. the string "index_page")
                continue

        # The key's resource_identifier didn't match any known key_class
        raise TypeError(
            "resource_identifier in key: {!r} must one of {}, not {!r}".format(
                key,
                set(self.store_backends.keys()),
                type(key),
            )
        )

    def list_keys(self):
        keys = []
        for type_, backend in self.store_backends.items():
            try:
                # If the store_backend does not support list_keys...
                key_tuples = backend.list_keys()
            except NotImplementedError:
                pass
            try:
                if issubclass(type_, DataContextKey):
                    keys += [type_.from_tuple(tuple_) for tuple_ in key_tuples]
            except TypeError:
                # If the key in store_backends is not itself a type...
                pass
        return keys

    def write_index_page(self, page):
        """This third param_store has a special method, which uses a zero-length tuple as a key."""
        return self.store_backends["index_page"].set(
            (),
            page,
            content_encoding="utf-8",
            content_type="text/html; " "charset=utf-8",
        )

    def clean_site(self):
        for _, target_store_backend in self.store_backends.items():
            keys = target_store_backend.list_keys()
            for key in keys:
                target_store_backend.remove_key(key)

    def copy_static_assets(self, static_assets_source_dir=None):
        """
        Copies static assets, using a special "static_assets" backend store that accepts variable-length tuples as
        keys, with no filepath_template.
        """
        file_exclusions = [".DS_Store"]
        dir_exclusions = []

        if not static_assets_source_dir:
            static_assets_source_dir = file_relative_path(
                __file__, os.path.join("..", "..", "render", "view", "static")
            )

        for item in os.listdir(static_assets_source_dir):
            # Directory
            if os.path.isdir(os.path.join(static_assets_source_dir, item)):
                if item in dir_exclusions:
                    continue
                # Recurse
                new_source_dir = os.path.join(static_assets_source_dir, item)
                self.copy_static_assets(new_source_dir)
            # File
            else:
                # Copy file over using static assets store backend
                if item in file_exclusions:
                    continue
                source_name = os.path.join(static_assets_source_dir, item)
                with open(source_name, "rb") as f:
                    # Only use path elements starting from static/ for key
                    store_key = tuple(os.path.normpath(source_name).split(os.sep))
                    store_key = store_key[store_key.index("static") :]
                    content_type, content_encoding = guess_type(item, strict=False)

                    if content_type is None:
                        # Use GE-known content-type if possible
                        if source_name.endswith(".otf"):
                            content_type = "font/opentype"
                        else:
                            # fallback
                            logger.warning(
                                "Unable to automatically determine content_type for {}".format(
                                    source_name
                                )
                            )
                            content_type = "text/html; charset=utf8"

                    if not isinstance(
                        self.store_backends["static_assets"], GeCloudStoreBackend
                    ):
                        self.store_backends["static_assets"].set(
                            store_key,
                            f.read(),
                            content_encoding=content_encoding,
                            content_type=content_type,
                        )

    @property
    def config(self) -> dict:
        return self._config
