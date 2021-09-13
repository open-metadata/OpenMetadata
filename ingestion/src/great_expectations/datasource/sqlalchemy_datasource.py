import datetime
import logging
from pathlib import Path
from string import Template
from urllib.parse import urlparse

from great_expectations.core.batch import Batch, BatchMarkers
from great_expectations.core.util import nested_update
from great_expectations.dataset.sqlalchemy_dataset import SqlAlchemyBatchReference
from great_expectations.datasource import LegacyDatasource
from great_expectations.exceptions import (
    DatasourceInitializationError,
    DatasourceKeyPairAuthBadPassphraseError,
)
from great_expectations.types import ClassConfig
from great_expectations.types.configurations import classConfigSchema

logger = logging.getLogger(__name__)

try:
    import sqlalchemy
    from sqlalchemy import create_engine
    from sqlalchemy.sql.elements import quoted_name

except ImportError:
    sqlalchemy = None
    create_engine = None
    logger.debug("Unable to import sqlalchemy.")


if sqlalchemy != None:
    try:
        import google.auth

        datasource_initialization_exceptions = (
            sqlalchemy.exc.OperationalError,
            sqlalchemy.exc.DatabaseError,
            sqlalchemy.exc.ArgumentError,
            google.auth.exceptions.GoogleAuthError,
        )
    except ImportError:
        datasource_initialization_exceptions = (
            sqlalchemy.exc.OperationalError,
            sqlalchemy.exc.DatabaseError,
            sqlalchemy.exc.ArgumentError,
        )


class SqlAlchemyDatasource(LegacyDatasource):
    """
    A SqlAlchemyDatasource will provide data_assets converting batch_kwargs using the following rules:
        - if the batch_kwargs include a table key, the datasource will provide a dataset object connected to that table
        - if the batch_kwargs include a query key, the datasource will create a temporary table usingthat query. The query can be parameterized according to the standard python Template engine, which uses $parameter, with additional kwargs passed to the get_batch method.

    --ge-feature-maturity-info--
        id: datasource_postgresql
        title: Datasource - PostgreSQL
        icon:
        short_description: Postgres
        description: Support for using the open source PostgresQL database as an external datasource and execution engine.
        how_to_guide_url:
        maturity: Production
        maturity_details:
            api_stability: High
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Complete
            documentation_completeness: Medium (does not have a specific how-to, but easy to use overall)
            bug_risk: Low
            expectation_completeness: Moderate

        id: datasource_bigquery
        title: Datasource - BigQuery
        icon:
        short_description: BigQuery
        description: Use Google BigQuery as an execution engine and external datasource to validate data.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_datasources/how_to_configure_a_bigquery_datasource.html
        maturity: Beta
        maturity_details:
            api_stability: Unstable (table generator inability to work with triple-dotted, temp table usability, init flow calls setup "other")
            implementation_completeness: Moderate
            unit_test_coverage: Partial (no test coverage for temp table creation)
            integration_infrastructure_test_coverage: Minimal
            documentation_completeness: Partial (how-to does not cover all cases)
            bug_risk: High (we *know* of several bugs, including inability to list tables, SQLAlchemy URL incomplete)
            expectation_completeness: Moderate

        id: datasource_redshift
        title: Datasource - Amazon Redshift
        icon:
        short_description: Redshift
        description: Use Amazon Redshift as an execution engine and external datasource to validate data.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_datasources/how_to_configure_a_redshift_datasource.html
        maturity: Beta
        maturity_details:
            api_stability: Moderate (potential metadata/introspection method special handling for performance)
            implementation_completeness: Complete
            unit_test_coverage: Minimal
            integration_infrastructure_test_coverage: Minimal (none automated)
            documentation_completeness: Moderate
            bug_risk: Moderate
            expectation_completeness: Moderate

        id: datasource_snowflake
        title: Datasource - Snowflake
        icon:
        short_description: Snowflake
        description: Use Snowflake Computing as an execution engine and external datasource to validate data.
        how_to_guide_url: https://docs.greatexpectations.io/en/latest/how_to_guides/configuring_datasources/how_to_configure_a_snowflake_datasource.html
        maturity: Production
        maturity_details:
            api_stability: High
            implementation_completeness: Complete
            unit_test_coverage: Complete
            integration_infrastructure_test_coverage: Minimal (manual only)
            documentation_completeness: Complete
            bug_risk: Low
            expectation_completeness: Complete

        id: datasource_mssql
        title: Datasource - Microsoft SQL Server
        icon:
        short_description: Microsoft SQL Server
        description: Use Microsoft SQL Server as an execution engine and external datasource to validate data.
        how_to_guide_url:
        maturity: Experimental
        maturity_details:
            api_stability: High
            implementation_completeness: Moderate
            unit_test_coverage: Minimal (none)
            integration_infrastructure_test_coverage: Minimal (none)
            documentation_completeness: Minimal
            bug_risk: High
            expectation_completeness: Low (some required queries do not generate properly, such as related to nullity)

        id: datasource_mysql
        title: Datasource - MySQL
        icon:
        short_description: MySQL
        description: Use MySQL as an execution engine and external datasource to validate data.
        how_to_guide_url:
        maturity: Experimental
        maturity_details:
            api_stability: Low (no consideration for temp tables)
            implementation_completeness: Low (no consideration for temp tables)
            unit_test_coverage: Minimal (none)
            integration_infrastructure_test_coverage: Minimal (none)
            documentation_completeness:  Minimal (none)
            bug_risk: Unknown
            expectation_completeness: Unknown

        id: datasource_mariadb
        title: Datasource - MariaDB
        icon:
        short_description: MariaDB
        description: Use MariaDB as an execution engine and external datasource to validate data.
        how_to_guide_url:
        maturity: Experimental
        maturity_details:
            api_stability: Low (no consideration for temp tables)
            implementation_completeness: Low (no consideration for temp tables)
            unit_test_coverage: Minimal (none)
            integration_infrastructure_test_coverage: Minimal (none)
            documentation_completeness:  Minimal (none)
            bug_risk: Unknown
            expectation_completeness: Unknown
    """

    recognized_batch_parameters = {"query_parameters", "limit", "dataset_options"}

    @classmethod
    def build_configuration(
        cls, data_asset_type=None, batch_kwargs_generators=None, **kwargs
    ):
        """
        Build a full configuration object for a datasource, potentially including generators with defaults.

        Args:
            data_asset_type: A ClassConfig dictionary
            batch_kwargs_generators: Generator configuration dictionary
            **kwargs: Additional kwargs to be part of the datasource constructor's initialization

        Returns:
            A complete datasource configuration.

        """

        if data_asset_type is None:
            data_asset_type = {
                "class_name": "SqlAlchemyDataset",
                "module_name": "great_expectations.dataset",
            }
        else:
            data_asset_type = classConfigSchema.dump(ClassConfig(**data_asset_type))

        configuration = kwargs
        configuration["data_asset_type"] = data_asset_type
        if batch_kwargs_generators is not None:
            configuration["batch_kwargs_generators"] = batch_kwargs_generators

        return configuration

    def __init__(
        self,
        name="default",
        data_context=None,
        data_asset_type=None,
        credentials=None,
        batch_kwargs_generators=None,
        **kwargs
    ):
        if not sqlalchemy:
            raise DatasourceInitializationError(
                name, "ModuleNotFoundError: No module named 'sqlalchemy'"
            )

        configuration_with_defaults = SqlAlchemyDatasource.build_configuration(
            data_asset_type, batch_kwargs_generators, **kwargs
        )
        data_asset_type = configuration_with_defaults.pop("data_asset_type")
        batch_kwargs_generators = configuration_with_defaults.pop(
            "batch_kwargs_generators", None
        )
        super().__init__(
            name,
            data_context=data_context,
            data_asset_type=data_asset_type,
            batch_kwargs_generators=batch_kwargs_generators,
            **configuration_with_defaults
        )

        if credentials is not None:
            self._datasource_config.update({"credentials": credentials})
        else:
            credentials = {}

        try:
            # if an engine was provided, use that
            if "engine" in kwargs:
                self.engine = kwargs.pop("engine")

            # if a connection string or url was provided, use that
            elif "connection_string" in kwargs:
                connection_string = kwargs.pop("connection_string")
                self.engine = create_engine(connection_string, **kwargs)
                connection = self.engine.connect()
                connection.close()
            elif "url" in credentials:
                url = credentials.pop("url")
                self.drivername = urlparse(url).scheme
                self.engine = create_engine(url, **kwargs)
                connection = self.engine.connect()
                connection.close()

            # Otherwise, connect using remaining kwargs
            else:
                (
                    options,
                    create_engine_kwargs,
                    drivername,
                ) = self._get_sqlalchemy_connection_options(**kwargs)
                self.drivername = drivername
                self.engine = create_engine(options, **create_engine_kwargs)
                connection = self.engine.connect()
                connection.close()

            # since we switched to lazy loading of Datasources when we initialise a DataContext,
            # the dialect of SQLAlchemy Datasources cannot be obtained reliably when we send
            # "data_context.__init__" events.
            # This event fills in the SQLAlchemy dialect.
            if data_context is not None and getattr(
                data_context, "_usage_statistics_handler", None
            ):
                handler = data_context._usage_statistics_handler
                handler.send_usage_message(
                    event="datasource.sqlalchemy.connect",
                    event_payload={
                        "anonymized_name": handler._datasource_anonymizer.anonymize(
                            self.name
                        ),
                        "sqlalchemy_dialect": self.engine.name,
                    },
                    success=True,
                )

        except datasource_initialization_exceptions as sqlalchemy_error:
            raise DatasourceInitializationError(self._name, str(sqlalchemy_error))

        self._build_generators()

    def _get_sqlalchemy_connection_options(self, **kwargs):
        drivername = None
        if "credentials" in self._datasource_config:
            credentials = self._datasource_config["credentials"]
        else:
            credentials = {}

        create_engine_kwargs = {}

        connect_args = credentials.pop("connect_args", None)
        if connect_args:
            create_engine_kwargs["connect_args"] = connect_args

        # if a connection string or url was provided in the profile, use that
        if "connection_string" in credentials:
            options = credentials["connection_string"]
        elif "url" in credentials:
            options = credentials["url"]
        else:
            # Update credentials with anything passed during connection time
            drivername = credentials.pop("drivername")
            schema_name = credentials.pop("schema_name", None)
            if schema_name is not None:
                logger.warning(
                    "schema_name specified creating a URL with schema is not supported. Set a default "
                    "schema on the user connecting to your database."
                )

            if "private_key_path" in credentials:
                options, create_engine_kwargs = self._get_sqlalchemy_key_pair_auth_url(
                    drivername, credentials
                )
            else:
                options = sqlalchemy.engine.url.URL(drivername, **credentials)
        return options, create_engine_kwargs, drivername

    def _get_sqlalchemy_key_pair_auth_url(self, drivername, credentials):
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization

        private_key_path = credentials.pop("private_key_path")
        private_key_passphrase = credentials.pop("private_key_passphrase")

        with Path(private_key_path).expanduser().resolve().open(mode="rb") as key:
            try:
                p_key = serialization.load_pem_private_key(
                    key.read(),
                    password=private_key_passphrase.encode()
                    if private_key_passphrase
                    else None,
                    backend=default_backend(),
                )
            except ValueError as e:
                if "incorrect password" in str(e).lower():
                    raise DatasourceKeyPairAuthBadPassphraseError(
                        datasource_name="SqlAlchemyDatasource",
                        message="Decryption of key failed, was the passphrase incorrect?",
                    ) from e
                else:
                    raise e
        pkb = p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        credentials_driver_name = credentials.pop("drivername", None)
        create_engine_kwargs = {"connect_args": {"private_key": pkb}}
        return (
            sqlalchemy.engine.url.URL(
                drivername or credentials_driver_name, **credentials
            ),
            create_engine_kwargs,
        )

    def get_batch(self, batch_kwargs, batch_parameters=None):
        # We need to build a batch_id to be used in the dataframe
        batch_markers = BatchMarkers(
            {
                "ge_load_time": datetime.datetime.now(datetime.timezone.utc).strftime(
                    "%Y%m%dT%H%M%S.%fZ"
                )
            }
        )

        if "bigquery_temp_table" in batch_kwargs:
            query_support_table_name = batch_kwargs.get("bigquery_temp_table")
        elif "snowflake_transient_table" in batch_kwargs:
            # Snowflake can use either a transient or temp table, so we allow a table_name to be provided
            query_support_table_name = batch_kwargs.get("snowflake_transient_table")
        else:
            query_support_table_name = None

        if "query" in batch_kwargs:
            if "limit" in batch_kwargs or "offset" in batch_kwargs:
                logger.warning(
                    "Limit and offset parameters are ignored when using query-based batch_kwargs; consider "
                    "adding limit and offset directly to the generated query."
                )
            if "query_parameters" in batch_kwargs:
                query = Template(batch_kwargs["query"]).safe_substitute(
                    batch_kwargs["query_parameters"]
                )
            else:
                query = batch_kwargs["query"]
            batch_reference = SqlAlchemyBatchReference(
                engine=self.engine,
                query=query,
                table_name=query_support_table_name,
                schema=batch_kwargs.get("schema"),
            )
        elif "table" in batch_kwargs:
            table = batch_kwargs["table"]
            if batch_kwargs.get("use_quoted_name"):
                table = quoted_name(table, quote=True)

            limit = batch_kwargs.get("limit")
            offset = batch_kwargs.get("offset")
            if limit is not None or offset is not None:
                # AWS Athena does not support offset
                if (
                    offset is not None
                    and self.engine.dialect.name.lower() == "awsathena"
                ):
                    raise NotImplementedError("AWS Athena does not support OFFSET.")
                logger.info(
                    "Generating query from table batch_kwargs based on limit and offset"
                )

                # In BigQuery the table name is already qualified with its schema name
                if self.engine.dialect.name.lower() == "bigquery":
                    schema = None

                else:
                    schema = batch_kwargs.get("schema")
                # limit doesn't compile properly for oracle so we will append rownum to query string later
                if self.engine.dialect.name.lower() == "oracle":
                    raw_query = sqlalchemy.select([sqlalchemy.text("*")]).select_from(
                        sqlalchemy.schema.Table(
                            table, sqlalchemy.MetaData(), schema=schema
                        )
                    )
                else:
                    raw_query = (
                        sqlalchemy.select([sqlalchemy.text("*")])
                        .select_from(
                            sqlalchemy.schema.Table(
                                table, sqlalchemy.MetaData(), schema=schema
                            )
                        )
                        .offset(offset)
                        .limit(limit)
                    )
                query = str(
                    raw_query.compile(
                        self.engine, compile_kwargs={"literal_binds": True}
                    )
                )
                # use rownum instead of limit in oracle
                if self.engine.dialect.name.lower() == "oracle":
                    query += "\nWHERE ROWNUM <= %d" % limit
                batch_reference = SqlAlchemyBatchReference(
                    engine=self.engine,
                    query=query,
                    table_name=query_support_table_name,
                    schema=batch_kwargs.get("schema"),
                )
            else:
                batch_reference = SqlAlchemyBatchReference(
                    engine=self.engine,
                    table_name=table,
                    schema=batch_kwargs.get("schema"),
                )
        else:
            raise ValueError(
                "Invalid batch_kwargs: exactly one of 'table' or 'query' must be specified"
            )

        return Batch(
            datasource_name=self.name,
            batch_kwargs=batch_kwargs,
            data=batch_reference,
            batch_parameters=batch_parameters,
            batch_markers=batch_markers,
            data_context=self._data_context,
        )

    def process_batch_parameters(
        self, query_parameters=None, limit=None, dataset_options=None
    ):
        batch_kwargs = super().process_batch_parameters(
            limit=limit,
            dataset_options=dataset_options,
        )
        nested_update(batch_kwargs, {"query_parameters": query_parameters})
        return batch_kwargs
