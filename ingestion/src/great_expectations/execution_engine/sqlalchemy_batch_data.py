import logging
import uuid

from great_expectations.execution_engine.execution_engine import BatchData

try:
    import sqlalchemy as sa
    from sqlalchemy.engine.default import DefaultDialect
    from sqlalchemy.exc import DatabaseError
    from sqlalchemy.sql.elements import quoted_name
except ImportError:
    sa = None
    quoted_name = None
    DefaultDialect = None

logger = logging.getLogger(__name__)


class SqlAlchemyBatchData(BatchData):
    """A class which represents a SQL alchemy batch, with properties including the construction of the batch itself
    and several getters used to access various properties."""

    def __init__(
        self,
        execution_engine,
        record_set_name: str = None,
        # Option 1
        schema_name: str = None,
        table_name: str = None,
        # Option 2
        query: str = None,
        # Option 3
        selectable=None,
        create_temp_table: bool = True,
        temp_table_name: str = None,
        temp_table_schema_name: str = None,
        use_quoted_name: bool = False,
        source_table_name: str = None,
        source_schema_name: str = None,
    ):
        """A Constructor used to initialize and SqlAlchemy Batch, create an id for it, and verify that all necessary
        parameters have been provided. If a Query is given, also builds a temporary table for this query

            Args:
                engine (SqlAlchemy Engine): \
                    A SqlAlchemy Engine or connection that will be used to access the data
                record_set_name: (string or None): \
                    The name of the record set available as a domain kwarg for Great Expectations validations. record_set_name
                    can usually be None, but is required when there are multiple record_sets in the same Batch.
                schema_name (string or None): \
                    The name of the schema_name in which the databases lie
                table_name (string or None): \
                    The name of the table that will be accessed. Either this parameter or the query parameter must be
                    specified. Default is 'None'.
                query (string or None): \
                    A query string representing a domain, which will be used to create a temporary table
                selectable (Sqlalchemy Selectable or None): \
                    A SqlAlchemy selectable representing a domain, which will be used to create a temporary table
                create_temp_table (bool): \
                    When building the batch data object from a query, this flag determines whether a temporary table should
                    be created against which to validate data from the query. If False, a subselect statement will be used
                    in each validation.
                temp_table_name (str or None): \
                    The name to use for a temporary table if one should be created. If None, a default name will be generated.
                temp_table_schema_name (str or None): \
                    The name of the schema in which a temporary table should be created. If None, the default schema will be
                    used if a temporary table is requested.
                use_quoted_name (bool): \
                    If true, names should be quoted to preserve case sensitivity on databases that usually normalize them
                source_table_name (str): \
                    For SqlAlchemyBatchData based on selectables, source_table_name provides the name of the table on which
                    the selectable is based. This is required for most kinds of table introspection (e.g. looking up column types)
                source_schema_name (str): \
                    For SqlAlchemyBatchData based on selectables, source_schema_name provides the name of the schema on which
                    the selectable is based. This is required for most kinds of table introspection (e.g. looking up column types)

        The query that will be executed against the DB can be determined in any of three ways:

            1. Specify a `schema_name` and `table_name`. This will query the whole table as a record_set. If schema_name is None, then the default schema will be used.
            2. Specify a `query`, which will be executed as-is to fetch the record_set. NOTE Abe 20201118 : This functionality is currently untested.
            3. Specify a `selectable`, which will be to fetch the record_set. This is the primary path used by DataConnectors.

        In the case of (2) and (3) you have the option to execute the query either as a temporary table, or as a subselect statement.

        In general, temporary tables invite more optimization from the query engine itself. Subselect statements may sometimes be preferred, because they do not require write access on the database.


        """
        super().__init__(execution_engine)
        engine = execution_engine.engine
        self._engine = engine
        self._record_set_name = record_set_name or "great_expectations_sub_selection"
        if not isinstance(self._record_set_name, str):
            raise TypeError(
                f"record_set_name should be of type str, not {type(record_set_name)}"
            )

        self._schema_name = schema_name
        self._use_quoted_name = use_quoted_name
        self._source_table_name = source_table_name
        self._source_schema_name = source_schema_name

        if sum(bool(x) for x in [table_name, query, selectable is not None]) != 1:
            raise ValueError(
                "Exactly one of table_name, query, or selectable must be specified"
            )
        elif (query and schema_name) or (selectable is not None and schema_name):
            raise ValueError(
                "schema_name can only be used with table_name. Use temp_table_schema_name to provide a target schema for creating a temporary table."
            )

        if table_name:
            # Suggestion: pull this block out as its own _function
            if use_quoted_name:
                table_name = quoted_name(table_name, quote=True)
            if engine.dialect.name.lower() == "bigquery":
                if schema_name is not None:
                    logger.warning(
                        "schema_name should not be used when passing a table_name for biquery. Instead, include the schema name in the table_name string."
                    )
                # In BigQuery the table name is already qualified with its schema name
                self._selectable = sa.Table(
                    table_name,
                    sa.MetaData(),
                    schema_name=None,
                )
            else:
                self._selectable = sa.Table(
                    table_name,
                    sa.MetaData(),
                    schema_name=schema_name,
                )

        elif create_temp_table:
            if temp_table_name:
                generated_table_name = temp_table_name
            else:
                # Suggestion: Pull this into a separate "_generate_temporary_table_name" method
                generated_table_name = f"ge_tmp_{str(uuid.uuid4())[:8]}"
                # mssql expects all temporary table names to have a prefix '#'
                if engine.dialect.name.lower() == "mssql":
                    generated_table_name = f"#{generated_table_name}"
            if selectable is not None:
                if engine.dialect.name.lower() == "oracle":
                    # oracle query was already passed as a string
                    query = selectable
                else:
                    # compile selectable to sql statement
                    query = selectable.compile(
                        dialect=self.sql_engine_dialect,
                        compile_kwargs={"literal_binds": True},
                    )
            self._create_temporary_table(
                generated_table_name,
                query,
                temp_table_schema_name=temp_table_schema_name,
            )
            self._selectable = sa.Table(
                generated_table_name,
                sa.MetaData(),
                schema_name=temp_table_schema_name,
            )
        else:
            if query:
                self._selectable = sa.text(query)
            else:
                self._selectable = selectable.alias(self._record_set_name)

    @property
    def sql_engine_dialect(self) -> DefaultDialect:
        """Returns the Batches' current engine dialect"""
        return self._engine.dialect

    @property
    def record_set_name(self):
        return self._record_set_name

    @property
    def source_table_name(self):
        return self._source_table_name

    @property
    def source_schema_name(self):
        return self._source_schema_name

    @property
    def selectable(self):
        return self._selectable

    @property
    def use_quoted_name(self):
        return self._use_quoted_name

    def _create_temporary_table(
        self, temp_table_name, query, temp_table_schema_name=None
    ):
        """
        Create Temporary table based on sql query. This will be used as a basis for executing expectations.
        :param query:
        """
        if self.sql_engine_dialect.name.lower() == "bigquery":
            stmt = "CREATE OR REPLACE TABLE `{temp_table_name}` AS {query}".format(
                temp_table_name=temp_table_name, query=query
            )
        elif self.sql_engine_dialect.name.lower() == "snowflake":
            if temp_table_schema_name is not None:
                temp_table_name = temp_table_schema_name + "." + temp_table_name
            stmt = (
                "CREATE OR REPLACE TEMPORARY TABLE {temp_table_name} AS {query}".format(
                    temp_table_name=temp_table_name, query=query
                )
            )
        elif self.sql_engine_dialect.name == "mysql":
            # Note: We can keep the "MySQL" clause separate for clarity, even though it is the same as the
            # generic case.
            stmt = "CREATE TEMPORARY TABLE {temp_table_name} AS {query}".format(
                temp_table_name=temp_table_name, query=query
            )
        elif self.sql_engine_dialect.name == "mssql":
            # Insert "into #{temp_table_name}" in the custom sql query right before the "from" clause
            # Split is case sensitive so detect case.
            # Note: transforming query to uppercase/lowercase has unintended consequences (i.e.,
            # changing column names), so this is not an option!
            if isinstance(query, sa.dialects.mssql.base.MSSQLCompiler):
                query = query.string  # extracting string from MSSQLCompiler object

            if "from" in query:
                strsep = "from"
            else:
                strsep = "FROM"
            querymod = query.split(strsep, maxsplit=1)
            stmt = (querymod[0] + "into {temp_table_name} from" + querymod[1]).format(
                temp_table_name=temp_table_name
            )
        elif self.sql_engine_dialect.name.lower() == "awsathena":
            stmt = "CREATE TABLE {temp_table_name} AS {query}".format(
                temp_table_name=temp_table_name, query=query
            )
        elif self.sql_engine_dialect.name.lower() == "oracle":
            # oracle 18c introduced PRIVATE temp tables which are transient objects
            stmt_1 = "CREATE PRIVATE TEMPORARY TABLE {temp_table_name} ON COMMIT PRESERVE DEFINITION AS {query}".format(
                temp_table_name=temp_table_name, query=query
            )
            # prior to oracle 18c only GLOBAL temp tables existed and only the data is transient
            # this means an empty table will persist after the db session
            stmt_2 = "CREATE GLOBAL TEMPORARY TABLE {temp_table_name} ON COMMIT PRESERVE ROWS AS {query}".format(
                temp_table_name=temp_table_name, query=query
            )
        else:
            stmt = 'CREATE TEMPORARY TABLE "{temp_table_name}" AS {query}'.format(
                temp_table_name=temp_table_name, query=query
            )
        if self.sql_engine_dialect.name.lower() == "oracle":
            try:
                self._engine.execute(stmt_1)
            except DatabaseError:
                self._engine.execute(stmt_2)
        else:
            self._engine.execute(stmt)
