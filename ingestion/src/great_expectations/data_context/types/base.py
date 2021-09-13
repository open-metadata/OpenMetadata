import abc
import enum
import itertools
import logging
import uuid
from copy import deepcopy
from typing import Dict, List, Optional, Union

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap
from ruamel.yaml.compat import StringIO

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.util import convert_to_json_serializable, nested_update
from great_expectations.marshmallow__shade import (
    INCLUDE,
    Schema,
    ValidationError,
    fields,
    post_dump,
    post_load,
    pre_load,
    validates_schema,
)
from great_expectations.marshmallow__shade.validate import OneOf
from great_expectations.types import DictDot, SerializableDictDot
from great_expectations.types.configurations import ClassConfigSchema

yaml = YAML()
yaml.indent(mapping=2, sequence=4, offset=2)

logger = logging.getLogger(__name__)

CURRENT_GE_CONFIG_VERSION = 3
FIRST_GE_CONFIG_VERSION_WITH_CHECKPOINT_STORE = 3
CURRENT_CHECKPOINT_CONFIG_VERSION = 1
MINIMUM_SUPPORTED_CONFIG_VERSION = 2
DEFAULT_USAGE_STATISTICS_URL = (
    "https://stats.greatexpectations.io/great_expectations/v1/usage_statistics"
)


def object_to_yaml_str(obj):
    output_str: str
    with StringIO() as string_stream:
        yaml.dump(obj, string_stream)
        output_str = string_stream.getvalue()
    return output_str


class BaseYamlConfig(SerializableDictDot):
    _config_schema_class = None

    def __init__(self, commented_map: CommentedMap = None):
        if commented_map is None:
            commented_map = CommentedMap()
        self._commented_map = commented_map

    @classmethod
    def _get_schema_instance(cls) -> Schema:
        if not issubclass(cls.get_schema_class(), Schema):
            raise ge_exceptions.InvalidConfigError(
                "Invalid type: A configuration schema class needs to inherit from the Marshmallow Schema class."
            )
        if not issubclass(cls.get_config_class(), BaseYamlConfig):
            raise ge_exceptions.InvalidConfigError(
                "Invalid type: A configuration class needs to inherit from the BaseYamlConfig class."
            )
        if hasattr(cls.get_config_class(), "_schema_instance"):
            # noinspection PyProtectedMember
            schema_instance: Schema = cls.get_config_class()._schema_instance
            if schema_instance is None:
                cls.get_config_class()._schema_instance = (cls.get_schema_class())()
            else:
                return schema_instance
        else:
            cls.get_config_class().schema_instance = (cls.get_schema_class())()
            return cls.get_config_class().schema_instance

    @classmethod
    def from_commented_map(cls, commented_map: CommentedMap):
        try:
            config: Union[dict, BaseYamlConfig]
            config = cls._get_schema_instance().load(commented_map)
            if isinstance(config, dict):
                return cls.get_config_class()(commented_map=commented_map, **config)
            return config
        except ValidationError:
            logger.error(
                "Encountered errors during loading config.  See ValidationError for more details."
            )
            raise

    def _get_schema_validated_updated_commented_map(self) -> CommentedMap:
        commented_map: CommentedMap = deepcopy(self._commented_map)
        commented_map.update(self._get_schema_instance().dump(self))
        return commented_map

    def to_yaml(self, outfile):
        """
        :returns None (but writes a YAML file containing the project configuration)
        """
        yaml.dump(self.commented_map, outfile)

    def to_yaml_str(self) -> str:
        """
        :returns a YAML string containing the project configuration
        """
        return object_to_yaml_str(self.commented_map)

    def to_json_dict(self) -> dict:
        """
        :returns a JSON-serialiable dict containing the project configuration
        """
        commented_map: CommentedMap = self.commented_map
        return convert_to_json_serializable(data=commented_map)

    @property
    def commented_map(self) -> CommentedMap:
        return self._get_schema_validated_updated_commented_map()

    @classmethod
    def get_config_class(cls):
        raise NotImplementedError

    @classmethod
    def get_schema_class(cls):
        raise NotImplementedError


class AssetConfig(DictDot):
    def __init__(
        self,
        name=None,
        class_name=None,
        module_name=None,
        bucket=None,
        prefix=None,
        delimiter=None,
        max_keys=None,
        batch_spec_passthrough=None,
        **kwargs,
    ):
        if name is not None:
            self.name = name
        self._class_name = class_name
        self._module_name = module_name
        if bucket is not None:
            self.bucket = bucket
        if prefix is not None:
            self.prefix = prefix
        if delimiter is not None:
            self.delimiter = delimiter
        if max_keys is not None:
            self.max_keys = max_keys
        if batch_spec_passthrough is not None:
            self.batch_spec_passthrough = batch_spec_passthrough
        for k, v in kwargs.items():
            setattr(self, k, v)

    @property
    def class_name(self):
        return self._class_name

    @property
    def module_name(self):
        return self._module_name


class AssetConfigSchema(Schema):
    class Meta:
        unknown = INCLUDE

    name = fields.String(required=False, allow_none=True)
    class_name = fields.String(required=False, allow_none=True, missing="Asset")
    module_name = fields.String(
        required=False,
        all_none=True,
        missing="great_expectations.datasource.data_connector.asset",
    )
    base_directory = fields.String(required=False, allow_none=True)
    glob_directive = fields.String(required=False, allow_none=True)
    pattern = fields.String(required=False, allow_none=True)
    group_names = fields.List(
        cls_or_instance=fields.Str(), required=False, allow_none=True
    )
    bucket = fields.String(required=False, allow_none=True)
    prefix = fields.String(required=False, allow_none=True)
    delimiter = fields.String(required=False, allow_none=True)
    max_keys = fields.Integer(required=False, allow_none=True)
    batch_spec_passthrough = fields.Dict(required=False, allow_none=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        pass

    # noinspection PyUnusedLocal
    @post_load
    def make_asset_config(self, data, **kwargs):
        return AssetConfig(**data)


class SorterConfig(DictDot):
    def __init__(
        self,
        name,
        class_name=None,
        module_name=None,
        orderby="asc",
        reference_list=None,
        datetime_format=None,
        **kwargs,
    ):
        self._name = name
        self._class_name = class_name
        self._module_name = module_name
        self._orderby = orderby
        for k, v in kwargs.items():
            setattr(self, k, v)

        if reference_list is not None:
            self._reference_list = reference_list

        if datetime_format is not None:
            self._datetime_format = datetime_format

    @property
    def name(self):
        return self._name

    @property
    def module_name(self):
        return self._module_name

    @property
    def class_name(self):
        return self._class_name

    @property
    def orderby(self):
        return self._orderby

    @property
    def reference_list(self):
        return self._reference_list

    @property
    def datetime_format(self):
        return self._datetime_format


class SorterConfigSchema(Schema):
    class Meta:
        unknown = INCLUDE

    name = fields.String(required=True)
    class_name = fields.String(required=True)
    module_name = fields.String(
        missing="great_expectations.datasource.data_connector.sorter"
    )
    orderby = fields.String(required=False, missing="asc", allow_none=False)

    # allow_none = True because it is only used by some Sorters
    reference_list = fields.List(
        cls_or_instance=fields.Str(), required=False, missing=None, allow_none=True
    )
    datetime_format = fields.String(required=False, missing=None, allow_none=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        pass

    # noinspection PyUnusedLocal
    @post_load
    def make_sorter_config(self, data, **kwargs):
        return SorterConfig(**data)


class DataConnectorConfig(DictDot):
    def __init__(
        self,
        class_name,
        module_name=None,
        credentials=None,
        assets=None,
        base_directory=None,
        glob_directive=None,
        default_regex=None,
        batch_identifiers=None,
        sorters=None,
        batch_spec_passthrough=None,
        # S3
        boto3_options=None,
        bucket=None,
        max_keys=None,
        # Azure
        azure_options=None,
        container=None,
        name_starts_with=None,
        # GCS
        bucket_or_name=None,
        max_results=None,
        # Both S3/GCS
        prefix=None,
        # Both S3/Azure
        delimiter=None,
        **kwargs,
    ):
        self._class_name = class_name
        self._module_name = module_name
        if credentials is not None:
            self.credentials = credentials
        if assets is not None:
            self.assets = assets
        if base_directory is not None:
            self.base_directory = base_directory
        if glob_directive is not None:
            self.glob_directive = glob_directive
        if default_regex is not None:
            self.default_regex = default_regex
        if batch_identifiers is not None:
            self.batch_identifiers = batch_identifiers
        if sorters is not None:
            self.sorters = sorters
        if batch_spec_passthrough is not None:
            self.batch_spec_passthrough = batch_spec_passthrough

        # S3
        if boto3_options is not None:
            self.boto3_options = boto3_options
        if bucket is not None:
            self.bucket = bucket
        if max_keys is not None:
            self.max_keys = max_keys

        # Azure
        if azure_options is not None:
            self.azure_options = azure_options
        if container is not None:
            self.container = container
        if name_starts_with is not None:
            self.name_starts_with = name_starts_with

        # GCS
        if bucket_or_name is not None:
            self.bucket_or_name = bucket_or_name
        if max_results is not None:
            self.max_results = max_results

        # Both S3/GCS
        if prefix is not None:
            self.prefix = prefix

        # Both S3/Azure
        if delimiter is not None:
            self.delimiter = delimiter

        for k, v in kwargs.items():
            setattr(self, k, v)

    @property
    def class_name(self):
        return self._class_name

    @property
    def module_name(self):
        return self._module_name


class DataConnectorConfigSchema(Schema):
    class Meta:
        unknown = INCLUDE

    class_name = fields.String(required=True)
    module_name = fields.String(missing="great_expectations.datasource.data_connector")

    assets = fields.Dict(
        keys=fields.Str(),
        values=fields.Nested(AssetConfigSchema, required=False, allow_none=True),
        required=False,
        allow_none=True,
    )

    base_directory = fields.String(required=False, allow_none=True)
    glob_directive = fields.String(required=False, allow_none=True)
    sorters = fields.List(
        fields.Nested(SorterConfigSchema, required=False, allow_none=True),
        required=False,
        allow_none=True,
    )
    default_regex = fields.Dict(required=False, allow_none=True)
    credentials = fields.Raw(required=False, allow_none=True)
    batch_identifiers = fields.List(
        cls_or_instance=fields.Str(), required=False, allow_none=True
    )

    # S3
    boto3_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    bucket = fields.String(required=False, allow_none=True)
    max_keys = fields.Integer(required=False, allow_none=True)

    # Azure
    azure_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    container = fields.String(required=False, allow_none=True)
    name_starts_with = fields.String(required=False, allow_none=True)

    # GCS
    gcs_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    bucket_or_name = fields.String(required=False, allow_none=True)
    max_results = fields.String(required=False, allow_none=True)

    # Both S3/GCS
    prefix = fields.String(required=False, allow_none=True)

    # Both S3/Azure
    delimiter = fields.String(required=False, allow_none=True)

    data_asset_name_prefix = fields.String(required=False, allow_none=True)
    data_asset_name_suffix = fields.String(required=False, allow_none=True)
    include_schema_name = fields.Boolean(required=False, allow_none=True)
    splitter_method = fields.String(required=False, allow_none=True)
    splitter_kwargs = fields.Dict(required=False, allow_none=True)
    sampling_method = fields.String(required=False, allow_none=True)
    sampling_kwargs = fields.Dict(required=False, allow_none=True)
    excluded_tables = fields.List(
        cls_or_instance=fields.Str(), required=False, allow_none=True
    )
    included_tables = fields.List(
        cls_or_instance=fields.Str(), required=False, allow_none=True
    )
    skip_inapplicable_tables = fields.Boolean(required=False, allow_none=True)
    batch_spec_passthrough = fields.Dict(required=False, allow_none=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        # If a class_name begins with the dollar sign ("$"), then it is assumed to be a variable name to be substituted.
        if data["class_name"][0] == "$":
            return
        if ("default_regex" in data) and not (
            data["class_name"]
            in [
                "InferredAssetFilesystemDataConnector",
                "ConfiguredAssetFilesystemDataConnector",
                "InferredAssetS3DataConnector",
                "ConfiguredAssetS3DataConnector",
                "InferredAssetAzureDataConnector",
                "ConfiguredAssetAzureDataConnector",
                "InferredAssetGCSDataConnector",
                "ConfiguredAssetGCSDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by a
subclass of the FilePathDataConnector class (your data connector is "{data['class_name']}").  Please update your
configuration to continue.
                """
            )
        if ("glob_directive" in data) and not (
            data["class_name"]
            in [
                "InferredAssetFilesystemDataConnector",
                "ConfiguredAssetFilesystemDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by a
filesystem type of the data connector (your data connector is "{data['class_name']}").  Please update your
configuration to continue.
                """
            )
        if ("delimiter" in data) and not (
            data["class_name"]
            in [
                "InferredAssetS3DataConnector",
                "ConfiguredAssetS3DataConnector",
                "InferredAssetAzureDataConnector",
                "ConfiguredAssetAzureDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by an
S3/Azure type of the data connector (your data connector is "{data['class_name']}").  Please update your configuration to
continue.
                """
            )
        if ("prefix" in data) and not (
            data["class_name"]
            in [
                "InferredAssetS3DataConnector",
                "ConfiguredAssetS3DataConnector",
                "InferredAssetGCSDataConnector",
                "ConfiguredAssetGCSDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by an
S3/GCS type of the data connector (your data connector is "{data['class_name']}").  Please update your configuration to
continue.
                """
            )
        if ("bucket" in data or "max_keys" in data) and not (
            data["class_name"]
            in [
                "InferredAssetS3DataConnector",
                "ConfiguredAssetS3DataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by an
S3 type of the data connector (your data connector is "{data['class_name']}").  Please update your configuration to
continue.
                """
            )
        if (
            "azure_options" in data or "container" in data or "name_starts_with" in data
        ) and not (
            data["class_name"]
            in [
                "InferredAssetAzureDataConnector",
                "ConfiguredAssetAzureDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by an
Azure type of the data connector (your data connector is "{data['class_name']}").  Please update your configuration to
continue.
                    """
            )
        if "azure_options" in data and data["class_name"] in [
            "InferredAssetAzureDataConnector",
            "ConfiguredAssetAzureDataConnector",
        ]:
            azure_options = data["azure_options"]
            if not (("conn_str" in azure_options) ^ ("account_url" in azure_options)):
                raise ge_exceptions.InvalidConfigError(
                    f"""Your current configuration is either missing methods of authentication or is using too many for the Azure type of data connector.
                    You must only select one between `conn_str` or `account_url`. Please update your configuration to continue.
                    """
                )
        if (
            "gcs_options" in data or "bucket_or_name" in data or "max_results" in data
        ) and not (
            data["class_name"]
            in [
                "InferredAssetGCSDataConnector",
                "ConfiguredAssetGCSDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by a
GCS type of the data connector (your data connector is "{data['class_name']}").  Please update your configuration to
continue.
                    """
            )
        if "gcs_options" in data and data["class_name"] in [
            "InferredAssetGCSDataConnector",
            "ConfiguredAssetGCSDataConnector",
        ]:
            gcs_options = data["gcs_options"]
            if "filename" in gcs_options and "info" in gcs_options:
                raise ge_exceptions.InvalidConfigError(
                    f"""Your current configuration can only use a single method of authentication for the GCS type of data connector.
                    You must only select one between `filename` (from_service_account_file) and `info` (from_service_account_info). Please update your configuration to continue.
                    """
                )
        if (
            "data_asset_name_prefix" in data
            or "data_asset_name_suffix" in data
            or "include_schema_name" in data
            or "splitter_method" in data
            or "splitter_kwargs" in data
            or "sampling_method" in data
            or "sampling_kwargs" in data
            or "excluded_tables" in data
            or "included_tables" in data
            or "skip_inapplicable_tables" in data
        ) and not (
            data["class_name"]
            in [
                "InferredAssetSqlDataConnector",
                "ConfiguredAssetSqlDataConnector",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data connector that are required only by an
SQL type of the data connector (your data connector is "{data['class_name']}").  Please update your configuration to
continue.
                """
            )

    # noinspection PyUnusedLocal
    @post_load
    def make_data_connector_config(self, data, **kwargs):
        return DataConnectorConfig(**data)


class ExecutionEngineConfig(DictDot):
    def __init__(
        self,
        class_name,
        module_name=None,
        caching=None,
        batch_spec_defaults=None,
        connection_string=None,
        credentials=None,
        spark_config=None,
        boto3_options=None,
        azure_options=None,
        gcs_options=None,
        **kwargs,
    ):
        self._class_name = class_name
        self._module_name = module_name
        if caching is not None:
            self.caching = caching
        if batch_spec_defaults is not None:
            self._batch_spec_defaults = batch_spec_defaults
        if connection_string is not None:
            self.connection_string = connection_string
        if credentials is not None:
            self.credentials = credentials
        if spark_config is not None:
            self.spark_config = spark_config
        if boto3_options is not None:
            self.boto3_options = boto3_options
        if azure_options is not None:
            self.azure_options = azure_options
        if gcs_options is not None:
            self.gcs_options = gcs_options
        for k, v in kwargs.items():
            setattr(self, k, v)

    @property
    def module_name(self):
        return self._module_name

    @property
    def class_name(self):
        return self._class_name

    @property
    def batch_spec_defaults(self):
        return self._batch_spec_defaults


class ExecutionEngineConfigSchema(Schema):
    class Meta:
        unknown = INCLUDE

    class_name = fields.String(required=True)
    module_name = fields.String(missing="great_expectations.execution_engine")
    connection_string = fields.String(required=False, allow_none=True)
    credentials = fields.Raw(required=False, allow_none=True)
    spark_config = fields.Raw(required=False, allow_none=True)
    boto3_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    azure_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    gcs_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    caching = fields.Boolean(required=False, allow_none=True)
    batch_spec_defaults = fields.Dict(required=False, allow_none=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        # If a class_name begins with the dollar sign ("$"), then it is assumed to be a variable name to be substituted.
        if data["class_name"][0] == "$":
            return
        if ("connection_string" in data or "credentials" in data) and not (
            data["class_name"] == "SqlAlchemyExecutionEngine"
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses the "connection_string" key in an execution engine, but only
SqlAlchemyExecutionEngine requires this attribute (your execution engine is "{data['class_name']}").  Please update your
configuration to continue.
                """
            )
        if "spark_config" in data and not (
            data["class_name"] == "SparkDFExecutionEngine"
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses the "spark_config" key in an execution engine, but only
SparkDFExecutionEngine requires this attribute (your execution engine is "{data['class_name']}").  Please update your
configuration to continue.
                """
            )

    # noinspection PyUnusedLocal
    @post_load
    def make_execution_engine_config(self, data, **kwargs):
        return ExecutionEngineConfig(**data)


class DatasourceConfig(DictDot):
    def __init__(
        self,
        class_name=None,
        module_name: Optional[str] = "great_expectations.datasource",
        execution_engine=None,
        data_connectors=None,
        data_asset_type=None,
        batch_kwargs_generators=None,
        connection_string=None,
        credentials=None,
        introspection=None,
        tables=None,
        boto3_options=None,
        azure_options=None,
        gcs_options=None,
        reader_method=None,
        reader_options=None,
        limit=None,
        **kwargs,
    ):
        # NOTE - JPC - 20200316: Currently, we are mostly inconsistent with respect to this type...
        self._class_name = class_name
        self._module_name = module_name
        if execution_engine is not None:
            self.execution_engine = execution_engine
        if data_connectors is not None and isinstance(data_connectors, dict):
            self.data_connectors = data_connectors

        # NOTE - AJB - 20201202: This should use the datasource class build_configuration method as in DataContext.add_datasource()
        if data_asset_type is None:
            if class_name == "PandasDatasource":
                data_asset_type = {
                    "class_name": "PandasDataset",
                    "module_name": "great_expectations.dataset",
                }
            elif class_name == "SqlAlchemyDatasource":
                data_asset_type = {
                    "class_name": "SqlAlchemyDataset",
                    "module_name": "great_expectations.dataset",
                }
            elif class_name == "SparkDFDatasource":
                data_asset_type = {
                    "class_name": "SparkDFDataset",
                    "module_name": "great_expectations.dataset",
                }
        if data_asset_type is not None:
            self.data_asset_type = data_asset_type
        if batch_kwargs_generators is not None:
            self.batch_kwargs_generators = batch_kwargs_generators
        if connection_string is not None:
            self.connection_string = connection_string
        if credentials is not None:
            self.credentials = credentials
        if introspection is not None:
            self.introspection = introspection
        if tables is not None:
            self.tables = tables
        if boto3_options is not None:
            self.boto3_options = boto3_options
        if azure_options is not None:
            self.azure_options = azure_options
        if gcs_options is not None:
            self.gcs_options = gcs_options
        if reader_method is not None:
            self.reader_method = reader_method
        if reader_options is not None:
            self.reader_options = reader_options
        if limit is not None:
            self.limit = limit
        for k, v in kwargs.items():
            setattr(self, k, v)

    @property
    def class_name(self):
        return self._class_name

    @property
    def module_name(self):
        return self._module_name


class DatasourceConfigSchema(Schema):
    class Meta:
        unknown = INCLUDE

    class_name = fields.String(missing="Datasource")
    module_name = fields.String(missing="great_expectations.datasource")
    force_reuse_spark_context = fields.Bool(required=False, allow_none=True)
    spark_config = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    execution_engine = fields.Nested(
        ExecutionEngineConfigSchema, required=False, allow_none=True
    )
    data_connectors = fields.Dict(
        keys=fields.Str(),
        values=fields.Nested(DataConnectorConfigSchema),
        required=False,
        allow_none=True,
    )

    data_asset_type = fields.Nested(ClassConfigSchema, required=False, allow_none=True)

    # TODO: Update to generator-specific
    # batch_kwargs_generators = fields.Mapping(keys=fields.Str(), values=fields.Nested(fields.GeneratorSchema))
    batch_kwargs_generators = fields.Dict(
        keys=fields.Str(), values=fields.Dict(), required=False, allow_none=True
    )
    connection_string = fields.String(required=False, allow_none=True)
    credentials = fields.Raw(required=False, allow_none=True)
    introspection = fields.Dict(required=False, allow_none=True)
    tables = fields.Dict(required=False, allow_none=True)
    boto3_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    azure_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    gcs_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    reader_method = fields.String(required=False, allow_none=True)
    reader_options = fields.Dict(
        keys=fields.Str(), values=fields.Str(), required=False, allow_none=True
    )
    limit = fields.Integer(required=False, allow_none=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        if "generators" in data:
            raise ge_exceptions.InvalidConfigError(
                'Your current configuration uses the "generators" key in a datasource, but in version 0.10 of '
                'GE that key is renamed to "batch_kwargs_generators". Please update your configuration to continue.'
            )
        # If a class_name begins with the dollar sign ("$"), then it is assumed to be a variable name to be substituted.
        if data["class_name"][0] == "$":
            return
        if (
            "connection_string" in data
            or "credentials" in data
            or "introspection" in data
            or "tables" in data
        ) and not (
            data["class_name"]
            in [
                "SqlAlchemyDatasource",
                "SimpleSqlalchemyDatasource",
            ]
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current configuration uses one or more keys in a data source that are required only by a
sqlalchemy data source (your data source is "{data['class_name']}").  Please update your configuration to continue.
                """
            )

    # noinspection PyUnusedLocal
    @post_load
    def make_datasource_config(self, data, **kwargs):
        return DatasourceConfig(**data)


class AnonymizedUsageStatisticsConfig(DictDot):
    def __init__(self, enabled=True, data_context_id=None, usage_statistics_url=None):
        self._enabled = enabled
        if data_context_id is None:
            data_context_id = str(uuid.uuid4())
            self._explicit_id = False
        else:
            self._explicit_id = True

        self._data_context_id = data_context_id
        if usage_statistics_url is None:
            usage_statistics_url = DEFAULT_USAGE_STATISTICS_URL
            self._explicit_url = False
        else:
            self._explicit_url = True
        self._usage_statistics_url = usage_statistics_url

    @property
    def enabled(self):
        return self._enabled

    @enabled.setter
    def enabled(self, enabled):
        if not isinstance(enabled, bool):
            raise ValueError("usage statistics enabled property must be boolean")
        self._enabled = enabled

    @property
    def data_context_id(self):
        return self._data_context_id

    @data_context_id.setter
    def data_context_id(self, data_context_id):
        try:
            uuid.UUID(data_context_id)
        except ValueError:
            raise ge_exceptions.InvalidConfigError(
                "data_context_id must be a valid uuid"
            )
        self._data_context_id = data_context_id
        self._explicit_id = True

    @property
    def explicit_id(self):
        return self._explicit_id

    @property
    def usage_statistics_url(self):
        return self._usage_statistics_url

    @usage_statistics_url.setter
    def usage_statistics_url(self, usage_statistics_url):
        self._usage_statistics_url = usage_statistics_url
        self._explicit_url = True


class AnonymizedUsageStatisticsConfigSchema(Schema):
    data_context_id = fields.UUID()
    enabled = fields.Boolean(default=True)
    usage_statistics_url = fields.URL(allow_none=True)
    _explicit_url = fields.Boolean(required=False)

    # noinspection PyUnusedLocal
    @post_load()
    def make_usage_statistics_config(self, data, **kwargs):
        if "data_context_id" in data:
            data["data_context_id"] = str(data["data_context_id"])
        return AnonymizedUsageStatisticsConfig(**data)

    # noinspection PyUnusedLocal
    @post_dump()
    def filter_implicit(self, data, **kwargs):
        if not data.get("_explicit_url") and "usage_statistics_url" in data:
            del data["usage_statistics_url"]
        if "_explicit_url" in data:
            del data["_explicit_url"]
        return data


class NotebookTemplateConfig(DictDot):
    def __init__(self, file_name, template_kwargs=None):
        self.file_name = file_name
        if template_kwargs:
            self.template_kwargs = template_kwargs
        else:
            self.template_kwargs = {}


class NotebookTemplateConfigSchema(Schema):
    file_name = fields.String()
    template_kwargs = fields.Dict(
        keys=fields.Str(), values=fields.Str(), allow_none=True
    )

    # noinspection PyUnusedLocal
    @post_load
    def make_notebook_template_config(self, data, **kwargs):
        return NotebookTemplateConfig(**data)


class NotebookConfig(DictDot):
    def __init__(
        self,
        class_name,
        module_name,
        custom_templates_module,
        header_markdown=None,
        footer_markdown=None,
        table_expectations_header_markdown=None,
        column_expectations_header_markdown=None,
        table_expectations_not_found_markdown=None,
        column_expectations_not_found_markdown=None,
        authoring_intro_markdown=None,
        column_expectations_markdown=None,
        header_code=None,
        footer_code=None,
        table_expectation_code=None,
        column_expectation_code=None,
    ):
        self.class_name = class_name
        self.module_name = module_name
        self.custom_templates_module = custom_templates_module

        self.header_markdown = header_markdown
        self.footer_markdown = footer_markdown
        self.table_expectations_header_markdown = table_expectations_header_markdown
        self.column_expectations_header_markdown = column_expectations_header_markdown
        self.table_expectations_not_found_markdown = (
            table_expectations_not_found_markdown
        )
        self.column_expectations_not_found_markdown = (
            column_expectations_not_found_markdown
        )
        self.authoring_intro_markdown = authoring_intro_markdown
        self.column_expectations_markdown = column_expectations_markdown

        self.header_code = header_code
        self.footer_code = footer_code
        self.table_expectation_code = table_expectation_code
        self.column_expectation_code = column_expectation_code


class NotebookConfigSchema(Schema):
    class_name = fields.String(missing="SuiteEditNotebookRenderer")
    module_name = fields.String(
        missing="great_expectations.render.renderer.suite_edit_notebook_renderer"
    )
    custom_templates_module = fields.String()

    header_markdown = fields.Nested(NotebookTemplateConfigSchema, allow_none=True)
    footer_markdown = fields.Nested(NotebookTemplateConfigSchema, allow_none=True)
    table_expectations_header_markdown = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )
    column_expectations_header_markdown = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )
    table_expectations_not_found_markdown = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )
    column_expectations_not_found_markdown = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )
    authoring_intro_markdown = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )
    column_expectations_markdown = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )

    header_code = fields.Nested(NotebookTemplateConfigSchema, allow_none=True)
    footer_code = fields.Nested(NotebookTemplateConfigSchema, allow_none=True)
    table_expectation_code = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )
    column_expectation_code = fields.Nested(
        NotebookTemplateConfigSchema, allow_none=True
    )

    # noinspection PyUnusedLocal
    @post_load
    def make_notebook_config(self, data, **kwargs):
        return NotebookConfig(**data)


class NotebooksConfig(DictDot):
    def __init__(self, suite_edit):
        self.suite_edit = suite_edit


class NotebooksConfigSchema(Schema):
    # for now only suite_edit, could have other customization options for
    # notebooks in the future
    suite_edit = fields.Nested(NotebookConfigSchema)

    # noinspection PyUnusedLocal
    @post_load
    def make_notebooks_config(self, data, **kwargs):
        return NotebooksConfig(**data)


class GeCloudConfig(DictDot):
    def __init__(self, base_url: str, account_id: str, access_token: str):
        self.base_url = base_url
        self.account_id = account_id
        self.access_token = access_token

    def to_json_dict(self):
        return {
            "base_url": self.base_url,
            "account_id": self.account_id,
            "access_token": self.access_token,
        }


class DataContextConfigSchema(Schema):
    config_version = fields.Number(
        validate=lambda x: 0 < x < 100,
        error_messages={"invalid": "config version must " "be a number."},
    )
    datasources = fields.Dict(
        keys=fields.Str(),
        values=fields.Nested(DatasourceConfigSchema),
        required=False,
        allow_none=True,
    )
    expectations_store_name = fields.Str()
    validations_store_name = fields.Str()
    evaluation_parameter_store_name = fields.Str()
    checkpoint_store_name = fields.Str(required=False, allow_none=True)
    plugins_directory = fields.Str(allow_none=True)
    validation_operators = fields.Dict(
        keys=fields.Str(), values=fields.Dict(), required=False, allow_none=True
    )
    stores = fields.Dict(keys=fields.Str(), values=fields.Dict())
    notebooks = fields.Nested(NotebooksConfigSchema, allow_none=True)
    data_docs_sites = fields.Dict(
        keys=fields.Str(), values=fields.Dict(), allow_none=True
    )
    config_variables_file_path = fields.Str(allow_none=True)
    anonymous_usage_statistics = fields.Nested(AnonymizedUsageStatisticsConfigSchema)

    # noinspection PyMethodMayBeStatic
    # noinspection PyUnusedLocal
    def handle_error(self, exc, data, **kwargs):
        """Log and raise our custom exception when (de)serialization fails."""
        if (
            exc
            and exc.messages
            and isinstance(exc.messages, dict)
            and all([key is None for key in exc.messages.keys()])
        ):
            exc.messages = list(itertools.chain.from_iterable(exc.messages.values()))

        message: str = (
            f"Error while processing DataContextConfig: {' '.join(exc.messages)}"
        )
        logger.error(message)
        raise ge_exceptions.InvalidDataContextConfigError(
            message=message,
        )

    @validates_schema
    def validate_schema(self, data, **kwargs):
        if "config_version" not in data:
            raise ge_exceptions.InvalidDataContextConfigError(
                "The key `config_version` is missing; please check your config file.",
                validation_error=ValidationError(message="no config_version key"),
            )

        if not isinstance(data["config_version"], (int, float)):
            raise ge_exceptions.InvalidDataContextConfigError(
                "The key `config_version` must be a number. Please check your config file.",
                validation_error=ValidationError(message="config version not a number"),
            )

        # When migrating from 0.7.x to 0.8.0
        if data["config_version"] == 0 and any(
            [
                store_config["class_name"] == "ValidationsStore"
                for store_config in data["stores"].values()
            ]
        ):
            raise ge_exceptions.UnsupportedConfigVersionError(
                "You appear to be using a config version from the 0.7.x series. This version is no longer supported."
            )

        if data["config_version"] < MINIMUM_SUPPORTED_CONFIG_VERSION:
            raise ge_exceptions.UnsupportedConfigVersionError(
                "You appear to have an invalid config version ({}).\n    The version number must be at least {}. "
                "Please see the migration guide at https://docs.greatexpectations.io/en/latest/guides/how_to_guides/migrating_versions.html".format(
                    data["config_version"], MINIMUM_SUPPORTED_CONFIG_VERSION
                ),
            )

        if data["config_version"] > CURRENT_GE_CONFIG_VERSION:
            raise ge_exceptions.InvalidDataContextConfigError(
                "You appear to have an invalid config version ({}).\n    The maximum valid version is {}.".format(
                    data["config_version"], CURRENT_GE_CONFIG_VERSION
                ),
                validation_error=ValidationError(message="config version too high"),
            )

        if data["config_version"] < CURRENT_GE_CONFIG_VERSION and (
            "checkpoint_store_name" in data
            or any(
                [
                    store_config["class_name"] == "CheckpointStore"
                    for store_config in data["stores"].values()
                ]
            )
        ):
            raise ge_exceptions.InvalidDataContextConfigError(
                "You appear to be using a Checkpoint store with an invalid config version ({}).\n    Your data context with this older configuration version specifies a Checkpoint store, which is a new feature.  Please update your configuration to the new version number {} before adding a Checkpoint store.\n  Visit https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html to learn more about the upgrade process.".format(
                    data["config_version"], float(CURRENT_GE_CONFIG_VERSION)
                ),
                validation_error=ValidationError(
                    message="You appear to be using a Checkpoint store with an invalid config version ({}).\n    Your data context with this older configuration version specifies a Checkpoint store, which is a new feature.  Please update your configuration to the new version number {} before adding a Checkpoint store.\n  Visit https://docs.greatexpectations.io/en/latest/how_to_guides/migrating_versions.html to learn more about the upgrade process.".format(
                        data["config_version"], float(CURRENT_GE_CONFIG_VERSION)
                    )
                ),
            )

        if (
            data["config_version"] >= FIRST_GE_CONFIG_VERSION_WITH_CHECKPOINT_STORE
            and "validation_operators" in data
            and data["validation_operators"] is not None
        ):
            # TODO: <Alex>Add a URL to the migration guide with instructions for how to replace validation_operators with appropriate actions.</Alex>
            logger.warning(
                "You appear to be using a legacy capability with the latest config version ({}).\n    Your data context with this configuration version uses validation_operators, which are being deprecated.  Please update your configuration to be compatible with the version number {}.".format(
                    data["config_version"], CURRENT_GE_CONFIG_VERSION
                ),
            )


class DataContextConfigDefaults(enum.Enum):
    DEFAULT_CONFIG_VERSION = CURRENT_GE_CONFIG_VERSION
    DEFAULT_EXPECTATIONS_STORE_NAME = "expectations_store"
    EXPECTATIONS_BASE_DIRECTORY = "expectations"
    DEFAULT_EXPECTATIONS_STORE_BASE_DIRECTORY_RELATIVE_NAME = (
        f"{EXPECTATIONS_BASE_DIRECTORY}/"
    )
    DEFAULT_VALIDATIONS_STORE_NAME = "validations_store"
    VALIDATIONS_BASE_DIRECTORY = "validations"
    DEFAULT_VALIDATIONS_STORE_BASE_DIRECTORY_RELATIVE_NAME = (
        f"uncommitted/{VALIDATIONS_BASE_DIRECTORY}/"
    )
    DEFAULT_EVALUATION_PARAMETER_STORE_NAME = "evaluation_parameter_store"
    DEFAULT_EVALUATION_PARAMETER_STORE_BASE_DIRECTORY_RELATIVE_NAME = (
        "evaluation_parameters/"
    )
    DEFAULT_CHECKPOINT_STORE_NAME = "checkpoint_store"
    CHECKPOINTS_BASE_DIRECTORY = "checkpoints"
    DEFAULT_CHECKPOINT_STORE_BASE_DIRECTORY_RELATIVE_NAME = (
        f"{CHECKPOINTS_BASE_DIRECTORY}/"
    )
    DEFAULT_DATA_DOCS_SITE_NAME = "local_site"
    DEFAULT_CONFIG_VARIABLES_FILEPATH = "uncommitted/config_variables.yml"
    PLUGINS_BASE_DIRECTORY = "plugins"
    DEFAULT_PLUGINS_DIRECTORY = f"{PLUGINS_BASE_DIRECTORY}/"
    NOTEBOOKS_BASE_DIRECTORY = "notebooks"
    DEFAULT_VALIDATION_OPERATORS = {
        "action_list_operator": {
            "class_name": "ActionListValidationOperator",
            "action_list": [
                {
                    "name": "store_validation_result",
                    "action": {"class_name": "StoreValidationResultAction"},
                },
                {
                    "name": "store_evaluation_params",
                    "action": {"class_name": "StoreEvaluationParametersAction"},
                },
                {
                    "name": "update_data_docs",
                    "action": {"class_name": "UpdateDataDocsAction"},
                },
            ],
        }
    }
    DEFAULT_STORES = {
        DEFAULT_EXPECTATIONS_STORE_NAME: {
            "class_name": "ExpectationsStore",
            "store_backend": {
                "class_name": "TupleFilesystemStoreBackend",
                "base_directory": DEFAULT_EXPECTATIONS_STORE_BASE_DIRECTORY_RELATIVE_NAME,
            },
        },
        DEFAULT_VALIDATIONS_STORE_NAME: {
            "class_name": "ValidationsStore",
            "store_backend": {
                "class_name": "TupleFilesystemStoreBackend",
                "base_directory": DEFAULT_VALIDATIONS_STORE_BASE_DIRECTORY_RELATIVE_NAME,
            },
        },
        DEFAULT_EVALUATION_PARAMETER_STORE_NAME: {
            "class_name": "EvaluationParameterStore"
        },
        DEFAULT_CHECKPOINT_STORE_NAME: {
            "class_name": "CheckpointStore",
            "store_backend": {
                "class_name": "TupleFilesystemStoreBackend",
                "suppress_store_backend_id": True,
                "base_directory": DEFAULT_CHECKPOINT_STORE_BASE_DIRECTORY_RELATIVE_NAME,
            },
        },
    }
    DEFAULT_DATA_DOCS_SITES = {
        DEFAULT_DATA_DOCS_SITE_NAME: {
            "class_name": "SiteBuilder",
            "show_how_to_buttons": True,
            "store_backend": {
                "class_name": "TupleFilesystemStoreBackend",
                "base_directory": "uncommitted/data_docs/local_site/",
            },
            "site_index_builder": {
                "class_name": "DefaultSiteIndexBuilder",
            },
        }
    }


class CheckpointConfigDefaults(enum.Enum):
    DEFAULT_CONFIG_VERSION = CURRENT_CHECKPOINT_CONFIG_VERSION


class BaseStoreBackendDefaults(DictDot):
    """
    Define base defaults for platform specific StoreBackendDefaults.
    StoreBackendDefaults define defaults for specific cases of often used configurations.
    For example, if you plan to store expectations, validations, and data_docs in s3 use the S3StoreBackendDefaults and you may be able to specify less parameters.
    """

    def __init__(
        self,
        expectations_store_name: str = DataContextConfigDefaults.DEFAULT_EXPECTATIONS_STORE_NAME.value,
        validations_store_name: str = DataContextConfigDefaults.DEFAULT_VALIDATIONS_STORE_NAME.value,
        evaluation_parameter_store_name: str = DataContextConfigDefaults.DEFAULT_EVALUATION_PARAMETER_STORE_NAME.value,
        checkpoint_store_name: str = DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_NAME.value,
        data_docs_site_name: str = DataContextConfigDefaults.DEFAULT_DATA_DOCS_SITE_NAME.value,
        validation_operators: dict = None,
        stores: dict = None,
        data_docs_sites: dict = None,
    ):
        self.expectations_store_name = expectations_store_name
        self.validations_store_name = validations_store_name
        self.evaluation_parameter_store_name = evaluation_parameter_store_name
        self.checkpoint_store_name = checkpoint_store_name
        self.validation_operators = validation_operators
        if stores is None:
            stores = deepcopy(DataContextConfigDefaults.DEFAULT_STORES.value)
        self.stores = stores
        if data_docs_sites is None:
            data_docs_sites = deepcopy(
                DataContextConfigDefaults.DEFAULT_DATA_DOCS_SITES.value
            )
        self.data_docs_sites = data_docs_sites
        self.data_docs_site_name = data_docs_site_name


class S3StoreBackendDefaults(BaseStoreBackendDefaults):
    """
    Default store configs for s3 backends, with some accessible parameters
    Args:
        default_bucket_name: Use this bucket name for stores that do not have a bucket name provided
        expectations_store_bucket_name: Overrides default_bucket_name if supplied
        validations_store_bucket_name: Overrides default_bucket_name if supplied
        data_docs_bucket_name: Overrides default_bucket_name if supplied
        checkpoint_store_bucket_name: Overrides default_bucket_name if supplied
        expectations_store_prefix: Overrides default if supplied
        validations_store_prefix: Overrides default if supplied
        data_docs_prefix: Overrides default if supplied
        checkpoint_store_prefix: Overrides default if supplied
        expectations_store_name: Overrides default if supplied
        validations_store_name: Overrides default if supplied
        evaluation_parameter_store_name: Overrides default if supplied
        checkpoint_store_name: Overrides default if supplied
    """

    def __init__(
        self,
        default_bucket_name: Optional[str] = None,
        expectations_store_bucket_name: Optional[str] = None,
        validations_store_bucket_name: Optional[str] = None,
        data_docs_bucket_name: Optional[str] = None,
        checkpoint_store_bucket_name: Optional[str] = None,
        expectations_store_prefix: str = "expectations",
        validations_store_prefix: str = "validations",
        data_docs_prefix: str = "data_docs",
        checkpoint_store_prefix: str = "checkpoints",
        expectations_store_name: str = "expectations_S3_store",
        validations_store_name: str = "validations_S3_store",
        evaluation_parameter_store_name: str = "evaluation_parameter_store",
        checkpoint_store_name: str = "checkpoint_S3_store",
    ):
        # Initialize base defaults
        super().__init__()

        # Use default_bucket_name if separate store buckets are not provided
        if expectations_store_bucket_name is None:
            expectations_store_bucket_name = default_bucket_name
        if validations_store_bucket_name is None:
            validations_store_bucket_name = default_bucket_name
        if data_docs_bucket_name is None:
            data_docs_bucket_name = default_bucket_name
        if checkpoint_store_bucket_name is None:
            checkpoint_store_bucket_name = default_bucket_name

        # Overwrite defaults
        self.expectations_store_name = expectations_store_name
        self.validations_store_name = validations_store_name
        self.evaluation_parameter_store_name = evaluation_parameter_store_name
        self.checkpoint_store_name = checkpoint_store_name
        self.stores = {
            expectations_store_name: {
                "class_name": "ExpectationsStore",
                "store_backend": {
                    "class_name": "TupleS3StoreBackend",
                    "bucket": expectations_store_bucket_name,
                    "prefix": expectations_store_prefix,
                },
            },
            validations_store_name: {
                "class_name": "ValidationsStore",
                "store_backend": {
                    "class_name": "TupleS3StoreBackend",
                    "bucket": validations_store_bucket_name,
                    "prefix": validations_store_prefix,
                },
            },
            evaluation_parameter_store_name: {"class_name": "EvaluationParameterStore"},
            checkpoint_store_name: {
                "class_name": "CheckpointStore",
                "store_backend": {
                    "class_name": "TupleS3StoreBackend",
                    "bucket": checkpoint_store_bucket_name,
                    "prefix": checkpoint_store_prefix,
                },
            },
        }
        self.data_docs_sites = {
            "s3_site": {
                "class_name": "SiteBuilder",
                "show_how_to_buttons": True,
                "store_backend": {
                    "class_name": "TupleS3StoreBackend",
                    "bucket": data_docs_bucket_name,
                    "prefix": data_docs_prefix,
                },
                "site_index_builder": {
                    "class_name": "DefaultSiteIndexBuilder",
                },
            }
        }


class FilesystemStoreBackendDefaults(BaseStoreBackendDefaults):
    """
    Default store configs for filesystem backends, with some accessible parameters
    Args:
        root_directory: Absolute directory prepended to the base_directory for each store
        plugins_directory: Overrides default if supplied
    """

    def __init__(
        self,
        root_directory: Optional[str] = None,
        plugins_directory: Optional[str] = None,
    ):
        # Initialize base defaults
        super().__init__()

        if plugins_directory is None:
            plugins_directory = (
                DataContextConfigDefaults.DEFAULT_PLUGINS_DIRECTORY.value
            )
        self.plugins_directory = plugins_directory
        if root_directory is not None:
            self.stores[self.expectations_store_name]["store_backend"][
                "root_directory"
            ] = root_directory
            self.stores[self.validations_store_name]["store_backend"][
                "root_directory"
            ] = root_directory
            self.stores[self.checkpoint_store_name]["store_backend"][
                "root_directory"
            ] = root_directory
            self.data_docs_sites[self.data_docs_site_name]["store_backend"][
                "root_directory"
            ] = root_directory


class InMemoryStoreBackendDefaults(BaseStoreBackendDefaults):
    """
    Default store configs for in memory backends.

    This is useful for testing without persistence.
    """

    def __init__(
        self,
    ):
        # Initialize base defaults
        super().__init__()

        self.stores = {
            self.expectations_store_name: {
                "class_name": "ExpectationsStore",
                "store_backend": {
                    "class_name": "InMemoryStoreBackend",
                },
            },
            self.validations_store_name: {
                "class_name": "ValidationsStore",
                "store_backend": {
                    "class_name": "InMemoryStoreBackend",
                },
            },
            self.evaluation_parameter_store_name: {
                "class_name": "EvaluationParameterStore"
            },
            self.checkpoint_store_name: {
                "class_name": "CheckpointStore",
                "store_backend": {
                    "class_name": "InMemoryStoreBackend",
                },
            },
        }
        self.data_docs_sites = {}


class GCSStoreBackendDefaults(BaseStoreBackendDefaults):
    """
    Default store configs for Google Cloud Storage (GCS) backends, with some accessible parameters
    Args:
        default_bucket_name: Use this bucket name for stores that do not have a bucket name provided
        default_project_name: Use this project name for stores that do not have a project name provided
        expectations_store_bucket_name: Overrides default_bucket_name if supplied
        validations_store_bucket_name: Overrides default_bucket_name if supplied
        data_docs_bucket_name: Overrides default_bucket_name if supplied
        checkpoint_store_bucket_name: Overrides default_bucket_name if supplied
        expectations_store_project_name: Overrides default_project_name if supplied
        validations_store_project_name: Overrides default_project_name if supplied
        data_docs_project_name: Overrides default_project_name if supplied
        checkpoint_store_project_name: Overrides default_project_name if supplied
        expectations_store_prefix: Overrides default if supplied
        validations_store_prefix: Overrides default if supplied
        data_docs_prefix: Overrides default if supplied
        checkpoint_store_prefix: Overrides default if supplied
        expectations_store_name: Overrides default if supplied
        validations_store_name: Overrides default if supplied
        evaluation_parameter_store_name: Overrides default if supplied
        checkpoint_store_name: Overrides default if supplied
    """

    def __init__(
        self,
        default_bucket_name: Optional[str] = None,
        default_project_name: Optional[str] = None,
        expectations_store_bucket_name: Optional[str] = None,
        validations_store_bucket_name: Optional[str] = None,
        data_docs_bucket_name: Optional[str] = None,
        checkpoint_store_bucket_name: Optional[str] = None,
        expectations_store_project_name: Optional[str] = None,
        validations_store_project_name: Optional[str] = None,
        data_docs_project_name: Optional[str] = None,
        checkpoint_store_project_name: Optional[str] = None,
        expectations_store_prefix: str = "expectations",
        validations_store_prefix: str = "validations",
        data_docs_prefix: str = "data_docs",
        checkpoint_store_prefix: str = "checkpoints",
        expectations_store_name: str = "expectations_GCS_store",
        validations_store_name: str = "validations_GCS_store",
        evaluation_parameter_store_name: str = "evaluation_parameter_store",
        checkpoint_store_name: str = "checkpoint_GCS_store",
    ):
        # Initialize base defaults
        super().__init__()

        # Use default_bucket_name if separate store buckets are not provided
        if expectations_store_bucket_name is None:
            expectations_store_bucket_name = default_bucket_name
        if validations_store_bucket_name is None:
            validations_store_bucket_name = default_bucket_name
        if data_docs_bucket_name is None:
            data_docs_bucket_name = default_bucket_name
        if checkpoint_store_bucket_name is None:
            checkpoint_store_bucket_name = default_bucket_name

        # Use default_project_name if separate store projects are not provided
        if expectations_store_project_name is None:
            expectations_store_project_name = default_project_name
        if validations_store_project_name is None:
            validations_store_project_name = default_project_name
        if data_docs_project_name is None:
            data_docs_project_name = default_project_name
        if checkpoint_store_project_name is None:
            checkpoint_store_project_name = default_project_name

        # Overwrite defaults
        self.expectations_store_name = expectations_store_name
        self.validations_store_name = validations_store_name
        self.evaluation_parameter_store_name = evaluation_parameter_store_name
        self.checkpoint_store_name = checkpoint_store_name
        self.stores = {
            expectations_store_name: {
                "class_name": "ExpectationsStore",
                "store_backend": {
                    "class_name": "TupleGCSStoreBackend",
                    "project": expectations_store_project_name,
                    "bucket": expectations_store_bucket_name,
                    "prefix": expectations_store_prefix,
                },
            },
            validations_store_name: {
                "class_name": "ValidationsStore",
                "store_backend": {
                    "class_name": "TupleGCSStoreBackend",
                    "project": validations_store_project_name,
                    "bucket": validations_store_bucket_name,
                    "prefix": validations_store_prefix,
                },
            },
            evaluation_parameter_store_name: {"class_name": "EvaluationParameterStore"},
            checkpoint_store_name: {
                "class_name": "CheckpointStore",
                "store_backend": {
                    "class_name": "TupleGCSStoreBackend",
                    "project": checkpoint_store_project_name,
                    "bucket": checkpoint_store_bucket_name,
                    "prefix": checkpoint_store_prefix,
                },
            },
        }
        self.data_docs_sites = {
            "gcs_site": {
                "class_name": "SiteBuilder",
                "show_how_to_buttons": True,
                "store_backend": {
                    "class_name": "TupleGCSStoreBackend",
                    "project": data_docs_project_name,
                    "bucket": data_docs_bucket_name,
                    "prefix": data_docs_prefix,
                },
                "site_index_builder": {
                    "class_name": "DefaultSiteIndexBuilder",
                },
            }
        }


class DatabaseStoreBackendDefaults(BaseStoreBackendDefaults):
    """
    Default store configs for database backends, with some accessible parameters
    Args:
        default_credentials: Use these credentials for all stores that do not have credentials provided
        expectations_store_credentials: Overrides default_credentials if supplied
        validations_store_credentials: Overrides default_credentials if supplied
        checkpoint_store_credentials: Overrides default_credentials if supplied
        expectations_store_name: Overrides default if supplied
        validations_store_name: Overrides default if supplied
        evaluation_parameter_store_name: Overrides default if supplied
        checkpoint_store_name: Overrides default if supplied
    """

    def __init__(
        self,
        default_credentials: Optional[Dict] = None,
        expectations_store_credentials: Optional[Dict] = None,
        validations_store_credentials: Optional[Dict] = None,
        checkpoint_store_credentials: Optional[Dict] = None,
        expectations_store_name: str = "expectations_database_store",
        validations_store_name: str = "validations_database_store",
        evaluation_parameter_store_name: str = "evaluation_parameter_store",
        checkpoint_store_name: str = "checkpoint_database_store",
    ):
        # Initialize base defaults
        super().__init__()

        # Use default credentials if separate credentials not supplied for expectations_store and validations_store
        if expectations_store_credentials is None:
            expectations_store_credentials = default_credentials
        if validations_store_credentials is None:
            validations_store_credentials = default_credentials
        if checkpoint_store_credentials is None:
            checkpoint_store_credentials = default_credentials

        # Overwrite defaults
        self.expectations_store_name = expectations_store_name
        self.validations_store_name = validations_store_name
        self.evaluation_parameter_store_name = evaluation_parameter_store_name
        self.checkpoint_store_name = checkpoint_store_name

        self.stores = {
            expectations_store_name: {
                "class_name": "ExpectationsStore",
                "store_backend": {
                    "class_name": "DatabaseStoreBackend",
                    "credentials": expectations_store_credentials,
                },
            },
            validations_store_name: {
                "class_name": "ValidationsStore",
                "store_backend": {
                    "class_name": "DatabaseStoreBackend",
                    "credentials": validations_store_credentials,
                },
            },
            evaluation_parameter_store_name: {"class_name": "EvaluationParameterStore"},
            checkpoint_store_name: {
                "class_name": "CheckpointStore",
                "store_backend": {
                    "class_name": "DatabaseStoreBackend",
                    "credentials": checkpoint_store_credentials,
                },
            },
        }


class DataContextConfig(BaseYamlConfig):
    # TODO: <Alex>ALEX (does not work yet)</Alex>
    # _config_schema_class = DataContextConfigSchema

    def __init__(
        self,
        config_version: Optional[float] = None,
        datasources: Optional[
            Union[
                Dict[str, DatasourceConfig],
                Dict[str, Dict[str, Union[Dict[str, str], str, dict]]],
            ]
        ] = None,
        expectations_store_name: Optional[str] = None,
        validations_store_name: Optional[str] = None,
        evaluation_parameter_store_name: Optional[str] = None,
        checkpoint_store_name: Optional[str] = None,
        plugins_directory: Optional[str] = None,
        validation_operators=None,
        stores: Optional[Dict] = None,
        data_docs_sites: Optional[Dict] = None,
        notebooks=None,
        config_variables_file_path: Optional[str] = None,
        anonymous_usage_statistics=None,
        store_backend_defaults: Optional[BaseStoreBackendDefaults] = None,
        commented_map: Optional[CommentedMap] = None,
    ):
        # Set defaults
        if config_version is None:
            config_version = DataContextConfigDefaults.DEFAULT_CONFIG_VERSION.value

        # Set defaults via store_backend_defaults if one is passed in
        # Override attributes from store_backend_defaults with any items passed into the constructor:
        if store_backend_defaults is not None:
            if stores is None:
                stores = store_backend_defaults.stores
            if expectations_store_name is None:
                expectations_store_name = store_backend_defaults.expectations_store_name
            if validations_store_name is None:
                validations_store_name = store_backend_defaults.validations_store_name
            if evaluation_parameter_store_name is None:
                evaluation_parameter_store_name = (
                    store_backend_defaults.evaluation_parameter_store_name
                )
            if data_docs_sites is None:
                data_docs_sites = store_backend_defaults.data_docs_sites
            if checkpoint_store_name is None:
                checkpoint_store_name = store_backend_defaults.checkpoint_store_name

        self._config_version = config_version
        if datasources is None:
            datasources = {}
        self.datasources = datasources
        self.expectations_store_name = expectations_store_name
        self.validations_store_name = validations_store_name
        self.evaluation_parameter_store_name = evaluation_parameter_store_name
        if checkpoint_store_name is not None:
            self.checkpoint_store_name = checkpoint_store_name
        self.plugins_directory = plugins_directory
        if validation_operators is not None:
            self.validation_operators = validation_operators
        self.stores = stores
        self.notebooks = notebooks
        self.data_docs_sites = data_docs_sites
        self.config_variables_file_path = config_variables_file_path
        if anonymous_usage_statistics is None:
            anonymous_usage_statistics = AnonymizedUsageStatisticsConfig()
        elif isinstance(anonymous_usage_statistics, dict):
            anonymous_usage_statistics = AnonymizedUsageStatisticsConfig(
                **anonymous_usage_statistics
            )
        self.anonymous_usage_statistics = anonymous_usage_statistics

        super().__init__(commented_map=commented_map)

    # TODO: <Alex>ALEX (we still need the next two properties)</Alex>
    @classmethod
    def get_config_class(cls):
        return cls  # DataContextConfig

    @classmethod
    def get_schema_class(cls):
        return DataContextConfigSchema

    @property
    def config_version(self):
        return self._config_version


class CheckpointConfigSchema(Schema):
    class Meta:
        unknown = INCLUDE
        fields = (
            "name",
            "config_version",
            "template_name",
            "module_name",
            "class_name",
            "run_name_template",
            "expectation_suite_name",
            "batch_request",
            "action_list",
            "evaluation_parameters",
            "runtime_configuration",
            "validations",
            "profilers",
            # Next two fields are for LegacyCheckpoint configuration
            "validation_operator_name",
            "batches",
            # Next fields are used by configurators
            "site_names",
            "slack_webhook",
            "notify_on",
            "notify_with",
            "ge_cloud_id",
        )
        ordered = True

    # if keys have None value, remove in post_dump
    REMOVE_KEYS_IF_NONE = [
        "site_names",
        "slack_webhook",
        "notify_on",
        "notify_with",
    ]

    ge_cloud_id = fields.UUID(required=False, allow_none=True)
    name = fields.String(required=False, allow_none=True)
    config_version = fields.Number(
        validate=lambda x: (0 < x < 100) or x is None,
        error_messages={"invalid": "config version must " "be a number or None."},
        required=False,
        allow_none=True,
    )
    template_name = fields.String(required=False, allow_none=True)
    module_name = fields.String(required=False, missing="great_expectations.checkpoint")
    class_name = fields.Str(required=False, allow_none=True)
    run_name_template = fields.String(required=False, allow_none=True)
    expectation_suite_name = fields.String(required=False, allow_none=True)
    batch_request = fields.Dict(required=False, allow_none=True)
    action_list = fields.List(
        cls_or_instance=fields.Dict(), required=False, allow_none=True
    )
    evaluation_parameters = fields.Dict(required=False, allow_none=True)
    runtime_configuration = fields.Dict(required=False, allow_none=True)
    validations = fields.List(
        cls_or_instance=fields.Dict(), required=False, allow_none=True
    )
    profilers = fields.List(
        cls_or_instance=fields.Dict(), required=False, allow_none=True
    )
    # Next two fields are for LegacyCheckpoint configuration
    validation_operator_name = fields.Str(required=False, allow_none=True)
    batches = fields.List(
        cls_or_instance=fields.Dict(
            keys=fields.Str(
                validate=OneOf(["batch_kwargs", "expectation_suite_names"]),
                required=False,
                allow_none=True,
            )
        ),
        required=False,
        allow_none=True,
    )
    # Next fields are used by configurators
    site_names = fields.Raw(required=False, allow_none=True)
    slack_webhook = fields.String(required=False, allow_none=True)
    notify_on = fields.String(required=False, allow_none=True)
    notify_with = fields.String(required=False, allow_none=True)

    @validates_schema
    def validate_schema(self, data, **kwargs):
        if not (
            "name" in data or "validation_operator_name" in data or "batches" in data
        ):
            raise ge_exceptions.InvalidConfigError(
                f"""Your current Checkpoint configuration is incomplete.  Please update your Checkpoint configuration to
                continue.
                """
            )

        if data.get("config_version"):
            if "name" not in data:
                raise ge_exceptions.InvalidConfigError(
                    f"""Your Checkpoint configuration requires the "name" field.  Please update your current Checkpoint
                    configuration to continue.
                    """
                )

    @post_dump
    def remove_keys_if_none(self, data, **kwargs):
        data = deepcopy(data)
        for key in self.REMOVE_KEYS_IF_NONE:
            if key in data and data[key] is None:
                data.pop(key)
        return data


class CheckpointConfig(BaseYamlConfig):
    # TODO: <Alex>ALEX (does not work yet)</Alex>
    # _config_schema_class = CheckpointConfigSchema

    def __init__(
        self,
        name: Optional[str] = None,
        config_version: Optional[Union[int, float]] = None,
        template_name: Optional[str] = None,
        module_name: Optional[str] = None,
        class_name: Optional[str] = None,
        run_name_template: Optional[str] = None,
        expectation_suite_name: Optional[str] = None,
        batch_request: Optional[dict] = None,
        action_list: Optional[List[dict]] = None,
        evaluation_parameters: Optional[dict] = None,
        runtime_configuration: Optional[dict] = None,
        validations: Optional[List[dict]] = None,
        profilers: Optional[List[dict]] = None,
        validation_operator_name: Optional[str] = None,
        batches: Optional[List[dict]] = None,
        commented_map: Optional[CommentedMap] = None,
        ge_cloud_id: Optional[str] = None,
        # the following fous args are used by SimpleCheckpoint
        site_names: Optional[Union[list, str]] = None,
        slack_webhook: Optional[str] = None,
        notify_on: Optional[str] = None,
        notify_with: Optional[str] = None,
    ):
        self._name = name
        self._config_version = config_version
        if self.config_version is None:
            class_name = class_name or "LegacyCheckpoint"
            self.validation_operator_name = validation_operator_name
            if batches is not None and isinstance(batches, list):
                self.batches = batches
        else:
            class_name = class_name or "Checkpoint"
            self._template_name = template_name
            self._run_name_template = run_name_template
            self._expectation_suite_name = expectation_suite_name
            self._batch_request = batch_request
            self._action_list = action_list or []
            self._evaluation_parameters = evaluation_parameters or {}
            self._runtime_configuration = runtime_configuration or {}
            self._validations = validations or []
            self._profilers = profilers or []
            self._ge_cloud_id = ge_cloud_id
            # the following attributes are used by SimpleCheckpoint
            self._site_names = site_names
            self._slack_webhook = slack_webhook
            self._notify_on = notify_on
            self._notify_with = notify_with

        self._module_name = module_name or "great_expectations.checkpoint"
        self._class_name = class_name

        super().__init__(commented_map=commented_map)

    def update(
        self,
        other_config: Optional["CheckpointConfig"] = None,
        runtime_kwargs: Optional[dict] = None,
    ):
        assert other_config is not None or runtime_kwargs is not None, (
            "other_config and runtime_kwargs cannot both " "be None"
        )

        if other_config is not None:
            # replace
            if other_config.name is not None:
                self.name = other_config.name
            if other_config.module_name is not None:
                self.module_name = other_config.module_name
            if other_config.class_name is not None:
                self.class_name = other_config.class_name
            if other_config.run_name_template is not None:
                self.run_name_template = other_config.run_name_template
            if other_config.expectation_suite_name is not None:
                self.expectation_suite_name = other_config.expectation_suite_name
            # update
            if other_config.batch_request is not None:
                if self.batch_request is None:
                    batch_request = {}
                else:
                    batch_request = self.batch_request

                other_batch_request = other_config.batch_request

                updated_batch_request = nested_update(
                    batch_request,
                    other_batch_request,
                )
                self._batch_request = updated_batch_request
            if other_config.action_list is not None:
                self.action_list = self.get_updated_action_list(
                    base_action_list=self.action_list,
                    other_action_list=other_config.action_list,
                )
            if other_config.evaluation_parameters is not None:
                nested_update(
                    self.evaluation_parameters,
                    other_config.evaluation_parameters,
                )
            if other_config.runtime_configuration is not None:
                nested_update(
                    self.runtime_configuration,
                    other_config.runtime_configuration,
                )
            if other_config.validations is not None:
                self.validations.extend(
                    filter(
                        lambda v: v not in self.validations, other_config.validations
                    )
                )
            if other_config.profilers is not None:
                self.profilers.extend(other_config.profilers)
        if runtime_kwargs is not None and any(runtime_kwargs.values()):
            # replace
            if runtime_kwargs.get("run_name_template") is not None:
                self.run_name_template = runtime_kwargs.get("run_name_template")
            if runtime_kwargs.get("expectation_suite_name") is not None:
                self.expectation_suite_name = runtime_kwargs.get(
                    "expectation_suite_name"
                )
            # update
            if runtime_kwargs.get("batch_request") is not None:
                batch_request = self.batch_request
                batch_request = batch_request or {}
                runtime_batch_request = runtime_kwargs.get("batch_request")
                batch_request = nested_update(batch_request, runtime_batch_request)
                self._batch_request = batch_request
            if runtime_kwargs.get("action_list") is not None:
                self.action_list = self.get_updated_action_list(
                    base_action_list=self.action_list,
                    other_action_list=runtime_kwargs.get("action_list"),
                )
            if runtime_kwargs.get("evaluation_parameters") is not None:
                nested_update(
                    self.evaluation_parameters,
                    runtime_kwargs.get("evaluation_parameters"),
                )
            if runtime_kwargs.get("runtime_configuration") is not None:
                nested_update(
                    self.runtime_configuration,
                    runtime_kwargs.get("runtime_configuration"),
                )
            if runtime_kwargs.get("validations") is not None:
                self.validations.extend(
                    filter(
                        lambda v: v not in self.validations,
                        runtime_kwargs.get("validations"),
                    )
                )
            if runtime_kwargs.get("profilers") is not None:
                self.profilers.extend(runtime_kwargs.get("profilers"))

    # TODO: <Alex>ALEX (we still need the next two properties)</Alex>
    @classmethod
    def get_config_class(cls):
        return cls  # CheckpointConfig

    @classmethod
    def get_schema_class(cls):
        return CheckpointConfigSchema

    @property
    def ge_cloud_id(self):
        return self._ge_cloud_id

    @ge_cloud_id.setter
    def ge_cloud_id(self, value: str):
        self._ge_cloud_id = value

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value: str):
        self._name = value

    @property
    def template_name(self):
        return self._template_name

    @template_name.setter
    def template_name(self, value: str):
        self._template_name = value

    @property
    def config_version(self):
        return self._config_version

    @property
    def validations(self):
        return self._validations

    @property
    def profilers(self):
        return self._profilers

    @property
    def module_name(self):
        return self._module_name

    @module_name.setter
    def module_name(self, value: str):
        self._module_name = value

    @property
    def class_name(self):
        return self._class_name

    @class_name.setter
    def class_name(self, value: str):
        self._class_name = value

    @property
    def run_name_template(self):
        return self._run_name_template

    @run_name_template.setter
    def run_name_template(self, value: str):
        self._run_name_template = value

    @property
    def batch_request(self):
        return self._batch_request

    @batch_request.setter
    def batch_request(self, value: dict):
        self._batch_request = value

    @property
    def expectation_suite_name(self):
        return self._expectation_suite_name

    @expectation_suite_name.setter
    def expectation_suite_name(self, value: str):
        self._expectation_suite_name = value

    @property
    def action_list(self):
        return self._action_list

    @action_list.setter
    def action_list(self, value: List[dict]):
        self._action_list = value

    @property
    def site_names(self):
        return self._site_names

    @property
    def slack_webhook(self):
        return self._slack_webhook

    @property
    def notify_on(self):
        return self._notify_on

    @property
    def notify_with(self):
        return self._notify_with

    @classmethod
    def get_updated_action_list(
        cls,
        base_action_list: list,
        other_action_list: list,
    ) -> List[dict]:
        base_action_list_dict = {action["name"]: action for action in base_action_list}
        for other_action in other_action_list:
            other_action_name = other_action["name"]
            if other_action_name in base_action_list_dict:
                if other_action["action"] is None:
                    base_action_list_dict.pop(other_action_name)
                else:
                    nested_update(
                        base_action_list_dict[other_action_name],
                        other_action,
                        dedup=True,
                    )
            else:
                base_action_list_dict[other_action_name] = other_action
        return list(base_action_list_dict.values())

    @property
    def evaluation_parameters(self):
        return self._evaluation_parameters

    @property
    def runtime_configuration(self):
        return self._runtime_configuration


class CheckpointValidationConfig(DictDot):
    pass


class CheckpointValidationConfigSchema(Schema):
    pass


dataContextConfigSchema = DataContextConfigSchema()
datasourceConfigSchema = DatasourceConfigSchema()
dataConnectorConfigSchema = DataConnectorConfigSchema()
assetConfigSchema = AssetConfigSchema()
sorterConfigSchema = SorterConfigSchema()
anonymizedUsageStatisticsSchema = AnonymizedUsageStatisticsConfigSchema()
notebookConfigSchema = NotebookConfigSchema()
checkpointConfigSchema = CheckpointConfigSchema()
