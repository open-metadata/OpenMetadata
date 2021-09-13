import inspect
import logging
from typing import Dict, Optional

import numpy as np
import pandas as pd

from great_expectations.core import ExpectationConfiguration
from great_expectations.exceptions import InvalidExpectationConfigurationError
from great_expectations.execution_engine import (
    ExecutionEngine,
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.expectation import (
    ColumnMapExpectation,
    TableExpectation,
)
from great_expectations.expectations.registry import get_metric_kwargs
from great_expectations.expectations.util import render_evaluation_parameter_string
from great_expectations.render.renderer.renderer import renderer
from great_expectations.render.types import RenderedStringTemplateContent
from great_expectations.render.util import (
    num_to_str,
    parse_row_condition_string_pandas_engine,
    substitute_none_for_missing,
)
from great_expectations.validator.validation_graph import MetricConfiguration

logger = logging.getLogger(__name__)

try:
    import pyspark.sql.types as sparktypes
except ImportError as e:
    logger.debug(str(e))
    logger.debug(
        "Unable to load spark context; install optional spark dependency for support."
    )

try:
    import sqlalchemy as sa
    from sqlalchemy.dialects import registry

except ImportError:
    logger.debug(
        "Unable to load SqlAlchemy context; install optional sqlalchemy dependency for support"
    )
    sa = None
    registry = None

try:
    import sqlalchemy_redshift.dialect
except ImportError:
    sqlalchemy_redshift = None

try:
    import pybigquery.sqlalchemy_bigquery

    ###
    # NOTE: 20210816 - jdimatteo: A convention we rely on is for SqlAlchemy dialects
    # to define an attribute "dialect". A PR has been submitted to fix this upstream
    # with https://github.com/googleapis/python-bigquery-sqlalchemy/pull/251. If that
    # fix isn't present, add this "dialect" attribute here:
    if not hasattr(pybigquery.sqlalchemy_bigquery, "dialect"):
        pybigquery.sqlalchemy_bigquery.dialect = (
            pybigquery.sqlalchemy_bigquery.BigQueryDialect
        )

    # Sometimes "pybigquery.sqlalchemy_bigquery" fails to self-register in Azure (our CI/CD pipeline) in certain cases, so we do it explicitly.
    # (see https://stackoverflow.com/questions/53284762/nosuchmoduleerror-cant-load-plugin-sqlalchemy-dialectssnowflake)
    registry.register("bigquery", "pybigquery.sqlalchemy_bigquery", "dialect")
    try:
        getattr(pybigquery.sqlalchemy_bigquery, "INTEGER")
        bigquery_types_tuple = None
    except AttributeError:
        # In older versions of the pybigquery driver, types were not exported, so we use a hack
        logger.warning(
            "Old pybigquery driver version detected. Consider upgrading to 0.4.14 or later."
        )
        from collections import namedtuple

        BigQueryTypes = namedtuple(
            "BigQueryTypes", sorted(pybigquery.sqlalchemy_bigquery._type_map)
        )
        bigquery_types_tuple = BigQueryTypes(**pybigquery.sqlalchemy_bigquery._type_map)
except ImportError:
    bigquery_types_tuple = None
    pybigquery = None


class ExpectColumnValuesToBeOfType(ColumnMapExpectation):
    """Expect a column to contain values of a specified data type.

    expect_column_values_to_be_of_type is a :func:`column_aggregate_expectation \
    <great_expectations.dataset.dataset.MetaDataset.column_aggregate_expectation>` for typed-column backends,
    and also for PandasDataset where the column dtype and provided type_ are unambiguous constraints (any dtype
    except 'object' or dtype of 'object' with type_ specified as 'object').

    For PandasDataset columns with dtype of 'object' expect_column_values_to_be_of_type is a
    :func:`column_map_expectation <great_expectations.dataset.dataset.MetaDataset.column_map_expectation>` and will
    independently check each row's type.

    Args:
        column (str): \
            The column name.
        type\\_ (str): \
            A string representing the data type that each column should have as entries. Valid types are defined
            by the current backend implementation and are dynamically loaded. For example, valid types for
            PandasDataset include any numpy dtype values (such as 'int64') or native python types (such as 'int'),
            whereas valid types for a SqlAlchemyDataset include types named by the current driver such as 'INTEGER'
            in most SQL dialects and 'TEXT' in dialects such as postgresql. Valid types for SparkDFDataset include
            'StringType', 'BooleanType' and other pyspark-defined type names.


    Keyword Args:
        mostly (None or a float between 0 and 1): \
            Return `"success": True` if at least mostly fraction of values match the expectation. \
            For more detail, see :ref:`mostly`.

    Other Parameters:
        result_format (str or None): \
            Which output mode to use: `BOOLEAN_ONLY`, `BASIC`, `COMPLETE`, or `SUMMARY`.
            For more detail, see :ref:`result_format <result_format>`.
        include_config (boolean): \
            If True, then include the expectation config as part of the result object. \
            For more detail, see :ref:`include_config`.
        catch_exceptions (boolean or None): \
            If True, then catch exceptions and include them as part of the result object. \
            For more detail, see :ref:`catch_exceptions`.
        meta (dict or None): \
            A JSON-serializable dictionary (nesting allowed) that will be included in the output without \
            modification. For more detail, see :ref:`meta`.

    Returns:
        An ExpectationSuiteValidationResult

        Exact fields vary depending on the values passed to :ref:`result_format <result_format>` and
        :ref:`include_config`, :ref:`catch_exceptions`, and :ref:`meta`.

    See also:
        :func:`expect_column_values_to_be_in_type_list \
        <great_expectations.dataset.dataset.Dataset.expect_column_values_to_be_in_type_list>`

    """

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column map expectation"],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    map_metric = "column_values.of_type"
    success_keys = (
        "type_",
        "mostly",
    )
    default_kwarg_values = {
        "type_": None,
        "mostly": 1,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": False,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)
        try:
            assert "type_" in configuration.kwargs, "type_ is required"
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
        return True

    @classmethod
    @renderer(renderer_type="renderer.prescriptive")
    @render_evaluation_parameter_string
    def _prescriptive_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")

        params = substitute_none_for_missing(
            configuration.kwargs,
            ["column", "type_", "mostly", "row_condition", "condition_parser"],
        )

        if params["mostly"] is not None:
            params["mostly_pct"] = num_to_str(
                params["mostly"] * 100, precision=15, no_scientific=True
            )
            # params["mostly_pct"] = "{:.14f}".format(params["mostly"]*100).rstrip("0").rstrip(".")
            template_str = (
                "values must be of type $type_, at least $mostly_pct % of the time."
            )
        else:
            template_str = "values must be of type $type_."

        if include_column_name:
            template_str = "$column " + template_str

        if params["row_condition"] is not None:
            (
                conditional_template_str,
                conditional_params,
            ) = parse_row_condition_string_pandas_engine(params["row_condition"])
            template_str = conditional_template_str + ", then " + template_str
            params.update(conditional_params)

        return [
            RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {
                        "template": template_str,
                        "params": params,
                        "styling": styling,
                    },
                }
            )
        ]

    def _validate_pandas(
        self,
        actual_column_type,
        expected_type,
    ):
        if expected_type is None:
            success = True
        else:
            comp_types = []

            try:
                comp_types.append(np.dtype(expected_type).type)
            except TypeError:
                try:
                    pd_type = getattr(pd, expected_type)
                    if isinstance(pd_type, type):
                        comp_types.append(pd_type)
                except AttributeError:
                    pass

                try:
                    pd_type = getattr(pd.core.dtypes.dtypes, expected_type)
                    if isinstance(pd_type, type):
                        comp_types.append(pd_type)
                except AttributeError:
                    pass

            native_type = _native_type_type_map(expected_type)
            if native_type is not None:
                comp_types.extend(native_type)

            success = actual_column_type.type in comp_types

        return {
            "success": success,
            "result": {"observed_value": actual_column_type.type.__name__},
        }

    def _validate_sqlalchemy(self, actual_column_type, expected_type, execution_engine):
        # Our goal is to be as explicit as possible. We will match the dialect
        # if that is possible. If there is no dialect available, we *will*
        # match against a top-level SqlAlchemy type.
        #
        # This is intended to be a conservative approach.
        #
        # In particular, we *exclude* types that would be valid under an ORM
        # such as "float" for postgresql with this approach

        if expected_type is None:
            success = True
        else:
            types = []
            type_module = _get_dialect_type_module(execution_engine=execution_engine)
            try:
                potential_type = getattr(type_module, expected_type)
                # In the case of the PyAthena dialect we need to verify that
                # the type returned is indeed a type and not an instance.
                if not inspect.isclass(potential_type):
                    type_class = type(potential_type)
                else:
                    type_class = potential_type
                types.append(type_class)
            except AttributeError:
                logger.debug("Unrecognized type: %s" % expected_type)
            if len(types) == 0:
                logger.warning(
                    "No recognized sqlalchemy types in type_list for current dialect."
                )
            types = tuple(types)
            success = isinstance(actual_column_type, types)

        return {
            "success": success,
            "result": {"observed_value": type(actual_column_type).__name__},
        }

    def _validate_spark(
        self,
        actual_column_type,
        expected_type,
    ):
        if expected_type is None:
            success = True
        else:
            types = []
            try:
                type_class = getattr(sparktypes, expected_type)
                types.append(type_class)
            except AttributeError:
                logger.debug("Unrecognized type: %s" % expected_type)
            if len(types) == 0:
                raise ValueError("No recognized spark types in expected_types_list")
            types = tuple(types)
            success = isinstance(actual_column_type, types)
        return {
            "success": success,
            "result": {"observed_value": type(actual_column_type).__name__},
        }

    def get_validation_dependencies(
        self,
        configuration: Optional[ExpectationConfiguration] = None,
        execution_engine: Optional[ExecutionEngine] = None,
        runtime_configuration: Optional[dict] = None,
    ):
        # This calls TableExpectation.get_validation_dependencies to set baseline dependencies for the aggregate version
        # of the expectation.
        # We need to keep this as super(ColumnMapExpectation, self), which calls
        # TableExpectation.get_validation_dependencies instead of ColumnMapExpectation.get_validation_dependencies.
        # This is because the map version of this expectation is only supported for Pandas, so we want the aggregate
        # version for the other backends.
        dependencies = super(ColumnMapExpectation, self).get_validation_dependencies(
            configuration, execution_engine, runtime_configuration
        )

        # Only PandasExecutionEngine supports the column map version of the expectation.
        if isinstance(execution_engine, PandasExecutionEngine):
            column_name = configuration.kwargs.get("column")
            expected_type = configuration.kwargs.get("type_")
            metric_kwargs = get_metric_kwargs(
                configuration=configuration,
                metric_name="table.column_types",
                runtime_configuration=runtime_configuration,
            )
            metric_domain_kwargs = metric_kwargs.get("metric_domain_kwargs")
            metric_value_kwargs = metric_kwargs.get("metric_value_kwargs")
            table_column_types_configuration = MetricConfiguration(
                "table.column_types",
                metric_domain_kwargs=metric_domain_kwargs,
                metric_value_kwargs=metric_value_kwargs,
            )
            actual_column_types_list = execution_engine.resolve_metrics(
                [table_column_types_configuration]
            )[table_column_types_configuration.id]
            actual_column_type = [
                type_dict["type"]
                for type_dict in actual_column_types_list
                if type_dict["name"] == column_name
            ][0]

            # only use column map version if column dtype is object
            if actual_column_type.type.__name__ == "object_" and expected_type not in [
                "object",
                "object_",
                "O",
                None,
            ]:
                # this resets dependencies using  ColumnMapExpectation.get_validation_dependencies
                dependencies = super().get_validation_dependencies(
                    configuration, execution_engine, runtime_configuration
                )

        # this adds table.column_types dependency for both aggregate and map versions of expectation
        column_types_metric_kwargs = get_metric_kwargs(
            metric_name="table.column_types",
            configuration=configuration,
            runtime_configuration=runtime_configuration,
        )
        dependencies["metrics"]["table.column_types"] = MetricConfiguration(
            metric_name="table.column_types",
            metric_domain_kwargs=column_types_metric_kwargs["metric_domain_kwargs"],
            metric_value_kwargs=column_types_metric_kwargs["metric_value_kwargs"],
        )

        return dependencies

    def _validate(
        self,
        configuration: ExpectationConfiguration,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine: ExecutionEngine = None,
    ):
        column_name = configuration.kwargs.get("column")
        expected_type = configuration.kwargs.get("type_")
        actual_column_types_list = metrics.get("table.column_types")
        actual_column_type = [
            type_dict["type"]
            for type_dict in actual_column_types_list
            if type_dict["name"] == column_name
        ][0]

        if isinstance(execution_engine, PandasExecutionEngine):
            # only PandasExecutionEngine supports map version of expectation and
            # only when column type is object
            if actual_column_type.type.__name__ == "object_" and expected_type not in [
                "object",
                "object_",
                "O",
                None,
            ]:
                # this calls ColumnMapMetric._validate
                return super()._validate(
                    configuration, metrics, runtime_configuration, execution_engine
                )
            return self._validate_pandas(
                actual_column_type=actual_column_type, expected_type=expected_type
            )
        elif isinstance(execution_engine, SqlAlchemyExecutionEngine):
            return self._validate_sqlalchemy(
                actual_column_type=actual_column_type,
                expected_type=expected_type,
                execution_engine=execution_engine,
            )
        elif isinstance(execution_engine, SparkDFExecutionEngine):
            return self._validate_spark(
                actual_column_type=actual_column_type, expected_type=expected_type
            )


def _get_dialect_type_module(
    execution_engine,
):
    if execution_engine.dialect_module is None:
        logger.warning(
            "No sqlalchemy dialect found; relying in top-level sqlalchemy types."
        )
        return sa
    try:
        # Redshift does not (yet) export types to top level; only recognize base SA types
        if isinstance(
            execution_engine.dialect_module,
            sqlalchemy_redshift.dialect.RedshiftDialect,
        ):
            return execution_engine.dialect_module.sa
    except (TypeError, AttributeError):
        pass

    # Bigquery works with newer versions, but use a patch if we had to define bigquery_types_tuple
    try:
        if (
            isinstance(
                execution_engine.dialect_module,
                pybigquery.sqlalchemy_bigquery.BigQueryDialect,
            )
            and bigquery_types_tuple is not None
        ):
            return bigquery_types_tuple
    except (TypeError, AttributeError):
        pass

    return execution_engine.dialect_module


def _native_type_type_map(type_):
    # We allow native python types in cases where the underlying type is "object":
    if type_.lower() == "none":
        return (type(None),)
    elif type_.lower() == "bool":
        return (bool,)
    elif type_.lower() in ["int", "long"]:
        return (int,)
    elif type_.lower() == "float":
        return (float,)
    elif type_.lower() == "bytes":
        return (bytes,)
    elif type_.lower() == "complex":
        return (complex,)
    elif type_.lower() in ["str", "string_types"]:
        return (str,)
    elif type_.lower() == "list":
        return (list,)
    elif type_.lower() == "dict":
        return (dict,)
    elif type_.lower() == "unicode":
        return None
