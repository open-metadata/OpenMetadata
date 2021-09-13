import os
import uuid

from ruamel.yaml import YAML
from ruamel.yaml.compat import StringIO

from great_expectations.data_context.types.base import DataContextConfigDefaults


class YAMLToString(YAML):
    """
    Get yaml dump as a string: https://yaml.readthedocs.io/en/latest/example.html#output-of-dump-as-a-string
    """

    def dump(self, data, stream=None, **kw):
        inefficient = False
        if not stream:
            inefficient = True
            stream = StringIO()
        YAML.dump(self, data, stream, **kw)
        if inefficient:
            return stream.getvalue()


yaml = YAMLToString()
yaml.indent(mapping=2, sequence=4, offset=4)
yaml.default_flow_style = False

# TODO: maybe bring params in via f-strings from base.ConfigDefaults or whatever
#  I end up using for the base level configs. Specifically PROJECT_OPTIONAL_CONFIG_COMMENT
#  and PROJECT_HELP_COMMENT

PROJECT_HELP_COMMENT = f"""
# Welcome to Great Expectations! Always know what to expect from your data.
#
# Here you can define datasources, batch kwargs generators, integrations and
# more. This file is intended to be committed to your repo. For help with
# configuration please:
#   - Read our docs: https://docs.greatexpectations.io/en/latest/reference/spare_parts/data_context_reference.html#configuration
#   - Join our slack channel: http://greatexpectations.io/slack

# config_version refers to the syntactic version of this config file, and is used in maintaining backwards compatibility
# It is auto-generated and usually does not need to be changed.
config_version: {DataContextConfigDefaults.DEFAULT_CONFIG_VERSION.value}

# Datasources tell Great Expectations where your data lives and how to get it.
# You can use the CLI command `great_expectations datasource new` to help you
# add a new datasource. Read more at https://docs.greatexpectations.io/en/latest/reference/core_concepts/datasource.html
datasources: {{}}
"""

CONFIG_VARIABLES_INTRO = """
# This config file supports variable substitution which enables: 1) keeping
# secrets out of source control & 2) environment-based configuration changes
# such as staging vs prod.
#
# When GE encounters substitution syntax (like `my_key: ${my_value}` or
# `my_key: $my_value`) in the great_expectations.yml file, it will attempt
# to replace the value of `my_key` with the value from an environment
# variable `my_value` or a corresponding key read from this config file,
# which is defined through the `config_variables_file_path`.
# Environment variables take precedence over variables defined here.
#
# Substitution values defined here can be a simple (non-nested) value,
# nested value such as a dictionary, or an environment variable (i.e. ${ENV_VAR})
#
#
# https://docs.greatexpectations.io/en/latest/guides/how_to_guides/configuring_data_contexts/how_to_use_a_yaml_file_or_environment_variables_to_populate_credentials.html

"""

CONFIG_VARIABLES_TEMPLATE = (
    CONFIG_VARIABLES_INTRO + "instance_id: " + str(uuid.uuid4()) + os.linesep
)

# Create yaml strings
# NOTE: .replace("\n", "\n  ")[:-2] is a hack to indent all lines two spaces,
# and remove the inserted final two spaces.
EXPECTATIONS_STORE_STRING = yaml.dump(
    {
        "expectations_store": DataContextConfigDefaults.DEFAULT_STORES.value[
            "expectations_store"
        ]
    }
).replace("\n", "\n  ")[:-2]
VALIDATIONS_STORE_STRING = yaml.dump(
    {
        "validations_store": DataContextConfigDefaults.DEFAULT_STORES.value[
            "validations_store"
        ]
    }
).replace("\n", "\n  ")[:-2]
EVALUATION_PARAMETER_STORE_STRING = yaml.dump(
    DataContextConfigDefaults.DEFAULT_STORES.value["evaluation_parameter_store"]
)
CHECKPOINT_STORE_STRING = yaml.dump(
    {
        "checkpoint_store": DataContextConfigDefaults.DEFAULT_STORES.value[
            "checkpoint_store"
        ]
    }
).replace("\n", "\n  ")[:-2]

PROJECT_OPTIONAL_CONFIG_COMMENT = (
    CONFIG_VARIABLES_INTRO
    + f"""
config_variables_file_path: {DataContextConfigDefaults.DEFAULT_CONFIG_VARIABLES_FILEPATH.value}

# The plugins_directory will be added to your python path for custom modules
# used to override and extend Great Expectations.
plugins_directory: {DataContextConfigDefaults.DEFAULT_PLUGINS_DIRECTORY.value}

stores:
# Stores are configurable places to store things like Expectations, Validations
# Data Docs, and more. These are for advanced users only - most users can simply
# leave this section alone.
#
# Three stores are required: expectations, validations, and
# evaluation_parameters, and must exist with a valid store entry. Additional
# stores can be configured for uses such as data_docs, etc.
  {EXPECTATIONS_STORE_STRING}
  {VALIDATIONS_STORE_STRING}
  evaluation_parameter_store:
    # Evaluation Parameters enable dynamic expectations. Read more here:
    # https://docs.greatexpectations.io/en/latest/reference/core_concepts/evaluation_parameters.html
    {EVALUATION_PARAMETER_STORE_STRING}
  {CHECKPOINT_STORE_STRING}
expectations_store_name: expectations_store
validations_store_name: validations_store
evaluation_parameter_store_name: evaluation_parameter_store
checkpoint_store_name: checkpoint_store

data_docs_sites:
  # Data Docs make it simple to visualize data quality in your project. These
  # include Expectations, Validations & Profiles. The are built for all
  # Datasources from JSON artifacts in the local repo including validations &
  # profiles from the uncommitted directory. Read more at https://docs.greatexpectations.io/en/latest/reference/core_concepts/data_docs.html
  local_site:
    class_name: SiteBuilder
    # set to false to hide how-to buttons in Data Docs
    show_how_to_buttons: true
    store_backend:
        class_name: TupleFilesystemStoreBackend
        base_directory: uncommitted/data_docs/local_site/
    site_index_builder:
        class_name: DefaultSiteIndexBuilder
"""
)

ANONYMIZED_USAGE_STATISTICS_ENABLED = """
anonymous_usage_statistics:
  enabled: True
"""

ANONYMIZED_USAGE_STATISTICS_DISABLED = """
anonymous_usage_statistics:
  enabled: False
"""

DEFAULT_GE_CLOUD_DATA_CONTEXT_CONFIG = """
datasources:
  default_spark_datasource:
    execution_engine:
      module_name: great_expectations.execution_engine
      class_name: SparkDFExecutionEngine
    module_name: great_expectations.datasource
    class_name: Datasource
    data_connectors:
      default_runtime_data_connector:
        class_name: RuntimeDataConnector
        batch_identifiers:
  default_pandas_datasource:
      execution_engine:
        module_name: great_expectations.execution_engine
        class_name: PandasExecutionEngine
      module_name: great_expectations.datasource
      class_name: Datasource
      data_connectors:
        default_runtime_data_connector:
          class_name: RuntimeDataConnector
          batch_identifiers:

plugins_directory: ${plugins_directory}

stores:
  default_evaluation_parameter_store:
    class_name: EvaluationParameterStore

  default_expectations_store:
    class_name: ExpectationsStore
    store_backend:
      class_name: GeCloudStoreBackend
      ge_cloud_base_url: ${base_url}
      ge_cloud_resource_type: expectation_suite
      ge_cloud_credentials:
        access_token: ${access_token}
        account_id: ${account_id}
      suppress_store_backend_id: True

  default_validations_store:
    class_name: ValidationsStore
    store_backend:
      class_name: GeCloudStoreBackend
      ge_cloud_base_url: ${base_url}
      ge_cloud_resource_type: suite_validation_result
      ge_cloud_credentials:
        access_token: ${access_token}
        account_id: ${account_id}
      suppress_store_backend_id: True

  default_checkpoint_store:
    class_name: CheckpointStore
    store_backend:
      class_name: GeCloudStoreBackend
      ge_cloud_base_url: ${base_url}
      ge_cloud_resource_type: contract
      ge_cloud_credentials:
        access_token: ${access_token}
        account_id: ${account_id}
      suppress_store_backend_id: True

evaluation_parameter_store_name: default_evaluation_parameter_store
expectations_store_name: default_expectations_store
validations_store_name: default_validations_store
checkpoint_store_name: default_checkpoint_store

data_docs_sites:
  default_site:
    class_name: SiteBuilder
    show_how_to_buttons: true
    store_backend:
      class_name: GeCloudStoreBackend
      ge_cloud_base_url: ${base_url}
      ge_cloud_resource_type: rendered_data_doc
      ge_cloud_credentials:
        access_token: ${access_token}
        account_id: ${account_id}
      suppress_store_backend_id: True
    site_index_builder:
      class_name: DefaultSiteIndexBuilder
    site_section_builders:
      profiling: None

anonymous_usage_statistics:
  enabled: true
  usage_statistics_url: ${usage_statistics_url}
  data_context_id: ${account_id}
"""

PROJECT_TEMPLATE_USAGE_STATISTICS_ENABLED = (
    PROJECT_HELP_COMMENT
    + PROJECT_OPTIONAL_CONFIG_COMMENT
    + ANONYMIZED_USAGE_STATISTICS_ENABLED
)
PROJECT_TEMPLATE_USAGE_STATISTICS_DISABLED = (
    PROJECT_HELP_COMMENT
    + PROJECT_OPTIONAL_CONFIG_COMMENT
    + ANONYMIZED_USAGE_STATISTICS_DISABLED
)
