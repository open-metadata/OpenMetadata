import copy
import locale
import logging
import os
import platform
import random
import string
import tempfile
import threading
from functools import wraps
from types import ModuleType
from typing import Dict, List, Optional, Union

import numpy as np
import pandas as pd
from dateutil.parser import parse
from pandas import DataFrame as pandas_DataFrame

from great_expectations.core import (
    ExpectationConfigurationSchema,
    ExpectationSuite,
    ExpectationSuiteSchema,
    ExpectationSuiteValidationResultSchema,
    ExpectationValidationResultSchema,
)
from great_expectations.core.batch import Batch, BatchDefinition
from great_expectations.core.util import (
    get_or_create_spark_application,
    get_sql_dialect_floating_point_infinity_value,
)
from great_expectations.dataset import PandasDataset, SparkDFDataset, SqlAlchemyDataset
from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.execution_engine.sparkdf_batch_data import SparkDFBatchData
from great_expectations.execution_engine.sqlalchemy_batch_data import (
    SqlAlchemyBatchData,
)
from great_expectations.profile import ColumnsExistProfiler
from great_expectations.util import import_library_module
from great_expectations.validator.validator import Validator

expectationValidationResultSchema = ExpectationValidationResultSchema()
expectationSuiteValidationResultSchema = ExpectationSuiteValidationResultSchema()
expectationConfigurationSchema = ExpectationConfigurationSchema()
expectationSuiteSchema = ExpectationSuiteSchema()


logger = logging.getLogger(__name__)

tmp_dir = str(tempfile.mkdtemp())


try:
    import sqlalchemy as sqlalchemy
    from sqlalchemy import create_engine

    # noinspection PyProtectedMember
    from sqlalchemy.engine import Engine
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    sqlalchemy = None
    create_engine = None
    Engine = None
    SQLAlchemyError = None
    logger.debug("Unable to load SqlAlchemy or one of its subclasses.")

try:
    from pyspark.sql import DataFrame as SparkDataFrame
    from pyspark.sql import SparkSession
except ImportError:
    SparkSession = None
    SparkDataFrame = type(None)

try:
    from pyspark.sql import DataFrame as spark_DataFrame
except ImportError:
    spark_DataFrame = type(None)

try:
    import sqlalchemy.dialects.sqlite as sqlitetypes
    from sqlalchemy.dialects.sqlite import dialect as sqliteDialect

    SQLITE_TYPES = {
        "VARCHAR": sqlitetypes.VARCHAR,
        "CHAR": sqlitetypes.CHAR,
        "INTEGER": sqlitetypes.INTEGER,
        "SMALLINT": sqlitetypes.SMALLINT,
        "DATETIME": sqlitetypes.DATETIME(truncate_microseconds=True),
        "DATE": sqlitetypes.DATE,
        "FLOAT": sqlitetypes.FLOAT,
        "BOOLEAN": sqlitetypes.BOOLEAN,
        "TIMESTAMP": sqlitetypes.TIMESTAMP,
    }
except (ImportError, KeyError):
    sqlitetypes = None
    sqliteDialect = None
    SQLITE_TYPES = {}

try:
    import pybigquery.sqlalchemy_bigquery
    import pybigquery.sqlalchemy_bigquery as BigQueryDialect

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
    sqlalchemy.dialects.registry.register(
        "bigquery", "pybigquery.sqlalchemy_bigquery", "dialect"
    )
    try:
        getattr(pybigquery.sqlalchemy_bigquery, "INTEGER")
        bigquery_types_tuple = {}
        BIGQUERY_TYPES = {
            "INTEGER": pybigquery.sqlalchemy_bigquery.INTEGER,
            "NUMERIC": pybigquery.sqlalchemy_bigquery.NUMERIC,
            "STRING": pybigquery.sqlalchemy_bigquery.STRING,
            "BIGNUMERIC": pybigquery.sqlalchemy_bigquery.BIGNUMERIC,
            "BYTES": pybigquery.sqlalchemy_bigquery.BYTES,
            "BOOL": pybigquery.sqlalchemy_bigquery.BOOL,
            "BOOLEAN": pybigquery.sqlalchemy_bigquery.BOOLEAN,
            "TIMESTAMP": pybigquery.sqlalchemy_bigquery.TIMESTAMP,
            "TIME": pybigquery.sqlalchemy_bigquery.TIME,
            "FLOAT": pybigquery.sqlalchemy_bigquery.FLOAT,
            "DATE": pybigquery.sqlalchemy_bigquery.DATE,
            "DATETIME": pybigquery.sqlalchemy_bigquery.DATETIME,
        }
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
except (ImportError, AttributeError):
    bigquery_types_tuple = None
    BigQueryDialect = None
    pybigquery = None


try:
    import sqlalchemy.dialects.postgresql as postgresqltypes
    from sqlalchemy.dialects.postgresql import dialect as postgresqlDialect

    POSTGRESQL_TYPES = {
        "TEXT": postgresqltypes.TEXT,
        "CHAR": postgresqltypes.CHAR,
        "INTEGER": postgresqltypes.INTEGER,
        "SMALLINT": postgresqltypes.SMALLINT,
        "BIGINT": postgresqltypes.BIGINT,
        "TIMESTAMP": postgresqltypes.TIMESTAMP,
        "DATE": postgresqltypes.DATE,
        "DOUBLE_PRECISION": postgresqltypes.DOUBLE_PRECISION,
        "BOOLEAN": postgresqltypes.BOOLEAN,
        "NUMERIC": postgresqltypes.NUMERIC,
    }
except (ImportError, KeyError):
    postgresqltypes = None
    postgresqlDialect = None
    POSTGRESQL_TYPES = {}

try:
    import sqlalchemy.dialects.mysql as mysqltypes
    from sqlalchemy.dialects.mysql import dialect as mysqlDialect

    MYSQL_TYPES = {
        "TEXT": mysqltypes.TEXT,
        "CHAR": mysqltypes.CHAR,
        "INTEGER": mysqltypes.INTEGER,
        "SMALLINT": mysqltypes.SMALLINT,
        "BIGINT": mysqltypes.BIGINT,
        "DATETIME": mysqltypes.DATETIME,
        "TIMESTAMP": mysqltypes.TIMESTAMP,
        "DATE": mysqltypes.DATE,
        "FLOAT": mysqltypes.FLOAT,
        "DOUBLE": mysqltypes.DOUBLE,
        "BOOLEAN": mysqltypes.BOOLEAN,
        "TINYINT": mysqltypes.TINYINT,
    }
except (ImportError, KeyError):
    mysqltypes = None
    mysqlDialect = None
    MYSQL_TYPES = {}

try:
    import sqlalchemy.dialects.mssql as mssqltypes
    from sqlalchemy.dialects.mssql import dialect as mssqlDialect

    MSSQL_TYPES = {
        "BIGINT": mssqltypes.BIGINT,
        "BINARY": mssqltypes.BINARY,
        "BIT": mssqltypes.BIT,
        "CHAR": mssqltypes.CHAR,
        "DATE": mssqltypes.DATE,
        "DATETIME": mssqltypes.DATETIME,
        "DATETIME2": mssqltypes.DATETIME2,
        "DATETIMEOFFSET": mssqltypes.DATETIMEOFFSET,
        "DECIMAL": mssqltypes.DECIMAL,
        "FLOAT": mssqltypes.FLOAT,
        "IMAGE": mssqltypes.IMAGE,
        "INTEGER": mssqltypes.INTEGER,
        "MONEY": mssqltypes.MONEY,
        "NCHAR": mssqltypes.NCHAR,
        "NTEXT": mssqltypes.NTEXT,
        "NUMERIC": mssqltypes.NUMERIC,
        "NVARCHAR": mssqltypes.NVARCHAR,
        "REAL": mssqltypes.REAL,
        "SMALLDATETIME": mssqltypes.SMALLDATETIME,
        "SMALLINT": mssqltypes.SMALLINT,
        "SMALLMONEY": mssqltypes.SMALLMONEY,
        "SQL_VARIANT": mssqltypes.SQL_VARIANT,
        "TEXT": mssqltypes.TEXT,
        "TIME": mssqltypes.TIME,
        "TIMESTAMP": mssqltypes.TIMESTAMP,
        "TINYINT": mssqltypes.TINYINT,
        "UNIQUEIDENTIFIER": mssqltypes.UNIQUEIDENTIFIER,
        "VARBINARY": mssqltypes.VARBINARY,
        "VARCHAR": mssqltypes.VARCHAR,
    }
except (ImportError, KeyError):
    mssqltypes = None
    mssqlDialect = None
    MSSQL_TYPES = {}


class SqlAlchemyConnectionManager:
    def __init__(self):
        self.lock = threading.Lock()
        self._connections = {}

    def get_engine(self, connection_string):
        if sqlalchemy is not None:
            with self.lock:
                if connection_string not in self._connections:
                    try:
                        engine = create_engine(connection_string)
                        conn = engine.connect()
                        self._connections[connection_string] = conn
                    except (ImportError, SQLAlchemyError):
                        print(
                            f"Unable to establish connection with {connection_string}"
                        )
                        raise
                return self._connections[connection_string]
        return None


connection_manager = SqlAlchemyConnectionManager()


class LockingConnectionCheck:
    def __init__(self, sa, connection_string):
        self.lock = threading.Lock()
        self.sa = sa
        self.connection_string = connection_string
        self._is_valid = None

    def is_valid(self):
        with self.lock:
            if self._is_valid is None:
                try:
                    engine = self.sa.create_engine(self.connection_string)
                    conn = engine.connect()
                    conn.close()
                    self._is_valid = True
                except (ImportError, self.sa.exc.SQLAlchemyError) as e:
                    print(f"{str(e)}")
                    self._is_valid = False
            return self._is_valid


def get_sqlite_connection_url(sqlite_db_path):
    url = "sqlite://"
    if sqlite_db_path is not None:
        extra_slash = ""
        if platform.system() != "Windows":
            extra_slash = "/"
        url = f"{url}/{extra_slash}{sqlite_db_path}"
    return url


def get_dataset(
    dataset_type,
    data,
    schemas=None,
    profiler=ColumnsExistProfiler,
    caching=True,
    table_name=None,
    sqlite_db_path=None,
):
    """Utility to create datasets for json-formatted tests"""
    df = pd.DataFrame(data)
    if dataset_type == "PandasDataset":
        if schemas and "pandas" in schemas:
            schema = schemas["pandas"]
            pandas_schema = {}
            for (key, value) in schema.items():
                # Note, these are just names used in our internal schemas to build datasets *for internal tests*
                # Further, some changes in pandas internal about how datetimes are created means to support pandas
                # pre- 0.25, we need to explicitly specify when we want timezone.

                # We will use timestamp for timezone-aware (UTC only) dates in our tests
                if value.lower() in ["timestamp", "datetime64[ns, tz]"]:
                    df[key] = pd.to_datetime(df[key], utc=True)
                    continue
                elif value.lower() in ["datetime", "datetime64", "datetime64[ns]"]:
                    df[key] = pd.to_datetime(df[key])
                    continue
                elif value.lower() in ["date"]:
                    df[key] = pd.to_datetime(df[key]).dt.date
                    value = "object"
                try:
                    type_ = np.dtype(value)
                except TypeError:
                    type_ = getattr(pd.core.dtypes.dtypes, value)
                    # If this raises AttributeError it's okay: it means someone built a bad test
                pandas_schema[key] = type_
            # pandas_schema = {key: np.dtype(value) for (key, value) in schemas["pandas"].items()}
            df = df.astype(pandas_schema)
        return PandasDataset(df, profiler=profiler, caching=caching)

    elif dataset_type == "sqlite":
        if not create_engine:
            return None

        engine = create_engine(get_sqlite_connection_url(sqlite_db_path=sqlite_db_path))

        # Add the data to the database as a new table

        sql_dtypes = {}
        if (
            schemas
            and "sqlite" in schemas
            and isinstance(engine.dialect, sqlitetypes.dialect)
        ):
            schema = schemas["sqlite"]
            sql_dtypes = {col: SQLITE_TYPES[dtype] for (col, dtype) in schema.items()}
            for col in schema:
                type_ = schema[col]
                if type_ in ["INTEGER", "SMALLINT", "BIGINT"]:
                    df[col] = pd.to_numeric(df[col], downcast="signed")
                elif type_ in ["FLOAT", "DOUBLE", "DOUBLE_PRECISION"]:
                    df[col] = pd.to_numeric(df[col])
                    min_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=True
                    )
                    max_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=False
                    )
                    for api_schema_type in ["api_np", "api_cast"]:
                        min_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=True
                        )
                        max_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=False
                        )
                        df.replace(
                            to_replace=[min_value_api, max_value_api],
                            value=[min_value_dbms, max_value_dbms],
                            inplace=True,
                        )
                elif type_ in ["DATETIME", "TIMESTAMP"]:
                    df[col] = pd.to_datetime(df[col])
                elif type_ in ["DATE"]:
                    df[col] = pd.to_datetime(df[col]).dt.date

        if table_name is None:
            table_name = generate_test_table_name()
        df.to_sql(
            name=table_name,
            con=engine,
            index=False,
            dtype=sql_dtypes,
            if_exists="replace",
        )

        # Build a SqlAlchemyDataset using that database
        return SqlAlchemyDataset(
            table_name, engine=engine, profiler=profiler, caching=caching
        )

    elif dataset_type == "postgresql":
        if not create_engine:
            return None

        # Create a new database
        db_hostname = os.getenv("GE_TEST_LOCAL_DB_HOSTNAME", "localhost")
        engine = connection_manager.get_engine(
            f"postgresql://postgres@{db_hostname}/test_ci"
        )
        sql_dtypes = {}
        if (
            schemas
            and "postgresql" in schemas
            and isinstance(engine.dialect, postgresqltypes.dialect)
        ):
            schema = schemas["postgresql"]
            sql_dtypes = {
                col: POSTGRESQL_TYPES[dtype] for (col, dtype) in schema.items()
            }
            for col in schema:
                type_ = schema[col]
                if type_ in ["INTEGER", "SMALLINT", "BIGINT"]:
                    df[col] = pd.to_numeric(df[col], downcast="signed")
                elif type_ in ["FLOAT", "DOUBLE", "DOUBLE_PRECISION"]:
                    df[col] = pd.to_numeric(df[col])
                    min_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=True
                    )
                    max_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=False
                    )
                    for api_schema_type in ["api_np", "api_cast"]:
                        min_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=True
                        )
                        max_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=False
                        )
                        df.replace(
                            to_replace=[min_value_api, max_value_api],
                            value=[min_value_dbms, max_value_dbms],
                            inplace=True,
                        )
                elif type_ in ["DATETIME", "TIMESTAMP"]:
                    df[col] = pd.to_datetime(df[col])
                elif type_ in ["DATE"]:
                    df[col] = pd.to_datetime(df[col]).dt.date

        if table_name is None:
            table_name = generate_test_table_name()
        df.to_sql(
            name=table_name,
            con=engine,
            index=False,
            dtype=sql_dtypes,
            if_exists="replace",
        )

        # Build a SqlAlchemyDataset using that database
        return SqlAlchemyDataset(
            table_name, engine=engine, profiler=profiler, caching=caching
        )

    elif dataset_type == "mysql":
        if not create_engine:
            return None

        db_hostname = os.getenv("GE_TEST_LOCAL_DB_HOSTNAME", "localhost")
        engine = create_engine(f"mysql+pymysql://root@{db_hostname}/test_ci")

        sql_dtypes = {}
        if (
            schemas
            and "mysql" in schemas
            and isinstance(engine.dialect, mysqltypes.dialect)
        ):
            schema = schemas["mysql"]
            sql_dtypes = {col: MYSQL_TYPES[dtype] for (col, dtype) in schema.items()}
            for col in schema:
                type_ = schema[col]
                if type_ in ["INTEGER", "SMALLINT", "BIGINT"]:
                    df[col] = pd.to_numeric(df[col], downcast="signed")
                elif type_ in ["FLOAT", "DOUBLE", "DOUBLE_PRECISION"]:
                    df[col] = pd.to_numeric(df[col])
                    min_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=True
                    )
                    max_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=False
                    )
                    for api_schema_type in ["api_np", "api_cast"]:
                        min_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=True
                        )
                        max_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=False
                        )
                        df.replace(
                            to_replace=[min_value_api, max_value_api],
                            value=[min_value_dbms, max_value_dbms],
                            inplace=True,
                        )
                elif type_ in ["DATETIME", "TIMESTAMP"]:
                    df[col] = pd.to_datetime(df[col])
                elif type_ in ["DATE"]:
                    df[col] = pd.to_datetime(df[col]).dt.date

        if table_name is None:
            table_name = generate_test_table_name()
        df.to_sql(
            name=table_name,
            con=engine,
            index=False,
            dtype=sql_dtypes,
            if_exists="replace",
        )

        # Will - 20210126
        # For mysql we want our tests to know when a temp_table is referred to more than once in the
        # same query. This has caused problems in expectations like expect_column_values_to_be_unique().
        # Here we instantiate a SqlAlchemyDataset with a custom_sql, which causes a temp_table to be created,
        # rather than referring the table by name.
        custom_sql = "SELECT * FROM " + table_name
        return SqlAlchemyDataset(
            custom_sql=custom_sql, engine=engine, profiler=profiler, caching=caching
        )
    elif dataset_type == "bigquery":
        if not create_engine:
            return None
        engine = _create_bigquery_engine()
        schema = None
        if schemas and dataset_type in schemas:
            schema = schemas[dataset_type]
            # BigQuery does not allow for column names to have spaces
            schema = {k.replace(" ", "_"): v for k, v in schema.items()}

        df.columns = df.columns.str.replace(" ", "_")

        if table_name is None:
            table_name = generate_test_table_name()
        df.to_sql(
            name=table_name,
            con=engine,
            index=False,
            if_exists="replace",
        )
        custom_sql = f"SELECT * FROM {_bigquery_dataset()}.{table_name}"
        return SqlAlchemyDataset(
            custom_sql=custom_sql, engine=engine, profiler=profiler, caching=caching
        )

    elif dataset_type == "mssql":
        if not create_engine:
            return None

        db_hostname = os.getenv("GE_TEST_LOCAL_DB_HOSTNAME", "localhost")
        engine = create_engine(
            f"mssql+pyodbc://sa:ReallyStrongPwd1234%^&*@{db_hostname}:1433/test_ci?"
            "driver=ODBC Driver 17 for SQL Server&charset=utf8&autocommit=true",
            # echo=True,
        )

        # If "autocommit" is not desired to be on by default, then use the following pattern when explicit "autocommit"
        # is desired (e.g., for temporary tables, "autocommit" is off by default, so the override option may be useful).
        # engine.execute(sa.text(sql_query_string).execution_options(autocommit=True))

        sql_dtypes = {}
        if (
            schemas
            and dataset_type in schemas
            and isinstance(engine.dialect, mssqltypes.dialect)
        ):
            schema = schemas[dataset_type]
            sql_dtypes = {col: MSSQL_TYPES[dtype] for (col, dtype) in schema.items()}
            for col in schema:
                type_ = schema[col]
                if type_ in ["INTEGER", "SMALLINT", "BIGINT"]:
                    df[col] = pd.to_numeric(df[col], downcast="signed")
                elif type_ in ["FLOAT"]:
                    df[col] = pd.to_numeric(df[col])
                    min_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=True
                    )
                    max_value_dbms = get_sql_dialect_floating_point_infinity_value(
                        schema=dataset_type, negative=False
                    )
                    for api_schema_type in ["api_np", "api_cast"]:
                        min_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=True
                        )
                        max_value_api = get_sql_dialect_floating_point_infinity_value(
                            schema=api_schema_type, negative=False
                        )
                        df.replace(
                            to_replace=[min_value_api, max_value_api],
                            value=[min_value_dbms, max_value_dbms],
                            inplace=True,
                        )
                elif type_ in ["DATETIME", "TIMESTAMP"]:
                    df[col] = pd.to_datetime(df[col])
                elif type_ in ["DATE"]:
                    df[col] = pd.to_datetime(df[col]).dt.date

        if table_name is None:
            table_name = generate_test_table_name()
        df.to_sql(
            name=table_name,
            con=engine,
            index=False,
            dtype=sql_dtypes,
            if_exists="replace",
        )

        # Build a SqlAlchemyDataset using that database
        return SqlAlchemyDataset(
            table_name, engine=engine, profiler=profiler, caching=caching
        )

    elif dataset_type == "SparkDFDataset":
        import pyspark.sql.types as sparktypes

        SPARK_TYPES = {
            "StringType": sparktypes.StringType,
            "IntegerType": sparktypes.IntegerType,
            "LongType": sparktypes.LongType,
            "DateType": sparktypes.DateType,
            "TimestampType": sparktypes.TimestampType,
            "FloatType": sparktypes.FloatType,
            "DoubleType": sparktypes.DoubleType,
            "BooleanType": sparktypes.BooleanType,
            "DataType": sparktypes.DataType,
            "NullType": sparktypes.NullType,
        }
        spark = get_or_create_spark_application(
            spark_config={
                "spark.sql.catalogImplementation": "hive",
                "spark.executor.memory": "450m",
                # "spark.driver.allowMultipleContexts": "true",  # This directive does not appear to have any effect.
            }
        )
        # We need to allow null values in some column types that do not support them natively, so we skip
        # use of df in this case.
        data_reshaped = list(
            zip(*(v for _, v in data.items()))
        )  # create a list of rows
        if schemas and "spark" in schemas:
            schema = schemas["spark"]
            # sometimes first method causes Spark to throw a TypeError
            try:
                spark_schema = sparktypes.StructType(
                    [
                        sparktypes.StructField(
                            column, SPARK_TYPES[schema[column]](), True
                        )
                        for column in schema
                    ]
                )
                # We create these every time, which is painful for testing
                # However nuance around null treatment as well as the desire
                # for real datetime support in tests makes this necessary
                data = copy.deepcopy(data)
                if "ts" in data:
                    print(data)
                    print(schema)
                for col in schema:
                    type_ = schema[col]
                    if type_ in ["IntegerType", "LongType"]:
                        # Ints cannot be None...but None can be valid in Spark (as Null)
                        vals = []
                        for val in data[col]:
                            if val is None:
                                vals.append(val)
                            else:
                                vals.append(int(val))
                        data[col] = vals
                    elif type_ in ["FloatType", "DoubleType"]:
                        vals = []
                        for val in data[col]:
                            if val is None:
                                vals.append(val)
                            else:
                                vals.append(float(val))
                        data[col] = vals
                    elif type_ in ["DateType", "TimestampType"]:
                        vals = []
                        for val in data[col]:
                            if val is None:
                                vals.append(val)
                            else:
                                vals.append(parse(val))
                        data[col] = vals
                # Do this again, now that we have done type conversion using the provided schema
                data_reshaped = list(
                    zip(*(v for _, v in data.items()))
                )  # create a list of rows
                spark_df = spark.createDataFrame(data_reshaped, schema=spark_schema)
            except TypeError:
                string_schema = sparktypes.StructType(
                    [
                        sparktypes.StructField(column, sparktypes.StringType())
                        for column in schema
                    ]
                )
                spark_df = spark.createDataFrame(data_reshaped, string_schema)
                for c in spark_df.columns:
                    spark_df = spark_df.withColumn(
                        c, spark_df[c].cast(SPARK_TYPES[schema[c]]())
                    )
        elif len(data_reshaped) == 0:
            # if we have an empty dataset and no schema, need to assign an arbitrary type
            columns = list(data.keys())
            spark_schema = sparktypes.StructType(
                [
                    sparktypes.StructField(column, sparktypes.StringType())
                    for column in columns
                ]
            )
            spark_df = spark.createDataFrame(data_reshaped, spark_schema)
        else:
            # if no schema provided, uses Spark's schema inference
            columns = list(data.keys())
            spark_df = spark.createDataFrame(data_reshaped, columns)
        return SparkDFDataset(spark_df, profiler=profiler, caching=caching)
    else:
        raise ValueError("Unknown dataset_type " + str(dataset_type))


def get_test_validator_with_data(
    execution_engine,
    data,
    schemas=None,
    profiler=ColumnsExistProfiler,
    caching=True,
    table_name=None,
    sqlite_db_path=None,
):
    """Utility to create datasets for json-formatted tests."""
    df = pd.DataFrame(data)
    if execution_engine == "pandas":
        if schemas and "pandas" in schemas:
            schema = schemas["pandas"]
            pandas_schema = {}
            for (key, value) in schema.items():
                # Note, these are just names used in our internal schemas to build datasets *for internal tests*
                # Further, some changes in pandas internal about how datetimes are created means to support pandas
                # pre- 0.25, we need to explicitly specify when we want timezone.

                # We will use timestamp for timezone-aware (UTC only) dates in our tests
                if value.lower() in ["timestamp", "datetime64[ns, tz]"]:
                    df[key] = pd.to_datetime(df[key], utc=True)
                    continue
                elif value.lower() in ["datetime", "datetime64", "datetime64[ns]"]:
                    df[key] = pd.to_datetime(df[key])
                    continue
                elif value.lower() in ["date"]:
                    df[key] = pd.to_datetime(df[key]).dt.date
                    value = "object"
                try:
                    type_ = np.dtype(value)
                except TypeError:
                    type_ = getattr(pd.core.dtypes.dtypes, value)
                    # If this raises AttributeError it's okay: it means someone built a bad test
                pandas_schema[key] = type_
            # pandas_schema = {key: np.dtype(value) for (key, value) in schemas["pandas"].items()}
            df = df.astype(pandas_schema)

        if table_name is None:
            # noinspection PyUnusedLocal
            table_name = generate_test_table_name()

        return build_pandas_validator_with_data(df=df)

    elif execution_engine in ["sqlite", "postgresql", "mysql", "mssql", "bigquery"]:
        if not create_engine:
            return None
        return build_sa_validator_with_data(
            df=df,
            sa_engine_name=execution_engine,
            schemas=schemas,
            caching=caching,
            table_name=table_name,
            sqlite_db_path=sqlite_db_path,
        )

    elif execution_engine == "spark":
        import pyspark.sql.types as sparktypes

        SPARK_TYPES = {
            "StringType": sparktypes.StringType,
            "IntegerType": sparktypes.IntegerType,
            "LongType": sparktypes.LongType,
            "DateType": sparktypes.DateType,
            "TimestampType": sparktypes.TimestampType,
            "FloatType": sparktypes.FloatType,
            "DoubleType": sparktypes.DoubleType,
            "BooleanType": sparktypes.BooleanType,
            "DataType": sparktypes.DataType,
            "NullType": sparktypes.NullType,
        }

        spark = get_or_create_spark_application(
            spark_config={
                "spark.sql.catalogImplementation": "hive",
                "spark.executor.memory": "450m",
                # "spark.driver.allowMultipleContexts": "true",  # This directive does not appear to have any effect.
            }
        )
        # We need to allow null values in some column types that do not support them natively, so we skip
        # use of df in this case.
        data_reshaped = list(
            zip(*(v for _, v in data.items()))
        )  # create a list of rows
        if schemas and "spark" in schemas:
            schema = schemas["spark"]
            # sometimes first method causes Spark to throw a TypeError
            try:
                spark_schema = sparktypes.StructType(
                    [
                        sparktypes.StructField(
                            column, SPARK_TYPES[schema[column]](), True
                        )
                        for column in schema
                    ]
                )
                # We create these every time, which is painful for testing
                # However nuance around null treatment as well as the desire
                # for real datetime support in tests makes this necessary
                data = copy.deepcopy(data)
                if "ts" in data:
                    print(data)
                    print(schema)
                for col in schema:
                    type_ = schema[col]
                    if type_ in ["IntegerType", "LongType"]:
                        # Ints cannot be None...but None can be valid in Spark (as Null)
                        vals = []
                        for val in data[col]:
                            if val is None:
                                vals.append(val)
                            else:
                                vals.append(int(val))
                        data[col] = vals
                    elif type_ in ["FloatType", "DoubleType"]:
                        vals = []
                        for val in data[col]:
                            if val is None:
                                vals.append(val)
                            else:
                                vals.append(float(val))
                        data[col] = vals
                    elif type_ in ["DateType", "TimestampType"]:
                        vals = []
                        for val in data[col]:
                            if val is None:
                                vals.append(val)
                            else:
                                vals.append(parse(val))
                        data[col] = vals
                # Do this again, now that we have done type conversion using the provided schema
                data_reshaped = list(
                    zip(*(v for _, v in data.items()))
                )  # create a list of rows
                spark_df = spark.createDataFrame(data_reshaped, schema=spark_schema)
            except TypeError:
                string_schema = sparktypes.StructType(
                    [
                        sparktypes.StructField(column, sparktypes.StringType())
                        for column in schema
                    ]
                )
                spark_df = spark.createDataFrame(data_reshaped, string_schema)
                for c in spark_df.columns:
                    spark_df = spark_df.withColumn(
                        c, spark_df[c].cast(SPARK_TYPES[schema[c]]())
                    )
        elif len(data_reshaped) == 0:
            # if we have an empty dataset and no schema, need to assign an arbitrary type
            columns = list(data.keys())
            spark_schema = sparktypes.StructType(
                [
                    sparktypes.StructField(column, sparktypes.StringType())
                    for column in columns
                ]
            )
            spark_df = spark.createDataFrame(data_reshaped, spark_schema)
        else:
            # if no schema provided, uses Spark's schema inference
            columns = list(data.keys())
            spark_df = spark.createDataFrame(data_reshaped, columns)

        if table_name is None:
            # noinspection PyUnusedLocal
            table_name = generate_test_table_name()

        return build_spark_validator_with_data(df=spark_df, spark=spark)

    else:
        raise ValueError("Unknown dataset_type " + str(execution_engine))


def build_pandas_validator_with_data(
    df: pd.DataFrame,
    batch_definition: Optional[BatchDefinition] = None,
) -> Validator:
    batch: Batch = Batch(data=df, batch_definition=batch_definition)
    return Validator(execution_engine=PandasExecutionEngine(), batches=(batch,))


def build_sa_validator_with_data(
    df,
    sa_engine_name,
    schemas=None,
    caching=True,
    table_name=None,
    sqlite_db_path=None,
    batch_definition: Optional[BatchDefinition] = None,
):
    dialect_classes = {
        "sqlite": sqlitetypes.dialect,
        "postgresql": postgresqltypes.dialect,
        "mysql": mysqltypes.dialect,
        "mssql": mssqltypes.dialect,
        "bigquery": pybigquery.sqlalchemy_bigquery.BigQueryDialect,
    }
    dialect_types = {
        "sqlite": SQLITE_TYPES,
        "postgresql": POSTGRESQL_TYPES,
        "mysql": MYSQL_TYPES,
        "mssql": MSSQL_TYPES,
        "bigquery": BIGQUERY_TYPES,
    }
    db_hostname = os.getenv("GE_TEST_LOCAL_DB_HOSTNAME", "localhost")
    if sa_engine_name == "sqlite":
        engine = create_engine(get_sqlite_connection_url(sqlite_db_path))
    elif sa_engine_name == "postgresql":
        engine = connection_manager.get_engine(
            f"postgresql://postgres@{db_hostname}/test_ci"
        )
    elif sa_engine_name == "mysql":
        engine = create_engine(f"mysql+pymysql://root@{db_hostname}/test_ci")
    elif sa_engine_name == "mssql":
        engine = create_engine(
            f"mssql+pyodbc://sa:ReallyStrongPwd1234%^&*@{db_hostname}:1433/test_ci?driver=ODBC Driver 17 "
            "for SQL Server&charset=utf8&autocommit=true",
            # echo=True,
        )
    elif sa_engine_name == "bigquery":
        engine = _create_bigquery_engine()
    else:
        engine = None

    # If "autocommit" is not desired to be on by default, then use the following pattern when explicit "autocommit"
    # is desired (e.g., for temporary tables, "autocommit" is off by default, so the override option may be useful).
    # engine.execute(sa.text(sql_query_string).execution_options(autocommit=True))

    # Add the data to the database as a new table

    if sa_engine_name == "bigquery":
        schema = None
        if schemas and sa_engine_name in schemas:
            schema = schemas[sa_engine_name]
            # bigquery does not allow column names to have spaces
            schema = {k.replace(" ", "_"): v for k, v in schema.items()}

        df.columns = df.columns.str.replace(" ", "_")

    sql_dtypes = {}
    if (
        schemas
        and sa_engine_name in schemas
        and isinstance(engine.dialect, dialect_classes.get(sa_engine_name))
    ):
        schema = schemas[sa_engine_name]

        sql_dtypes = {
            col: dialect_types.get(sa_engine_name)[dtype]
            for (col, dtype) in schema.items()
        }
        for col in schema:
            type_ = schema[col]
            if type_ in ["INTEGER", "SMALLINT", "BIGINT"]:
                df[col] = pd.to_numeric(df[col], downcast="signed")
            elif type_ in ["FLOAT", "DOUBLE", "DOUBLE_PRECISION"]:
                df[col] = pd.to_numeric(df[col])
                min_value_dbms = get_sql_dialect_floating_point_infinity_value(
                    schema=sa_engine_name, negative=True
                )
                max_value_dbms = get_sql_dialect_floating_point_infinity_value(
                    schema=sa_engine_name, negative=False
                )
                for api_schema_type in ["api_np", "api_cast"]:
                    min_value_api = get_sql_dialect_floating_point_infinity_value(
                        schema=api_schema_type, negative=True
                    )
                    max_value_api = get_sql_dialect_floating_point_infinity_value(
                        schema=api_schema_type, negative=False
                    )
                    df.replace(
                        to_replace=[min_value_api, max_value_api],
                        value=[min_value_dbms, max_value_dbms],
                        inplace=True,
                    )
            elif type_ in ["DATETIME", "TIMESTAMP", "DATE"]:
                df[col] = pd.to_datetime(df[col])

    if table_name is None:
        table_name = generate_test_table_name()

    df.to_sql(
        name=table_name,
        con=engine,
        index=False,
        dtype=sql_dtypes,
        if_exists="replace",
    )

    batch_data = SqlAlchemyBatchData(execution_engine=engine, table_name=table_name)
    batch = Batch(data=batch_data, batch_definition=batch_definition)
    execution_engine = SqlAlchemyExecutionEngine(caching=caching, engine=engine)

    return Validator(execution_engine=execution_engine, batches=(batch,))


def modify_locale(func):
    @wraps(func)
    def locale_wrapper(*args, **kwargs):
        old_locale = locale.setlocale(locale.LC_TIME, None)
        print(old_locale)
        # old_locale = locale.getlocale(locale.LC_TIME) Why not getlocale? not sure
        try:
            new_locale = locale.setlocale(locale.LC_TIME, "en_US.UTF-8")
            assert new_locale == "en_US.UTF-8"
            func(*args, **kwargs)
        except Exception:
            raise
        finally:
            locale.setlocale(locale.LC_TIME, old_locale)

    return locale_wrapper


def build_spark_validator_with_data(
    df: Union[pd.DataFrame, SparkDataFrame],
    spark: SparkSession,
    batch_definition: Optional[BatchDefinition] = None,
) -> Validator:
    if isinstance(df, pd.DataFrame):
        df = spark.createDataFrame(
            [
                tuple(
                    None if isinstance(x, (float, int)) and np.isnan(x) else x
                    for x in record.tolist()
                )
                for record in df.to_records(index=False)
            ],
            df.columns.tolist(),
        )
    batch: Batch = Batch(data=df, batch_definition=batch_definition)
    execution_engine: SparkDFExecutionEngine = build_spark_engine(
        spark=spark,
        df=df,
        batch_id=batch.id,
    )
    return Validator(execution_engine=execution_engine, batches=(batch,))


def build_pandas_engine(
    df: pd.DataFrame,
) -> PandasExecutionEngine:
    batch: Batch = Batch(data=df)

    execution_engine: PandasExecutionEngine = PandasExecutionEngine(
        batch_data_dict={batch.id: batch.data}
    )
    return execution_engine


def build_sa_engine(
    df: pd.DataFrame,
    sa: ModuleType,
    schema: Optional[str] = None,
    if_exists: Optional[str] = "fail",
    index: Optional[bool] = False,
    dtype: Optional[dict] = None,
) -> SqlAlchemyExecutionEngine:
    table_name: str = "test"

    # noinspection PyUnresolvedReferences
    sqlalchemy_engine: Engine = sa.create_engine("sqlite://", echo=False)
    df.to_sql(
        name=table_name,
        con=sqlalchemy_engine,
        schema=schema,
        if_exists=if_exists,
        index=index,
        dtype=dtype,
    )

    execution_engine: SqlAlchemyExecutionEngine

    execution_engine = SqlAlchemyExecutionEngine(engine=sqlalchemy_engine)
    batch_data: SqlAlchemyBatchData = SqlAlchemyBatchData(
        execution_engine=execution_engine, table_name=table_name
    )
    batch: Batch = Batch(data=batch_data)

    execution_engine = SqlAlchemyExecutionEngine(
        engine=sqlalchemy_engine, batch_data_dict={batch.id: batch_data}
    )

    return execution_engine


# Builds a Spark Execution Engine
def build_spark_engine(
    spark: SparkSession,
    df: Union[pd.DataFrame, SparkDataFrame],
    batch_id: Optional[str] = None,
    batch_definition: Optional[BatchDefinition] = None,
) -> SparkDFExecutionEngine:
    if (
        sum(
            bool(x)
            for x in [
                batch_id is not None,
                batch_definition is not None,
            ]
        )
        != 1
    ):
        raise ValueError(
            "Exactly one of batch_id or batch_definition must be specified."
        )

    if batch_id is None:
        batch_id = batch_definition.id

    if isinstance(df, pd.DataFrame):
        df = spark.createDataFrame(
            [
                tuple(
                    None if isinstance(x, (float, int)) and np.isnan(x) else x
                    for x in record.tolist()
                )
                for record in df.to_records(index=False)
            ],
            df.columns.tolist(),
        )
    conf: List[tuple] = spark.sparkContext.getConf().getAll()
    spark_config: Dict[str, str] = dict(conf)
    execution_engine: SparkDFExecutionEngine = SparkDFExecutionEngine(
        spark_config=spark_config
    )
    execution_engine.load_batch_data(batch_id=batch_id, batch_data=df)
    return execution_engine


def candidate_getter_is_on_temporary_notimplemented_list(context, getter):
    if context in ["sqlite"]:
        return getter in ["get_column_modes", "get_column_stdev"]
    if context in ["postgresql", "mysql", "mssql"]:
        return getter in ["get_column_modes"]
    if context == "spark":
        return getter in []


def candidate_test_is_on_temporary_notimplemented_list(context, expectation_type):
    if context in ["sqlite", "postgresql", "mysql", "mssql"]:
        return expectation_type in [
            "expect_column_values_to_be_increasing",
            "expect_column_values_to_be_decreasing",
            "expect_column_values_to_match_strftime_format",
            "expect_column_values_to_be_dateutil_parseable",
            "expect_column_values_to_be_json_parseable",
            "expect_column_values_to_match_json_schema",
            "expect_column_stdev_to_be_between",
            "expect_column_most_common_value_to_be_in_set",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
            "expect_column_pair_values_to_be_equal",
            "expect_column_pair_values_A_to_be_greater_than_B",
            "expect_column_pair_values_to_be_in_set",
            "expect_select_column_values_to_be_unique_within_record",
            "expect_compound_columns_to_be_unique",
            "expect_multicolumn_values_to_be_unique",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_multicolumn_sum_to_equal",
        ]
    if context in ["bigquery"]:
        return expectation_type in [
            "expect_column_values_to_be_increasing",
            "expect_column_values_to_be_decreasing",
            "expect_column_values_to_match_strftime_format",
            "expect_column_values_to_be_dateutil_parseable",
            "expect_column_values_to_be_json_parseable",
            "expect_column_values_to_match_json_schema",
            "expect_column_stdev_to_be_between",
            "expect_column_most_common_value_to_be_in_set",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_kl_divergence_to_be_less_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
            "expect_column_chisquare_test_p_value_to_be_greater_than",
            "expect_column_pair_values_to_be_equal",
            "expect_column_pair_values_A_to_be_greater_than_B",
            "expect_column_pair_values_to_be_in_set",
            "expect_select_column_values_to_be_unique_within_record",
            "expect_compound_columns_to_be_unique",
            "expect_multicolumn_values_to_be_unique",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_multicolumn_sum_to_equal",
            "expect_column_values_to_be_between",  # TODO: error unique to bigquery -- https://github.com/great-expectations/great_expectations/issues/3261
            "expect_column_values_to_be_of_type",  # TODO: error unique to bigquery -- https://github.com/great-expectations/great_expectations/issues/3261
            "expect_column_values_to_be_in_set",  # TODO: error unique to bigquery -- https://github.com/great-expectations/great_expectations/issues/3261
            "expect_column_values_to_be_in_type_list",  # TODO: error unique to bigquery -- https://github.com/great-expectations/great_expectations/issues/3261
            "expect_column_values_to_match_like_pattern_list",  # TODO: error unique to bigquery -- https://github.com/great-expectations/great_expectations/issues/3261
            "expect_column_values_to_not_match_like_pattern_list",  # TODO: error unique to bigquery -- https://github.com/great-expectations/great_expectations/issues/3261
        ]

    if context == "SparkDFDataset":
        return expectation_type in [
            "expect_column_values_to_be_dateutil_parseable",
            "expect_column_values_to_be_json_parseable",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
            "expect_compound_columns_to_be_unique",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_table_row_count_to_equal_other_table",
        ]
    if context == "PandasDataset":
        return expectation_type in [
            "expect_table_row_count_to_equal_other_table",
        ]
    return False


def candidate_test_is_on_temporary_notimplemented_list_cfe(context, expectation_type):
    if context in ["sqlite", "postgresql", "mysql", "mssql"]:
        return expectation_type in [
            # "expect_select_column_values_to_be_unique_within_record",
            "expect_column_values_to_be_increasing",
            "expect_column_values_to_be_decreasing",
            "expect_column_values_to_match_strftime_format",
            "expect_column_values_to_be_dateutil_parseable",
            "expect_column_values_to_be_json_parseable",
            "expect_column_values_to_match_json_schema",
            "expect_column_stdev_to_be_between",
            # "expect_column_unique_value_count_to_be_between",
            # "expect_column_proportion_of_unique_values_to_be_between",
            # "expect_column_most_common_value_to_be_in_set",
            # "expect_column_max_to_be_between",
            # "expect_column_min_to_be_between",
            # "expect_column_sum_to_be_between",
            # "expect_column_pair_values_A_to_be_greater_than_B",
            # "expect_column_pair_values_to_be_equal",
            # "expect_column_pair_values_to_be_in_set",
            "expect_multicolumn_values_to_be_unique",
            # "expect_multicolumn_sum_to_equal",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_chisquare_test_p_value_to_be_greater_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
            "expect_compound_columns_to_be_unique",
        ]

    if context == "bigquery":
        ###
        # NOTE: 20210729 - jdimatteo: It is relatively slow to create tables for
        # all these tests in BigQuery, and if you want to run a single test then
        # you can uncomment and modify the below line (which results in only the
        # tests for "expect_column_values_to_not_be_null" being run):
        # return expectation_type != "expect_column_values_to_not_be_null"
        ###
        # NOTE: 20210729 - jdimatteo: Below are temporarily not being tested
        # with BigQuery. For each disabled test below, please include a link to
        # a github issue tracking adding the test with BigQuery.
        ###
        return expectation_type in [
            "expect_column_kl_divergence_to_be_less_than",  # TODO: Takes over 64 minutes to "collect" (haven't actually seen it complete yet) -- https://github.com/great-expectations/great_expectations/issues/3260
            "expect_column_values_to_be_in_set",  # TODO: No matching signature for operator and AssertionError: expected ['2018-01-01T00:00:00'] but got ['2018-01-01'] -- https://github.com/great-expectations/great_expectations/issues/3260
            "expect_column_values_to_be_in_type_list",  # TODO: AssertionError -- https://github.com/great-expectations/great_expectations/issues/3260
            "expect_column_values_to_be_between",  # TODO: "400 No matching signature for operator >=" -- https://github.com/great-expectations/great_expectations/issues/3260
            "expect_column_quantile_values_to_be_between",  # TODO: takes over 15 minutes to "collect" (haven't actually seen it complete yet) -- https://github.com/great-expectations/great_expectations/issues/3260
            "expect_column_mean_to_be_between",  # TODO: "400 No matching signature for operator *" -- https://github.com/great-expectations/great_expectations/issues/3260
            # "expect_select_column_values_to_be_unique_within_record",
            "expect_column_values_to_be_increasing",
            "expect_column_values_to_be_decreasing",
            "expect_column_values_to_match_strftime_format",
            "expect_column_values_to_be_dateutil_parseable",
            "expect_column_values_to_be_json_parseable",
            "expect_column_values_to_match_json_schema",
            "expect_column_stdev_to_be_between",
            # "expect_column_pair_values_A_to_be_greater_than_B",
            # "expect_column_pair_values_to_be_equal",
            # "expect_column_pair_values_to_be_in_set",
            "expect_multicolumn_values_to_be_unique",
            # "expect_multicolumn_sum_to_equal",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_chisquare_test_p_value_to_be_greater_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
            "expect_compound_columns_to_be_unique",
        ]
    if context == "spark":
        return expectation_type in [
            # "expect_select_column_values_to_be_unique_within_record",
            "expect_table_row_count_to_equal_other_table",
            "expect_column_values_to_be_in_set",
            "expect_column_values_to_not_be_in_set",
            "expect_column_values_to_not_match_regex_list",
            "expect_column_values_to_match_like_pattern",
            "expect_column_values_to_not_match_like_pattern",
            "expect_column_values_to_match_like_pattern_list",
            "expect_column_values_to_not_match_like_pattern_list",
            "expect_column_values_to_be_dateutil_parseable",
            # "expect_column_pair_values_A_to_be_greater_than_B",
            # "expect_column_pair_values_to_be_equal",
            # "expect_column_pair_values_to_be_in_set",
            # "expect_compound_columns_to_be_unique",
            "expect_multicolumn_values_to_be_unique",
            # "expect_multicolumn_sum_to_equal",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_chisquare_test_p_value_to_be_greater_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
        ]
    if context == "pandas":
        return expectation_type in [
            "expect_table_row_count_to_equal_other_table",
            "expect_column_values_to_match_like_pattern",
            "expect_column_values_to_not_match_like_pattern",
            "expect_column_values_to_match_like_pattern_list",
            "expect_column_values_to_not_match_like_pattern_list",
            # "expect_column_values_to_match_strftime_format",
            # "expect_column_values_to_be_dateutil_parseable",
            # "expect_column_values_to_be_json_parseable",
            # "expect_column_values_to_match_json_schema",
            # "expect_column_distinct_values_to_be_in_set",
            # "expect_column_distinct_values_to_contain_set",
            # "expect_column_distinct_values_to_equal_set",
            # "expect_column_mean_to_be_between",
            # "expect_column_median_to_be_between",
            # "expect_column_quantile_values_to_be_between",
            # "expect_column_stdev_to_be_between",
            # "expect_column_unique_value_count_to_be_between",
            # "expect_column_proportion_of_unique_values_to_be_between",
            # "expect_column_most_common_value_to_be_in_set",
            # "expect_column_max_to_be_between",
            # "expect_column_min_to_be_between",
            # "expect_column_sum_to_be_between",
            # "expect_column_pair_values_A_to_be_greater_than_B",
            # "expect_column_pair_values_to_be_equal",
            # "expect_column_pair_values_to_be_in_set",
            # "expect_select_column_values_to_be_unique_within_record",
            # "expect_compound_columns_to_be_unique",
            "expect_multicolumn_values_to_be_unique",
            "expect_column_pair_cramers_phi_value_to_be_less_than",
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than",
            "expect_column_chisquare_test_p_value_to_be_greater_than",
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than",
        ]

    return False


def build_test_backends_list(
    include_pandas=True,
    include_spark=True,
    include_sqlalchemy=True,
    include_sqlite=True,
    include_postgresql=False,
    include_mysql=False,
    include_mssql=False,
    include_bigquery=False,
):
    test_backends = []

    if include_pandas:
        test_backends += ["pandas"]

    if include_spark:
        try:
            import pyspark
            from pyspark.sql import SparkSession
        except ImportError:
            raise ValueError("spark tests are requested, but pyspark is not installed")
        test_backends += ["spark"]

    db_hostname = os.getenv("GE_TEST_LOCAL_DB_HOSTNAME", "localhost")
    if include_sqlalchemy:

        sa: Optional[ModuleType] = import_library_module(module_name="sqlalchemy")
        if sa is None:
            raise ImportError(
                "sqlalchemy tests are requested, but sqlalchemy in not installed"
            )

        if include_sqlite:
            test_backends += ["sqlite"]

        if include_postgresql:
            ###
            # NOTE: 20190918 - JPC: Since I've had to relearn this a few times, a note here.
            # SQLALCHEMY coerces postgres DOUBLE_PRECISION to float, which loses precision
            # round trip compared to NUMERIC, which stays as a python DECIMAL

            # Be sure to ensure that tests (and users!) understand that subtlety,
            # which can be important for distributional expectations, for example.
            ###
            connection_string = f"postgresql://postgres@{db_hostname}/test_ci"
            checker = LockingConnectionCheck(sa, connection_string)
            if checker.is_valid() is True:
                test_backends += ["postgresql"]
            else:
                raise ValueError(
                    f"backend-specific tests are requested, but unable to connect to the database at "
                    f"{connection_string}"
                )

        if include_mysql:
            try:
                engine = create_engine(f"mysql+pymysql://root@{db_hostname}/test_ci")
                conn = engine.connect()
                conn.close()
            except (ImportError, SQLAlchemyError):
                raise ImportError(
                    "mysql tests are requested, but unable to connect to the mysql database at "
                    f"'mysql+pymysql://root@{db_hostname}/test_ci'"
                )
            test_backends += ["mysql"]

        if include_mssql:
            try:
                engine = create_engine(
                    f"mssql+pyodbc://sa:ReallyStrongPwd1234%^&*@{db_hostname}:1433/test_ci?"
                    "driver=ODBC Driver 17 for SQL Server&charset=utf8&autocommit=true",
                    # echo=True,
                )
                conn = engine.connect()
                conn.close()
            except (ImportError, sa.exc.SQLAlchemyError):
                raise ImportError(
                    "mssql tests are requested, but unable to connect to the mssql database at "
                    f"'mssql+pyodbc://sa:ReallyStrongPwd1234%^&*@{db_hostname}:1433/test_ci?"
                    "driver=ODBC Driver 17 for SQL Server&charset=utf8&autocommit=true'",
                )
            test_backends += ["mssql"]

        if include_bigquery:
            try:
                engine = _create_bigquery_engine()
                conn = engine.connect()
                conn.close()
            except (ImportError, sa.exc.SQLAlchemyError) as e:
                raise ImportError(
                    "bigquery tests are requested, but unable to connect"
                ) from e
            test_backends += ["bigquery"]

    return test_backends


def generate_expectation_tests(
    expectation_type, examples_config, expectation_execution_engines_dict=None
):
    """

    :param expectation_type: snake_case name of the expectation type
    :param examples_config: a dictionary that defines the data and test cases for the expectation
    :param expectation_execution_engines_dict: (optional) a dictionary that shows which backends/execution engines the
            expectation is implemented for. It can be obtained from the output of the expectation's self_check method
            Example:
            {
             "PandasExecutionEngine": True,
             "SqlAlchemyExecutionEngine": False,
             "SparkDFExecutionEngine": False
            }
    :return:
    """
    parametrized_tests = []

    # If Expectation.examples defines "test_backends", use that to determine backends and dialects to use.
    # Otherwise, use the introspected expectation_execution_engines_dict.
    for d in examples_config:
        d = copy.deepcopy(d)
        if expectation_execution_engines_dict is not None:
            example_backends_is_defined = "test_backends" in d
            example_backends = [
                backend_dict.get("backend")
                for backend_dict in d.get("test_backends", [])
            ]
            example_sqlalchemy_dialects = [
                dialect
                for backend_dict in d.get("test_backends", {})
                if (backend_dict.get("backend") == "sqlalchemy")
                for dialect in backend_dict.get("dialects", [])
            ]
            include_sqlalchemy = (
                ("sqlalchemy" in example_backends)
                if example_backends_is_defined
                else (
                    expectation_execution_engines_dict.get("SqlAlchemyExecutionEngine")
                    == True
                )
            )
            backends = build_test_backends_list(
                include_pandas=("pandas" in example_backends)
                if example_backends_is_defined
                else (
                    expectation_execution_engines_dict.get("PandasExecutionEngine")
                    == True
                ),
                include_spark=("spark" in example_backends)
                if example_backends_is_defined
                else (
                    expectation_execution_engines_dict.get("SparkDFExecutionEngine")
                    == True
                ),
                include_sqlalchemy=include_sqlalchemy,
                include_sqlite=("sqlite" in example_sqlalchemy_dialects)
                if example_backends_is_defined
                else include_sqlalchemy,
                include_postgresql=("postgresql" in example_sqlalchemy_dialects),
                include_mysql=("mysql" in example_sqlalchemy_dialects),
                include_mssql=("mssql" in example_sqlalchemy_dialects),
            )
        else:
            backends = build_test_backends_list()

        for c in backends:

            datasets = []
            if candidate_test_is_on_temporary_notimplemented_list_cfe(
                c, expectation_type
            ):
                skip_expectation = True
                schemas = validator_with_data = None
            else:
                skip_expectation = False
                if isinstance(d["data"], list):
                    sqlite_db_path = os.path.abspath(
                        os.path.join(
                            tmp_dir,
                            "sqlite_db"
                            + "".join(
                                [
                                    random.choice(string.ascii_letters + string.digits)
                                    for _ in range(8)
                                ]
                            )
                            + ".db",
                        )
                    )
                    for dataset in d["data"]:
                        datasets.append(
                            get_test_validator_with_data(
                                c,
                                dataset["data"],
                                dataset.get("schemas"),
                                table_name=dataset.get("dataset_name"),
                                sqlite_db_path=sqlite_db_path,
                            )
                        )
                    validator_with_data = datasets[0]
                else:
                    schemas = d["schemas"] if "schemas" in d else None
                    validator_with_data = get_test_validator_with_data(
                        c, d["data"], schemas=schemas
                    )

            for test in d["tests"]:

                # use the expectation_execution_engines_dict of the expectation
                # to exclude unimplemented backends from the testing
                if expectation_execution_engines_dict is not None:
                    supress_test_for = test.get("suppress_test_for")
                    if supress_test_for is None:
                        supress_test_for = []
                    if not expectation_execution_engines_dict.get(
                        "PandasExecutionEngine"
                    ):
                        supress_test_for.append("pandas")
                    if not expectation_execution_engines_dict.get(
                        "SqlAlchemyExecutionEngine"
                    ):
                        supress_test_for.append("sqlalchemy")
                    if not expectation_execution_engines_dict.get(
                        "SparkDFExecutionEngine"
                    ):
                        supress_test_for.append("spark")

                    if len(supress_test_for) > 0:
                        test["suppress_test_for"] = supress_test_for

                generate_test = True
                skip_test = False
                if "only_for" in test:
                    # if we're not on the "only_for" list, then never even generate the test
                    generate_test = False
                    if not isinstance(test["only_for"], list):
                        raise ValueError("Invalid test specification.")

                    if validator_with_data and isinstance(
                        validator_with_data.execution_engine.active_batch_data,
                        SqlAlchemyBatchData,
                    ):
                        # Call out supported dialects
                        if "sqlalchemy" in test["only_for"]:
                            generate_test = True
                        elif (
                            "sqlite" in test["only_for"]
                            and sqliteDialect is not None
                            and isinstance(
                                validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                                sqliteDialect,
                            )
                        ):
                            generate_test = True
                        elif (
                            "postgresql" in test["only_for"]
                            and postgresqlDialect is not None
                            and isinstance(
                                validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                                postgresqlDialect,
                            )
                        ):
                            generate_test = True
                        elif (
                            "mysql" in test["only_for"]
                            and mysqlDialect is not None
                            and isinstance(
                                validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                                mysqlDialect,
                            )
                        ):
                            generate_test = True
                        elif (
                            "mssql" in test["only_for"]
                            and mssqlDialect is not None
                            and isinstance(
                                validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                                mssqlDialect,
                            )
                        ):
                            generate_test = True
                    elif validator_with_data and isinstance(
                        validator_with_data.execution_engine.active_batch_data,
                        pandas_DataFrame,
                    ):
                        if "pandas" in test["only_for"]:
                            generate_test = True
                        if (
                            "pandas_022" in test["only_for"]
                            or "pandas_023" in test["only_for"]
                        ) and int(pd.__version__.split(".")[1]) in [22, 23]:
                            generate_test = True
                        if ("pandas>=24" in test["only_for"]) and int(
                            pd.__version__.split(".")[1]
                        ) > 24:
                            generate_test = True
                    elif validator_with_data and isinstance(
                        validator_with_data.execution_engine.active_batch_data,
                        spark_DataFrame,
                    ):
                        if "spark" in test["only_for"]:
                            generate_test = True

                if not generate_test:
                    continue

                if "suppress_test_for" in test and (
                    (
                        "sqlalchemy" in test["suppress_test_for"]
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            SqlAlchemyBatchData,
                        )
                    )
                    or (
                        "sqlite" in test["suppress_test_for"]
                        and sqliteDialect is not None
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            SqlAlchemyBatchData,
                        )
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                            sqliteDialect,
                        )
                    )
                    or (
                        "postgresql" in test["suppress_test_for"]
                        and postgresqlDialect is not None
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            SqlAlchemyBatchData,
                        )
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                            postgresqlDialect,
                        )
                    )
                    or (
                        "mysql" in test["suppress_test_for"]
                        and mysqlDialect is not None
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            SqlAlchemyBatchData,
                        )
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                            mysqlDialect,
                        )
                    )
                    or (
                        "mssql" in test["suppress_test_for"]
                        and mssqlDialect is not None
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            SqlAlchemyBatchData,
                        )
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data.sql_engine_dialect,
                            mssqlDialect,
                        )
                    )
                    or (
                        "pandas" in test["suppress_test_for"]
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            pandas_DataFrame,
                        )
                    )
                    or (
                        "spark" in test["suppress_test_for"]
                        and validator_with_data
                        and isinstance(
                            validator_with_data.execution_engine.active_batch_data,
                            spark_DataFrame,
                        )
                    )
                ):
                    skip_test = True
                # Known condition: SqlAlchemy does not support allow_cross_type_comparisons
                if (
                    "allow_cross_type_comparisons" in test["in"]
                    and validator_with_data
                    and isinstance(
                        validator_with_data.execution_engine.active_batch_data,
                        SqlAlchemyBatchData,
                    )
                ):
                    skip_test = True

                if not skip_test:
                    parametrized_tests.append(
                        {
                            "expectation_type": expectation_type,
                            "validator_with_data": validator_with_data,
                            "test": test,
                            "skip": skip_expectation or skip_test,
                            "backend": c,
                        }
                    )

    return parametrized_tests


def evaluate_json_test(data_asset, expectation_type, test):
    """
    This method will evaluate the result of a test build using the Great Expectations json test format.

    NOTE: Tests can be suppressed for certain data types if the test contains the Key 'suppress_test_for' with a list
        of DataAsset types to suppress, such as ['SQLAlchemy', 'Pandas'].

    :param data_asset: (DataAsset) A great expectations DataAsset
    :param expectation_type: (string) the name of the expectation to be run using the test input
    :param test: (dict) a dictionary containing information for the test to be run. The dictionary must include:
        - title: (string) the name of the test
        - exact_match_out: (boolean) If true, match the 'out' dictionary exactly against the result of the expectation
        - in: (dict or list) a dictionary of keyword arguments to use to evaluate the expectation or a list of positional arguments
        - out: (dict) the dictionary keys against which to make assertions. Unless exact_match_out is true, keys must\
            come from the following list:
              - success
              - observed_value
              - unexpected_index_list
              - unexpected_list
              - details
              - traceback_substring (if present, the string value will be expected as a substring of the exception_traceback)
    :return: None. asserts correctness of results.
    """

    data_asset.set_default_expectation_argument("result_format", "COMPLETE")
    data_asset.set_default_expectation_argument("include_config", False)

    if "title" not in test:
        raise ValueError("Invalid test configuration detected: 'title' is required.")

    if "exact_match_out" not in test:
        raise ValueError(
            "Invalid test configuration detected: 'exact_match_out' is required."
        )

    if "in" not in test:
        raise ValueError("Invalid test configuration detected: 'in' is required.")

    if "out" not in test:
        raise ValueError("Invalid test configuration detected: 'out' is required.")

    # Support tests with positional arguments
    if isinstance(test["in"], list):
        result = getattr(data_asset, expectation_type)(*test["in"])
    # As well as keyword arguments
    else:
        result = getattr(data_asset, expectation_type)(**test["in"])

    check_json_test_result(test=test, result=result, data_asset=data_asset)


def evaluate_json_test_cfe(validator, expectation_type, test):
    """
    This method will evaluate the result of a test build using the Great Expectations json test format.

    NOTE: Tests can be suppressed for certain data types if the test contains the Key 'suppress_test_for' with a list
        of DataAsset types to suppress, such as ['SQLAlchemy', 'Pandas'].

    :param data_asset: (DataAsset) A great expectations DataAsset
    :param expectation_type: (string) the name of the expectation to be run using the test input
    :param test: (dict) a dictionary containing information for the test to be run. The dictionary must include:
        - title: (string) the name of the test
        - exact_match_out: (boolean) If true, match the 'out' dictionary exactly against the result of the expectation
        - in: (dict or list) a dictionary of keyword arguments to use to evaluate the expectation or a list of positional arguments
        - out: (dict) the dictionary keys against which to make assertions. Unless exact_match_out is true, keys must\
            come from the following list:
              - success
              - observed_value
              - unexpected_index_list
              - unexpected_list
              - details
              - traceback_substring (if present, the string value will be expected as a substring of the exception_traceback)
    :return: None. asserts correctness of results.
    """
    expectation_suite = ExpectationSuite("json_test_suite")
    # noinspection PyProtectedMember
    validator._initialize_expectations(expectation_suite=expectation_suite)
    # validator.set_default_expectation_argument("result_format", "COMPLETE")
    # validator.set_default_expectation_argument("include_config", False)

    if "title" not in test:
        raise ValueError("Invalid test configuration detected: 'title' is required.")

    if "exact_match_out" not in test:
        raise ValueError(
            "Invalid test configuration detected: 'exact_match_out' is required."
        )

    if "in" not in test:
        raise ValueError("Invalid test configuration detected: 'in' is required.")

    if "out" not in test:
        raise ValueError("Invalid test configuration detected: 'out' is required.")

    kwargs = copy.deepcopy(test["in"])

    if isinstance(test["in"], list):
        result = getattr(validator, expectation_type)(*kwargs)
    # As well as keyword arguments
    else:
        runtime_kwargs = {"result_format": "COMPLETE", "include_config": False}
        runtime_kwargs.update(kwargs)
        result = getattr(validator, expectation_type)(**runtime_kwargs)

    check_json_test_result(
        test=test,
        result=result,
        data_asset=validator.execution_engine.active_batch_data,
    )


def check_json_test_result(test, result, data_asset=None):
    # Check results
    if test["exact_match_out"] is True:
        assert result == expectationValidationResultSchema.load(test["out"])
    else:
        # Convert result to json since our tests are reading from json so cannot easily contain richer types (e.g. NaN)
        # NOTE - 20191031 - JPC - we may eventually want to change these tests as we update our view on how
        # representations, serializations, and objects should interact and how much of that is shown to the user.
        result = result.to_json_dict()
        print(result)
        for key, value in test["out"].items():
            # Apply our great expectations-specific test logic

            if key == "success":
                assert result["success"] == value

            elif key == "observed_value":
                if "tolerance" in test:
                    if isinstance(value, dict):
                        assert set(result["result"]["observed_value"].keys()) == set(
                            value.keys()
                        )
                        for k, v in value.items():
                            assert np.allclose(
                                result["result"]["observed_value"][k],
                                v,
                                rtol=test["tolerance"],
                            )
                    else:
                        assert np.allclose(
                            result["result"]["observed_value"],
                            value,
                            rtol=test["tolerance"],
                        )
                else:
                    assert result["result"]["observed_value"] == value

            # NOTE: This is a key used ONLY for testing cases where an expectation is legitimately allowed to return
            # any of multiple possible observed_values. expect_column_values_to_be_of_type is one such expectation.
            elif key == "observed_value_list":
                assert result["result"]["observed_value"] in value

            elif key == "unexpected_index_list":
                if isinstance(data_asset, (SqlAlchemyDataset, SparkDFDataset)):
                    pass
                elif isinstance(data_asset, (SqlAlchemyBatchData, SparkDFBatchData)):
                    pass
                else:
                    assert result["result"]["unexpected_index_list"] == value

            elif key == "unexpected_list":
                # check if value can be sorted; if so, sort so arbitrary ordering of results does not cause failure
                if (isinstance(value, list)) & (len(value) >= 1):
                    if type(value[0].__lt__(value[0])) != type(NotImplemented):
                        value = sorted(value, key=lambda x: str(x))
                        result["result"]["unexpected_list"] = sorted(
                            result["result"]["unexpected_list"], key=lambda x: str(x)
                        )

                assert result["result"]["unexpected_list"] == value, (
                    "expected "
                    + str(value)
                    + " but got "
                    + str(result["result"]["unexpected_list"])
                )

            elif key == "details":
                assert result["result"]["details"] == value

            elif key == "value_counts":
                for val_count in value:
                    assert val_count in result["result"]["details"]["value_counts"]

            elif key.startswith("observed_cdf"):
                if "x_-1" in key:
                    if key.endswith("gt"):
                        assert (
                            result["result"]["details"]["observed_cdf"]["x"][-1] > value
                        )
                    else:
                        assert (
                            result["result"]["details"]["observed_cdf"]["x"][-1]
                            == value
                        )
                elif "x_0" in key:
                    if key.endswith("lt"):
                        assert (
                            result["result"]["details"]["observed_cdf"]["x"][0] < value
                        )
                    else:
                        assert (
                            result["result"]["details"]["observed_cdf"]["x"][0] == value
                        )
                else:
                    raise ValueError(
                        "Invalid test specification: unknown key " + key + " in 'out'"
                    )

            elif key == "traceback_substring":
                assert result["exception_info"]["raised_exception"]
                assert value in result["exception_info"]["exception_traceback"], (
                    "expected to find "
                    + value
                    + " in "
                    + result["exception_info"]["exception_traceback"]
                )

            elif key == "expected_partition":
                assert np.allclose(
                    result["result"]["details"]["expected_partition"]["bins"],
                    value["bins"],
                )
                assert np.allclose(
                    result["result"]["details"]["expected_partition"]["weights"],
                    value["weights"],
                )
                if "tail_weights" in result["result"]["details"]["expected_partition"]:
                    assert np.allclose(
                        result["result"]["details"]["expected_partition"][
                            "tail_weights"
                        ],
                        value["tail_weights"],
                    )

            elif key == "observed_partition":
                assert np.allclose(
                    result["result"]["details"]["observed_partition"]["bins"],
                    value["bins"],
                )
                assert np.allclose(
                    result["result"]["details"]["observed_partition"]["weights"],
                    value["weights"],
                )
                if "tail_weights" in result["result"]["details"]["observed_partition"]:
                    assert np.allclose(
                        result["result"]["details"]["observed_partition"][
                            "tail_weights"
                        ],
                        value["tail_weights"],
                    )

            else:
                raise ValueError(
                    "Invalid test specification: unknown key " + key + " in 'out'"
                )


def generate_test_table_name(
    default_table_name_prefix: Optional[str] = "test_data_",
) -> str:
    table_name: str = default_table_name_prefix + "".join(
        [random.choice(string.ascii_letters + string.digits) for _ in range(8)]
    )
    return table_name


def _create_bigquery_engine() -> Engine:
    gcp_project = os.getenv("GE_TEST_BIGQUERY_PROJECT")
    if not gcp_project:
        raise ValueError(
            "Environment Variable GE_TEST_BIGQUERY_PROJECT is required to run BigQuery expectation tests"
        )
    return create_engine(f"bigquery://{gcp_project}/{_bigquery_dataset()}")


def _bigquery_dataset() -> str:
    dataset = os.getenv("GE_TEST_BIGQUERY_DATASET")
    if not dataset:
        raise ValueError(
            "Environment Variable GE_TEST_BIGQUERY_DATASET is required to run BigQuery expectation tests"
        )
    return dataset
