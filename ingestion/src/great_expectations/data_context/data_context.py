import configparser
import copy
import datetime
import errno
import glob
import itertools
import json
import logging
import os
import shutil
import sys
import traceback
import uuid
import warnings
import webbrowser
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Union, cast

from dateutil.parser import parse
from ruamel.yaml import YAML, YAMLError
from ruamel.yaml.comments import CommentedMap
from ruamel.yaml.constructor import DuplicateKeyError

import great_expectations.exceptions as ge_exceptions
from great_expectations.checkpoint import Checkpoint, LegacyCheckpoint, SimpleCheckpoint
from great_expectations.checkpoint.types.checkpoint_result import CheckpointResult
from great_expectations.core.batch import (
    Batch,
    BatchRequest,
    IDDict,
    RuntimeBatchRequest,
)
from great_expectations.core.expectation_suite import ExpectationSuite
from great_expectations.core.expectation_validation_result import get_metric_kwargs_id
from great_expectations.core.id_dict import BatchKwargs
from great_expectations.core.metric import ValidationMetricIdentifier
from great_expectations.core.run_identifier import RunIdentifier
from great_expectations.core.usage_statistics.anonymizers.checkpoint_anonymizer import (
    CheckpointAnonymizer,
)
from great_expectations.core.usage_statistics.anonymizers.data_connector_anonymizer import (
    DataConnectorAnonymizer,
)
from great_expectations.core.usage_statistics.anonymizers.datasource_anonymizer import (
    DatasourceAnonymizer,
)
from great_expectations.core.usage_statistics.anonymizers.store_anonymizer import (
    StoreAnonymizer,
)
from great_expectations.core.usage_statistics.usage_statistics import (
    UsageStatisticsHandler,
    add_datasource_usage_statistics,
    run_validation_operator_usage_statistics,
    save_expectation_suite_usage_statistics,
    send_usage_message,
    usage_statistics_enabled_method,
)
from great_expectations.core.util import nested_update
from great_expectations.data_asset import DataAsset
from great_expectations.data_context.store import (
    GeCloudStoreBackend,
    Store,
    TupleStoreBackend,
)
from great_expectations.data_context.templates import (
    CONFIG_VARIABLES_TEMPLATE,
    DEFAULT_GE_CLOUD_DATA_CONTEXT_CONFIG,
    PROJECT_TEMPLATE_USAGE_STATISTICS_DISABLED,
    PROJECT_TEMPLATE_USAGE_STATISTICS_ENABLED,
)
from great_expectations.data_context.types.base import (
    CURRENT_GE_CONFIG_VERSION,
    DEFAULT_USAGE_STATISTICS_URL,
    MINIMUM_SUPPORTED_CONFIG_VERSION,
    AnonymizedUsageStatisticsConfig,
    CheckpointConfig,
    DataContextConfig,
    DataContextConfigDefaults,
    DatasourceConfig,
    GeCloudConfig,
    anonymizedUsageStatisticsSchema,
    dataContextConfigSchema,
    datasourceConfigSchema,
)
from great_expectations.data_context.types.refs import GeCloudIdAwareRef
from great_expectations.data_context.types.resource_identifiers import (
    ConfigurationIdentifier,
    ExpectationSuiteIdentifier,
    GeCloudIdentifier,
    ValidationResultIdentifier,
)
from great_expectations.data_context.util import (
    PasswordMasker,
    build_store_from_config,
    default_checkpoints_exist,
    file_relative_path,
    instantiate_class_from_config,
    load_class,
    parse_substitution_variable,
    substitute_all_config_variables,
    substitute_config_variable,
)
from great_expectations.dataset import Dataset
from great_expectations.datasource import LegacyDatasource
from great_expectations.datasource.new_datasource import BaseDatasource, Datasource
from great_expectations.exceptions import DataContextError
from great_expectations.marshmallow__shade import ValidationError
from great_expectations.profile.basic_dataset_profiler import BasicDatasetProfiler
from great_expectations.render.renderer.site_builder import SiteBuilder
from great_expectations.util import (
    filter_properties_dict,
    verify_dynamic_loading_support,
)
from great_expectations.validator.validator import BridgeValidator, Validator

try:
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    # We'll redefine this error in code below to catch ProfilerError, which is caught above, so SA errors will
    # just fall through
    SQLAlchemyError = ge_exceptions.ProfilerError

logger = logging.getLogger(__name__)
yaml = YAML()
yaml.indent(mapping=2, sequence=4, offset=2)
yaml.default_flow_style = False


class BaseDataContext:
    """
        This class implements most of the functionality of DataContext, with a few exceptions.

        1. BaseDataContext does not attempt to keep its project_config in sync with a file on disc.
        2. BaseDataContext doesn't attempt to "guess" paths or objects types. Instead, that logic is pushed
            into DataContext class.

        Together, these changes make BaseDataContext class more testable.

    --ge-feature-maturity-info--

        id: os_linux
        title: OS - Linux
        icon:
        short_description:
        description:
        how_to_guide_url:
        maturity: Production
        maturity_details:
            api_stability: N/A
            implementation_completeness: N/A
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Complete
            documentation_completeness: Complete
            bug_risk: Low

        id: os_macos
        title: OS - MacOS
        icon:
        short_description:
        description:
        how_to_guide_url:
        maturity: Production
        maturity_details:
            api_stability: N/A
            implementation_completeness: N/A
            unit_test_coverage: Complete (local only)
            integration_infrastructure_test_coverage: Complete (local only)
            documentation_completeness: Complete
            bug_risk: Low

        id: os_windows
        title: OS - Windows
        icon:
        short_description:
        description:
        how_to_guide_url:
        maturity: Beta
        maturity_details:
            api_stability: N/A
            implementation_completeness: N/A
            unit_test_coverage: Minimal
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Complete
            bug_risk: Moderate
    ------------------------------------------------------------
        id: workflow_create_edit_expectations_cli_scaffold
        title: Create and Edit Expectations - suite scaffold
        icon:
        short_description: Creating a new Expectation Suite using suite scaffold
        description: Creating Expectation Suites through an interactive development loop using suite scaffold
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_and_editing_expectations/how_to_automatically_create_a_new_expectation_suite.html
        maturity: Experimental (expect exciting changes to Profiler capability)
        maturity_details:
            api_stability: N/A
            implementation_completeness: N/A
            unit_test_coverage: N/A
            integration_infrastructure_test_coverage: Partial
            documentation_completeness: Complete
            bug_risk: Low

        id: workflow_create_edit_expectations_cli_edit
        title: Create and Edit Expectations - CLI
        icon:
        short_description: Creating a new Expectation Suite using the CLI
        description: Creating a Expectation Suite great_expectations suite new command
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_and_editing_expectations/how_to_create_a_new_expectation_suite_using_the_cli.html
        maturity: Experimental (expect exciting changes to Profiler and Suite Renderer capability)
        maturity_details:
            api_stability: N/A
            implementation_completeness: N/A
            unit_test_coverage: N/A
            integration_infrastructure_test_coverage: Partial
            documentation_completeness: Complete
            bug_risk: Low

        id: workflow_create_edit_expectations_json_schema
        title: Create and Edit Expectations - Json schema
        icon:
        short_description: Creating a new Expectation Suite from a json schema file
        description: Creating a new Expectation Suite using JsonSchemaProfiler function and json schema file
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/creating_and_editing_expectations/how_to_create_a_suite_from_a_json_schema_file.html
        maturity: Experimental (expect exciting changes to Profiler capability)
        maturity_details:
            api_stability: N/A
            implementation_completeness: N/A
            unit_test_coverage: N/A
            integration_infrastructure_test_coverage: Partial
            documentation_completeness: Complete
            bug_risk: Low

    --ge-feature-maturity-info--
    """

    PROFILING_ERROR_CODE_TOO_MANY_DATA_ASSETS = 2
    PROFILING_ERROR_CODE_SPECIFIED_DATA_ASSETS_NOT_FOUND = 3
    PROFILING_ERROR_CODE_NO_BATCH_KWARGS_GENERATORS_FOUND = 4
    PROFILING_ERROR_CODE_MULTIPLE_BATCH_KWARGS_GENERATORS_FOUND = 5
    UNCOMMITTED_DIRECTORIES = ["data_docs", "validations"]
    GE_UNCOMMITTED_DIR = "uncommitted"
    BASE_DIRECTORIES = [
        DataContextConfigDefaults.CHECKPOINTS_BASE_DIRECTORY.value,
        DataContextConfigDefaults.EXPECTATIONS_BASE_DIRECTORY.value,
        DataContextConfigDefaults.NOTEBOOKS_BASE_DIRECTORY.value,
        DataContextConfigDefaults.PLUGINS_BASE_DIRECTORY.value,
        GE_UNCOMMITTED_DIR,
    ]
    NOTEBOOK_SUBDIRECTORIES = ["pandas", "spark", "sql"]
    GE_DIR = "great_expectations"
    GE_YML = "great_expectations.yml"
    GE_EDIT_NOTEBOOK_DIR = GE_UNCOMMITTED_DIR
    FALSEY_STRINGS = ["FALSE", "false", "False", "f", "F", "0"]
    GLOBAL_CONFIG_PATHS = [
        os.path.expanduser("~/.great_expectations/great_expectations.conf"),
        "/etc/great_expectations.conf",
    ]
    DOLLAR_SIGN_ESCAPE_STRING = r"\$"
    TEST_YAML_CONFIG_SUPPORTED_STORE_TYPES = [
        "ExpectationsStore",
        "ValidationsStore",
        "HtmlSiteStore",
        "EvaluationParameterStore",
        "MetricStore",
        "SqlAlchemyQueryStore",
        "CheckpointStore",
    ]
    TEST_YAML_CONFIG_SUPPORTED_DATASOURCE_TYPES = [
        "Datasource",
        "SimpleSqlalchemyDatasource",
    ]
    TEST_YAML_CONFIG_SUPPORTED_DATA_CONNECTOR_TYPES = [
        "InferredAssetFilesystemDataConnector",
        "ConfiguredAssetFilesystemDataConnector",
        "InferredAssetS3DataConnector",
        "ConfiguredAssetS3DataConnector",
        "InferredAssetAzureDataConnector",
        "ConfiguredAssetAzureDataConnector",
        "InferredAssetGCSDataConnector",
        "ConfiguredAssetGCSDataConnector",
        "InferredAssetSqlDataConnector",
        "ConfiguredAssetSqlDataConnector",
    ]
    TEST_YAML_CONFIG_SUPPORTED_CHECKPOINT_TYPES = [
        "Checkpoint",
        "SimpleCheckpoint",
    ]
    ALL_TEST_YAML_CONFIG_DIAGNOSTIC_INFO_TYPES = [
        "__substitution_error__",
        "__yaml_parse_error__",
        "__custom_subclass_not_core_ge__",
        "__class_name_not_provided__",
    ]
    ALL_TEST_YAML_CONFIG_SUPPORTED_TYPES = (
        TEST_YAML_CONFIG_SUPPORTED_STORE_TYPES
        + TEST_YAML_CONFIG_SUPPORTED_DATASOURCE_TYPES
        + TEST_YAML_CONFIG_SUPPORTED_DATA_CONNECTOR_TYPES
        + TEST_YAML_CONFIG_SUPPORTED_CHECKPOINT_TYPES
    )

    @classmethod
    def validate_config(cls, project_config):
        if isinstance(project_config, DataContextConfig):
            return True
        try:
            dataContextConfigSchema.load(project_config)
        except ValidationError:
            raise
        return True

    @usage_statistics_enabled_method(
        event_name="data_context.__init__",
    )
    def __init__(
        self,
        project_config,
        context_root_dir=None,
        runtime_environment=None,
        ge_cloud_mode=False,
        ge_cloud_config=None,
    ):
        """DataContext constructor

        Args:
            context_root_dir: location to look for the ``great_expectations.yml`` file. If None, searches for the file \
            based on conventions for project subdirectories.
            runtime_environment: a dictionary of config variables that
            override both those set in config_variables.yml and the environment

        Returns:
            None
        """
        print("hello world")

        if not BaseDataContext.validate_config(project_config):
            raise ge_exceptions.InvalidConfigError(
                "Your project_config is not valid. Try using the CLI check-config command."
            )
        self._ge_cloud_mode = ge_cloud_mode
        self._ge_cloud_config = ge_cloud_config
        self._project_config = project_config
        self._apply_global_config_overrides()

        if context_root_dir is not None:
            context_root_dir = os.path.abspath(context_root_dir)
        self._context_root_directory = context_root_dir

        self.runtime_environment = runtime_environment or {}

        # Init plugin support
        if self.plugins_directory is not None and os.path.exists(
            self.plugins_directory
        ):
            sys.path.append(self.plugins_directory)

        # We want to have directories set up before initializing usage statistics so that we can obtain a context instance id
        self._in_memory_instance_id = (
            None  # This variable *may* be used in case we cannot save an instance id
        )

        # Init stores
        self._stores = {}
        self._init_stores(self.project_config_with_variables_substituted.stores)

        # Init data_context_id
        self._data_context_id = self._construct_data_context_id()

        # Override the project_config data_context_id if an expectations_store was already set up
        self._project_config.anonymous_usage_statistics.data_context_id = (
            self._data_context_id
        )
        self._initialize_usage_statistics(
            self.project_config_with_variables_substituted.anonymous_usage_statistics
        )

        # Store cached datasources but don't init them
        self._cached_datasources = {}

        # Build the datasources we know about and have access to
        self._init_datasources(self.project_config_with_variables_substituted)

        # Init validation operators
        # NOTE - 20200522 - JPC - A consistent approach to lazy loading for plugins will be useful here, harmonizing
        # the way that execution environments (AKA datasources), validation operators, site builders and other
        # plugins are built.
        self.validation_operators = {}
        # NOTE - 20210112 - Alex Sherstinsky - Validation Operators are planned to be deprecated.
        if (
            "validation_operators" in self.get_config().commented_map
            and self._project_config.validation_operators
        ):
            for (
                validation_operator_name,
                validation_operator_config,
            ) in self._project_config.validation_operators.items():
                self.add_validation_operator(
                    validation_operator_name,
                    validation_operator_config,
                )

        self._evaluation_parameter_dependencies_compiled = False
        self._evaluation_parameter_dependencies = {}

    @property
    def ge_cloud_config(self):
        return self._ge_cloud_config

    @property
    def ge_cloud_mode(self):
        return self._ge_cloud_mode

    def _build_store_from_config(self, store_name, store_config):
        module_name = "great_expectations.data_context.store"
        # Set expectations_store.store_backend_id to the data_context_id from the project_config if
        # the expectations_store does not yet exist by:
        # adding the data_context_id from the project_config
        # to the store_config under the key manually_initialize_store_backend_id
        if (store_name == self.expectations_store_name) and store_config.get(
            "store_backend"
        ):
            store_config["store_backend"].update(
                {
                    "manually_initialize_store_backend_id": self.project_config_with_variables_substituted.anonymous_usage_statistics.data_context_id
                }
            )

        # Set suppress_store_backend_id = True if store is inactive and has a store_backend.
        if (
            store_name not in [store["name"] for store in self.list_active_stores()]
            and store_config.get("store_backend") is not None
        ):
            store_config["store_backend"].update({"suppress_store_backend_id": True})

        new_store = build_store_from_config(
            store_name=store_name,
            store_config=store_config,
            module_name=module_name,
            runtime_environment={
                "root_directory": self.root_directory,
            },
        )
        self._stores[store_name] = new_store
        return new_store

    def _init_stores(self, store_configs):
        """Initialize all Stores for this DataContext.

        Stores are a good fit for reading/writing objects that:
            1. follow a clear key-value pattern, and
            2. are usually edited programmatically, using the Context

        Note that stores do NOT manage plugins.
        """
        for store_name, store_config in store_configs.items():
            self._build_store_from_config(store_name, store_config)

    def _init_datasources(self, config):
        if not config.datasources:
            return
        for datasource_name, data_source_config in config.datasources.items():
            try:
                self._cached_datasources[datasource_name] = self.get_datasource(
                    datasource_name=datasource_name
                )
            except ge_exceptions.DatasourceInitializationError:
                # this error will happen if our configuration contains datasources that GE can no longer connect to.
                # this is ok, as long as we don't use it to retrieve a batch. If we try to do that, the error will be
                # caught at the context.get_batch() step. So we just pass here.
                pass

    def _apply_global_config_overrides(self):
        # check for global usage statistics opt out
        validation_errors = {}

        if self._check_global_usage_statistics_opt_out():
            logger.info(
                "Usage statistics is disabled globally. Applying override to project_config."
            )
            self._project_config.anonymous_usage_statistics.enabled = False

        # check for global data_context_id
        global_data_context_id = self._get_global_config_value(
            environment_variable="GE_DATA_CONTEXT_ID",
            conf_file_section="anonymous_usage_statistics",
            conf_file_option="data_context_id",
        )
        if global_data_context_id:
            data_context_id_errors = anonymizedUsageStatisticsSchema.validate(
                {"data_context_id": global_data_context_id}
            )
            if not data_context_id_errors:
                logger.info(
                    "data_context_id is defined globally. Applying override to project_config."
                )
                self._project_config.anonymous_usage_statistics.data_context_id = (
                    global_data_context_id
                )
            else:
                validation_errors.update(data_context_id_errors)
        # check for global usage_statistics url
        global_usage_statistics_url = self._get_global_config_value(
            environment_variable="GE_USAGE_STATISTICS_URL",
            conf_file_section="anonymous_usage_statistics",
            conf_file_option="usage_statistics_url",
        )
        if global_usage_statistics_url:
            usage_statistics_url_errors = anonymizedUsageStatisticsSchema.validate(
                {"usage_statistics_url": global_usage_statistics_url}
            )
            if not usage_statistics_url_errors:
                logger.info(
                    "usage_statistics_url is defined globally. Applying override to project_config."
                )
                self._project_config.anonymous_usage_statistics.usage_statistics_url = (
                    global_usage_statistics_url
                )
            else:
                validation_errors.update(usage_statistics_url_errors)
        if validation_errors:
            logger.warning(
                "The following globally-defined config variables failed validation:\n{}\n\n"
                "Please fix the variables if you would like to apply global values to project_config.".format(
                    json.dumps(validation_errors, indent=2)
                )
            )

    @classmethod
    def _get_global_config_value(
        cls, environment_variable=None, conf_file_section=None, conf_file_option=None
    ):
        assert (conf_file_section and conf_file_option) or (
            not conf_file_section and not conf_file_option
        ), "Must pass both 'conf_file_section' and 'conf_file_option' or neither."
        if environment_variable and os.environ.get(environment_variable, False):
            return os.environ.get(environment_variable)
        if conf_file_section and conf_file_option:
            for config_path in BaseDataContext.GLOBAL_CONFIG_PATHS:
                config = configparser.ConfigParser()
                config.read(config_path)
                config_value = config.get(
                    conf_file_section, conf_file_option, fallback=None
                )
                if config_value:
                    return config_value
        return None

    def _check_global_usage_statistics_opt_out(self):
        if os.environ.get("GE_USAGE_STATS", False):
            ge_usage_stats = os.environ.get("GE_USAGE_STATS")
            if ge_usage_stats in BaseDataContext.FALSEY_STRINGS:
                return True
            else:
                logger.warning(
                    "GE_USAGE_STATS environment variable must be one of: {}".format(
                        BaseDataContext.FALSEY_STRINGS
                    )
                )
        for config_path in BaseDataContext.GLOBAL_CONFIG_PATHS:
            config = configparser.ConfigParser()
            states = config.BOOLEAN_STATES
            for falsey_string in BaseDataContext.FALSEY_STRINGS:
                states[falsey_string] = False
            states["TRUE"] = True
            states["True"] = True
            config.BOOLEAN_STATES = states
            config.read(config_path)
            try:
                if config.getboolean("anonymous_usage_statistics", "enabled") is False:
                    # If stats are disabled, then opt out is true
                    return True
            except (ValueError, configparser.Error):
                pass
        return False

    def _construct_data_context_id(self) -> str:
        """
        Choose the id of the currently-configured expectations store, if available and a persistent store.
        If not, it should choose the id stored in DataContextConfig.
        Returns:
            UUID to use as the data_context_id
        """

        # if in ge_cloud_mode, use ge_cloud_account_id
        if self.ge_cloud_mode:
            return self.ge_cloud_config.account_id
        # Choose the id of the currently-configured expectations store, if it is a persistent store
        expectations_store = self._stores[
            self.project_config_with_variables_substituted.expectations_store_name
        ]
        if isinstance(expectations_store.store_backend, TupleStoreBackend):
            # suppress_warnings since a warning will already have been issued during the store creation if there was an invalid store config
            return expectations_store.store_backend_id_warnings_suppressed

        # Otherwise choose the id stored in the project_config
        else:
            return (
                self.project_config_with_variables_substituted.anonymous_usage_statistics.data_context_id
            )

    def _initialize_usage_statistics(
        self, usage_statistics_config: AnonymizedUsageStatisticsConfig
    ):
        """Initialize the usage statistics system."""
        if not usage_statistics_config.enabled:
            logger.info("Usage statistics is disabled; skipping initialization.")
            self._usage_statistics_handler = None
            return

        self._usage_statistics_handler = UsageStatisticsHandler(
            data_context=self,
            data_context_id=self._data_context_id,
            usage_statistics_url=usage_statistics_config.usage_statistics_url,
        )

    def add_store(self, store_name, store_config):
        """Add a new Store to the DataContext and (for convenience) return the instantiated Store object.

        Args:
            store_name (str): a key for the new Store in in self._stores
            store_config (dict): a config for the Store to add

        Returns:
            store (Store)
        """

        self._project_config["stores"][store_name] = store_config
        return self._build_store_from_config(store_name, store_config)

    def add_validation_operator(
        self, validation_operator_name, validation_operator_config
    ):
        """Add a new ValidationOperator to the DataContext and (for convenience) return the instantiated object.

        Args:
            validation_operator_name (str): a key for the new ValidationOperator in in self._validation_operators
            validation_operator_config (dict): a config for the ValidationOperator to add

        Returns:
            validation_operator (ValidationOperator)
        """

        self._project_config["validation_operators"][
            validation_operator_name
        ] = validation_operator_config
        config = self.project_config_with_variables_substituted.validation_operators[
            validation_operator_name
        ]
        module_name = "great_expectations.validation_operators"
        new_validation_operator = instantiate_class_from_config(
            config=config,
            runtime_environment={
                "data_context": self,
                "name": validation_operator_name,
            },
            config_defaults={"module_name": module_name},
        )
        if not new_validation_operator:
            raise ge_exceptions.ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=config["class_name"],
            )
        self.validation_operators[validation_operator_name] = new_validation_operator
        return new_validation_operator

    def _normalize_absolute_or_relative_path(self, path):
        if path is None:
            return
        if os.path.isabs(path):
            return path
        else:
            return os.path.join(self.root_directory, path)

    def _normalize_store_path(self, resource_store):
        if resource_store["type"] == "filesystem":
            if not os.path.isabs(resource_store["base_directory"]):
                resource_store["base_directory"] = os.path.join(
                    self.root_directory, resource_store["base_directory"]
                )
        return resource_store

    def get_site_names(self) -> List[str]:
        """Get a list of configured site names."""
        return list(
            self.project_config_with_variables_substituted.data_docs_sites.keys()
        )

    def get_docs_sites_urls(
        self,
        resource_identifier=None,
        site_name: Optional[str] = None,
        only_if_exists=True,
        site_names: Optional[List[str]] = None,
    ) -> List[Dict[str, str]]:
        """
        Get URLs for a resource for all data docs sites.

        This function will return URLs for any configured site even if the sites
        have not been built yet.

        Args:
            resource_identifier (object): optional. It can be an identifier of
                ExpectationSuite's, ValidationResults and other resources that
                have typed identifiers. If not provided, the method will return
                the URLs of the index page.
            site_name: Optionally specify which site to open. If not specified,
                return all urls in the project.
            site_names: Optionally specify which sites are active. Sites not in
                this list are not processed, even if specified in site_name.

        Returns:
            list: a list of URLs. Each item is the URL for the resource for a
                data docs site
        """
        unfiltered_sites = (
            self.project_config_with_variables_substituted.data_docs_sites
        )

        # Filter out sites that are not in site_names
        sites = (
            {k: v for k, v in unfiltered_sites.items() if k in site_names}
            if site_names
            else unfiltered_sites
        )

        if not sites:
            logger.debug("Found no data_docs_sites.")
            return []
        logger.debug(f"Found {len(sites)} data_docs_sites.")

        if site_name:
            if site_name not in sites.keys():
                raise ge_exceptions.DataContextError(
                    f"Could not find site named {site_name}. Please check your configurations"
                )
            site = sites[site_name]
            site_builder = self._load_site_builder_from_site_config(site)
            url = site_builder.get_resource_url(
                resource_identifier=resource_identifier, only_if_exists=only_if_exists
            )
            return [{"site_name": site_name, "site_url": url}]

        site_urls = []
        for _site_name, site_config in sites.items():
            site_builder = self._load_site_builder_from_site_config(site_config)
            url = site_builder.get_resource_url(
                resource_identifier=resource_identifier, only_if_exists=only_if_exists
            )
            site_urls.append({"site_name": _site_name, "site_url": url})

        return site_urls

    def _load_site_builder_from_site_config(self, site_config) -> SiteBuilder:
        default_module_name = "great_expectations.render.renderer.site_builder"
        site_builder = instantiate_class_from_config(
            config=site_config,
            runtime_environment={
                "data_context": self,
                "root_directory": self.root_directory,
            },
            config_defaults={"module_name": default_module_name},
        )
        if not site_builder:
            raise ge_exceptions.ClassInstantiationError(
                module_name=default_module_name,
                package_name=None,
                class_name=site_config["class_name"],
            )
        return site_builder

    @usage_statistics_enabled_method(
        event_name="data_context.open_data_docs",
    )
    def open_data_docs(
        self,
        resource_identifier: Optional[str] = None,
        site_name: Optional[str] = None,
        only_if_exists: Optional[bool] = True,
    ) -> None:
        """
        A stdlib cross-platform way to open a file in a browser.

        Args:
            resource_identifier: ExpectationSuiteIdentifier,
                ValidationResultIdentifier or any other type's identifier. The
                argument is optional - when not supplied, the method returns the
                URL of the index page.
            site_name: Optionally specify which site to open. If not specified,
                open all docs found in the project.
            only_if_exists: Optionally specify flag to pass to "self.get_docs_sites_urls()".
        """
        data_docs_urls: List[Dict[str, str]] = self.get_docs_sites_urls(
            resource_identifier=resource_identifier,
            site_name=site_name,
            only_if_exists=only_if_exists,
        )
        urls_to_open: List[str] = [site["site_url"] for site in data_docs_urls]

        for url in urls_to_open:
            if url is not None:
                logger.debug(f"Opening Data Docs found here: {url}")
                webbrowser.open(url)

    @property
    def root_directory(self):
        """The root directory for configuration objects in the data context; the location in which
        ``great_expectations.yml`` is located."""
        return self._context_root_directory

    @property
    def plugins_directory(self):
        """The directory in which custom plugin modules should be placed."""
        return self._normalize_absolute_or_relative_path(
            self.project_config_with_variables_substituted.plugins_directory
        )

    @property
    def project_config_with_variables_substituted(self) -> DataContextConfig:
        return self.get_config_with_variables_substituted()

    @property
    def anonymous_usage_statistics(self):
        return self.project_config_with_variables_substituted.anonymous_usage_statistics

    @property
    def notebooks(self):
        return self.project_config_with_variables_substituted.notebooks

    @property
    def stores(self):
        """A single holder for all Stores in this context"""
        return self._stores

    @property
    def datasources(self) -> Dict[str, Union[LegacyDatasource, BaseDatasource]]:
        """A single holder for all Datasources in this context"""
        return self._cached_datasources

    @property
    def checkpoint_store_name(self):
        try:
            return self.project_config_with_variables_substituted.checkpoint_store_name
        except AttributeError:
            config_version: float = (
                self.project_config_with_variables_substituted.config_version
            )
            if self.root_directory and default_checkpoints_exist(
                directory_path=self.root_directory
            ):
                return DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_NAME.value
            if self.root_directory:
                error_message: str = f'Attempted to access the "checkpoint_store_name" field with a legacy config version ({config_version}) and no `checkpoints` directory.\n  To continue using legacy config version ({config_version}), please create the following directory: {os.path.join(self.root_directory, DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_BASE_DIRECTORY_RELATIVE_NAME.value)}\n  To use the new "Checkpoint Store" feature, please update your configuration to the new version number {float(CURRENT_GE_CONFIG_VERSION)}.\n  Visit https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html to learn more about the upgrade process.'
            else:
                error_message: str = f'Attempted to access the "checkpoint_store_name" field with a legacy config version ({config_version}) and no `checkpoints` directory.\n  To continue using legacy config version ({config_version}), please create a `checkpoints` directory in your Great Expectations project " f"directory.\n  To use the new "Checkpoint Store" feature, please update your configuration to the new version number {float(CURRENT_GE_CONFIG_VERSION)}.\n  Visit https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html to learn more about the upgrade process.'
            raise ge_exceptions.InvalidTopLevelConfigKeyError(error_message)

    @property
    def checkpoint_store(self):
        checkpoint_store_name: str = self.checkpoint_store_name
        try:
            return self.stores[checkpoint_store_name]
        except KeyError as e:
            config_version: float = (
                self.project_config_with_variables_substituted.config_version
            )
            if self.root_directory and default_checkpoints_exist(
                directory_path=self.root_directory
            ):
                logger.warning(
                    f'Detected legacy config version ({config_version}) so will try to use default Checkpoint store.\n  Please update your configuration to the new version number {float(CURRENT_GE_CONFIG_VERSION)} in order to use the new "Checkpoint Store" feature.\n  Visit https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html to learn more about the upgrade process.'
                )
                return self._build_store_from_config(
                    checkpoint_store_name,
                    DataContextConfigDefaults.DEFAULT_STORES.value[
                        checkpoint_store_name
                    ],
                )
            raise ge_exceptions.StoreConfigurationError(
                f'Attempted to access the Checkpoint store named "{checkpoint_store_name}", which is not a configured store.'
            )

    @property
    def expectations_store_name(self):
        return self.project_config_with_variables_substituted.expectations_store_name

    @property
    def expectations_store(self):
        return self.stores[self.expectations_store_name]

    @property
    def data_context_id(self):
        return (
            self.project_config_with_variables_substituted.anonymous_usage_statistics.data_context_id
        )

    @property
    def instance_id(self):
        instance_id = self._load_config_variables_file().get("instance_id")
        if instance_id is None:
            if self._in_memory_instance_id is not None:
                return self._in_memory_instance_id
            instance_id = str(uuid.uuid4())
            self._in_memory_instance_id = instance_id
        return instance_id

    @property
    def config_variables(self):
        # Note Abe 20121114 : We should probably cache config_variables instead of loading them from disk every time.
        return dict(self._load_config_variables_file())

    #####
    #
    # Internal helper methods
    #
    #####

    def _load_config_variables_file(self):
        """
        Get all config variables from the default location. For Data Contexts in GE Cloud mode, config variables are
        loaded from a global great_expectations.conf file, located at one of the paths defined in
        self.GLOBAL_CONFIG_PATHS (in order of search precedence).
        """
        if self.ge_cloud_mode:
            for config_path in self.GLOBAL_CONFIG_PATHS:
                if os.path.isfile(config_path):
                    config = configparser.ConfigParser()
                    config.read(config_path)
                    return dict(config.items(section="ge_cloud_config"))
            return {}
        config_variables_file_path = self.get_config().config_variables_file_path
        if config_variables_file_path:
            try:
                # If the user specifies the config variable path with an environment variable, we want to substitute it
                defined_path = substitute_config_variable(
                    config_variables_file_path, dict(os.environ)
                )
                if not os.path.isabs(defined_path):
                    # A BaseDataContext will not have a root directory; in that case use the current directory
                    # for any non-absolute path
                    root_directory = self.root_directory or os.curdir
                else:
                    root_directory = ""
                var_path = os.path.join(root_directory, defined_path)
                with open(var_path) as config_variables_file:
                    return yaml.load(config_variables_file) or {}
            except OSError as e:
                if e.errno != errno.ENOENT:
                    raise
                logger.debug("Generating empty config variables file.")
                return {}
        else:
            return {}

    def get_config_with_variables_substituted(self, config=None) -> DataContextConfig:
        """
        Substitute vars in config of form ${var} or $(var) with values found in the following places,
        in order of precedence: ge_cloud_config (for Data Contexts in GE Cloud mode), runtime_environment,
        environment variables, config_variables, or ge_cloud_config_variable_defaults (allows certain variables to
        be optional in GE Cloud mode).
        """
        if not config:
            config = self._project_config

        substituted_config_variables = substitute_all_config_variables(
            self.config_variables,
            dict(os.environ),
            self.DOLLAR_SIGN_ESCAPE_STRING,
        )

        # for ge_cloud_mode: in most cases, self.ge_cloud_config will be a subset of substituted_config_variables,
        # but if one or more ge_cloud_config values are passed in at runtime, they will be reflected in
        # self.ge_cloud_config and will take precedence
        substitutions = {
            **substituted_config_variables,
            **dict(os.environ),
            **self.runtime_environment,
            **(self.ge_cloud_config.to_json_dict() if self.ge_cloud_mode else {}),
        }

        if self.ge_cloud_mode:
            ge_cloud_config_variable_defaults = {
                "plugins_directory": self._normalize_absolute_or_relative_path(
                    DataContextConfigDefaults.DEFAULT_PLUGINS_DIRECTORY.value
                ),
                "usage_statistics_url": DEFAULT_USAGE_STATISTICS_URL,
            }
            for config_variable, value in ge_cloud_config_variable_defaults.items():
                if substitutions.get(config_variable) is None:
                    logger.info(
                        f'Config variable "{config_variable}" was not found in environment or global config ('
                        f'{self.GLOBAL_CONFIG_PATHS}). Using default value "{value}" instead. If you would '
                        f"like to "
                        f"use a different value, please specify it in an environment variable or in a "
                        f"great_expectations.conf file located at one of the above paths, in a section named "
                        f'"ge_cloud_config".'
                    )
                    substitutions[config_variable] = value

        return DataContextConfig(
            **substitute_all_config_variables(
                config, substitutions, self.DOLLAR_SIGN_ESCAPE_STRING
            )
        )

    def escape_all_config_variables(
        self,
        value: Union[str, dict, list],
        dollar_sign_escape_string: str = DOLLAR_SIGN_ESCAPE_STRING,
        skip_if_substitution_variable: bool = True,
    ) -> Union[str, dict, list]:
        """
        Replace all `$` characters with the DOLLAR_SIGN_ESCAPE_STRING

        Args:
            value: config variable value
            dollar_sign_escape_string: replaces instances of `$`
            skip_if_substitution_variable: skip if the value is of the form ${MYVAR} or $MYVAR

        Returns:
            input value with all `$` characters replaced with the escape string
        """

        if isinstance(value, dict) or isinstance(value, OrderedDict):
            return {
                k: self.escape_all_config_variables(
                    v, dollar_sign_escape_string, skip_if_substitution_variable
                )
                for k, v in value.items()
            }

        elif isinstance(value, list):
            return [
                self.escape_all_config_variables(
                    v, dollar_sign_escape_string, skip_if_substitution_variable
                )
                for v in value
            ]
        if skip_if_substitution_variable:
            if parse_substitution_variable(value) is None:
                return value.replace("$", dollar_sign_escape_string)
            else:
                return value
        else:
            return value.replace("$", dollar_sign_escape_string)

    def save_config_variable(
        self, config_variable_name, value, skip_if_substitution_variable: bool = True
    ):
        r"""Save config variable value
        Escapes $ unless they are used in substitution variables e.g. the $ characters in ${SOME_VAR} or $SOME_VAR are not escaped

        Args:
            config_variable_name: name of the property
            value: the value to save for the property
            skip_if_substitution_variable: set to False to escape $ in values in substitution variable form e.g. ${SOME_VAR} -> r"\${SOME_VAR}" or $SOME_VAR -> r"\$SOME_VAR"

        Returns:
            None
        """
        config_variables = self._load_config_variables_file()
        value = self.escape_all_config_variables(
            value,
            self.DOLLAR_SIGN_ESCAPE_STRING,
            skip_if_substitution_variable=skip_if_substitution_variable,
        )
        config_variables[config_variable_name] = value
        config_variables_filepath = self.get_config().config_variables_file_path
        if not config_variables_filepath:
            raise ge_exceptions.InvalidConfigError(
                "'config_variables_file_path' property is not found in config - setting it is required to use this feature"
            )

        config_variables_filepath = os.path.join(
            self.root_directory, config_variables_filepath
        )

        os.makedirs(os.path.dirname(config_variables_filepath), exist_ok=True)
        if not os.path.isfile(config_variables_filepath):
            logger.info(
                "Creating new substitution_variables file at {config_variables_filepath}".format(
                    config_variables_filepath=config_variables_filepath
                )
            )
            with open(config_variables_filepath, "w") as template:
                template.write(CONFIG_VARIABLES_TEMPLATE)

        with open(config_variables_filepath, "w") as config_variables_file:
            yaml.dump(config_variables, config_variables_file)

    def delete_datasource(self, datasource_name: str):
        """Delete a data source
        Args:
            datasource_name: The name of the datasource to delete.

        Raises:
            ValueError: If the datasource name isn't provided or cannot be found.
        """
        if datasource_name is None:
            raise ValueError("Datasource names must be a datasource name")
        else:
            datasource = self.get_datasource(datasource_name=datasource_name)
            if datasource:
                # remove key until we have a delete method on project_config
                # self.project_config_with_variables_substituted.datasources[
                # datasource_name].remove()
                del self._project_config["datasources"][datasource_name]
                del self._cached_datasources[datasource_name]
            else:
                raise ValueError(f"Datasource {datasource_name} not found")

    def get_available_data_asset_names(
        self, datasource_names=None, batch_kwargs_generator_names=None
    ):
        """Inspect datasource and batch kwargs generators to provide available data_asset objects.

        Args:
            datasource_names: list of datasources for which to provide available data_asset_name objects. If None, \
            return available data assets for all datasources.
            batch_kwargs_generator_names: list of batch kwargs generators for which to provide available
            data_asset_name objects.

        Returns:
            data_asset_names (dict): Dictionary describing available data assets
            ::

                {
                  datasource_name: {
                    batch_kwargs_generator_name: [ data_asset_1, data_asset_2, ... ]
                    ...
                  }
                  ...
                }

        """
        data_asset_names = {}
        if datasource_names is None:
            datasource_names = [
                datasource["name"] for datasource in self.list_datasources()
            ]
        elif isinstance(datasource_names, str):
            datasource_names = [datasource_names]
        elif not isinstance(datasource_names, list):
            raise ValueError(
                "Datasource names must be a datasource name, list of datasource names or None (to list all datasources)"
            )

        if batch_kwargs_generator_names is not None:
            if isinstance(batch_kwargs_generator_names, str):
                batch_kwargs_generator_names = [batch_kwargs_generator_names]
            if len(batch_kwargs_generator_names) == len(
                datasource_names
            ):  # Iterate over both together
                for idx, datasource_name in enumerate(datasource_names):
                    datasource = self.get_datasource(datasource_name)
                    data_asset_names[
                        datasource_name
                    ] = datasource.get_available_data_asset_names(
                        batch_kwargs_generator_names[idx]
                    )

            elif len(batch_kwargs_generator_names) == 1:
                datasource = self.get_datasource(datasource_names[0])
                datasource_names[
                    datasource_names[0]
                ] = datasource.get_available_data_asset_names(
                    batch_kwargs_generator_names
                )

            else:
                raise ValueError(
                    "If providing batch kwargs generator, you must either specify one for each datasource or only "
                    "one datasource."
                )
        else:  # generator_names is None
            for datasource_name in datasource_names:
                try:
                    datasource = self.get_datasource(datasource_name)
                    data_asset_names[
                        datasource_name
                    ] = datasource.get_available_data_asset_names()
                except ValueError:
                    # handle the edge case of a non-existent datasource
                    data_asset_names[datasource_name] = {}

        return data_asset_names

    def build_batch_kwargs(
        self,
        datasource,
        batch_kwargs_generator,
        data_asset_name=None,
        partition_id=None,
        **kwargs,
    ):
        """Builds batch kwargs using the provided datasource, batch kwargs generator, and batch_parameters.

        Args:
            datasource (str): the name of the datasource for which to build batch_kwargs
            batch_kwargs_generator (str): the name of the batch kwargs generator to use to build batch_kwargs
            data_asset_name (str): an optional name batch_parameter
            **kwargs: additional batch_parameters

        Returns:
            BatchKwargs

        """
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
        datasource_obj = self.get_datasource(datasource)
        batch_kwargs = datasource_obj.build_batch_kwargs(
            batch_kwargs_generator=batch_kwargs_generator,
            data_asset_name=data_asset_name,
            partition_id=partition_id,
            **kwargs,
        )
        return batch_kwargs

    def _get_batch_v2(
        self,
        batch_kwargs: Union[dict, BatchKwargs],
        expectation_suite_name: Union[str, ExpectationSuite],
        data_asset_type=None,
        batch_parameters=None,
    ) -> DataAsset:
        """Build a batch of data using batch_kwargs, and return a DataAsset with expectation_suite_name attached. If
        batch_parameters are included, they will be available as attributes of the batch.
        Args:
            batch_kwargs: the batch_kwargs to use; must include a datasource key
            expectation_suite_name: The ExpectationSuite or the name of the expectation_suite to get
            data_asset_type: the type of data_asset to build, with associated expectation implementations. This can
                generally be inferred from the datasource.
            batch_parameters: optional parameters to store as the reference description of the batch. They should
                reflect parameters that would provide the passed BatchKwargs.
        Returns:
            DataAsset
        """
        if isinstance(batch_kwargs, dict):
            batch_kwargs = BatchKwargs(batch_kwargs)

        if not isinstance(batch_kwargs, BatchKwargs):
            raise ge_exceptions.BatchKwargsError(
                "BatchKwargs must be a BatchKwargs object or dictionary."
            )

        if not isinstance(
            expectation_suite_name, (ExpectationSuite, ExpectationSuiteIdentifier, str)
        ):
            raise ge_exceptions.DataContextError(
                "expectation_suite_name must be an ExpectationSuite, "
                "ExpectationSuiteIdentifier or string."
            )

        if isinstance(expectation_suite_name, ExpectationSuite):
            expectation_suite = expectation_suite_name
        elif isinstance(expectation_suite_name, ExpectationSuiteIdentifier):
            expectation_suite = self.get_expectation_suite(
                expectation_suite_name.expectation_suite_name
            )
        else:
            expectation_suite = self.get_expectation_suite(expectation_suite_name)

        datasource = self.get_datasource(batch_kwargs.get("datasource"))
        batch = datasource.get_batch(
            batch_kwargs=batch_kwargs, batch_parameters=batch_parameters
        )
        if data_asset_type is None:
            data_asset_type = datasource.config.get("data_asset_type")
        validator = BridgeValidator(
            batch=batch,
            expectation_suite=expectation_suite,
            expectation_engine=data_asset_type,
        )
        return validator.get_dataset()

    def _get_batch_v3(
        self,
        datasource_name: Optional[str] = None,
        data_connector_name: Optional[str] = None,
        data_asset_name: Optional[str] = None,
        *,
        batch_request: Optional[Union[BatchRequest, RuntimeBatchRequest]] = None,
        batch_data: Optional[Any] = None,
        data_connector_query: Optional[Union[IDDict, dict]] = None,
        batch_identifiers: Optional[dict] = None,
        limit: Optional[int] = None,
        index: Optional[Union[int, list, tuple, slice, str]] = None,
        custom_filter_function: Optional[Callable] = None,
        batch_spec_passthrough: Optional[dict] = None,
        sampling_method: Optional[str] = None,
        sampling_kwargs: Optional[dict] = None,
        splitter_method: Optional[str] = None,
        splitter_kwargs: Optional[dict] = None,
        runtime_parameters: Optional[dict] = None,
        query: Optional[str] = None,
        path: Optional[str] = None,
        batch_filter_parameters: Optional[dict] = None,
        **kwargs,
    ) -> Union[Batch, DataAsset]:
        """Get exactly one batch, based on a variety of flexible input types.

        Args:
            datasource_name
            data_connector_name
            data_asset_name

            batch_request
            batch_data
            data_connector_query
            batch_identifiers
            batch_filter_parameters

            limit
            index
            custom_filter_function

            batch_spec_passthrough

            sampling_method
            sampling_kwargs

            splitter_method
            splitter_kwargs

            **kwargs

        Returns:
            (Batch) The requested batch

        This method does not require typed or nested inputs.
        Instead, it is intended to help the user pick the right parameters.

        This method attempts to return exactly one batch.
        If 0 or more than 1 batches would be returned, it raises an error.
        """
        batch_list: List[Batch] = self.get_batch_list(
            datasource_name=datasource_name,
            data_connector_name=data_connector_name,
            data_asset_name=data_asset_name,
            batch_request=batch_request,
            batch_data=batch_data,
            data_connector_query=data_connector_query,
            batch_identifiers=batch_identifiers,
            limit=limit,
            index=index,
            custom_filter_function=custom_filter_function,
            batch_spec_passthrough=batch_spec_passthrough,
            sampling_method=sampling_method,
            sampling_kwargs=sampling_kwargs,
            splitter_method=splitter_method,
            splitter_kwargs=splitter_kwargs,
            runtime_parameters=runtime_parameters,
            query=query,
            path=path,
            batch_filter_parameters=batch_filter_parameters,
            **kwargs,
        )
        # NOTE: Alex 20201202 - The check below is duplicate of code in Datasource.get_single_batch_from_batch_request()
        warnings.warn(
            "get_batch will be deprecated for the V3 Batch Request API in a future version of GE. Please use"
            "get_batch_list instead.",
            DeprecationWarning,
        )
        if len(batch_list) != 1:
            raise ValueError(
                f"Got {len(batch_list)} batches instead of a single batch. If you would like to use a BatchRequest to "
                f"return multiple batches, please use get_batch_list directly instead of calling get_batch"
            )
        return batch_list[0]

    @usage_statistics_enabled_method(
        event_name="data_context.run_validation_operator",
        args_payload_fn=run_validation_operator_usage_statistics,
    )
    def run_validation_operator(
        self,
        validation_operator_name: str,
        assets_to_validate: List,
        run_id: Optional[Union[str, RunIdentifier]] = None,
        evaluation_parameters: Optional[dict] = None,
        run_name: Optional[str] = None,
        run_time: Optional[Union[str, datetime.datetime]] = None,
        result_format: Optional[Union[str, dict]] = None,
        **kwargs,
    ):
        """
        Run a validation operator to validate data assets and to perform the business logic around
        validation that the operator implements.

        Args:
            validation_operator_name: name of the operator, as appears in the context's config file
            assets_to_validate: a list that specifies the data assets that the operator will validate. The members of
                the list can be either batches, or a tuple that will allow the operator to fetch the batch:
                (batch_kwargs, expectation_suite_name)
            run_name: The run_name for the validation; if None, a default value will be used
            **kwargs: Additional kwargs to pass to the validation operator

        Returns:
            ValidationOperatorResult
        """
        result_format = result_format or {"result_format": "SUMMARY"}

        if not assets_to_validate:
            raise ge_exceptions.DataContextError(
                "No batches of data were passed in. These are required"
            )

        for batch in assets_to_validate:
            if not isinstance(batch, (tuple, DataAsset, Validator)):
                raise ge_exceptions.DataContextError(
                    "Batches are required to be of type DataAsset or Validator"
                )
        try:
            validation_operator = self.validation_operators[validation_operator_name]
        except KeyError:
            raise ge_exceptions.DataContextError(
                f"No validation operator `{validation_operator_name}` was found in your project. Please verify this in your great_expectations.yml"
            )

        if run_id is None and run_name is None:
            run_name = datetime.datetime.now(datetime.timezone.utc).strftime(
                "%Y%m%dT%H%M%S.%fZ"
            )
            logger.info(f"Setting run_name to: {run_name}")
        if evaluation_parameters is None:
            return validation_operator.run(
                assets_to_validate=assets_to_validate,
                run_id=run_id,
                run_name=run_name,
                run_time=run_time,
                result_format=result_format,
                **kwargs,
            )
        else:
            return validation_operator.run(
                assets_to_validate=assets_to_validate,
                run_id=run_id,
                evaluation_parameters=evaluation_parameters,
                run_name=run_name,
                run_time=run_time,
                result_format=result_format,
                **kwargs,
            )

    def _get_data_context_version(self, arg1: Any, **kwargs) -> Optional[str]:
        """
        arg1: the first positional argument (can take on various types)

        **kwargs: variable arguments

        First check:
        Returns "v3" if the "0.13" entities are specified in the **kwargs.

        Otherwise:
        Returns None if no datasources have been configured (or if there is an exception while getting the datasource).
        Returns "v3" if the datasource is a subclass of the BaseDatasource class.
        Returns "v2" if the datasource is an instance of the LegacyDatasource class.
        """

        if {
            "datasource_name",
            "data_connector_name",
            "data_asset_name",
            "batch_request",
            "batch_data",
        }.intersection(set(kwargs.keys())):
            return "v3"

        if not self.datasources:
            return None

        api_version: Optional[str] = None
        datasource_name: Any
        if "datasource_name" in kwargs:
            datasource_name = kwargs.pop("datasource_name", None)
        else:
            datasource_name = arg1
        try:
            datasource: Union[LegacyDatasource, BaseDatasource] = self.get_datasource(
                datasource_name=datasource_name
            )
            if issubclass(type(datasource), BaseDatasource):
                api_version = "v3"
        except (ValueError, TypeError):
            if "batch_kwargs" in kwargs:
                batch_kwargs = kwargs.get("batch_kwargs", None)
            else:
                batch_kwargs = arg1
            if isinstance(batch_kwargs, dict):
                datasource_name = batch_kwargs.get("datasource")
                if datasource_name is not None:
                    try:
                        datasource: Union[
                            LegacyDatasource, BaseDatasource
                        ] = self.get_datasource(datasource_name=datasource_name)
                        if isinstance(datasource, LegacyDatasource):
                            api_version = "v2"
                    except (ValueError, TypeError):
                        pass
        return api_version

    def get_batch(
        self, arg1: Any = None, arg2: Any = None, arg3: Any = None, **kwargs
    ) -> Union[Batch, DataAsset]:
        """Get exactly one batch, based on a variety of flexible input types.
        The method `get_batch` is the main user-facing method for getting batches; it supports both the new (V3) and the
        Legacy (V2) Datasource schemas.  The version-specific implementations are contained in "_get_batch_v2()" and
        "_get_batch_v3()", respectively, both of which are in the present module.

        For the V3 API parameters, please refer to the signature and parameter description of method "_get_batch_v3()".
        For the Legacy usage, please refer to the signature and parameter description of the method "_get_batch_v2()".

        Args:
            arg1: the first positional argument (can take on various types)
            arg2: the second positional argument (can take on various types)
            arg3: the third positional argument (can take on various types)

            **kwargs: variable arguments

        Returns:
            Batch (V3) or DataAsset (V2) -- the requested batch

        Processing Steps:
        1. Determine the version (possible values are "v3" or "v2").
        2. Convert the positional arguments to the appropriate named arguments, based on the version.
        3. Package the remaining arguments as variable keyword arguments (applies only to V3).
        4. Call the version-specific method ("_get_batch_v3()" or "_get_batch_v2()") with the appropriate arguments.
        """

        api_version: Optional[str] = self._get_data_context_version(arg1=arg1, **kwargs)
        if api_version == "v3":
            if "datasource_name" in kwargs:
                datasource_name = kwargs.pop("datasource_name", None)
            else:
                datasource_name = arg1
            if "data_connector_name" in kwargs:
                data_connector_name = kwargs.pop("data_connector_name", None)
            else:
                data_connector_name = arg2
            if "data_asset_name" in kwargs:
                data_asset_name = kwargs.pop("data_asset_name", None)
            else:
                data_asset_name = arg3
            return self._get_batch_v3(
                datasource_name=datasource_name,
                data_connector_name=data_connector_name,
                data_asset_name=data_asset_name,
                **kwargs,
            )
        if "batch_kwargs" in kwargs:
            batch_kwargs = kwargs.get("batch_kwargs", None)
        else:
            batch_kwargs = arg1
        if "expectation_suite_name" in kwargs:
            expectation_suite_name = kwargs.get("expectation_suite_name", None)
        else:
            expectation_suite_name = arg2
        if "data_asset_type" in kwargs:
            data_asset_type = kwargs.get("data_asset_type", None)
        else:
            data_asset_type = arg3
        batch_parameters = kwargs.get("batch_parameters")
        return self._get_batch_v2(
            batch_kwargs=batch_kwargs,
            expectation_suite_name=expectation_suite_name,
            data_asset_type=data_asset_type,
            batch_parameters=batch_parameters,
        )

    def get_batch_list(
        self,
        datasource_name: Optional[str] = None,
        data_connector_name: Optional[str] = None,
        data_asset_name: Optional[str] = None,
        *,
        batch_request: Optional[Union[BatchRequest, RuntimeBatchRequest]] = None,
        batch_data: Optional[Any] = None,
        data_connector_query: Optional[Union[IDDict, dict]] = None,
        batch_identifiers: Optional[dict] = None,
        limit: Optional[int] = None,
        index: Optional[Union[int, list, tuple, slice, str]] = None,
        custom_filter_function: Optional[Callable] = None,
        batch_spec_passthrough: Optional[dict] = None,
        sampling_method: Optional[str] = None,
        sampling_kwargs: Optional[dict] = None,
        splitter_method: Optional[str] = None,
        splitter_kwargs: Optional[dict] = None,
        runtime_parameters: Optional[dict] = None,
        query: Optional[str] = None,
        path: Optional[str] = None,
        batch_filter_parameters: Optional[dict] = None,
        **kwargs,
    ) -> List[Batch]:
        """Get the list of zero or more batches, based on a variety of flexible input types.
        This method applies only to the new (V3) Datasource schema.

        Args:
            batch_request

            datasource_name
            data_connector_name
            data_asset_name

            batch_request
            batch_data
            query
            runtime_parameters
            data_connector_query
            batch_identifiers
            batch_filter_parameters

            limit
            index
            custom_filter_function

            sampling_method
            sampling_kwargs

            splitter_method
            splitter_kwargs

            batch_spec_passthrough

            **kwargs

        Returns:
            (Batch) The requested batch

        `get_batch` is the main user-facing API for getting batches.
        In contrast to virtually all other methods in the class, it does not require typed or nested inputs.
        Instead, this method is intended to help the user pick the right parameters

        This method attempts to return any number of batches, including an empty list.
        """

        datasource_name: str
        if batch_request:
            if not isinstance(batch_request, BatchRequest):
                raise TypeError(
                    f"batch_request must be an instance of BatchRequest object, not {type(batch_request)}"
                )
            datasource_name = batch_request.datasource_name

        # ensure that the first parameter is datasource_name, which should be a str. This check prevents users
        # from passing in batch_request as an unnamed parameter.
        if not isinstance(datasource_name, str):
            raise ge_exceptions.GreatExpectationsTypeError(
                f"the first parameter, datasource_name, must be a str, not {type(datasource_name)}"
            )
        datasource: Datasource = self.datasources[datasource_name]

        if len([arg for arg in [batch_data, query, path] if arg is not None]) > 1:
            raise ValueError("Must provide only one of batch_data, query, or path.")
        if any(
            [
                batch_data is not None
                and runtime_parameters
                and "batch_data" in runtime_parameters,
                query and runtime_parameters and "query" in runtime_parameters,
                path and runtime_parameters and "path" in runtime_parameters,
            ]
        ):
            raise ValueError(
                "If batch_data, query, or path arguments are provided, the same keys cannot appear in the "
                "runtime_parameters argument."
            )

        if batch_request:
            # TODO: Raise a warning if any parameters besides batch_requests are specified
            return datasource.get_batch_list_from_batch_request(
                batch_request=batch_request
            )
        elif any([batch_data is not None, query, path, runtime_parameters]):
            runtime_parameters = runtime_parameters or {}
            if batch_data is not None:
                runtime_parameters["batch_data"] = batch_data
            elif query is not None:
                runtime_parameters["query"] = query
            elif path is not None:
                runtime_parameters["path"] = path

            if batch_identifiers is None:
                batch_identifiers = kwargs
            else:
                # Raise a warning if kwargs exist
                pass

            batch_request = RuntimeBatchRequest(
                datasource_name=datasource_name,
                data_connector_name=data_connector_name,
                data_asset_name=data_asset_name,
                batch_spec_passthrough=batch_spec_passthrough,
                runtime_parameters=runtime_parameters,
                batch_identifiers=batch_identifiers,
            )

        else:
            if data_connector_query is None:
                if (
                    batch_filter_parameters is not None
                    and batch_identifiers is not None
                ):
                    raise ValueError(
                        'Must provide either "batch_filter_parameters" or "batch_identifiers", not both.'
                    )
                elif batch_filter_parameters is None and batch_identifiers is not None:
                    logger.warning(
                        'Attempting to build data_connector_query but "batch_identifiers" was provided '
                        'instead of "batch_filter_parameters". The "batch_identifiers" key on '
                        'data_connector_query has been renamed to "batch_filter_parameters". Please update '
                        'your code. Falling back on provided "batch_identifiers".'
                    )
                    batch_filter_parameters = batch_identifiers
                elif batch_filter_parameters is None and batch_identifiers is None:
                    batch_filter_parameters = kwargs
                else:
                    # Raise a warning if kwargs exist
                    pass

                data_connector_query_params: dict = {
                    "batch_filter_parameters": batch_filter_parameters,
                    "limit": limit,
                    "index": index,
                    "custom_filter_function": custom_filter_function,
                }
                data_connector_query = IDDict(data_connector_query_params)
            else:
                # Raise a warning if batch_filter_parameters or kwargs exist
                data_connector_query = IDDict(data_connector_query)

            if batch_spec_passthrough is None:
                batch_spec_passthrough = {}
                if sampling_method is not None:
                    sampling_params: dict = {
                        "sampling_method": sampling_method,
                    }
                    if sampling_kwargs is not None:
                        sampling_params["sampling_kwargs"] = sampling_kwargs
                    batch_spec_passthrough.update(sampling_params)
                if splitter_method is not None:
                    splitter_params: dict = {
                        "splitter_method": splitter_method,
                    }
                    if splitter_kwargs is not None:
                        splitter_params["splitter_kwargs"] = splitter_kwargs
                    batch_spec_passthrough.update(splitter_params)

            batch_request: BatchRequest = BatchRequest(
                datasource_name=datasource_name,
                data_connector_name=data_connector_name,
                data_asset_name=data_asset_name,
                data_connector_query=data_connector_query,
                batch_spec_passthrough=batch_spec_passthrough,
            )
        return datasource.get_batch_list_from_batch_request(batch_request=batch_request)

    def get_validator(
        self,
        datasource_name: Optional[str] = None,
        data_connector_name: Optional[str] = None,
        data_asset_name: Optional[str] = None,
        *,
        batch_request: Optional[Union[BatchRequest, RuntimeBatchRequest]] = None,
        batch_request_list: List[
            Optional[Union[BatchRequest, RuntimeBatchRequest]]
        ] = None,
        batch_data: Optional[Any] = None,
        data_connector_query: Optional[Union[IDDict, dict]] = None,
        batch_identifiers: Optional[dict] = None,
        limit: Optional[int] = None,
        index: Optional[Union[int, list, tuple, slice, str]] = None,
        custom_filter_function: Optional[Callable] = None,
        expectation_suite_name: Optional[str] = None,
        expectation_suite: Optional[ExpectationSuite] = None,
        create_expectation_suite_with_name: Optional[str] = None,
        batch_spec_passthrough: Optional[dict] = None,
        sampling_method: Optional[str] = None,
        sampling_kwargs: Optional[dict] = None,
        splitter_method: Optional[str] = None,
        splitter_kwargs: Optional[dict] = None,
        runtime_parameters: Optional[dict] = None,
        query: Optional[str] = None,
        path: Optional[str] = None,
        batch_filter_parameters: Optional[dict] = None,
        **kwargs,
    ) -> Validator:
        """
        This method applies only to the new (V3) Datasource schema.
        """

        if (
            sum(
                bool(x)
                for x in [
                    expectation_suite is not None,
                    expectation_suite_name is not None,
                    create_expectation_suite_with_name is not None,
                ]
            )
            != 1
        ):
            raise ValueError(
                "Exactly one of expectation_suite_name, expectation_suite, or create_expectation_suite_with_name must be specified"
            )

        if expectation_suite_name is not None:
            expectation_suite = self.get_expectation_suite(expectation_suite_name)

        if create_expectation_suite_with_name is not None:
            expectation_suite = self.create_expectation_suite(
                expectation_suite_name=create_expectation_suite_with_name
            )
        if (
            sum(
                bool(x)
                for x in [batch_request is not None, batch_request_list is not None]
            )
            > 1
        ):
            raise ValueError(
                "Only one of batch_request or batch_request_list may be specified"
            )

        if not batch_request_list:
            batch_request_list = [batch_request]

        batch_list: List = []
        for batch_request in batch_request_list:
            batch_list.extend(
                self.get_batch_list(
                    datasource_name=datasource_name,
                    data_connector_name=data_connector_name,
                    data_asset_name=data_asset_name,
                    batch_request=batch_request,
                    batch_data=batch_data,
                    data_connector_query=data_connector_query,
                    batch_identifiers=batch_identifiers,
                    limit=limit,
                    index=index,
                    custom_filter_function=custom_filter_function,
                    batch_spec_passthrough=batch_spec_passthrough,
                    sampling_method=sampling_method,
                    sampling_kwargs=sampling_kwargs,
                    splitter_method=splitter_method,
                    splitter_kwargs=splitter_kwargs,
                    runtime_parameters=runtime_parameters,
                    query=query,
                    path=path,
                    batch_filter_parameters=batch_filter_parameters,
                    **kwargs,
                )
            )

        # We get a single batch_definition so we can get the execution_engine here. All batches will share the same one
        # So the batch itself doesn't matter. But we use -1 because that will be the latest batch loaded.
        batch_definition = batch_list[-1].batch_definition
        execution_engine = self.datasources[
            batch_definition.datasource_name
        ].execution_engine

        validator = Validator(
            execution_engine=execution_engine,
            interactive_evaluation=True,
            expectation_suite=expectation_suite,
            data_context=self,
            batches=batch_list,
        )

        return validator

    def list_validation_operator_names(self):
        if not self.validation_operators:
            return []
        return list(self.validation_operators.keys())

    @usage_statistics_enabled_method(
        event_name="data_context.add_datasource",
        args_payload_fn=add_datasource_usage_statistics,
    )
    def add_datasource(
        self, name, initialize=True, **kwargs
    ) -> Optional[Dict[str, Union[LegacyDatasource, BaseDatasource]]]:
        """Add a new datasource to the data context, with configuration provided as kwargs.
        Args:
            name: the name for the new datasource to add
            initialize: if False, add the datasource to the config, but do not
                initialize it, for example if a user needs to debug database connectivity.
            kwargs (keyword arguments): the configuration for the new datasource

        Returns:
            datasource (Datasource)
        """
        logger.debug("Starting BaseDataContext.add_datasource for %s" % name)

        module_name = kwargs.get("module_name", "great_expectations.datasource")
        verify_dynamic_loading_support(module_name=module_name)
        class_name = kwargs.get("class_name")
        datasource_class = load_class(module_name=module_name, class_name=class_name)

        # For any class that should be loaded, it may control its configuration construction
        # by implementing a classmethod called build_configuration
        config: Union[CommentedMap, dict]
        if hasattr(datasource_class, "build_configuration"):
            config = datasource_class.build_configuration(**kwargs)
        else:
            config = kwargs

        return self._instantiate_datasource_from_config_and_update_project_config(
            name=name,
            config=config,
            initialize=initialize,
        )

    def _instantiate_datasource_from_config_and_update_project_config(
        self, name: str, config: Union[CommentedMap, dict], initialize: bool = True
    ) -> Optional[Union[LegacyDatasource, BaseDatasource]]:
        datasource_config: DatasourceConfig = datasourceConfigSchema.load(
            CommentedMap(**config)
        )
        self._project_config["datasources"][name] = datasource_config
        datasource_config = self.project_config_with_variables_substituted.datasources[
            name
        ]
        config: dict = dict(datasourceConfigSchema.dump(datasource_config))
        datasource: Optional[Union[LegacyDatasource, BaseDatasource]]
        if initialize:
            try:
                datasource = self._instantiate_datasource_from_config(
                    name=name, config=config
                )
                self._cached_datasources[name] = datasource
            except ge_exceptions.DatasourceInitializationError as e:
                # Do not keep configuration that could not be instantiated.
                del self._project_config["datasources"][name]
                raise e
        else:
            datasource = None
        return datasource

    def _instantiate_datasource_from_config(
        self, name: str, config: dict
    ) -> Union[LegacyDatasource, BaseDatasource]:
        """Instantiate a new datasource to the data context, with configuration provided as kwargs.
        Args:
            name(str): name of datasource
            config(dict): dictionary of configuration

        Returns:
            datasource (Datasource)
        """
        # We perform variable substitution in the datasource's config here before using the config
        # to instantiate the datasource object. Variable substitution is a service that the data
        # context provides. Datasources should not see unsubstituted variables in their config.

        try:
            datasource: Union[
                LegacyDatasource, BaseDatasource
            ] = self._build_datasource_from_config(name=name, config=config)
        except Exception as e:
            raise ge_exceptions.DatasourceInitializationError(
                datasource_name=name, message=str(e)
            )
        return datasource

    def add_batch_kwargs_generator(
        self, datasource_name, batch_kwargs_generator_name, class_name, **kwargs
    ):
        """
        Add a batch kwargs generator to the named datasource, using the provided
        configuration.

        Args:
            datasource_name: name of datasource to which to add the new batch kwargs generator
            batch_kwargs_generator_name: name of the generator to add
            class_name: class of the batch kwargs generator to add
            **kwargs: batch kwargs generator configuration, provided as kwargs

        Returns:

        """
        datasource_obj = self.get_datasource(datasource_name)
        generator = datasource_obj.add_batch_kwargs_generator(
            name=batch_kwargs_generator_name, class_name=class_name, **kwargs
        )
        return generator

    def set_config(self, project_config: DataContextConfig):
        self._project_config = project_config

    def get_config(
        self, mode="typed"
    ) -> Union[DataContextConfig, CommentedMap, dict, str]:
        config: DataContextConfig = self._project_config

        if mode == "typed":
            return config

        elif mode == "commented_map":
            return config.commented_map

        elif mode == "dict":
            return config.to_json_dict()

        elif mode == "yaml":
            return config.to_yaml_str()

        else:
            raise ValueError(f"Unknown config mode {mode}")

    def _build_datasource_from_config(
        self, name: str, config: Union[dict, DatasourceConfig]
    ):
        # We convert from the type back to a dictionary for purposes of instantiation
        if isinstance(config, DatasourceConfig):
            config = datasourceConfigSchema.dump(config)
        config.update({"name": name})
        # While the new Datasource classes accept "data_context_root_directory", the Legacy Datasource classes do not.
        if config["class_name"] in [
            "BaseDatasource",
            "Datasource",
        ]:
            config.update({"data_context_root_directory": self.root_directory})
        module_name = "great_expectations.datasource"
        datasource = instantiate_class_from_config(
            config=config,
            runtime_environment={"data_context": self},
            config_defaults={"module_name": module_name},
        )
        if not datasource:
            raise ge_exceptions.ClassInstantiationError(
                module_name=module_name,
                package_name=None,
                class_name=config["class_name"],
            )
        return datasource

    def get_datasource(
        self, datasource_name: str = "default"
    ) -> Optional[Union[LegacyDatasource, BaseDatasource]]:
        """Get the named datasource

        Args:
            datasource_name (str): the name of the datasource from the configuration

        Returns:
            datasource (Datasource)
        """
        if datasource_name in self._cached_datasources:
            return self._cached_datasources[datasource_name]
        if (
            datasource_name
            in self.project_config_with_variables_substituted.datasources
        ):
            datasource_config: DatasourceConfig = copy.deepcopy(
                self.project_config_with_variables_substituted.datasources[
                    datasource_name
                ]
            )
        else:
            raise ValueError(
                f"Unable to load datasource `{datasource_name}` -- no configuration found or invalid configuration."
            )
        config: dict = dict(datasourceConfigSchema.dump(datasource_config))
        datasource: Optional[
            Union[LegacyDatasource, BaseDatasource]
        ] = self._instantiate_datasource_from_config(
            name=datasource_name, config=config
        )
        self._cached_datasources[datasource_name] = datasource
        return datasource

    def list_expectation_suites(self):
        """Return a list of available expectation suite names."""
        try:
            keys = self.expectations_store.list_keys()
        except KeyError as e:
            raise ge_exceptions.InvalidConfigError(
                "Unable to find configured store: %s" % str(e)
            )
        return keys

    def list_datasources(self):
        """List currently-configured datasources on this context. Masks passwords.

        Returns:
            List(dict): each dictionary includes "name", "class_name", and "module_name" keys
        """
        datasources = []
        for (
            key,
            value,
        ) in self.project_config_with_variables_substituted.datasources.items():
            value["name"] = key

            if "credentials" in value:
                if "password" in value["credentials"]:
                    value["credentials"][
                        "password"
                    ] = PasswordMasker.MASKED_PASSWORD_STRING
                if "url" in value["credentials"]:
                    value["credentials"]["url"] = PasswordMasker.mask_db_url(
                        value["credentials"]["url"]
                    )

            datasources.append(value)
        return datasources

    def list_stores(self):
        """List currently-configured Stores on this context"""

        stores = []
        for (
            name,
            value,
        ) in self.project_config_with_variables_substituted.stores.items():
            store_config = copy.deepcopy(value)
            store_config["name"] = name
            stores.append(store_config)
        return stores

    def list_active_stores(self):
        """
        List active Stores on this context. Active stores are identified by setting the following parameters:
            expectations_store_name,
            validations_store_name,
            evaluation_parameter_store_name,
            checkpoint_store_name
        """
        active_store_names: List[str] = [
            self.expectations_store_name,
            self.validations_store_name,
            self.evaluation_parameter_store_name,
        ]
        try:
            active_store_names.append(self.checkpoint_store_name)
        except (AttributeError, ge_exceptions.InvalidTopLevelConfigKeyError):
            pass

        return [
            store for store in self.list_stores() if store["name"] in active_store_names
        ]

    def list_validation_operators(self):
        """List currently-configured Validation Operators on this context"""

        validation_operators = []
        for (
            name,
            value,
        ) in (
            self.project_config_with_variables_substituted.validation_operators.items()
        ):
            value["name"] = name
            validation_operators.append(value)
        return validation_operators

    def create_expectation_suite(
        self,
        expectation_suite_name: str,
        overwrite_existing: Optional[bool] = False,
        ge_cloud_id: Optional[str] = None,
        **kwargs,
    ) -> ExpectationSuite:
        """Build a new expectation suite and save it into the data_context expectation store.

        Args:
            expectation_suite_name: The name of the expectation_suite to create
            overwrite_existing (boolean): Whether to overwrite expectation suite if expectation suite with given name
                already exists.

        Returns:
            A new (empty) expectation suite.
        """
        if not isinstance(overwrite_existing, bool):
            raise ValueError("Parameter overwrite_existing must be of type BOOL")

        expectation_suite: ExpectationSuite = ExpectationSuite(
            expectation_suite_name=expectation_suite_name
        )
        if self.ge_cloud_mode:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="expectation_suite", ge_cloud_id=ge_cloud_id
            )
            if self.expectations_store.has_key(key) and not overwrite_existing:
                raise ge_exceptions.DataContextError(
                    "expectation_suite with GE Cloud ID {} already exists. If you would like to overwrite this "
                    "expectation_suite, set overwrite_existing=True.".format(
                        ge_cloud_id
                    )
                )
        else:
            key: ExpectationSuiteIdentifier = ExpectationSuiteIdentifier(
                expectation_suite_name=expectation_suite_name
            )
            if self.expectations_store.has_key(key) and not overwrite_existing:
                raise ge_exceptions.DataContextError(
                    "expectation_suite with name {} already exists. If you would like to overwrite this "
                    "expectation_suite, set overwrite_existing=True.".format(
                        expectation_suite_name
                    )
                )

        self.expectations_store.set(key, expectation_suite, **kwargs)
        return expectation_suite

    def delete_expectation_suite(
        self,
        expectation_suite_name: Optional[str] = None,
        ge_cloud_id: Optional[str] = None,
    ):
        """Delete specified expectation suite from data_context expectation store.

        Args:
            expectation_suite_name: The name of the expectation_suite to create

        Returns:
            True for Success and False for Failure.
        """
        if self.ge_cloud_mode:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="expectation_suite", ge_cloud_id=ge_cloud_id
            )
        else:
            key: ExpectationSuiteIdentifier = ExpectationSuiteIdentifier(
                expectation_suite_name
            )
        if not self.expectations_store.has_key(key):
            raise ge_exceptions.DataContextError(
                "expectation_suite with name {} does not exist."
            )
        else:
            self.expectations_store.remove_key(key)
            return True

    def get_expectation_suite(
        self,
        expectation_suite_name: Optional[str] = None,
        ge_cloud_id: Optional[str] = None,
    ) -> ExpectationSuite:
        """Get an Expectation Suite by name or GE Cloud ID
        Args:
            expectation_suite_name (str): the name for the Expectation Suite
            ge_cloud_id (str): the GE Cloud ID for the Expectation Suite

        Returns:
            expectation_suite
        """
        if self.ge_cloud_mode:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="expectation_suite", ge_cloud_id=ge_cloud_id
            )
        else:
            key: ExpectationSuiteIdentifier = ExpectationSuiteIdentifier(
                expectation_suite_name=expectation_suite_name
            )

        if self.expectations_store.has_key(key):
            return self.expectations_store.get(key)
        else:
            raise ge_exceptions.DataContextError(
                "expectation_suite %s not found" % expectation_suite_name
            )

    def list_expectation_suite_names(self):
        """Lists the available expectation suite names"""
        sorted_expectation_suite_names = [
            i.expectation_suite_name for i in self.list_expectation_suites()
        ]
        sorted_expectation_suite_names.sort()
        return sorted_expectation_suite_names

    @usage_statistics_enabled_method(
        event_name="data_context.save_expectation_suite",
        args_payload_fn=save_expectation_suite_usage_statistics,
    )
    def save_expectation_suite(
        self,
        expectation_suite: ExpectationSuite,
        expectation_suite_name: Optional[str] = None,
        overwrite_existing: Optional[bool] = True,
        ge_cloud_id: Optional[str] = None,
        **kwargs,
    ):
        """Save the provided expectation suite into the DataContext.

        Args:
            expectation_suite: the suite to save
            expectation_suite_name: the name of this expectation suite. If no name is provided the name will \
                be read from the suite

        Returns:
            None
        """
        if self.ge_cloud_mode:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="expectation_suite", ge_cloud_id=ge_cloud_id
            )
            if self.expectations_store.has_key(key) and not overwrite_existing:
                raise ge_exceptions.DataContextError(
                    "expectation_suite with GE Cloud ID {} already exists. If you would like to overwrite this "
                    "expectation_suite, set overwrite_existing=True.".format(
                        ge_cloud_id
                    )
                )
        else:
            if expectation_suite_name is None:
                key: ExpectationSuiteIdentifier = ExpectationSuiteIdentifier(
                    expectation_suite_name=expectation_suite.expectation_suite_name
                )
            else:
                expectation_suite.expectation_suite_name = expectation_suite_name
                key: ExpectationSuiteIdentifier = ExpectationSuiteIdentifier(
                    expectation_suite_name=expectation_suite_name
                )
            if self.expectations_store.has_key(key) and not overwrite_existing:
                raise ge_exceptions.DataContextError(
                    "expectation_suite with name {} already exists. If you would like to overwrite this "
                    "expectation_suite, set overwrite_existing=True.".format(
                        expectation_suite_name
                    )
                )

        self._evaluation_parameter_dependencies_compiled = False
        return self.expectations_store.set(key, expectation_suite, **kwargs)

    def _store_metrics(self, requested_metrics, validation_results, target_store_name):
        """
        requested_metrics is a dictionary like this:

              requested_metrics:
                *:  # The asterisk here matches *any* expectation suite name
                  # use the 'kwargs' key to request metrics that are defined by kwargs,
                  # for example because they are defined only for a particular column
                  # - column:
                  #     Age:
                  #        - expect_column_min_to_be_between.result.observed_value
                    - statistics.evaluated_expectations
                    - statistics.successful_expectations

        Args:
            requested_metrics:
            validation_results:
            target_store_name:

        Returns:

        """
        expectation_suite_name = validation_results.meta["expectation_suite_name"]
        run_id = validation_results.meta["run_id"]
        data_asset_name = validation_results.meta.get("batch_kwargs", {}).get(
            "data_asset_name"
        )

        for expectation_suite_dependency, metrics_list in requested_metrics.items():
            if (expectation_suite_dependency != "*") and (
                expectation_suite_dependency != expectation_suite_name
            ):
                continue

            if not isinstance(metrics_list, list):
                raise ge_exceptions.DataContextError(
                    "Invalid requested_metrics configuration: metrics requested for "
                    "each expectation suite must be a list."
                )

            for metric_configuration in metrics_list:
                metric_configurations = _get_metric_configuration_tuples(
                    metric_configuration
                )
                for metric_name, metric_kwargs in metric_configurations:
                    try:
                        metric_value = validation_results.get_metric(
                            metric_name, **metric_kwargs
                        )
                        self.stores[target_store_name].set(
                            ValidationMetricIdentifier(
                                run_id=run_id,
                                data_asset_name=data_asset_name,
                                expectation_suite_identifier=ExpectationSuiteIdentifier(
                                    expectation_suite_name
                                ),
                                metric_name=metric_name,
                                metric_kwargs_id=get_metric_kwargs_id(
                                    metric_name, metric_kwargs
                                ),
                            ),
                            metric_value,
                        )
                    except ge_exceptions.UnavailableMetricError:
                        # This will happen frequently in larger pipelines
                        logger.debug(
                            "metric {} was requested by another expectation suite but is not available in "
                            "this validation result.".format(metric_name)
                        )

    def store_validation_result_metrics(
        self, requested_metrics, validation_results, target_store_name
    ):
        self._store_metrics(requested_metrics, validation_results, target_store_name)

    def store_evaluation_parameters(self, validation_results, target_store_name=None):
        if not self._evaluation_parameter_dependencies_compiled:
            self._compile_evaluation_parameter_dependencies()

        if target_store_name is None:
            target_store_name = self.evaluation_parameter_store_name

        self._store_metrics(
            self._evaluation_parameter_dependencies,
            validation_results,
            target_store_name,
        )

    @property
    def evaluation_parameter_store(self):
        return self.stores[self.evaluation_parameter_store_name]

    @property
    def evaluation_parameter_store_name(self):
        return (
            self.project_config_with_variables_substituted.evaluation_parameter_store_name
        )

    @property
    def validations_store_name(self):
        return self.project_config_with_variables_substituted.validations_store_name

    @property
    def validations_store(self):
        return self.stores[self.validations_store_name]

    def _compile_evaluation_parameter_dependencies(self):
        self._evaluation_parameter_dependencies = {}
        for key in self.expectations_store.list_keys():
            expectation_suite = self.expectations_store.get(key)
            if not expectation_suite:
                continue

            dependencies = expectation_suite.get_evaluation_parameter_dependencies()
            if len(dependencies) > 0:
                nested_update(self._evaluation_parameter_dependencies, dependencies)

        self._evaluation_parameter_dependencies_compiled = True

    def get_validation_result(
        self,
        expectation_suite_name,
        run_id=None,
        batch_identifier=None,
        validations_store_name=None,
        failed_only=False,
    ):
        """Get validation results from a configured store.

        Args:
            expectation_suite_name: expectation_suite name for which to get validation result (default: "default")
            run_id: run_id for which to get validation result (if None, fetch the latest result by alphanumeric sort)
            validations_store_name: the name of the store from which to get validation results
            failed_only: if True, filter the result to return only failed expectations

        Returns:
            validation_result

        """
        if validations_store_name is None:
            validations_store_name = self.validations_store_name
        selected_store = self.stores[validations_store_name]

        if run_id is None or batch_identifier is None:
            # Get most recent run id
            # NOTE : This method requires a (potentially very inefficient) list_keys call.
            # It should probably move to live in an appropriate Store class,
            # but when we do so, that Store will need to function as more than just a key-value Store.
            key_list = selected_store.list_keys()
            filtered_key_list = []
            for key in key_list:
                if run_id is not None and key.run_id != run_id:
                    continue
                if (
                    batch_identifier is not None
                    and key.batch_identifier != batch_identifier
                ):
                    continue
                filtered_key_list.append(key)

            # run_id_set = set([key.run_id for key in filtered_key_list])
            if len(filtered_key_list) == 0:
                logger.warning("No valid run_id values found.")
                return {}

            filtered_key_list = sorted(filtered_key_list, key=lambda x: x.run_id)

            if run_id is None:
                run_id = filtered_key_list[-1].run_id
            if batch_identifier is None:
                batch_identifier = filtered_key_list[-1].batch_identifier

        key = ValidationResultIdentifier(
            expectation_suite_identifier=ExpectationSuiteIdentifier(
                expectation_suite_name=expectation_suite_name
            ),
            run_id=run_id,
            batch_identifier=batch_identifier,
        )
        results_dict = selected_store.get(key)

        # TODO: This should be a convenience method of ValidationResultSuite
        if failed_only:
            failed_results_list = [
                result for result in results_dict.results if not result.success
            ]
            results_dict.results = failed_results_list
            return results_dict
        else:
            return results_dict

    def update_return_obj(self, data_asset, return_obj):
        """Helper called by data_asset.

        Args:
            data_asset: The data_asset whose validation produced the current return object
            return_obj: the return object to update

        Returns:
            return_obj: the return object, potentially changed into a widget by the configured expectation explorer
        """
        return return_obj

    @usage_statistics_enabled_method(event_name="data_context.build_data_docs")
    def build_data_docs(
        self,
        site_names=None,
        resource_identifiers=None,
        dry_run=False,
        build_index: bool = True,
    ):
        """
        Build Data Docs for your project.

        These make it simple to visualize data quality in your project. These
        include Expectations, Validations & Profiles. The are built for all
        Datasources from JSON artifacts in the local repo including validations
        & profiles from the uncommitted directory.

        :param site_names: if specified, build data docs only for these sites, otherwise,
                            build all the sites specified in the context's config
        :param resource_identifiers: a list of resource identifiers (ExpectationSuiteIdentifier,
                            ValidationResultIdentifier). If specified, rebuild HTML
                            (or other views the data docs sites are rendering) only for
                            the resources in this list. This supports incremental build
                            of data docs sites (e.g., when a new validation result is created)
                            and avoids full rebuild.
        :param dry_run: a flag, if True, the method returns a structure containing the
                            URLs of the sites that *would* be built, but it does not build
                            these sites. The motivation for adding this flag was to allow
                            the CLI to display the the URLs before building and to let users
                            confirm.

        :param build_index: a flag if False, skips building the index page

        Returns:
            A dictionary with the names of the updated data documentation sites as keys and the the location info
            of their index.html files as values
        """
        logger.debug("Starting DataContext.build_data_docs")

        index_page_locator_infos = {}

        sites = self.project_config_with_variables_substituted.data_docs_sites
        if sites:
            logger.debug("Found data_docs_sites. Building sites...")

            for site_name, site_config in sites.items():
                logger.debug(
                    "Building Data Docs Site %s" % site_name,
                )

                if (site_names and (site_name in site_names)) or not site_names:
                    complete_site_config = site_config
                    module_name = "great_expectations.render.renderer.site_builder"
                    site_builder = instantiate_class_from_config(
                        config=complete_site_config,
                        runtime_environment={
                            "data_context": self,
                            "root_directory": self.root_directory,
                            "site_name": site_name,
                            "ge_cloud_mode": self.ge_cloud_mode,
                        },
                        config_defaults={"module_name": module_name},
                    )
                    if not site_builder:
                        raise ge_exceptions.ClassInstantiationError(
                            module_name=module_name,
                            package_name=None,
                            class_name=complete_site_config["class_name"],
                        )
                    if dry_run:
                        index_page_locator_infos[
                            site_name
                        ] = site_builder.get_resource_url(only_if_exists=False)
                    else:
                        index_page_resource_identifier_tuple = site_builder.build(
                            resource_identifiers,
                            build_index=(build_index and not self.ge_cloud_mode),
                        )
                        if index_page_resource_identifier_tuple:
                            index_page_locator_infos[
                                site_name
                            ] = index_page_resource_identifier_tuple[0]

        else:
            logger.debug("No data_docs_config found. No site(s) built.")

        return index_page_locator_infos

    def clean_data_docs(self, site_name=None) -> bool:
        """
        Clean a given data docs site.

        This removes all files from the configured Store.

        Args:
            site_name (str): Optional, the name of the site to clean. If not
            specified, all sites will be cleaned.
        """
        data_docs_sites = self.project_config_with_variables_substituted.data_docs_sites
        if not data_docs_sites:
            raise ge_exceptions.DataContextError(
                "No data docs sites were found on this DataContext, therefore no sites will be cleaned.",
            )

        data_docs_site_names = list(data_docs_sites.keys())
        if site_name:
            if site_name not in data_docs_site_names:
                raise ge_exceptions.DataContextError(
                    f"The specified site name `{site_name}` does not exist in this project."
                )
            return self._clean_data_docs_site(site_name)

        cleaned = []
        for existing_site_name in data_docs_site_names:
            cleaned.append(self._clean_data_docs_site(existing_site_name))
        return all(cleaned)

    def _clean_data_docs_site(self, site_name: str) -> bool:
        sites = self.project_config_with_variables_substituted.data_docs_sites
        if not sites:
            return False
        site_config = sites.get(site_name)

        site_builder = instantiate_class_from_config(
            config=site_config,
            runtime_environment={
                "data_context": self,
                "root_directory": self.root_directory,
            },
            config_defaults={
                "module_name": "great_expectations.render.renderer.site_builder"
            },
        )
        site_builder.clean_site()
        return True

    def profile_datasource(
        self,
        datasource_name,
        batch_kwargs_generator_name=None,
        data_assets=None,
        max_data_assets=20,
        profile_all_data_assets=True,
        profiler=BasicDatasetProfiler,
        profiler_configuration=None,
        dry_run=False,
        run_id=None,
        additional_batch_kwargs=None,
        run_name=None,
        run_time=None,
    ):
        """Profile the named datasource using the named profiler.

        Args:
            datasource_name: the name of the datasource for which to profile data_assets
            batch_kwargs_generator_name: the name of the batch kwargs generator to use to get batches
            data_assets: list of data asset names to profile
            max_data_assets: if the number of data assets the batch kwargs generator yields is greater than this max_data_assets,
                profile_all_data_assets=True is required to profile all
            profile_all_data_assets: when True, all data assets are profiled, regardless of their number
            profiler: the profiler class to use
            profiler_configuration: Optional profiler configuration dict
            dry_run: when true, the method checks arguments and reports if can profile or specifies the arguments that are missing
            additional_batch_kwargs: Additional keyword arguments to be provided to get_batch when loading the data asset.
        Returns:
            A dictionary::

                {
                    "success": True/False,
                    "results": List of (expectation_suite, EVR) tuples for each of the data_assets found in the datasource
                }

            When success = False, the error details are under "error" key
        """

        # We don't need the datasource object, but this line serves to check if the datasource by the name passed as
        # an arg exists and raise an error if it does not.
        datasource = self.get_datasource(datasource_name)

        if not dry_run:
            logger.info(f"Profiling '{datasource_name}' with '{profiler.__name__}'")

        profiling_results = {}

        # Build the list of available data asset names (each item a tuple of name and type)

        data_asset_names_dict = self.get_available_data_asset_names(datasource_name)

        available_data_asset_name_list = []
        try:
            datasource_data_asset_names_dict = data_asset_names_dict[datasource_name]
        except KeyError:
            # KeyError will happen if there is not datasource
            raise ge_exceptions.ProfilerError(f"No datasource {datasource_name} found.")

        if batch_kwargs_generator_name is None:
            # if no generator name is passed as an arg and the datasource has only
            # one generator with data asset names, use it.
            # if ambiguous, raise an exception
            for name in datasource_data_asset_names_dict.keys():
                if batch_kwargs_generator_name is not None:
                    profiling_results = {
                        "success": False,
                        "error": {
                            "code": DataContext.PROFILING_ERROR_CODE_MULTIPLE_BATCH_KWARGS_GENERATORS_FOUND
                        },
                    }
                    return profiling_results

                if len(datasource_data_asset_names_dict[name]["names"]) > 0:
                    available_data_asset_name_list = datasource_data_asset_names_dict[
                        name
                    ]["names"]
                    batch_kwargs_generator_name = name

            if batch_kwargs_generator_name is None:
                profiling_results = {
                    "success": False,
                    "error": {
                        "code": DataContext.PROFILING_ERROR_CODE_NO_BATCH_KWARGS_GENERATORS_FOUND
                    },
                }
                return profiling_results
        else:
            # if the generator name is passed as an arg, get this generator's available data asset names
            try:
                available_data_asset_name_list = datasource_data_asset_names_dict[
                    batch_kwargs_generator_name
                ]["names"]
            except KeyError:
                raise ge_exceptions.ProfilerError(
                    "batch kwargs Generator {} not found. Specify the name of a generator configured in this datasource".format(
                        batch_kwargs_generator_name
                    )
                )

        available_data_asset_name_list = sorted(
            available_data_asset_name_list, key=lambda x: x[0]
        )

        if len(available_data_asset_name_list) == 0:
            raise ge_exceptions.ProfilerError(
                "No Data Assets found in Datasource {}. Used batch kwargs generator: {}.".format(
                    datasource_name, batch_kwargs_generator_name
                )
            )
        total_data_assets = len(available_data_asset_name_list)

        if isinstance(data_assets, list) and len(data_assets) > 0:
            not_found_data_assets = [
                name
                for name in data_assets
                if name not in [da[0] for da in available_data_asset_name_list]
            ]
            if len(not_found_data_assets) > 0:
                profiling_results = {
                    "success": False,
                    "error": {
                        "code": DataContext.PROFILING_ERROR_CODE_SPECIFIED_DATA_ASSETS_NOT_FOUND,
                        "not_found_data_assets": not_found_data_assets,
                        "data_assets": available_data_asset_name_list,
                    },
                }
                return profiling_results

            data_assets.sort()
            data_asset_names_to_profiled = data_assets
            total_data_assets = len(available_data_asset_name_list)
            if not dry_run:
                logger.info(
                    "Profiling the white-listed data assets: %s, alphabetically."
                    % (",".join(data_assets))
                )
        else:
            if not profile_all_data_assets:
                if total_data_assets > max_data_assets:
                    profiling_results = {
                        "success": False,
                        "error": {
                            "code": DataContext.PROFILING_ERROR_CODE_TOO_MANY_DATA_ASSETS,
                            "num_data_assets": total_data_assets,
                            "data_assets": available_data_asset_name_list,
                        },
                    }
                    return profiling_results

            data_asset_names_to_profiled = [
                name[0] for name in available_data_asset_name_list
            ]
        if not dry_run:
            logger.info(
                "Profiling all %d data assets from batch kwargs generator %s"
                % (len(available_data_asset_name_list), batch_kwargs_generator_name)
            )
        else:
            logger.info(
                "Found %d data assets from batch kwargs generator %s"
                % (len(available_data_asset_name_list), batch_kwargs_generator_name)
            )

        profiling_results["success"] = True

        if not dry_run:
            profiling_results["results"] = []
            total_columns, total_expectations, total_rows, skipped_data_assets = (
                0,
                0,
                0,
                0,
            )
            total_start_time = datetime.datetime.now()

            for name in data_asset_names_to_profiled:
                logger.info("\tProfiling '%s'..." % name)
                try:
                    profiling_results["results"].append(
                        self.profile_data_asset(
                            datasource_name=datasource_name,
                            batch_kwargs_generator_name=batch_kwargs_generator_name,
                            data_asset_name=name,
                            profiler=profiler,
                            profiler_configuration=profiler_configuration,
                            run_id=run_id,
                            additional_batch_kwargs=additional_batch_kwargs,
                            run_name=run_name,
                            run_time=run_time,
                        )["results"][0]
                    )

                except ge_exceptions.ProfilerError as err:
                    logger.warning(err.message)
                except OSError as err:
                    logger.warning(
                        "IOError while profiling %s. (Perhaps a loading error?) Skipping."
                        % name[1]
                    )
                    logger.debug(str(err))
                    skipped_data_assets += 1
                except SQLAlchemyError as e:
                    logger.warning(
                        "SqlAlchemyError while profiling %s. Skipping." % name[1]
                    )
                    logger.debug(str(e))
                    skipped_data_assets += 1

            total_duration = (
                datetime.datetime.now() - total_start_time
            ).total_seconds()
            logger.info(
                """
    Profiled %d of %d named data assets, with %d total rows and %d columns in %.2f seconds.
    Generated, evaluated, and stored %d Expectations during profiling. Please review results using data-docs."""
                % (
                    len(data_asset_names_to_profiled),
                    total_data_assets,
                    total_rows,
                    total_columns,
                    total_duration,
                    total_expectations,
                )
            )
            if skipped_data_assets > 0:
                logger.warning(
                    "Skipped %d data assets due to errors." % skipped_data_assets
                )

        profiling_results["success"] = True
        return profiling_results

    def profile_data_asset(
        self,
        datasource_name,
        batch_kwargs_generator_name=None,
        data_asset_name=None,
        batch_kwargs=None,
        expectation_suite_name=None,
        profiler=BasicDatasetProfiler,
        profiler_configuration=None,
        run_id=None,
        additional_batch_kwargs=None,
        run_name=None,
        run_time=None,
    ):
        """
        Profile a data asset

        :param datasource_name: the name of the datasource to which the profiled data asset belongs
        :param batch_kwargs_generator_name: the name of the batch kwargs generator to use to get batches (only if batch_kwargs are not provided)
        :param data_asset_name: the name of the profiled data asset
        :param batch_kwargs: optional - if set, the method will use the value to fetch the batch to be profiled. If not passed, the batch kwargs generator (generator_name arg) will choose a batch
        :param profiler: the profiler class to use
        :param profiler_configuration: Optional profiler configuration dict
        :param run_name: optional - if set, the validation result created by the profiler will be under the provided run_name
        :param additional_batch_kwargs:
        :returns
            A dictionary::

                {
                    "success": True/False,
                    "results": List of (expectation_suite, EVR) tuples for each of the data_assets found in the datasource
                }

            When success = False, the error details are under "error" key
        """

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
            run_name = run_name or "profiling"
            run_id = RunIdentifier(run_name=run_name, run_time=run_time)

        logger.info(f"Profiling '{datasource_name}' with '{profiler.__name__}'")

        if not additional_batch_kwargs:
            additional_batch_kwargs = {}

        if batch_kwargs is None:
            try:
                generator = self.get_datasource(
                    datasource_name=datasource_name
                ).get_batch_kwargs_generator(name=batch_kwargs_generator_name)
                batch_kwargs = generator.build_batch_kwargs(
                    data_asset_name, **additional_batch_kwargs
                )
            except ge_exceptions.BatchKwargsError:
                raise ge_exceptions.ProfilerError(
                    "Unable to build batch_kwargs for datasource {}, using batch kwargs generator {} for name {}".format(
                        datasource_name, batch_kwargs_generator_name, data_asset_name
                    )
                )
            except ValueError:
                raise ge_exceptions.ProfilerError(
                    "Unable to find datasource {} or batch kwargs generator {}.".format(
                        datasource_name, batch_kwargs_generator_name
                    )
                )
        else:
            batch_kwargs.update(additional_batch_kwargs)

        profiling_results = {"success": False, "results": []}

        total_columns, total_expectations, total_rows, skipped_data_assets = 0, 0, 0, 0
        total_start_time = datetime.datetime.now()

        name = data_asset_name
        # logger.info("\tProfiling '%s'..." % name)

        start_time = datetime.datetime.now()

        if expectation_suite_name is None:
            if batch_kwargs_generator_name is None and data_asset_name is None:
                expectation_suite_name = (
                    datasource_name
                    + "."
                    + profiler.__name__
                    + "."
                    + BatchKwargs(batch_kwargs).to_id()
                )
            else:
                expectation_suite_name = (
                    datasource_name
                    + "."
                    + batch_kwargs_generator_name
                    + "."
                    + data_asset_name
                    + "."
                    + profiler.__name__
                )

        self.create_expectation_suite(
            expectation_suite_name=expectation_suite_name, overwrite_existing=True
        )

        # TODO: Add batch_parameters
        batch = self.get_batch(
            expectation_suite_name=expectation_suite_name,
            batch_kwargs=batch_kwargs,
        )

        if not profiler.validate(batch):
            raise ge_exceptions.ProfilerError(
                "batch '%s' is not a valid batch for the '%s' profiler"
                % (name, profiler.__name__)
            )

        # Note: This logic is specific to DatasetProfilers, which profile a single batch. Multi-batch profilers
        # will have more to unpack.
        expectation_suite, validation_results = profiler.profile(
            batch, run_id=run_id, profiler_configuration=profiler_configuration
        )
        profiling_results["results"].append((expectation_suite, validation_results))

        validation_ref = self.validations_store.set(
            key=ValidationResultIdentifier(
                expectation_suite_identifier=ExpectationSuiteIdentifier(
                    expectation_suite_name=expectation_suite_name
                ),
                run_id=run_id,
                batch_identifier=batch.batch_id,
            ),
            value=validation_results,
        )

        if isinstance(validation_ref, GeCloudIdAwareRef):
            ge_cloud_id = validation_ref.ge_cloud_id
            validation_results.ge_cloud_id = uuid.UUID(ge_cloud_id)

        if isinstance(batch, Dataset):
            # For datasets, we can produce some more detailed statistics
            row_count = batch.get_row_count()
            total_rows += row_count
            new_column_count = len(
                {
                    exp.kwargs["column"]
                    for exp in expectation_suite.expectations
                    if "column" in exp.kwargs
                }
            )
            total_columns += new_column_count

        new_expectation_count = len(expectation_suite.expectations)
        total_expectations += new_expectation_count

        self.save_expectation_suite(expectation_suite)
        duration = (datetime.datetime.now() - start_time).total_seconds()
        logger.info(
            "\tProfiled %d columns using %d rows from %s (%.3f sec)"
            % (new_column_count, row_count, name, duration)
        )

        total_duration = (datetime.datetime.now() - total_start_time).total_seconds()
        logger.info(
            """
Profiled the data asset, with %d total rows and %d columns in %.2f seconds.
Generated, evaluated, and stored %d Expectations during profiling. Please review results using data-docs."""
            % (
                total_rows,
                total_columns,
                total_duration,
                total_expectations,
            )
        )

        profiling_results["success"] = True
        return profiling_results

    def add_checkpoint(
        self,
        name: str,
        config_version: Optional[Union[int, float]] = None,
        template_name: Optional[str] = None,
        module_name: Optional[str] = None,
        class_name: Optional[str] = None,
        run_name_template: Optional[str] = None,
        expectation_suite_name: Optional[str] = None,
        batch_request: Optional[Union[BatchRequest, dict]] = None,
        action_list: Optional[List[dict]] = None,
        evaluation_parameters: Optional[dict] = None,
        runtime_configuration: Optional[dict] = None,
        validations: Optional[List[dict]] = None,
        profilers: Optional[List[dict]] = None,
        # Next two fields are for LegacyCheckpoint configuration
        validation_operator_name: Optional[str] = None,
        batches: Optional[List[dict]] = None,
        # the following four arguments are used by SimpleCheckpoint
        site_names: Optional[Union[str, List[str]]] = None,
        slack_webhook: Optional[str] = None,
        notify_on: Optional[str] = None,
        notify_with: Optional[Union[str, List[str]]] = None,
        ge_cloud_id: Optional[str] = None,
    ) -> Union[Checkpoint, LegacyCheckpoint]:

        checkpoint_config: Union[CheckpointConfig, dict]

        checkpoint_config = {
            "name": name,
            "config_version": config_version,
            "template_name": template_name,
            "module_name": module_name,
            "class_name": class_name,
            "run_name_template": run_name_template,
            "expectation_suite_name": expectation_suite_name,
            "batch_request": batch_request,
            "action_list": action_list,
            "evaluation_parameters": evaluation_parameters,
            "runtime_configuration": runtime_configuration,
            "validations": validations,
            "profilers": profilers,
            # Next two fields are for LegacyCheckpoint configuration
            "validation_operator_name": validation_operator_name,
            "batches": batches,
            # the following four keys are used by SimpleCheckpoint
            "site_names": site_names,
            "slack_webhook": slack_webhook,
            "notify_on": notify_on,
            "notify_with": notify_with,
            "ge_cloud_id": ge_cloud_id,
        }

        checkpoint_config = filter_properties_dict(
            properties=checkpoint_config, clean_falsy=True
        )
        new_checkpoint: Union[
            Checkpoint, LegacyCheckpoint
        ] = instantiate_class_from_config(
            config=checkpoint_config,
            runtime_environment={
                "data_context": self,
            },
            config_defaults={
                "module_name": "great_expectations.checkpoint.checkpoint",
            },
        )
        if self.ge_cloud_mode:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="contract", ge_cloud_id=ge_cloud_id
            )
        else:
            key: ConfigurationIdentifier = ConfigurationIdentifier(
                configuration_key=name,
            )
        checkpoint_config = CheckpointConfig(**new_checkpoint.config.to_json_dict())
        checkpoint_ref = self.checkpoint_store.set(key=key, value=checkpoint_config)
        if isinstance(checkpoint_ref, GeCloudIdAwareRef):
            ge_cloud_id = checkpoint_ref.ge_cloud_id
            new_checkpoint.config.ge_cloud_id = uuid.UUID(ge_cloud_id)
        return new_checkpoint

    def get_checkpoint(
        self, name: Optional[str] = None, ge_cloud_id: Optional[str] = None
    ) -> Union[Checkpoint, LegacyCheckpoint]:
        if ge_cloud_id:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="contract", ge_cloud_id=ge_cloud_id
            )
        else:
            key: ConfigurationIdentifier = ConfigurationIdentifier(
                configuration_key=name,
            )
        try:
            checkpoint_config: CheckpointConfig = self.checkpoint_store.get(key=key)
        except ge_exceptions.InvalidKeyError as exc_ik:
            raise ge_exceptions.CheckpointNotFoundError(
                message=f'Non-existent Checkpoint configuration named "{key.configuration_key}".\n\nDetails: {exc_ik}'
            )
        except ValidationError as exc_ve:
            raise ge_exceptions.InvalidCheckpointConfigError(
                message="Invalid Checkpoint configuration", validation_error=exc_ve
            )

        if checkpoint_config.config_version is None:
            if not (
                "batches" in checkpoint_config.to_json_dict()
                and (
                    len(checkpoint_config.to_json_dict()["batches"]) == 0
                    or {"batch_kwargs", "expectation_suite_names",}.issubset(
                        set(
                            list(
                                itertools.chain.from_iterable(
                                    [
                                        item.keys()
                                        for item in checkpoint_config.to_json_dict()[
                                            "batches"
                                        ]
                                    ]
                                )
                            )
                        )
                    )
                )
            ):
                raise ge_exceptions.CheckpointError(
                    message="Attempt to instantiate LegacyCheckpoint with insufficient and/or incorrect arguments."
                )

        config: dict = checkpoint_config.to_json_dict()
        if name:
            config.update({"name": name})
        config = filter_properties_dict(properties=config, clean_falsy=True)
        checkpoint: Union[Checkpoint, LegacyCheckpoint] = instantiate_class_from_config(
            config=config,
            runtime_environment={
                "data_context": self,
            },
            config_defaults={
                "module_name": "great_expectations.checkpoint",
            },
        )

        return checkpoint

    def delete_checkpoint(
        self, name: Optional[str] = None, ge_cloud_id: Optional[str] = None
    ):
        assert bool(name) ^ bool(
            ge_cloud_id
        ), "Must provide either name or ge_cloud_id."

        if ge_cloud_id:
            key: GeCloudIdentifier = GeCloudIdentifier(
                resource_type="contract", ge_cloud_id=ge_cloud_id
            )
        else:
            key: ConfigurationIdentifier = ConfigurationIdentifier(
                configuration_key=name
            )

        try:
            self.checkpoint_store.remove_key(key=key)
        except ge_exceptions.InvalidKeyError as exc_ik:
            raise ge_exceptions.CheckpointNotFoundError(
                message=f'Non-existent Checkpoint configuration named "{key.configuration_key}".\n\nDetails: {exc_ik}'
            )

    def list_checkpoints(self) -> List[str]:
        if self.ge_cloud_mode:
            return self.checkpoint_store.list_keys()
        else:
            return [x.configuration_key for x in self.checkpoint_store.list_keys()]

    def run_checkpoint(
        self,
        checkpoint_name: str,
        template_name: Optional[str] = None,
        run_name_template: Optional[str] = None,
        expectation_suite_name: Optional[str] = None,
        batch_request: Optional[Union[BatchRequest, dict]] = None,
        action_list: Optional[List[dict]] = None,
        evaluation_parameters: Optional[dict] = None,
        runtime_configuration: Optional[dict] = None,
        validations: Optional[List[dict]] = None,
        profilers: Optional[List[dict]] = None,
        run_id: Optional[Union[str, int, float]] = None,
        run_name: Optional[str] = None,
        run_time: Optional[datetime.datetime] = None,
        result_format: Optional[str] = None,
        ge_cloud_id: Optional[str] = None,
        **kwargs,
    ) -> CheckpointResult:
        """
        Validate against a pre-defined Checkpoint. (Experimental)
        Args:
            checkpoint_name: The name of a Checkpoint defined via the CLI or by manually creating a yml file
            run_name: The run_name for the validation; if None, a default value will be used
            **kwargs: Additional kwargs to pass to the validation operator

        Returns:
            CheckpointResult
        """
        # TODO mark experimental

        checkpoint: Union[Checkpoint, LegacyCheckpoint] = self.get_checkpoint(
            name=checkpoint_name, ge_cloud_id=ge_cloud_id
        )

        checkpoint_config_from_store: dict = checkpoint.config.to_json_dict()

        if (
            "runtime_configuration" in checkpoint_config_from_store
            and "result_format" in checkpoint_config_from_store["runtime_configuration"]
        ):
            result_format = result_format or checkpoint_config_from_store[
                "runtime_configuration"
            ].pop("result_format")

        if result_format is None:
            result_format = {"result_format": "SUMMARY"}

        checkpoint_config_from_call_args: dict = {
            "template_name": template_name,
            "run_name_template": run_name_template,
            "expectation_suite_name": expectation_suite_name,
            "batch_request": batch_request,
            "action_list": action_list,
            "evaluation_parameters": evaluation_parameters,
            "runtime_configuration": runtime_configuration,
            "validations": validations,
            "profilers": profilers,
            "run_id": run_id,
            "run_name": run_name,
            "run_time": run_time,
            "result_format": result_format,
        }

        checkpoint_config = {
            key: value
            for key, value in checkpoint_config_from_store.items()
            if key in checkpoint_config_from_call_args
        }
        checkpoint_config.update(checkpoint_config_from_call_args)
        checkpoint_config = filter_properties_dict(
            properties=checkpoint_config, clean_falsy=True
        )

        checkpoint_run_arguments: dict = dict(**checkpoint_config, **kwargs)

        return checkpoint.run(**checkpoint_run_arguments)

    def test_yaml_config(
        self,
        yaml_config: str,
        name: Optional[str] = None,
        class_name: Optional[str] = None,
        pretty_print: bool = True,
        return_mode: str = "instantiated_class",
        shorten_tracebacks: bool = False,
    ):
        """Convenience method for testing yaml configs

        test_yaml_config is a convenience method for configuring the moving
        parts of a Great Expectations deployment. It allows you to quickly
        test out configs for system components, especially Datasources,
        Checkpoints, and Stores.

        For many deployments of Great Expectations, these components (plus
        Expectations) are the only ones you'll need.

        test_yaml_config is mainly intended for use within notebooks and tests.

        Parameters
        ----------
        yaml_config : str
            A string containing the yaml config to be tested

        name: str
            (Optional) A string containing the name of the component to instantiate

        pretty_print : bool
            Determines whether to print human-readable output

        return_mode : str
            Determines what type of object test_yaml_config will return
            Valid modes are "instantiated_class" and "report_object"

        shorten_tracebacks : bool
            If true, catch any errors during instantiation and print only the
            last element of the traceback stack. This can be helpful for
            rapid iteration on configs in a notebook, because it can remove
            the need to scroll up and down a lot.

        Returns
        -------
        The instantiated component (e.g. a Datasource)
        OR
        a json object containing metadata from the component's self_check method

        The returned object is determined by return_mode.
        """
        usage_stats_event_name: str = "data_context.test_yaml_config"
        usage_stats_event_payload: Dict[str, Union[str, List[str]]] = {}

        if pretty_print:
            print("Attempting to instantiate class from config...")

        if return_mode not in ["instantiated_class", "report_object"]:
            raise ValueError(f"Unknown return_mode: {return_mode}.")

        try:
            substituted_config_variables: Union[
                DataContextConfig, dict
            ] = substitute_all_config_variables(
                self.config_variables,
                dict(os.environ),
            )

            substitutions: dict = {
                **substituted_config_variables,
                **dict(os.environ),
                **self.runtime_environment,
            }

            config_str_with_substituted_variables: Union[
                DataContextConfig, dict
            ] = substitute_all_config_variables(
                yaml_config,
                substitutions,
            )
        except Exception as e:
            usage_stats_event_payload: dict = {
                "diagnostic_info": ["__substitution_error__"],
            }
            send_usage_message(
                data_context=self,
                event=usage_stats_event_name,
                event_payload=usage_stats_event_payload,
                success=False,
            )
            raise e

        try:
            config: CommentedMap = yaml.load(config_str_with_substituted_variables)

            if "class_name" in config:
                class_name = config["class_name"]

        except Exception as e:
            usage_stats_event_payload: dict = {
                "diagnostic_info": ["__yaml_parse_error__"],
            }
            send_usage_message(
                data_context=self,
                event=usage_stats_event_name,
                event_payload=usage_stats_event_payload,
                success=False,
            )
            raise e

        instantiated_class: Any

        try:
            if class_name in self.TEST_YAML_CONFIG_SUPPORTED_STORE_TYPES:
                print(f"\tInstantiating as a Store, since class_name is {class_name}")
                store_name: str = name or config.get("name") or "my_temp_store"
                instantiated_class = cast(
                    Store,
                    self._build_store_from_config(
                        store_name=store_name,
                        store_config=config,
                    ),
                )
                store_name = instantiated_class.store_name or store_name
                self._project_config["stores"][store_name] = config

                store_anonymizer = StoreAnonymizer(self.data_context_id)
                usage_stats_event_payload = store_anonymizer.anonymize_store_info(
                    store_name=store_name, store_obj=instantiated_class
                )

            elif class_name in self.TEST_YAML_CONFIG_SUPPORTED_DATASOURCE_TYPES:
                print(
                    f"\tInstantiating as a Datasource, since class_name is {class_name}"
                )
                datasource_name: str = (
                    name or config.get("name") or "my_temp_datasource"
                )
                instantiated_class = cast(
                    Datasource,
                    self._instantiate_datasource_from_config_and_update_project_config(
                        name=datasource_name,
                        config=config,
                        initialize=True,
                    ),
                )

                datasource_anonymizer = DatasourceAnonymizer(self.data_context_id)

                if class_name == "SimpleSqlalchemyDatasource":
                    # Use the raw config here, defaults will be added in the anonymizer
                    usage_stats_event_payload = (
                        datasource_anonymizer.anonymize_simple_sqlalchemy_datasource(
                            name=datasource_name, config=config
                        )
                    )
                else:
                    # Roundtrip through schema validator to add missing fields
                    datasource_config = datasourceConfigSchema.load(
                        instantiated_class.config
                    )
                    full_datasource_config = datasourceConfigSchema.dump(
                        datasource_config
                    )
                    usage_stats_event_payload = (
                        datasource_anonymizer.anonymize_datasource_info(
                            name=datasource_name, config=full_datasource_config
                        )
                    )

            elif class_name in ["Checkpoint", "SimpleCheckpoint"]:
                print(
                    f"\tInstantiating as a {class_name}, since class_name is {class_name}"
                )

                checkpoint_name: str = (
                    name or config.get("name") or "my_temp_checkpoint"
                )

                checkpoint_config: Union[CheckpointConfig, dict]

                checkpoint_config = CheckpointConfig.from_commented_map(
                    commented_map=config
                )
                checkpoint_config = checkpoint_config.to_json_dict()
                checkpoint_config.update({"name": checkpoint_name})

                if class_name == "Checkpoint":
                    instantiated_class = Checkpoint(
                        data_context=self, **checkpoint_config
                    )
                elif class_name == "SimpleCheckpoint":
                    instantiated_class = SimpleCheckpoint(
                        data_context=self, **checkpoint_config
                    )

                checkpoint_anonymizer = CheckpointAnonymizer(self.data_context_id)

                usage_stats_event_payload = (
                    checkpoint_anonymizer.anonymize_checkpoint_info(
                        name=checkpoint_name, config=checkpoint_config
                    )
                )

            elif class_name in self.TEST_YAML_CONFIG_SUPPORTED_DATA_CONNECTOR_TYPES:
                print(
                    f"\tInstantiating as a DataConnector, since class_name is {class_name}"
                )
                data_connector_name: str = (
                    name or config.get("name") or "my_temp_data_connector"
                )
                instantiated_class = instantiate_class_from_config(
                    config=config,
                    runtime_environment={
                        "root_directory": self.root_directory,
                    },
                    config_defaults={},
                )

                data_connector_anonymizer = DataConnectorAnonymizer(
                    self.data_context_id
                )

                usage_stats_event_payload = (
                    data_connector_anonymizer.anonymize_data_connector_info(
                        name=data_connector_name, config=config
                    )
                )

            else:
                print(
                    "\tNo matching class found. Attempting to instantiate class from the raw config..."
                )
                instantiated_class = instantiate_class_from_config(
                    config=config,
                    runtime_environment={
                        "root_directory": self.root_directory,
                    },
                    config_defaults={},
                )

                # If a subclass of a supported type, find the parent class and anonymize
                store_anonymizer: StoreAnonymizer = StoreAnonymizer(
                    self.data_context_id
                )
                datasource_anonymizer: DatasourceAnonymizer = DatasourceAnonymizer(
                    self.data_context_id
                )
                checkpoint_anonymizer: CheckpointAnonymizer = CheckpointAnonymizer(
                    self.data_context_id
                )
                data_connector_anonymizer: DataConnectorAnonymizer = (
                    DataConnectorAnonymizer(self.data_context_id)
                )
                if (
                    store_anonymizer.is_parent_class_recognized(
                        store_obj=instantiated_class
                    )
                    is not None
                ):
                    store_name: str = name or config.get("name") or "my_temp_store"
                    store_name = instantiated_class.store_name or store_name
                    usage_stats_event_payload = store_anonymizer.anonymize_store_info(
                        store_name=store_name, store_obj=instantiated_class
                    )
                elif (
                    datasource_anonymizer.is_parent_class_recognized(config=config)
                    is not None
                ):
                    datasource_name: str = (
                        name or config.get("name") or "my_temp_datasource"
                    )
                    if datasource_anonymizer.is_parent_class_recognized_v3_api(
                        config=config
                    ):
                        # Roundtrip through schema validator to add missing fields
                        datasource_config = datasourceConfigSchema.load(
                            instantiated_class.config
                        )
                        full_datasource_config = datasourceConfigSchema.dump(
                            datasource_config
                        )
                    else:
                        # for v2 api
                        full_datasource_config = config
                    parent_class_name = (
                        datasource_anonymizer.is_parent_class_recognized(config=config)
                    )
                    if parent_class_name == "SimpleSqlalchemyDatasource":
                        # Use the raw config here, defaults will be added in the anonymizer
                        usage_stats_event_payload = datasource_anonymizer.anonymize_simple_sqlalchemy_datasource(
                            name=datasource_name, config=config
                        )
                    else:
                        usage_stats_event_payload = (
                            datasource_anonymizer.anonymize_datasource_info(
                                name=datasource_name, config=full_datasource_config
                            )
                        )

                elif (
                    checkpoint_anonymizer.is_parent_class_recognized(config=config)
                    is not None
                ):
                    checkpoint_name: str = (
                        name or config.get("name") or "my_temp_checkpoint"
                    )
                    # Roundtrip through schema validator to add missing fields
                    checkpoint_config: Union[CheckpointConfig, dict]
                    checkpoint_config = CheckpointConfig.from_commented_map(
                        commented_map=config
                    )
                    checkpoint_config = checkpoint_config.to_json_dict()
                    checkpoint_config.update({"name": checkpoint_name})
                    usage_stats_event_payload = (
                        checkpoint_anonymizer.anonymize_checkpoint_info(
                            name=checkpoint_name, config=checkpoint_config
                        )
                    )

                elif (
                    data_connector_anonymizer.is_parent_class_recognized(config=config)
                    is not None
                ):
                    data_connector_name: str = (
                        name or config.get("name") or "my_temp_data_connector"
                    )
                    usage_stats_event_payload = (
                        data_connector_anonymizer.anonymize_data_connector_info(
                            name=data_connector_name, config=config
                        )
                    )

                else:
                    # If class_name is not a supported type or subclass of a supported type,
                    # mark it as custom with no additional information since we can't anonymize
                    usage_stats_event_payload[
                        "diagnostic_info"
                    ] = usage_stats_event_payload.get("diagnostic_info", []) + [
                        "__custom_subclass_not_core_ge__"
                    ]

            send_usage_message(
                data_context=self,
                event=usage_stats_event_name,
                event_payload=usage_stats_event_payload,
                success=True,
            )
            if pretty_print:
                print(
                    f"\tSuccessfully instantiated {instantiated_class.__class__.__name__}"
                )
                print()

            report_object: dict = instantiated_class.self_check(
                pretty_print=pretty_print
            )

            if return_mode == "instantiated_class":
                return instantiated_class

            return report_object

        except Exception as e:
            if class_name is None:
                usage_stats_event_payload[
                    "diagnostic_info"
                ] = usage_stats_event_payload.get("diagnostic_info", []) + [
                    "__class_name_not_provided__"
                ]
            elif (
                usage_stats_event_payload.get("parent_class") is None
                and class_name in self.ALL_TEST_YAML_CONFIG_SUPPORTED_TYPES
            ):
                # add parent_class if it doesn't exist and class_name is one of our supported core GE types
                usage_stats_event_payload["parent_class"] = class_name
            send_usage_message(
                data_context=self,
                event=usage_stats_event_name,
                event_payload=usage_stats_event_payload,
                success=False,
            )
            if shorten_tracebacks:
                traceback.print_exc(limit=1)
            else:
                raise e


class DataContext(BaseDataContext):
    """A DataContext represents a Great Expectations project. It organizes storage and access for
    expectation suites, datasources, notification settings, and data fixtures.

    The DataContext is configured via a yml file stored in a directory called great_expectations; the configuration file
    as well as managed expectation suites should be stored in version control.

    Use the `create` classmethod to create a new empty config, or instantiate the DataContext
    by passing the path to an existing data context root directory.

    DataContexts use data sources you're already familiar with. BatchKwargGenerators help introspect data stores and data execution
    frameworks (such as airflow, Nifi, dbt, or dagster) to describe and produce batches of data ready for analysis. This
    enables fetching, validation, profiling, and documentation of  your data in a way that is meaningful within your
    existing infrastructure and work environment.

    DataContexts use a datasource-based namespace, where each accessible type of data has a three-part
    normalized *data_asset_name*, consisting of *datasource/generator/data_asset_name*.

    - The datasource actually connects to a source of materialized data and returns Great Expectations DataAssets \
      connected to a compute environment and ready for validation.

    - The BatchKwargGenerator knows how to introspect datasources and produce identifying "batch_kwargs" that define \
      particular slices of data.

    - The data_asset_name is a specific name -- often a table name or other name familiar to users -- that \
      batch kwargs generators can slice into batches.

    An expectation suite is a collection of expectations ready to be applied to a batch of data. Since
    in many projects it is useful to have different expectations evaluate in different contexts--profiling
    vs. testing; warning vs. error; high vs. low compute; ML model or dashboard--suites provide a namespace
    option for selecting which expectations a DataContext returns.

    In many simple projects, the datasource or batch kwargs generator name may be omitted and the DataContext will infer
    the correct name when there is no ambiguity.

    Similarly, if no expectation suite name is provided, the DataContext will assume the name "default".
    """

    @classmethod
    def create(
        cls,
        project_root_dir=None,
        usage_statistics_enabled=True,
        runtime_environment=None,
    ):
        """
        Build a new great_expectations directory and DataContext object in the provided project_root_dir.

        `create` will not create a new "great_expectations" directory in the provided folder, provided one does not
        already exist. Then, it will initialize a new DataContext in that folder and write the resulting config.

        Args:
            project_root_dir: path to the root directory in which to create a new great_expectations directory
            runtime_environment: a dictionary of config variables that
            override both those set in config_variables.yml and the environment

        Returns:
            DataContext
        """

        if not os.path.isdir(project_root_dir):
            raise ge_exceptions.DataContextError(
                "The project_root_dir must be an existing directory in which "
                "to initialize a new DataContext"
            )

        ge_dir = os.path.join(project_root_dir, cls.GE_DIR)
        os.makedirs(ge_dir, exist_ok=True)
        cls.scaffold_directories(ge_dir)

        if os.path.isfile(os.path.join(ge_dir, cls.GE_YML)):
            message = """Warning. An existing `{}` was found here: {}.
    - No action was taken.""".format(
                cls.GE_YML, ge_dir
            )
            warnings.warn(message)
        else:
            cls.write_project_template_to_disk(ge_dir, usage_statistics_enabled)

        if os.path.isfile(os.path.join(ge_dir, "notebooks")):
            message = """Warning. An existing `notebooks` directory was found here: {}.
    - No action was taken.""".format(
                ge_dir
            )
            warnings.warn(message)
        else:
            cls.scaffold_notebooks(ge_dir)

        uncommitted_dir = os.path.join(ge_dir, cls.GE_UNCOMMITTED_DIR)
        if os.path.isfile(os.path.join(uncommitted_dir, "config_variables.yml")):
            message = """Warning. An existing `config_variables.yml` was found here: {}.
    - No action was taken.""".format(
                uncommitted_dir
            )
            warnings.warn(message)
        else:
            cls.write_config_variables_template_to_disk(uncommitted_dir)

        return cls(ge_dir, runtime_environment=runtime_environment)

    @classmethod
    def all_uncommitted_directories_exist(cls, ge_dir):
        """Check if all uncommitted directories exist."""
        uncommitted_dir = os.path.join(ge_dir, cls.GE_UNCOMMITTED_DIR)
        for directory in cls.UNCOMMITTED_DIRECTORIES:
            if not os.path.isdir(os.path.join(uncommitted_dir, directory)):
                return False

        return True

    @classmethod
    def config_variables_yml_exist(cls, ge_dir):
        """Check if all config_variables.yml exists."""
        path_to_yml = os.path.join(ge_dir, cls.GE_YML)

        # TODO this is so brittle and gross
        with open(path_to_yml) as f:
            config = yaml.load(f)
        config_var_path = config.get("config_variables_file_path")
        config_var_path = os.path.join(ge_dir, config_var_path)
        return os.path.isfile(config_var_path)

    @classmethod
    def write_config_variables_template_to_disk(cls, uncommitted_dir):
        os.makedirs(uncommitted_dir, exist_ok=True)
        config_var_file = os.path.join(uncommitted_dir, "config_variables.yml")
        with open(config_var_file, "w") as template:
            template.write(CONFIG_VARIABLES_TEMPLATE)

    @classmethod
    def write_project_template_to_disk(cls, ge_dir, usage_statistics_enabled=True):
        file_path = os.path.join(ge_dir, cls.GE_YML)
        with open(file_path, "w") as template:
            if usage_statistics_enabled:
                template.write(PROJECT_TEMPLATE_USAGE_STATISTICS_ENABLED)
            else:
                template.write(PROJECT_TEMPLATE_USAGE_STATISTICS_DISABLED)

    @classmethod
    def scaffold_directories(cls, base_dir):
        """Safely create GE directories for a new project."""
        os.makedirs(base_dir, exist_ok=True)
        open(os.path.join(base_dir, ".gitignore"), "w").write("uncommitted/")

        for directory in cls.BASE_DIRECTORIES:
            if directory == "plugins":
                plugins_dir = os.path.join(base_dir, directory)
                os.makedirs(plugins_dir, exist_ok=True)
                os.makedirs(
                    os.path.join(plugins_dir, "custom_data_docs"), exist_ok=True
                )
                os.makedirs(
                    os.path.join(plugins_dir, "custom_data_docs", "views"),
                    exist_ok=True,
                )
                os.makedirs(
                    os.path.join(plugins_dir, "custom_data_docs", "renderers"),
                    exist_ok=True,
                )
                os.makedirs(
                    os.path.join(plugins_dir, "custom_data_docs", "styles"),
                    exist_ok=True,
                )
                cls.scaffold_custom_data_docs(plugins_dir)
            else:
                os.makedirs(os.path.join(base_dir, directory), exist_ok=True)

        uncommitted_dir = os.path.join(base_dir, cls.GE_UNCOMMITTED_DIR)

        for new_directory in cls.UNCOMMITTED_DIRECTORIES:
            new_directory_path = os.path.join(uncommitted_dir, new_directory)
            os.makedirs(new_directory_path, exist_ok=True)

        notebook_path = os.path.join(base_dir, "notebooks")
        for subdir in cls.NOTEBOOK_SUBDIRECTORIES:
            os.makedirs(os.path.join(notebook_path, subdir), exist_ok=True)

    @classmethod
    def scaffold_custom_data_docs(cls, plugins_dir):
        """Copy custom data docs templates"""
        styles_template = file_relative_path(
            __file__,
            "../render/view/static/styles/data_docs_custom_styles_template.css",
        )
        styles_destination_path = os.path.join(
            plugins_dir, "custom_data_docs", "styles", "data_docs_custom_styles.css"
        )
        shutil.copyfile(styles_template, styles_destination_path)

    @classmethod
    def scaffold_notebooks(cls, base_dir):
        """Copy template notebooks into the notebooks directory for a project."""
        template_dir = file_relative_path(__file__, "../init_notebooks/")
        notebook_dir = os.path.join(base_dir, "notebooks/")
        for subdir in cls.NOTEBOOK_SUBDIRECTORIES:
            subdir_path = os.path.join(notebook_dir, subdir)
            for notebook in glob.glob(os.path.join(template_dir, subdir, "*.ipynb")):
                notebook_name = os.path.basename(notebook)
                destination_path = os.path.join(subdir_path, notebook_name)
                shutil.copyfile(notebook, destination_path)

    @classmethod
    def _get_ge_cloud_config_dict(
        cls,
        ge_cloud_base_url: Optional[str] = None,
        ge_cloud_account_id: Optional[str] = None,
        ge_cloud_access_token: Optional[str] = None,
    ):
        ge_cloud_base_url = (
            ge_cloud_base_url
            or super()._get_global_config_value(
                environment_variable="GE_CLOUD_BASE_URL",
                conf_file_section="ge_cloud_config",
                conf_file_option="base_url",
            )
            or "https://app.greatexpectations.io/"
        )
        ge_cloud_account_id = ge_cloud_account_id or super()._get_global_config_value(
            environment_variable="GE_CLOUD_ACCOUNT_ID",
            conf_file_section="ge_cloud_config",
            conf_file_option="account_id",
        )
        ge_cloud_access_token = (
            ge_cloud_access_token
            or super()._get_global_config_value(
                environment_variable="GE_CLOUD_ACCESS_TOKEN",
                conf_file_section="ge_cloud_config",
                conf_file_option="access_token",
            )
        )
        return {
            "base_url": ge_cloud_base_url,
            "account_id": ge_cloud_account_id,
            "access_token": ge_cloud_access_token,
        }

    def get_ge_cloud_config(
        self,
        ge_cloud_base_url: Optional[str] = None,
        ge_cloud_account_id: Optional[str] = None,
        ge_cloud_access_token: Optional[str] = None,
    ):
        """
        Build a GeCloudConfig object. Config attributes are collected from any combination of args passed in at
        runtime, environment variables, or a global great_expectations.conf file (in order of precedence)
        """
        ge_cloud_config_dict = self._get_ge_cloud_config_dict(
            ge_cloud_base_url=ge_cloud_base_url,
            ge_cloud_account_id=ge_cloud_account_id,
            ge_cloud_access_token=ge_cloud_access_token,
        )

        missing_keys = []
        for key, val in ge_cloud_config_dict.items():
            if not val:
                missing_keys.append(key)
        if len(missing_keys) > 0:
            missing_keys_str = [f'"{key}"' for key in missing_keys]
            global_config_path_str = [
                f'"{path}"' for path in super().GLOBAL_CONFIG_PATHS
            ]
            raise DataContextError(
                f"{(', ').join(missing_keys_str)} arg(s) required for ge_cloud_mode but neither provided nor found in "
                f"environment or in global configs ({(', ').join(global_config_path_str)})."
            )

        return GeCloudConfig(**ge_cloud_config_dict)

    def __init__(
        self,
        context_root_dir: Optional[str] = None,
        runtime_environment: Optional[dict] = None,
        ge_cloud_mode: bool = False,
        ge_cloud_base_url: Optional[str] = None,
        ge_cloud_account_id: Optional[str] = None,
        ge_cloud_access_token: Optional[str] = None,
    ):
        self._ge_cloud_mode = ge_cloud_mode
        self._ge_cloud_config = None
        ge_cloud_config = None

        if ge_cloud_mode:
            ge_cloud_config = self.get_ge_cloud_config(
                ge_cloud_base_url=ge_cloud_base_url,
                ge_cloud_account_id=ge_cloud_account_id,
                ge_cloud_access_token=ge_cloud_access_token,
            )
            self._ge_cloud_config = ge_cloud_config
            # in ge_cloud_mode, if not provided, set context_root_dir to cwd
            if context_root_dir is None:
                context_root_dir = os.getcwd()
                logger.info(
                    f'context_root_dir was not provided - defaulting to current working directory "'
                    f'{context_root_dir}".'
                )
        else:
            # Determine the "context root directory" - this is the parent of "great_expectations" dir
            context_root_dir = (
                self.find_context_root_dir()
                if context_root_dir is None
                else context_root_dir
            )

        context_root_directory = os.path.abspath(os.path.expanduser(context_root_dir))
        self._context_root_directory = context_root_directory

        project_config = self._load_project_config()
        super().__init__(
            project_config,
            context_root_directory,
            runtime_environment,
            ge_cloud_mode=ge_cloud_mode,
            ge_cloud_config=ge_cloud_config,
        )

        # save project config if data_context_id auto-generated or global config values applied
        project_config_dict = dataContextConfigSchema.dump(project_config)
        if (
            project_config.anonymous_usage_statistics.explicit_id is False
            or project_config_dict != dataContextConfigSchema.dump(self._project_config)
        ):
            self._save_project_config()

    @property
    def default_ge_cloud_data_context_config_template(self):
        config_commented_map_from_yaml = yaml.load(DEFAULT_GE_CLOUD_DATA_CONTEXT_CONFIG)
        try:
            return (
                DataContextConfig(**config_commented_map_from_yaml)
                if self.ge_cloud_mode
                else DataContextConfig.from_commented_map(
                    commented_map=config_commented_map_from_yaml
                )
            )
        except ge_exceptions.InvalidDataContextConfigError:
            # Just to be explicit about what we intended to catch
            raise

    def _load_project_config(self):
        """
        Reads the project configuration from the project configuration file.
        The file may contain ${SOME_VARIABLE} variables - see self.project_config_with_variables_substituted
        for how these are substituted.

        For Data Contexts in GE Cloud mode, a default configuration template with pre-defined ${
        SOME_VARIABLE} variables is returned. (see
        great_expectations.data_context.templates.DEFAULT_GE_CLOUD_DATA_CONTEXT_CONFIG). These variables are
        substituted later using the same process referenced above.

        :return: the configuration object read from the file or template
        """
        if self.ge_cloud_mode:
            return self.default_ge_cloud_data_context_config_template

        path_to_yml = os.path.join(self.root_directory, self.GE_YML)
        try:
            with open(path_to_yml) as data:
                config_commented_map_from_yaml = yaml.load(data)

        except YAMLError as err:
            raise ge_exceptions.InvalidConfigurationYamlError(
                "Your configuration file is not a valid yml file likely due to a yml syntax error:\n\n{}".format(
                    err
                )
            )
        except DuplicateKeyError:
            raise ge_exceptions.InvalidConfigurationYamlError(
                "Error: duplicate key found in project YAML file."
            )
        except OSError:
            raise ge_exceptions.ConfigNotFoundError()

        try:
            return DataContextConfig.from_commented_map(
                commented_map=config_commented_map_from_yaml
            )
        except ge_exceptions.InvalidDataContextConfigError:
            # Just to be explicit about what we intended to catch
            raise

    def _save_project_config(self):
        """Save the current project to disk."""
        if self.ge_cloud_mode:
            logger.debug(
                "ge_cloud_mode detected - skipping DataContect._save_project_config"
            )
            return
        logger.debug("Starting DataContext._save_project_config")

        config_filepath = os.path.join(self.root_directory, self.GE_YML)
        with open(config_filepath, "w") as outfile:
            self._project_config.to_yaml(outfile)

    def add_store(self, store_name, store_config):
        logger.debug("Starting DataContext.add_store for store %s" % store_name)

        new_store = super().add_store(store_name, store_config)
        self._save_project_config()
        return new_store

    def add_datasource(
        self, name, **kwargs
    ) -> Optional[Union[LegacyDatasource, BaseDatasource]]:
        logger.debug("Starting DataContext.add_datasource for datasource %s" % name)

        new_datasource: Optional[
            Union[LegacyDatasource, BaseDatasource]
        ] = super().add_datasource(name=name, **kwargs)
        self._save_project_config()

        return new_datasource

    def delete_datasource(self, name: str):
        logger.debug(f"Starting DataContext.delete_datasource for datasource {name}")

        super().delete_datasource(datasource_name=name)
        self._save_project_config()

    @classmethod
    def find_context_root_dir(cls):
        result = None
        yml_path = None
        ge_home_environment = os.getenv("GE_HOME")
        if ge_home_environment:
            ge_home_environment = os.path.expanduser(ge_home_environment)
            if os.path.isdir(ge_home_environment) and os.path.isfile(
                os.path.join(ge_home_environment, "great_expectations.yml")
            ):
                result = ge_home_environment
        else:
            yml_path = cls.find_context_yml_file()
            if yml_path:
                result = os.path.dirname(yml_path)

        if result is None:
            raise ge_exceptions.ConfigNotFoundError()

        logger.debug(f"Using project config: {yml_path}")
        return result

    @classmethod
    def get_ge_config_version(cls, context_root_dir=None):
        yml_path = cls.find_context_yml_file(search_start_dir=context_root_dir)
        if yml_path is None:
            return

        with open(yml_path) as f:
            config_commented_map_from_yaml = yaml.load(f)

        config_version = config_commented_map_from_yaml.get("config_version")
        return float(config_version) if config_version else None

    @classmethod
    def set_ge_config_version(
        cls, config_version, context_root_dir=None, validate_config_version=True
    ):
        if not isinstance(config_version, (int, float)):
            raise ge_exceptions.UnsupportedConfigVersionError(
                "The argument `config_version` must be a number.",
            )

        if validate_config_version:
            if config_version < MINIMUM_SUPPORTED_CONFIG_VERSION:
                raise ge_exceptions.UnsupportedConfigVersionError(
                    "Invalid config version ({}).\n    The version number must be at least {}. ".format(
                        config_version, MINIMUM_SUPPORTED_CONFIG_VERSION
                    ),
                )
            elif config_version > CURRENT_GE_CONFIG_VERSION:
                raise ge_exceptions.UnsupportedConfigVersionError(
                    "Invalid config version ({}).\n    The maximum valid version is {}.".format(
                        config_version, CURRENT_GE_CONFIG_VERSION
                    ),
                )

        yml_path = cls.find_context_yml_file(search_start_dir=context_root_dir)
        if yml_path is None:
            return False

        with open(yml_path) as f:
            config_commented_map_from_yaml = yaml.load(f)
            config_commented_map_from_yaml["config_version"] = float(config_version)

        with open(yml_path, "w") as f:
            yaml.dump(config_commented_map_from_yaml, f)

        return True

    @classmethod
    def find_context_yml_file(cls, search_start_dir=None):
        """Search for the yml file starting here and moving upward."""
        yml_path = None
        if search_start_dir is None:
            search_start_dir = os.getcwd()

        for i in range(4):
            logger.debug(
                "Searching for config file {} ({} layer deep)".format(
                    search_start_dir, i
                )
            )

            potential_ge_dir = os.path.join(search_start_dir, cls.GE_DIR)

            if os.path.isdir(potential_ge_dir):
                potential_yml = os.path.join(potential_ge_dir, cls.GE_YML)
                if os.path.isfile(potential_yml):
                    yml_path = potential_yml
                    logger.debug("Found config file at " + str(yml_path))
                    break
            # move up one directory
            search_start_dir = os.path.dirname(search_start_dir)

        return yml_path

    @classmethod
    def does_config_exist_on_disk(cls, context_root_dir):
        """Return True if the great_expectations.yml exists on disk."""
        return os.path.isfile(os.path.join(context_root_dir, cls.GE_YML))

    @classmethod
    def is_project_initialized(cls, ge_dir):
        """
        Return True if the project is initialized.

        To be considered initialized, all of the following must be true:
        - all project directories exist (including uncommitted directories)
        - a valid great_expectations.yml is on disk
        - a config_variables.yml is on disk
        - the project has at least one datasource
        - the project has at least one suite
        """
        return (
            cls.does_config_exist_on_disk(ge_dir)
            and cls.all_uncommitted_directories_exist(ge_dir)
            and cls.config_variables_yml_exist(ge_dir)
            and cls._does_context_have_at_least_one_datasource(ge_dir)
            and cls._does_context_have_at_least_one_suite(ge_dir)
        )

    @classmethod
    def does_project_have_a_datasource_in_config_file(cls, ge_dir):
        if not cls.does_config_exist_on_disk(ge_dir):
            return False
        return cls._does_context_have_at_least_one_datasource(ge_dir)

    @classmethod
    def _does_context_have_at_least_one_datasource(cls, ge_dir):
        context = cls._attempt_context_instantiation(ge_dir)
        if not isinstance(context, DataContext):
            return False
        return len(context.list_datasources()) >= 1

    @classmethod
    def _does_context_have_at_least_one_suite(cls, ge_dir):
        context = cls._attempt_context_instantiation(ge_dir)
        if not isinstance(context, DataContext):
            return False
        return len(context.list_expectation_suites()) >= 1

    @classmethod
    def _attempt_context_instantiation(cls, ge_dir):
        try:
            context = DataContext(ge_dir)
            return context
        except (
            ge_exceptions.DataContextError,
            ge_exceptions.InvalidDataContextConfigError,
        ) as e:
            logger.debug(e)


class ExplorerDataContext(DataContext):
    def __init__(self, context_root_dir=None, expectation_explorer=True):
        """
            expectation_explorer: If True, load the expectation explorer manager, which will modify GE return objects \
            to include ipython notebook widgets.
        """

        super().__init__(context_root_dir)

        self._expectation_explorer = expectation_explorer
        if expectation_explorer:
            from great_expectations.jupyter_ux.expectation_explorer import (
                ExpectationExplorer,
            )

            self._expectation_explorer_manager = ExpectationExplorer()

    def update_return_obj(self, data_asset, return_obj):
        """Helper called by data_asset.

        Args:
            data_asset: The data_asset whose validation produced the current return object
            return_obj: the return object to update

        Returns:
            return_obj: the return object, potentially changed into a widget by the configured expectation explorer
        """
        if self._expectation_explorer:
            return self._expectation_explorer_manager.create_expectation_widget(
                data_asset, return_obj
            )
        else:
            return return_obj


def _get_metric_configuration_tuples(metric_configuration, base_kwargs=None):
    if base_kwargs is None:
        base_kwargs = {}

    if isinstance(metric_configuration, str):
        return [(metric_configuration, base_kwargs)]

    metric_configurations_list = []
    for kwarg_name in metric_configuration.keys():
        if not isinstance(metric_configuration[kwarg_name], dict):
            raise ge_exceptions.DataContextError(
                "Invalid metric_configuration: each key must contain a " "dictionary."
            )
        if (
            kwarg_name == "metric_kwargs_id"
        ):  # this special case allows a hash of multiple kwargs
            for metric_kwargs_id in metric_configuration[kwarg_name].keys():
                if base_kwargs != {}:
                    raise ge_exceptions.DataContextError(
                        "Invalid metric_configuration: when specifying "
                        "metric_kwargs_id, no other keys or values may be defined."
                    )
                if not isinstance(
                    metric_configuration[kwarg_name][metric_kwargs_id], list
                ):
                    raise ge_exceptions.DataContextError(
                        "Invalid metric_configuration: each value must contain a "
                        "list."
                    )
                metric_configurations_list += [
                    (metric_name, {"metric_kwargs_id": metric_kwargs_id})
                    for metric_name in metric_configuration[kwarg_name][
                        metric_kwargs_id
                    ]
                ]
        else:
            for kwarg_value in metric_configuration[kwarg_name].keys():
                base_kwargs.update({kwarg_name: kwarg_value})
                if not isinstance(metric_configuration[kwarg_name][kwarg_value], list):
                    raise ge_exceptions.DataContextError(
                        "Invalid metric_configuration: each value must contain a "
                        "list."
                    )
                for nested_configuration in metric_configuration[kwarg_name][
                    kwarg_value
                ]:
                    metric_configurations_list += _get_metric_configuration_tuples(
                        nested_configuration, base_kwargs=base_kwargs
                    )

    return metric_configurations_list
