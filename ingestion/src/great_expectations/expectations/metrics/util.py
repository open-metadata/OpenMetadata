import logging
from typing import Any, Dict, List, Optional

import numpy as np
from dateutil.parser import parse

from great_expectations.execution_engine.util import check_sql_engine_dialect

try:
    import psycopg2
    import sqlalchemy.dialects.postgresql.psycopg2 as sqlalchemy_psycopg2
except (ImportError, KeyError):
    sqlalchemy_psycopg2 = None

try:
    import snowflake
except ImportError:
    snowflake = None

try:
    import sqlalchemy as sa
    from sqlalchemy.dialects import registry
    from sqlalchemy.engine import Engine, reflection
    from sqlalchemy.engine.interfaces import Dialect
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.sql import Select
    from sqlalchemy.sql.elements import BinaryExpression, TextClause, literal
    from sqlalchemy.sql.operators import custom_op
except ImportError:
    sa = None
    registry = None
    Select = None
    BinaryExpression = None
    TextClause = None
    literal = None
    custom_op = None
    Engine = None
    reflection = None
    Dialect = None
    OperationalError = None

try:
    import sqlalchemy_redshift
except ImportError:
    sqlalchemy_redshift = None

logger = logging.getLogger(__name__)

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


def get_dialect_regex_expression(column, regex, dialect, positive=True):
    try:
        # postgres
        if issubclass(dialect.dialect, sa.dialects.postgresql.dialect):
            if positive:
                return BinaryExpression(column, literal(regex), custom_op("~"))
            else:
                return BinaryExpression(column, literal(regex), custom_op("!~"))
    except AttributeError:
        pass

    try:
        # redshift
        if issubclass(dialect.dialect, sqlalchemy_redshift.dialect.RedshiftDialect):
            if positive:
                return BinaryExpression(column, literal(regex), custom_op("~"))
            else:
                return BinaryExpression(column, literal(regex), custom_op("!~"))
    except (
        AttributeError,
        TypeError,
    ):  # TypeError can occur if the driver was not installed and so is None
        pass

    try:
        # MySQL
        if issubclass(dialect.dialect, sa.dialects.mysql.dialect):
            if positive:
                return BinaryExpression(column, literal(regex), custom_op("REGEXP"))
            else:
                return BinaryExpression(column, literal(regex), custom_op("NOT REGEXP"))
    except AttributeError:
        pass

    try:
        # Snowflake
        if issubclass(
            dialect.dialect,
            snowflake.sqlalchemy.snowdialect.SnowflakeDialect,
        ):
            if positive:
                return BinaryExpression(column, literal(regex), custom_op("RLIKE"))
            else:
                return BinaryExpression(column, literal(regex), custom_op("NOT RLIKE"))
    except (
        AttributeError,
        TypeError,
    ):  # TypeError can occur if the driver was not installed and so is None
        pass

    try:
        # Bigquery
        if hasattr(dialect, "BigQueryDialect"):
            if positive:
                return sa.func.REGEXP_CONTAINS(column, literal(regex))
            else:
                return sa.not_(sa.func.REGEXP_CONTAINS(column, literal(regex)))
    except (
        AttributeError,
        TypeError,
    ):  # TypeError can occur if the driver was not installed and so is None
        logger.debug(
            "Unable to load BigQueryDialect dialect while running get_dialect_regex_expression in expectations.metrics.util",
            exc_info=True,
        )
        pass

    return None


def _get_dialect_type_module(dialect=None):
    if dialect is None:
        logger.warning(
            "No sqlalchemy dialect found; relying in top-level sqlalchemy types."
        )
        return sa
    try:
        # Redshift does not (yet) export types to top level; only recognize base SA types
        if isinstance(dialect, sqlalchemy_redshift.dialect.RedshiftDialect):
            return dialect.sa
    except (TypeError, AttributeError):
        pass

    # Bigquery works with newer versions, but use a patch if we had to define bigquery_types_tuple
    try:
        if (
            isinstance(
                dialect,
                pybigquery.sqlalchemy_bigquery.BigQueryDialect,
            )
            and bigquery_types_tuple is not None
        ):
            return bigquery_types_tuple
    except (TypeError, AttributeError):
        pass

    return dialect


def attempt_allowing_relative_error(dialect):
    detected_redshift: bool = (
        sqlalchemy_redshift is not None
        and check_sql_engine_dialect(
            actual_sql_engine_dialect=dialect,
            candidate_sql_engine_dialect=sqlalchemy_redshift.dialect.RedshiftDialect,
        )
    )
    # noinspection PyTypeChecker
    detected_psycopg2: bool = (
        sqlalchemy_psycopg2 is not None
        and check_sql_engine_dialect(
            actual_sql_engine_dialect=dialect,
            candidate_sql_engine_dialect=sqlalchemy_psycopg2.PGDialect_psycopg2,
        )
    )
    return detected_redshift or detected_psycopg2


def is_column_present_in_table(
    engine: Engine,
    table_selectable: Select,
    column_name: str,
    schema_name: Optional[str] = None,
) -> bool:
    all_columns_metadata: Optional[
        List[Dict[str, Any]]
    ] = get_sqlalchemy_column_metadata(
        engine=engine, table_selectable=table_selectable, schema_name=schema_name
    )
    # Purposefully do not check for a NULL "all_columns_metadata" to insure that it must never happen.
    column_names: List[str] = [col_md["name"] for col_md in all_columns_metadata]
    return column_name in column_names


def get_sqlalchemy_column_metadata(
    engine: Engine, table_selectable: Select, schema_name: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    try:
        columns: List[Dict[str, Any]]

        inspector: reflection.Inspector = reflection.Inspector.from_engine(engine)
        try:
            # if a custom query was passed
            if isinstance(table_selectable, TextClause):
                columns = table_selectable.columns().columns
            else:
                columns = inspector.get_columns(
                    table_selectable,
                    schema=schema_name,
                )
        except (
            KeyError,
            AttributeError,
            sa.exc.NoSuchTableError,
            sa.exc.ProgrammingError,
        ):
            # we will get a KeyError for temporary tables, since
            # reflection will not find the temporary schema
            columns = column_reflection_fallback(
                selectable=table_selectable,
                dialect=engine.dialect,
                sqlalchemy_engine=engine,
            )

        # Use fallback because for mssql reflection doesn't throw an error but returns an empty list
        if len(columns) == 0:
            columns = column_reflection_fallback(
                selectable=table_selectable,
                dialect=engine.dialect,
                sqlalchemy_engine=engine,
            )

        return columns
    except AttributeError:
        return None


def column_reflection_fallback(
    selectable: Select, dialect: Dialect, sqlalchemy_engine: Engine
) -> List[Dict[str, str]]:
    """If we can't reflect the table, use a query to at least get column names."""
    col_info_dict_list: List[Dict[str, str]]
    if dialect.name.lower() == "mssql":
        # Get column names and types from the database
        # Reference: https://dataedo.com/kb/query/sql-server/list-table-columns-in-database
        columns_query: str = f"""
SELECT
    SCHEMA_NAME(tab.schema_id) AS schema_name,
    tab.name AS table_name,
    col.column_id AS column_id,
    col.name AS column_name,
    t.name AS column_data_type,
    col.max_length AS column_max_length,
    col.precision AS column_precision
FROM sys.tables AS tab
    INNER JOIN sys.columns AS col
    ON tab.object_id = col.object_id
    LEFT JOIN sys.types AS t
    ON col.user_type_id = t.user_type_id
WHERE tab.name = '{selectable}'
ORDER BY schema_name,
    table_name,
    column_id
"""
        col_info_query: TextClause = sa.text(columns_query)
        col_info_tuples_list: List[tuple] = sqlalchemy_engine.execute(
            col_info_query
        ).fetchall()
        # type_module = _get_dialect_type_module(dialect=dialect)
        col_info_dict_list: List[Dict[str, str]] = [
            {
                "name": column_name,
                # "type": getattr(type_module, column_data_type.upper())(),
                "type": column_data_type.upper(),
            }
            for schema_name, table_name, column_id, column_name, column_data_type, column_max_length, column_precision in col_info_tuples_list
        ]
    else:
        # if a custom query was passed
        if isinstance(selectable, TextClause):
            query: TextClause = selectable
        else:
            query: Select = sa.select([sa.text("*")]).select_from(selectable).limit(1)
        result_object = sqlalchemy_engine.execute(query)
        # noinspection PyProtectedMember
        col_names: List[str] = result_object._metadata.keys
        col_info_dict_list = [{"name": col_name} for col_name in col_names]
    return col_info_dict_list


def parse_value_set(value_set):
    parsed_value_set = [
        parse(value) if isinstance(value, str) else value for value in value_set
    ]
    return parsed_value_set


def get_dialect_like_pattern_expression(column, dialect, like_pattern, positive=True):
    dialect_supported: bool = False

    try:
        # Bigquery
        if hasattr(dialect, "BigQueryDialect"):
            dialect_supported = True
    except (
        AttributeError,
        TypeError,
    ):  # TypeError can occur if the driver was not installed and so is None
        pass

    if issubclass(
        dialect.dialect,
        (
            sa.dialects.sqlite.dialect,
            sa.dialects.postgresql.dialect,
            sa.dialects.mysql.dialect,
            sa.dialects.mssql.dialect,
        ),
    ):
        dialect_supported = True

    try:
        if isinstance(dialect, sqlalchemy_redshift.dialect.RedshiftDialect):
            dialect_supported = True
    except (AttributeError, TypeError):
        pass

    if dialect_supported:
        try:
            if positive:
                return column.like(literal(like_pattern))
            else:
                return sa.not_(column.like(literal(like_pattern)))
        except AttributeError:
            pass

    return None


def validate_distribution_parameters(distribution, params):
    """Ensures that necessary parameters for a distribution are present and that all parameters are sensical.

       If parameters necessary to construct a distribution are missing or invalid, this function raises ValueError\
       with an informative description. Note that 'loc' and 'scale' are optional arguments, and that 'scale'\
       must be positive.

       Args:
           distribution (string): \
               The scipy distribution name, e.g. normal distribution is 'norm'.
           params (dict or list): \
               The distribution shape parameters in a named dictionary or positional list form following the scipy \
               cdf argument scheme.

               params={'mean': 40, 'std_dev': 5} or params=[40, 5]

       Exceptions:
           ValueError: \
               With an informative description, usually when necessary parameters are omitted or are invalid.

    """

    norm_msg = (
        "norm distributions require 0 parameters and optionally 'mean', 'std_dev'."
    )
    beta_msg = "beta distributions require 2 positive parameters 'alpha', 'beta' and optionally 'loc', 'scale'."
    gamma_msg = "gamma distributions require 1 positive parameter 'alpha' and optionally 'loc','scale'."
    # poisson_msg = "poisson distributions require 1 positive parameter 'lambda' and optionally 'loc'."
    uniform_msg = (
        "uniform distributions require 0 parameters and optionally 'loc', 'scale'."
    )
    chi2_msg = "chi2 distributions require 1 positive parameter 'df' and optionally 'loc', 'scale'."
    expon_msg = (
        "expon distributions require 0 parameters and optionally 'loc', 'scale'."
    )

    if distribution not in [
        "norm",
        "beta",
        "gamma",
        "poisson",
        "uniform",
        "chi2",
        "expon",
    ]:
        raise AttributeError("Unsupported  distribution provided: %s" % distribution)

    if isinstance(params, dict):
        # `params` is a dictionary
        if params.get("std_dev", 1) <= 0 or params.get("scale", 1) <= 0:
            raise ValueError("std_dev and scale must be positive.")

        # alpha and beta are required and positive
        if distribution == "beta" and (
            params.get("alpha", -1) <= 0 or params.get("beta", -1) <= 0
        ):
            raise ValueError("Invalid parameters: %s" % beta_msg)

        # alpha is required and positive
        elif distribution == "gamma" and params.get("alpha", -1) <= 0:
            raise ValueError("Invalid parameters: %s" % gamma_msg)

        # lambda is a required and positive
        # elif distribution == 'poisson' and params.get('lambda', -1) <= 0:
        #    raise ValueError("Invalid parameters: %s" %poisson_msg)

        # df is necessary and required to be positive
        elif distribution == "chi2" and params.get("df", -1) <= 0:
            raise ValueError("Invalid parameters: %s:" % chi2_msg)

    elif isinstance(params, tuple) or isinstance(params, list):
        scale = None

        # `params` is a tuple or a list
        if distribution == "beta":
            if len(params) < 2:
                raise ValueError("Missing required parameters: %s" % beta_msg)
            if params[0] <= 0 or params[1] <= 0:
                raise ValueError("Invalid parameters: %s" % beta_msg)
            if len(params) == 4:
                scale = params[3]
            elif len(params) > 4:
                raise ValueError("Too many parameters provided: %s" % beta_msg)

        elif distribution == "norm":
            if len(params) > 2:
                raise ValueError("Too many parameters provided: %s" % norm_msg)
            if len(params) == 2:
                scale = params[1]

        elif distribution == "gamma":
            if len(params) < 1:
                raise ValueError("Missing required parameters: %s" % gamma_msg)
            if len(params) == 3:
                scale = params[2]
            if len(params) > 3:
                raise ValueError("Too many parameters provided: %s" % gamma_msg)
            elif params[0] <= 0:
                raise ValueError("Invalid parameters: %s" % gamma_msg)

        # elif distribution == 'poisson':
        #    if len(params) < 1:
        #        raise ValueError("Missing required parameters: %s" %poisson_msg)
        #   if len(params) > 2:
        #        raise ValueError("Too many parameters provided: %s" %poisson_msg)
        #    elif params[0] <= 0:
        #        raise ValueError("Invalid parameters: %s" %poisson_msg)

        elif distribution == "uniform":
            if len(params) == 2:
                scale = params[1]
            if len(params) > 2:
                raise ValueError("Too many arguments provided: %s" % uniform_msg)

        elif distribution == "chi2":
            if len(params) < 1:
                raise ValueError("Missing required parameters: %s" % chi2_msg)
            elif len(params) == 3:
                scale = params[2]
            elif len(params) > 3:
                raise ValueError("Too many arguments provided: %s" % chi2_msg)
            if params[0] <= 0:
                raise ValueError("Invalid parameters: %s" % chi2_msg)

        elif distribution == "expon":

            if len(params) == 2:
                scale = params[1]
            if len(params) > 2:
                raise ValueError("Too many arguments provided: %s" % expon_msg)

        if scale is not None and scale <= 0:
            raise ValueError("std_dev and scale must be positive.")

    else:
        raise ValueError(
            "params must be a dict or list, or use ge.dataset.util.infer_distribution_parameters(data, distribution)"
        )

    return


def _scipy_distribution_positional_args_from_dict(distribution, params):
    """Helper function that returns positional arguments for a scipy distribution using a dict of parameters.

       See the `cdf()` function here https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.beta.html#Methods\
       to see an example of scipy's positional arguments. This function returns the arguments specified by the \
       scipy.stat.distribution.cdf() for that distribution.

       Args:
           distribution (string): \
               The scipy distribution name.
           params (dict): \
               A dict of named parameters.

       Raises:
           AttributeError: \
               If an unsupported distribution is provided.
    """

    params["loc"] = params.get("loc", 0)
    if "scale" not in params:
        params["scale"] = 1

    if distribution == "norm":
        return params["mean"], params["std_dev"]
    elif distribution == "beta":
        return params["alpha"], params["beta"], params["loc"], params["scale"]
    elif distribution == "gamma":
        return params["alpha"], params["loc"], params["scale"]
    # elif distribution == 'poisson':
    #    return params['lambda'], params['loc']
    elif distribution == "uniform":
        return params["min"], params["max"]
    elif distribution == "chi2":
        return params["df"], params["loc"], params["scale"]
    elif distribution == "expon":
        return params["loc"], params["scale"]


def is_valid_continuous_partition_object(partition_object):
    """Tests whether a given object is a valid continuous partition object. See :ref:`partition_object`.

    :param partition_object: The partition_object to evaluate
    :return: Boolean
    """
    if (
        (partition_object is None)
        or ("weights" not in partition_object)
        or ("bins" not in partition_object)
    ):
        return False

    if "tail_weights" in partition_object:
        if len(partition_object["tail_weights"]) != 2:
            return False
        comb_weights = partition_object["tail_weights"] + partition_object["weights"]
    else:
        comb_weights = partition_object["weights"]

    ## TODO: Consider adding this check to migrate to the tail_weights structure of partition objects
    # if (partition_object['bins'][0] == -np.inf) or (partition_object['bins'][-1] == np.inf):
    #     return False

    # Expect one more bin edge than weight; all bin edges should be monotonically increasing; weights should sum to one
    return (
        (len(partition_object["bins"]) == (len(partition_object["weights"]) + 1))
        and np.all(np.diff(partition_object["bins"]) > 0)
        and np.allclose(np.sum(comb_weights), 1.0)
    )
