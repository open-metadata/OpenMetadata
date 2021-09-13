import enum
import json
import logging
import os
import platform
import sys
import textwrap
import uuid

import click

import great_expectations.exceptions as ge_exceptions
from great_expectations import DataContext, rtd_url_ge_version
from great_expectations.cli.v012 import toolkit
from great_expectations.cli.v012.cli_messages import NO_DATASOURCES_FOUND
from great_expectations.cli.v012.docs import build_docs
from great_expectations.cli.v012.mark import Mark as mark
from great_expectations.cli.v012.util import (
    CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    cli_message,
    cli_message_dict,
    verify_library_dependent_modules,
)
from great_expectations.core.expectation_suite import ExpectationSuite
from great_expectations.data_context.types.base import DatasourceConfigSchema
from great_expectations.datasource import (
    PandasDatasource,
    SparkDFDatasource,
    SqlAlchemyDatasource,
)
from great_expectations.datasource.batch_kwargs_generator import (
    ManualBatchKwargsGenerator,
)
from great_expectations.datasource.batch_kwargs_generator.table_batch_kwargs_generator import (
    TableBatchKwargsGenerator,
)
from great_expectations.exceptions import (
    BatchKwargsError,
    DatasourceInitializationError,
)
from great_expectations.validator.validator import BridgeValidator

logger = logging.getLogger(__name__)

try:
    import sqlalchemy
except ImportError:
    logger.debug(
        "Unable to load SqlAlchemy context; install optional sqlalchemy dependency for support"
    )
    sqlalchemy = None


class DatasourceTypes(enum.Enum):
    PANDAS = "pandas"
    SQL = "sql"
    SPARK = "spark"
    # TODO DBT = "dbt"


MANUAL_GENERATOR_CLASSES = ManualBatchKwargsGenerator


class SupportedDatabases(enum.Enum):
    MYSQL = "MySQL"
    POSTGRES = "Postgres"
    REDSHIFT = "Redshift"
    SNOWFLAKE = "Snowflake"
    BIGQUERY = "BigQuery"
    OTHER = "other - Do you have a working SQLAlchemy connection string?"
    # TODO MSSQL


@click.group()
def datasource():
    """Datasource operations"""
    pass


@datasource.command(name="new")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
def datasource_new(directory):
    """Add a new datasource to the data context."""
    context = toolkit.load_data_context_with_error_handling(directory)
    datasource_name, data_source_type = add_datasource(context)

    if datasource_name:
        cli_message(f"A new datasource '{datasource_name}' was added to your project.")
        toolkit.send_usage_message(
            data_context=context, event="cli.datasource.new", success=True
        )
    else:  # no datasource was created
        toolkit.send_usage_message(
            data_context=context, event="cli.datasource.new", success=False
        )
        sys.exit(1)


@datasource.command(name="delete")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.argument("datasource")
def delete_datasource(directory, datasource):
    """Delete the datasource specified as an argument"""
    context = toolkit.load_data_context_with_error_handling(directory)
    try:
        context.delete_datasource(datasource)
    except ValueError:
        cli_message(
            "<red>{}</red>".format(f"Datasource {datasource} could not be found.")
        )
        sys.exit(1)
    try:
        context.get_datasource(datasource)
    except ValueError:
        cli_message("<green>{}</green>".format("Datasource deleted successfully."))
        sys.exit(1)
    else:
        cli_message("<red>{}</red>".format("Datasource not deleted."))
        sys.exit(1)


@datasource.command(name="list")
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
def datasource_list(directory):
    """List known datasources."""
    context = toolkit.load_data_context_with_error_handling(directory)
    datasources = context.list_datasources()
    datasource_count = len(datasources)

    if datasource_count == 0:
        list_intro_string = "No Datasources found"
    else:
        list_intro_string = _build_datasource_intro_string(datasource_count)

    cli_message(list_intro_string)
    for datasource in datasources:
        cli_message("")
        cli_message_dict(datasource)

    toolkit.send_usage_message(
        data_context=context, event="cli.datasource.list", success=True
    )


def _build_datasource_intro_string(datasource_count):
    if datasource_count == 1:
        list_intro_string = "1 Datasource found:"
    if datasource_count > 1:
        list_intro_string = f"{datasource_count} Datasources found:"
    return list_intro_string


@datasource.command(name="profile")
@click.argument("datasource", default=None, required=False)
@click.option(
    "--batch-kwargs-generator-name",
    "-g",
    default=None,
    help="The name of the batch kwargs generator configured in the datasource. It will list data assets in the "
    "datasource",
)
@click.option(
    "--data-assets",
    "-l",
    default=None,
    help="Comma-separated list of the names of data assets that should be profiled. Requires datasource specified.",
)
@click.option(
    "--profile_all_data_assets",
    "-A",
    is_flag=True,
    default=False,
    help="Profile ALL data assets within the target data source. "
    "If True, this will override --max_data_assets.",
)
@click.option(
    "--assume-yes",
    "--yes",
    "-y",
    is_flag=True,
    default=False,
    help="By default request confirmation unless you specify -y/--yes/--assume-yes flag to skip dialog",
)
@click.option(
    "--directory",
    "-d",
    default=None,
    help="The project's great_expectations directory.",
)
@click.option(
    "--view/--no-view",
    help="By default open in browser unless you specify the --no-view flag",
    default=True,
)
@click.option(
    "--additional-batch-kwargs",
    default=None,
    help="Additional keyword arguments to be provided to get_batch when loading the data asset. Must be a valid JSON dictionary",
)
@mark.cli_as_experimental
def datasource_profile(
    datasource,
    batch_kwargs_generator_name,
    data_assets,
    profile_all_data_assets,
    directory,
    view,
    additional_batch_kwargs,
    assume_yes,
):
    """
    Profile a datasource (Experimental)

    If the optional data_assets and profile_all_data_assets arguments are not specified, the profiler will check
    if the number of data assets in the datasource exceeds the internally defined limit. If it does, it will
    prompt the user to either specify the list of data assets to profile or to profile all.
    If the limit is not exceeded, the profiler will profile all data assets in the datasource.
    """
    context = toolkit.load_data_context_with_error_handling(directory)

    try:
        if additional_batch_kwargs is not None:
            # TODO refactor out json load check in suite edit and add here
            additional_batch_kwargs = json.loads(additional_batch_kwargs)
            # TODO refactor batch load check in suite edit and add here

        if datasource is None:
            datasources = [
                _datasource["name"] for _datasource in context.list_datasources()
            ]
            if not datasources:
                cli_message(NO_DATASOURCES_FOUND)
                toolkit.send_usage_message(
                    data_context=context, event="cli.datasource.profile", success=False
                )
                sys.exit(1)
            elif len(datasources) > 1:
                cli_message(
                    "<red>Error: please specify the datasource to profile. "
                    "Available datasources: " + ", ".join(datasources) + "</red>"
                )
                toolkit.send_usage_message(
                    data_context=context, event="cli.datasource.profile", success=False
                )
                sys.exit(1)
            else:
                profile_datasource(
                    context,
                    datasources[0],
                    batch_kwargs_generator_name=batch_kwargs_generator_name,
                    data_assets=data_assets,
                    profile_all_data_assets=profile_all_data_assets,
                    open_docs=view,
                    additional_batch_kwargs=additional_batch_kwargs,
                    skip_prompt_flag=assume_yes,
                )
                toolkit.send_usage_message(
                    data_context=context, event="cli.datasource.profile", success=True
                )
        else:
            profile_datasource(
                context,
                datasource,
                batch_kwargs_generator_name=batch_kwargs_generator_name,
                data_assets=data_assets,
                profile_all_data_assets=profile_all_data_assets,
                open_docs=view,
                additional_batch_kwargs=additional_batch_kwargs,
                skip_prompt_flag=assume_yes,
            )
            toolkit.send_usage_message(
                data_context=context, event="cli.datasource.profile", success=True
            )
    except Exception as e:
        toolkit.send_usage_message(
            data_context=context, event="cli.datasource.profile", success=False
        )
        raise e


def add_datasource(context, choose_one_data_asset=False):
    """
    Interactive flow for adding a datasource to an existing context.

    :param context:
    :param choose_one_data_asset: optional - if True, this signals the method that the intent
            is to let user choose just one data asset (e.g., a file) and there is no need
            to configure a batch kwargs generator that comprehensively scans the datasource for data assets
    :return: a tuple: datasource_name, data_source_type
    """

    msg_prompt_where_is_your_data = """
What data would you like Great Expectations to connect to?
    1. Files on a filesystem (for processing with Pandas or Spark)
    2. Relational database (SQL)
"""

    msg_prompt_files_compute_engine = """
What are you processing your files with?
    1. Pandas
    2. PySpark
"""

    data_source_location_selection = click.prompt(
        msg_prompt_where_is_your_data, type=click.Choice(["1", "2"]), show_choices=False
    )

    datasource_name = None
    data_source_type = None

    if data_source_location_selection == "1":
        data_source_compute_selection = click.prompt(
            msg_prompt_files_compute_engine,
            type=click.Choice(["1", "2"]),
            show_choices=False,
        )

        if data_source_compute_selection == "1":  # pandas

            data_source_type = DatasourceTypes.PANDAS

            datasource_name = _add_pandas_datasource(
                context, passthrough_generator_only=choose_one_data_asset
            )

        elif data_source_compute_selection == "2":  # Spark

            data_source_type = DatasourceTypes.SPARK

            datasource_name = _add_spark_datasource(
                context, passthrough_generator_only=choose_one_data_asset
            )
    else:
        data_source_type = DatasourceTypes.SQL
        datasource_name = _add_sqlalchemy_datasource(context)

    return datasource_name, data_source_type


def _add_pandas_datasource(
    context, passthrough_generator_only=True, prompt_for_datasource_name=True
):
    toolkit.send_usage_message(
        data_context=context,
        event="cli.new_ds_choice",
        event_payload={"type": "pandas"},
        success=True,
    )

    if passthrough_generator_only:
        datasource_name = "files_datasource"
        configuration = PandasDatasource.build_configuration()

    else:
        path = click.prompt(
            msg_prompt_filesys_enter_base_path,
            type=click.Path(exists=True, file_okay=False),
        )

        if path.startswith("./"):
            path = path[2:]

        if path.endswith("/"):
            basenamepath = path[:-1]
        else:
            basenamepath = path

        datasource_name = os.path.basename(basenamepath) + "__dir"
        if prompt_for_datasource_name:
            datasource_name = click.prompt(
                msg_prompt_datasource_name, default=datasource_name
            )

        configuration = PandasDatasource.build_configuration(
            batch_kwargs_generators={
                "subdir_reader": {
                    "class_name": "SubdirReaderBatchKwargsGenerator",
                    "base_directory": os.path.join("..", path),
                }
            }
        )

        configuration["class_name"] = "PandasDatasource"
        configuration["module_name"] = "great_expectations.datasource"
        errors = DatasourceConfigSchema().validate(configuration)
        if len(errors) != 0:
            raise ge_exceptions.GreatExpectationsError(
                f"Invalid Datasource configuration: {errors:s}"
            )

    cli_message(
        """
Great Expectations will now add a new Datasource '{:s}' to your deployment, by adding this entry to your great_expectations.yml:

{:s}
""".format(
            datasource_name,
            textwrap.indent(toolkit.yaml.dump({datasource_name: configuration}), "  "),
        )
    )

    toolkit.confirm_proceed_or_exit(
        continuation_message="Okay, exiting now. To learn more about adding datasources, run great_expectations "
        "datasource --help or visit https://docs.greatexpectations.io/"
    )

    context.add_datasource(name=datasource_name, **configuration)
    return datasource_name


def _add_sqlalchemy_datasource(context, prompt_for_datasource_name=True):

    msg_success_database = (
        "\n<green>Great Expectations connected to your database!</green>"
    )

    if not _verify_sqlalchemy_dependent_modules():
        return None

    db_choices = [str(x) for x in list(range(1, 1 + len(SupportedDatabases)))]
    selected_database = (
        int(
            click.prompt(
                msg_prompt_choose_database,
                type=click.Choice(db_choices),
                show_choices=False,
            )
        )
        - 1
    )  # don't show user a zero index list :)

    selected_database = list(SupportedDatabases)[selected_database]

    toolkit.send_usage_message(
        data_context=context,
        event="cli.new_ds_choice",
        event_payload={"type": "sqlalchemy", "db": selected_database.name},
        success=True,
    )

    datasource_name = f"my_{selected_database.value.lower()}_db"
    if selected_database == SupportedDatabases.OTHER:
        datasource_name = "my_database"
    if prompt_for_datasource_name:
        datasource_name = click.prompt(
            msg_prompt_datasource_name, default=datasource_name
        )

    credentials = {}
    # Since we don't want to save the database credentials in the config file that will be
    # committed in the repo, we will use our Variable Substitution feature to store the credentials
    # in the credentials file (that will not be committed, since it is in the uncommitted directory)
    # with the datasource's name as the variable name.
    # The value of the datasource's "credentials" key in the config file (great_expectations.yml) will
    # be ${datasource name}.
    # GE will replace the ${datasource name} with the value from the credentials file in runtime.

    while True:
        cli_message(msg_db_config.format(datasource_name))

        if selected_database == SupportedDatabases.MYSQL:
            if not _verify_mysql_dependent_modules():
                return None

            credentials = _collect_mysql_credentials(default_credentials=credentials)
        elif selected_database == SupportedDatabases.POSTGRES:
            if not _verify_postgresql_dependent_modules():
                return None

            credentials = _collect_postgres_credentials(default_credentials=credentials)
        elif selected_database == SupportedDatabases.REDSHIFT:
            if not _verify_redshift_dependent_modules():
                return None

            credentials = _collect_redshift_credentials(default_credentials=credentials)
        elif selected_database == SupportedDatabases.SNOWFLAKE:
            if not _verify_snowflake_dependent_modules():
                return None

            credentials = _collect_snowflake_credentials(
                default_credentials=credentials
            )
        elif selected_database == SupportedDatabases.BIGQUERY:
            if not _verify_bigquery_dependent_modules():
                return None

            credentials = _collect_bigquery_credentials(default_credentials=credentials)
        elif selected_database == SupportedDatabases.OTHER:
            sqlalchemy_url = click.prompt(
                """What is the url/connection string for the sqlalchemy connection?
(reference: https://docs.sqlalchemy.org/en/latest/core/engines.html#database-urls)
""",
                show_default=False,
            ).strip()
            credentials = {"url": sqlalchemy_url}

        context.save_config_variable(datasource_name, credentials)

        message = """
<red>Cannot connect to the database.</red>
  - Please check your environment and the configuration you provided.
  - Database Error: {0:s}"""
        try:
            cli_message(
                "<cyan>Attempting to connect to your database. This may take a moment...</cyan>"
            )

            configuration = SqlAlchemyDatasource.build_configuration(
                credentials="${" + datasource_name + "}"
            )

            configuration["class_name"] = "SqlAlchemyDatasource"
            configuration["module_name"] = "great_expectations.datasource"
            errors = DatasourceConfigSchema().validate(configuration)
            if len(errors) != 0:
                raise ge_exceptions.GreatExpectationsError(
                    f"Invalid Datasource configuration: {errors:s}"
                )

            cli_message(
                """
Great Expectations will now add a new Datasource '{0:s}' to your deployment, by adding this entry to your great_expectations.yml:

{1:s}
The credentials will be saved in uncommitted/config_variables.yml under the key '{0:s}'
""".format(
                    datasource_name,
                    textwrap.indent(
                        toolkit.yaml.dump({datasource_name: configuration}), "  "
                    ),
                )
            )

            toolkit.confirm_proceed_or_exit()
            context.add_datasource(name=datasource_name, **configuration)
            cli_message(msg_success_database)
            break
        except ModuleNotFoundError as de:
            cli_message(message.format(str(de)))
            return None

        except DatasourceInitializationError as de:
            cli_message(message.format(str(de)))
            if not click.confirm("Enter the credentials again?", default=True):
                context.add_datasource(
                    datasource_name,
                    initialize=False,
                    module_name="great_expectations.datasource",
                    class_name="SqlAlchemyDatasource",
                    data_asset_type={"class_name": "SqlAlchemyDataset"},
                    credentials="${" + datasource_name + "}",
                )
                # TODO this message about continuing may not be accurate
                cli_message(
                    """
We saved datasource {:s} in {:s} and the credentials you entered in {:s}.
Since we could not connect to the database, you can complete troubleshooting in the configuration files documented in the how-to guides here:
<blue>https://docs.greatexpectations.io/en/latest/guides/how_to_guides/configuring_datasources.html?utm_source=cli&utm_medium=init&utm_campaign={:s}#{:s}</blue> .

After you connect to the datasource, run great_expectations init to continue.

""".format(
                        datasource_name,
                        DataContext.GE_YML,
                        context.get_config()["config_variables_file_path"],
                        rtd_url_ge_version,
                        selected_database.value.lower(),
                    )
                )
                return None

    return datasource_name


def _should_hide_input():
    """
    This is a workaround to help identify Windows and adjust the prompts accordingly
    since hidden prompts may freeze in certain Windows terminals
    """
    if "windows" in platform.platform().lower():
        return False
    return True


def _collect_postgres_credentials(default_credentials=None):
    if default_credentials is None:
        default_credentials = {}

    credentials = {"drivername": "postgresql"}

    credentials["host"] = click.prompt(
        "What is the host for the postgres connection?",
        default=default_credentials.get("host", "localhost"),
    ).strip()
    credentials["port"] = click.prompt(
        "What is the port for the postgres connection?",
        default=default_credentials.get("port", "5432"),
    ).strip()
    credentials["username"] = click.prompt(
        "What is the username for the postgres connection?",
        default=default_credentials.get("username", "postgres"),
    ).strip()
    # This is a minimal workaround we're doing to deal with hidden input problems using Git Bash on Windows
    # TODO: Revisit this if we decide to fully support Windows and identify if there is a better solution
    credentials["password"] = click.prompt(
        "What is the password for the postgres connection?",
        default="",
        show_default=False,
        hide_input=_should_hide_input(),
    )
    credentials["database"] = click.prompt(
        "What is the database name for the postgres connection?",
        default=default_credentials.get("database", "postgres"),
        show_default=True,
    ).strip()

    return credentials


def _collect_snowflake_credentials(default_credentials=None):
    if default_credentials is None:
        default_credentials = {}
    credentials = {"drivername": "snowflake"}

    auth_method = click.prompt(
        """What authentication method would you like to use?
    1. User and Password
    2. Single sign-on (SSO)
    3. Key pair authentication
""",
        type=click.Choice(["1", "2", "3"]),
        show_choices=False,
    )

    credentials["username"] = click.prompt(
        "What is the user login name for the snowflake connection?",
        default=default_credentials.get("username", ""),
    ).strip()

    credentials["host"] = click.prompt(
        "What is the account name for the snowflake connection (include region -- ex "
        "'ABCD.us-east-1')?",
        default=default_credentials.get("host", ""),
    ).strip()

    database = click.prompt(
        "What is database name for the snowflake connection? (optional -- leave blank for none)",
        default=default_credentials.get("database", ""),
    ).strip()
    if len(database) > 0:
        credentials["database"] = database

    credentials["query"] = {}
    schema = click.prompt(
        "What is schema name for the snowflake connection? (optional -- leave "
        "blank for none)",
        default=default_credentials.get("schema_name", ""),
    ).strip()

    if len(schema) > 0:
        credentials["query"]["schema"] = schema
    warehouse = click.prompt(
        "What is warehouse name for the snowflake connection? (optional "
        "-- leave blank for none)",
        default=default_credentials.get("warehouse", ""),
    ).strip()

    if len(warehouse) > 0:
        credentials["query"]["warehouse"] = warehouse

    role = click.prompt(
        "What is role name for the snowflake connection? (optional -- leave blank for none)",
        default=default_credentials.get("role", ""),
    ).strip()
    if len(role) > 0:
        credentials["query"]["role"] = role

    if auth_method == "1":
        credentials = {**credentials, **_collect_snowflake_credentials_user_password()}
    elif auth_method == "2":
        credentials = {**credentials, **_collect_snowflake_credentials_sso()}
    elif auth_method == "3":
        credentials = {**credentials, **_collect_snowflake_credentials_key_pair()}
    return credentials


def _collect_snowflake_credentials_user_password():
    credentials = {}

    credentials["password"] = click.prompt(
        "What is the password for the snowflake connection?",
        default="",
        show_default=False,
        hide_input=True,
    )

    return credentials


def _collect_snowflake_credentials_sso():
    credentials = {}

    credentials["connect_args"] = {}
    credentials["connect_args"]["authenticator"] = click.prompt(
        "Valid okta URL or 'externalbrowser' used to connect through SSO",
        default="externalbrowser",
        show_default=False,
    )

    return credentials


def _collect_snowflake_credentials_key_pair():
    credentials = {}

    credentials["private_key_path"] = click.prompt(
        "Path to the private key used for authentication",
        show_default=False,
    )

    credentials["private_key_passphrase"] = click.prompt(
        "Passphrase for the private key used for authentication (optional -- leave blank for none)",
        default="",
        show_default=False,
    )

    return credentials


def _collect_bigquery_credentials(default_credentials=None):
    sqlalchemy_url = click.prompt(
        """What is the SQLAlchemy url/connection string for the BigQuery connection?
(reference: https://github.com/mxmzdlv/pybigquery#connection-string-parameters)
""",
        show_default=False,
    ).strip()
    credentials = {"url": sqlalchemy_url}

    return credentials


def _collect_mysql_credentials(default_credentials=None):
    # We are insisting on pymysql driver when adding a MySQL datasource through the CLI
    # to avoid overcomplication of this flow.
    # If user wants to use another driver, they must create the sqlalchemy connection
    # URL by themselves in config_variables.yml
    if default_credentials is None:
        default_credentials = {}

    credentials = {"drivername": "mysql+pymysql"}

    credentials["host"] = click.prompt(
        "What is the host for the MySQL connection?",
        default=default_credentials.get("host", "localhost"),
    ).strip()
    credentials["port"] = click.prompt(
        "What is the port for the MySQL connection?",
        default=default_credentials.get("port", "3306"),
    ).strip()
    credentials["username"] = click.prompt(
        "What is the username for the MySQL connection?",
        default=default_credentials.get("username", ""),
    ).strip()
    credentials["password"] = click.prompt(
        "What is the password for the MySQL connection?",
        default="",
        show_default=False,
        hide_input=True,
    )
    credentials["database"] = click.prompt(
        "What is the database name for the MySQL connection?",
        default=default_credentials.get("database", ""),
    ).strip()

    return credentials


def _collect_redshift_credentials(default_credentials=None):
    # We are insisting on psycopg2 driver when adding a Redshift datasource through the CLI
    # to avoid overcomplication of this flow.
    # If user wants to use another driver, they must create the sqlalchemy connection
    # URL by themselves in config_variables.yml
    if default_credentials is None:
        default_credentials = {}

    credentials = {"drivername": "postgresql+psycopg2"}

    # required

    credentials["host"] = click.prompt(
        "What is the host for the Redshift connection?",
        default=default_credentials.get("host", ""),
    ).strip()
    credentials["port"] = click.prompt(
        "What is the port for the Redshift connection?",
        default=default_credentials.get("port", "5439"),
    ).strip()
    credentials["username"] = click.prompt(
        "What is the username for the Redshift connection?",
        default=default_credentials.get("username", ""),
    ).strip()
    # This is a minimal workaround we're doing to deal with hidden input problems using Git Bash on Windows
    # TODO: Revisit this if we decide to fully support Windows and identify if there is a better solution
    credentials["password"] = click.prompt(
        "What is the password for the Redshift connection?",
        default="",
        show_default=False,
        hide_input=_should_hide_input(),
    )
    credentials["database"] = click.prompt(
        "What is the database name for the Redshift connection?",
        default=default_credentials.get("database", ""),
    ).strip()

    # optional

    credentials["query"] = {}
    credentials["query"]["sslmode"] = click.prompt(
        "What is sslmode name for the Redshift connection?",
        default=default_credentials.get("sslmode", "prefer"),
    )

    return credentials


def _add_spark_datasource(
    context, passthrough_generator_only=True, prompt_for_datasource_name=True
):
    toolkit.send_usage_message(
        data_context=context,
        event="cli.new_ds_choice",
        event_payload={"type": "spark"},
        success=True,
    )

    if not _verify_pyspark_dependent_modules():
        return None

    if passthrough_generator_only:
        datasource_name = "files_spark_datasource"

        # configuration = SparkDFDatasource.build_configuration(batch_kwargs_generators={
        #     "default": {
        #         "class_name": "PassthroughGenerator",
        #     }
        # }
        # )
        configuration = SparkDFDatasource.build_configuration()

    else:
        path = click.prompt(
            msg_prompt_filesys_enter_base_path,
            type=click.Path(exists=True, file_okay=False),
        ).strip()
        if path.startswith("./"):
            path = path[2:]

        if path.endswith("/"):
            basenamepath = path[:-1]
        else:
            basenamepath = path

        datasource_name = os.path.basename(basenamepath) + "__dir"
        if prompt_for_datasource_name:
            datasource_name = click.prompt(
                msg_prompt_datasource_name, default=datasource_name
            )

        configuration = SparkDFDatasource.build_configuration(
            batch_kwargs_generators={
                "subdir_reader": {
                    "class_name": "SubdirReaderBatchKwargsGenerator",
                    "base_directory": os.path.join("..", path),
                }
            }
        )
        configuration["class_name"] = "SparkDFDatasource"
        configuration["module_name"] = "great_expectations.datasource"
        errors = DatasourceConfigSchema().validate(configuration)
        if len(errors) != 0:
            raise ge_exceptions.GreatExpectationsError(
                f"Invalid Datasource configuration: {errors:s}"
            )

    cli_message(
        """
Great Expectations will now add a new Datasource '{:s}' to your deployment, by adding this entry to your great_expectations.yml:

{:s}
""".format(
            datasource_name,
            textwrap.indent(toolkit.yaml.dump({datasource_name: configuration}), "  "),
        )
    )
    toolkit.confirm_proceed_or_exit()

    context.add_datasource(name=datasource_name, **configuration)
    return datasource_name


# TODO consolidate all the myriad CLI tests into this
def select_batch_kwargs_generator(
    context, datasource_name, available_data_assets_dict=None
):
    msg_prompt_select_generator = "Select batch kwarg generator"

    if available_data_assets_dict is None:
        available_data_assets_dict = context.get_available_data_asset_names(
            datasource_names=datasource_name
        )

    available_data_asset_names_by_generator = {}
    for key, value in available_data_assets_dict[datasource_name].items():
        if len(value["names"]) > 0:
            available_data_asset_names_by_generator[key] = value["names"]

    if len(available_data_asset_names_by_generator.keys()) == 0:
        return None
    elif len(available_data_asset_names_by_generator.keys()) == 1:
        return list(available_data_asset_names_by_generator.keys())[0]
    else:  # multiple batch_kwargs_generators
        generator_names = list(available_data_asset_names_by_generator.keys())
        choices = "\n".join(
            [
                f"    {i}. {generator_name}"
                for i, generator_name in enumerate(generator_names, 1)
            ]
        )
        option_selection = click.prompt(
            msg_prompt_select_generator + "\n" + choices,
            type=click.Choice(
                [str(i) for i, generator_name in enumerate(generator_names, 1)]
            ),
            show_choices=False,
        )
        batch_kwargs_generator_name = generator_names[int(option_selection) - 1]

        return batch_kwargs_generator_name


# TODO this method needs testing
# TODO this method has different numbers of returned objects
def get_batch_kwargs(
    context,
    datasource_name=None,
    batch_kwargs_generator_name=None,
    data_asset_name=None,
    additional_batch_kwargs=None,
):
    """
    This method manages the interaction with user necessary to obtain batch_kwargs for a batch of a data asset.

    In order to get batch_kwargs this method needs datasource_name, batch_kwargs_generator_name and data_asset_name
    to combine them into a fully-qualified data asset identifier(datasource_name/batch_kwargs_generator_name/data_asset_name).
    All three arguments are optional. If they are present, the method uses their values. Otherwise, the method
    prompts user to enter them interactively. Since it is possible for any of these three components to be
    passed to this method as empty values and to get their values after interacting with user, this method
    returns these components' values in case they changed.

    If the datasource has batch_kwargs_generators that can list available data asset names, the method lets user choose a name
    from that list (note: if there are multiple batch_kwargs_generators, user has to choose one first). If a name known to
    the chosen batch_kwargs_generator is selected, the batch_kwargs_generators will be able to yield batch_kwargs. The method also gives user
    an alternative to selecting the data asset name from the batch_kwargs_generators's list - user can type in a name for their
    data asset. In this case a passthrough batch kwargs batch_kwargs_generators will be used to construct a fully-qualified data asset
    identifier (note: if the datasource has no passthrough batch_kwargs_generators configured, the method will exist with a failure).
    Since no batch_kwargs_generators can yield batch_kwargs for this data asset name, the method prompts user to specify batch_kwargs
    by choosing a file (if the datasource is pandas or spark) or by writing a SQL query (if the datasource points
    to a database).

    :param context:
    :param datasource_name:
    :param batch_kwargs_generator_name:
    :param data_asset_name:
    :param additional_batch_kwargs:
    :return: a tuple: (datasource_name, batch_kwargs_generator_name, data_asset_name, batch_kwargs). The components
                of the tuple were passed into the methods as optional arguments, but their values might
                have changed after this method's execution. If the returned batch_kwargs is None, it means
                that the batch_kwargs_generator will know to yield batch_kwargs when called.
    """
    try:
        available_data_assets_dict = context.get_available_data_asset_names(
            datasource_names=datasource_name
        )
    except ValueError:
        # the datasource has no batch_kwargs_generators
        available_data_assets_dict = {datasource_name: {}}

    data_source = toolkit.select_datasource(context, datasource_name=datasource_name)
    datasource_name = data_source.name

    if batch_kwargs_generator_name is None:
        batch_kwargs_generator_name = select_batch_kwargs_generator(
            context,
            datasource_name,
            available_data_assets_dict=available_data_assets_dict,
        )

    # if the user provided us with the batch kwargs generator name and the data asset, we have everything we need -
    # let's ask the generator to build batch kwargs for this asset - we are done.
    if batch_kwargs_generator_name is not None and data_asset_name is not None:
        generator = data_source.get_batch_kwargs_generator(batch_kwargs_generator_name)
        batch_kwargs = generator.build_batch_kwargs(
            data_asset_name, **additional_batch_kwargs
        )
        return batch_kwargs

    if isinstance(
        context.get_datasource(datasource_name), (PandasDatasource, SparkDFDatasource)
    ):
        (
            data_asset_name,
            batch_kwargs,
        ) = _get_batch_kwargs_from_generator_or_from_file_path(
            context,
            datasource_name,
            batch_kwargs_generator_name=batch_kwargs_generator_name,
        )

    elif isinstance(context.get_datasource(datasource_name), SqlAlchemyDatasource):
        data_asset_name, batch_kwargs = _get_batch_kwargs_for_sqlalchemy_datasource(
            context, datasource_name, additional_batch_kwargs=additional_batch_kwargs
        )

    else:
        raise ge_exceptions.DataContextError(
            "Datasource {:s} is expected to be a PandasDatasource or SparkDFDatasource, but is {:s}".format(
                datasource_name, str(type(context.get_datasource(datasource_name)))
            )
        )

    return (datasource_name, batch_kwargs_generator_name, data_asset_name, batch_kwargs)


def _get_batch_kwargs_from_generator_or_from_file_path(
    context,
    datasource_name,
    batch_kwargs_generator_name=None,
    additional_batch_kwargs=None,
):
    if additional_batch_kwargs is None:
        additional_batch_kwargs = {}

    msg_prompt_generator_or_file_path = """
Would you like to:
    1. choose from a list of data assets in this datasource
    2. enter the path of a data file
"""
    msg_prompt_file_path = """
Enter the path of a data file (relative or absolute, s3a:// and gs:// paths are ok too)
"""

    msg_prompt_enter_data_asset_name = "\nWhich data would you like to use?\n"

    msg_prompt_enter_data_asset_name_suffix = (
        "    Don't see the name of the data asset in the list above? Just type it\n"
    )

    msg_prompt_file_type = """
We could not determine the format of the file. What is it?
    1. CSV
    2. Parquet
    3. Excel
    4. JSON
"""

    reader_method_file_extensions = {
        "1": "csv",
        "2": "parquet",
        "3": "xlsx",
        "4": "json",
    }

    data_asset_name = None

    datasource = context.get_datasource(datasource_name)
    if batch_kwargs_generator_name is not None:
        generator = datasource.get_batch_kwargs_generator(batch_kwargs_generator_name)

        option_selection = click.prompt(
            msg_prompt_generator_or_file_path,
            type=click.Choice(["1", "2"]),
            show_choices=False,
        )

        if option_selection == "1":

            available_data_asset_names = sorted(
                generator.get_available_data_asset_names()["names"], key=lambda x: x[0]
            )
            available_data_asset_names_str = [
                f"{name[0]} ({name[1]})" for name in available_data_asset_names
            ]

            data_asset_names_to_display = available_data_asset_names_str[:50]
            choices = "\n".join(
                [
                    f"    {i}. {name}"
                    for i, name in enumerate(data_asset_names_to_display, 1)
                ]
            )
            prompt = (
                msg_prompt_enter_data_asset_name
                + choices
                + "\n"
                + msg_prompt_enter_data_asset_name_suffix.format(
                    len(data_asset_names_to_display)
                )
            )

            data_asset_name_selection = click.prompt(prompt, show_default=False)

            data_asset_name_selection = data_asset_name_selection.strip()
            try:
                data_asset_index = int(data_asset_name_selection) - 1
                try:
                    data_asset_name = [name[0] for name in available_data_asset_names][
                        data_asset_index
                    ]
                except IndexError:
                    pass
            except ValueError:
                data_asset_name = data_asset_name_selection

            batch_kwargs = generator.build_batch_kwargs(
                data_asset_name, **additional_batch_kwargs
            )
            return (data_asset_name, batch_kwargs)

    # No generator name was passed or the user chose to enter a file path

    # We should allow a directory for Spark, but not for Pandas
    dir_okay = isinstance(datasource, SparkDFDatasource)

    path = None
    while True:
        # do not use Click to check if the file exists - the get_batch
        # logic will check this
        path = click.prompt(
            msg_prompt_file_path,
            type=click.Path(dir_okay=dir_okay),
            default=path,
        )

        if not path.startswith("gs:") and not path.startswith("s3"):
            path = os.path.abspath(path)

        batch_kwargs = {"path": path, "datasource": datasource_name}

        reader_method = None
        try:
            reader_kwargs = datasource.guess_reader_method_from_path(path)
            reader_method = reader_kwargs["reader_method"]
            reader_options = reader_kwargs.get("reader_options", {})
        except BatchKwargsError:
            pass

        if reader_method is None:

            while True:

                option_selection = click.prompt(
                    msg_prompt_file_type,
                    type=click.Choice(["1", "2", "3", "4"]),
                    show_choices=False,
                )

                try:
                    reader_method = datasource.guess_reader_method_from_path(
                        path + "." + reader_method_file_extensions[option_selection]
                    )["reader_method"]
                except BatchKwargsError:
                    pass

                if reader_method is not None:
                    batch_kwargs["reader_method"] = reader_method
                    if (
                        isinstance(datasource, SparkDFDatasource)
                        and reader_method == "csv"
                    ):
                        header_row = click.confirm(
                            "\nDoes this file contain a header row?", default=True
                        )
                        batch_kwargs["reader_options"] = {"header": header_row}
                    batch = datasource.get_batch(batch_kwargs=batch_kwargs)
                    break
        else:
            try:
                batch_kwargs["reader_method"] = reader_method
                reader_options = {
                    **batch_kwargs.get("reader_options", {}),
                    **reader_options,
                }
                if reader_options:
                    batch_kwargs["reader_options"] = reader_options
                if isinstance(datasource, SparkDFDatasource) and reader_method == "csv":
                    header_row = click.confirm(
                        "\nDoes this file contain a header row?", default=True
                    )
                    batch_kwargs["reader_options"] = {"header": header_row}
                batch = datasource.get_batch(batch_kwargs=batch_kwargs)
                break
            except Exception as e:
                file_load_error_message = """
<red>Cannot load file.</red>
  - Please check the file and try again or select a different data file.
  - Error: {0:s}"""
                cli_message(file_load_error_message.format(str(e)))
                if not click.confirm("\nTry again?", default=True):
                    cli_message(
                        """
We have saved your setup progress. When you are ready, run great_expectations init to continue.
"""
                    )
                    sys.exit(1)

    if data_asset_name is None and batch_kwargs.get("path"):
        try:
            # Try guessing a filename
            filename = os.path.split(batch_kwargs.get("path"))[1]
            # Take all but the last part after the period
            filename = ".".join(filename.split(".")[:-1])
            data_asset_name = filename
        except (OSError, IndexError):
            pass

    batch_kwargs["data_asset_name"] = data_asset_name

    return (data_asset_name, batch_kwargs)


def _get_default_schema(datasource):
    inspector = sqlalchemy.inspect(datasource.engine)
    return inspector.default_schema_name


def _get_batch_kwargs_for_sqlalchemy_datasource(
    context, datasource_name, additional_batch_kwargs=None
):
    data_asset_name = None
    sql_query = None
    datasource = context.get_datasource(datasource_name)
    msg_prompt_how_to_connect_to_data = """
You have selected a datasource that is a SQL database. How would you like to specify the data?
1. Enter a table name and schema
2. Enter a custom SQL query
3. List all tables in the database (this may take a very long time)
"""
    default_schema = _get_default_schema(datasource)
    temp_generator = TableBatchKwargsGenerator(name="temp", datasource=datasource)

    while data_asset_name is None:
        single_or_multiple_data_asset_selection = click.prompt(
            msg_prompt_how_to_connect_to_data,
            type=click.Choice(["1", "2", "3"]),
            show_choices=False,
        )
        if single_or_multiple_data_asset_selection == "1":  # name the table and schema
            schema_name = click.prompt(
                "Please provide the schema name of the table (this is optional)",
                default=default_schema,
            )
            table_name = click.prompt(
                "Please provide the table name (this is required)"
            )
            data_asset_name = f"{schema_name}.{table_name}"

        elif single_or_multiple_data_asset_selection == "2":  # SQL query
            sql_query = click.prompt("Please provide the SQL query")
            data_asset_name = "custom_sql_query"

        elif single_or_multiple_data_asset_selection == "3":  # list it all
            msg_prompt_warning: str = fr"""Warning: If you have a large number of tables in your datasource, this may take a very long time.
Would you like to continue?"""
            confirmation = click.prompt(
                msg_prompt_warning, type=click.Choice(["y", "n"]), show_choices=True
            )
            if confirmation == "y":
                # avoid this call until necessary
                available_data_asset_names = (
                    temp_generator.get_available_data_asset_names()["names"]
                )
                available_data_asset_names_str = [
                    f"{name[0]} ({name[1]})" for name in available_data_asset_names
                ]

                data_asset_names_to_display = available_data_asset_names_str
                choices = "\n".join(
                    [
                        f"    {i}. {name}"
                        for i, name in enumerate(data_asset_names_to_display, 1)
                    ]
                )
                msg_prompt_enter_data_asset_name = (
                    "\nWhich table would you like to use? (Choose one)\n"
                )
                prompt = msg_prompt_enter_data_asset_name + choices + os.linesep
                selection = click.prompt(prompt, show_default=False)
                selection = selection.strip()
                try:
                    data_asset_index = int(selection) - 1
                    try:
                        data_asset_name = [
                            name[0] for name in available_data_asset_names
                        ][data_asset_index]

                    except IndexError:
                        print(
                            f"You have specified {selection}, which is an incorrect index"
                        )
                        pass
                except ValueError:
                    print(
                        f"You have specified {selection}, which is an incorrect value"
                    )
                    pass

    if additional_batch_kwargs is None:
        additional_batch_kwargs = {}

    # Some backends require named temporary table parameters. We specifically elicit those and add them
    # where appropriate.
    temp_table_kwargs = {}
    datasource = context.get_datasource(datasource_name)

    if datasource.engine.dialect.name.lower() == "bigquery":
        # bigquery also requires special handling
        bigquery_temp_table = click.prompt(
            "Great Expectations will create a table to use for "
            "validation." + os.linesep + "Please enter a name for this table: ",
            default="SOME_PROJECT.SOME_DATASET.ge_tmp_" + str(uuid.uuid4())[:8],
        )
        temp_table_kwargs = {
            "bigquery_temp_table": bigquery_temp_table,
        }

    # now building the actual batch_kwargs
    if sql_query is None:
        batch_kwargs = temp_generator.build_batch_kwargs(
            data_asset_name, **additional_batch_kwargs
        )
        batch_kwargs.update(temp_table_kwargs)
    else:
        batch_kwargs = {"query": sql_query, "datasource": datasource_name}
        batch_kwargs.update(temp_table_kwargs)
        BridgeValidator(
            batch=datasource.get_batch(batch_kwargs),
            expectation_suite=ExpectationSuite("throwaway"),
        ).get_dataset()

    batch_kwargs["data_asset_name"] = data_asset_name
    return data_asset_name, batch_kwargs


def _verify_sqlalchemy_dependent_modules() -> bool:
    return verify_library_dependent_modules(
        python_import_name="sqlalchemy", pip_library_name="sqlalchemy"
    )


def _verify_mysql_dependent_modules() -> bool:
    return verify_library_dependent_modules(
        python_import_name="pymysql",
        pip_library_name="pymysql",
        module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    )


def _verify_postgresql_dependent_modules() -> bool:
    psycopg2_success: bool = verify_library_dependent_modules(
        python_import_name="psycopg2",
        pip_library_name="psycopg2-binary",
        module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    )
    # noinspection SpellCheckingInspection
    postgresql_psycopg2_success: bool = verify_library_dependent_modules(
        python_import_name="sqlalchemy.dialects.postgresql.psycopg2",
        pip_library_name="psycopg2-binary",
        module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    )
    return psycopg2_success and postgresql_psycopg2_success


def _verify_redshift_dependent_modules() -> bool:
    # noinspection SpellCheckingInspection
    postgresql_success: bool = _verify_postgresql_dependent_modules()
    redshift_success: bool = verify_library_dependent_modules(
        python_import_name="sqlalchemy_redshift.dialect",
        pip_library_name="sqlalchemy-redshift",
        module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    )
    return redshift_success or postgresql_success


def _verify_snowflake_dependent_modules() -> bool:
    return verify_library_dependent_modules(
        python_import_name="snowflake.sqlalchemy.snowdialect",
        pip_library_name="snowflake-sqlalchemy",
        module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    )


def _verify_bigquery_dependent_modules() -> bool:
    return verify_library_dependent_modules(
        python_import_name="pybigquery.sqlalchemy_bigquery",
        pip_library_name="pybigquery",
        module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
    )


def _verify_pyspark_dependent_modules() -> bool:
    return verify_library_dependent_modules(
        python_import_name="pyspark", pip_library_name="pyspark"
    )


def skip_prompt_message(skip_flag, prompt_message_text) -> bool:

    if not skip_flag:
        return click.confirm(prompt_message_text, default=True)

    return skip_flag


def profile_datasource(
    context,
    datasource_name,
    batch_kwargs_generator_name=None,
    data_assets=None,
    profile_all_data_assets=False,
    max_data_assets=20,
    additional_batch_kwargs=None,
    open_docs=False,
    skip_prompt_flag=False,
):
    """Profile a named datasource using the specified context"""
    # Note we are explicitly not using a logger in all CLI output to have
    # more control over console UI.
    logging.getLogger("great_expectations.profile.basic_dataset_profiler").setLevel(
        logging.INFO
    )
    msg_intro = "Profiling '{0:s}' will create expectations and documentation."

    msg_confirm_ok_to_proceed = """Would you like to profile '{0:s}'?"""

    msg_skipping = (
        "Skipping profiling for now. You can always do this later "
        "by running `<green>great_expectations datasource profile</green>`."
    )

    msg_some_data_assets_not_found = """Some of the data assets you specified were not found: {0:s}
"""

    msg_too_many_data_assets = """There are {0:d} data assets in {1:s}. Profiling all of them might take too long.
"""

    msg_error_multiple_generators_found = """<red>More than one batch kwargs generator found in datasource {0:s}.
Specify the one you want the profiler to use in batch_kwargs_generator_name argument.</red>
"""

    msg_error_no_generators_found = """<red>No batch kwargs generators can list available data assets in datasource
    {0:s}. The datasource might be empty or a batch kwargs generator not configured in the config file.</red>
"""

    msg_prompt_enter_data_asset_list = """Enter comma-separated list of data asset names (e.g., {0:s})
"""

    msg_options = """Choose how to proceed:
  1. Specify a list of the data assets to profile
  2. Exit and profile later
  3. Profile ALL data assets (this might take a while)
"""

    msg_data_doc_intro = """
<cyan>========== Data Docs ==========</cyan>

Great Expectations is building Data Docs from the data you just profiled!"""

    cli_message(msg_intro.format(datasource_name))

    if data_assets:
        data_assets = [item.strip() for item in data_assets.split(",")]

    # Call the data context's profiling method to check if the arguments are valid
    profiling_results = context.profile_datasource(
        datasource_name,
        batch_kwargs_generator_name=batch_kwargs_generator_name,
        data_assets=data_assets,
        profile_all_data_assets=profile_all_data_assets,
        max_data_assets=max_data_assets,
        dry_run=True,
        additional_batch_kwargs=additional_batch_kwargs,
    )

    if (
        profiling_results["success"] is True
    ):  # data context is ready to profile - run profiling
        if (
            data_assets
            or profile_all_data_assets
            or skip_prompt_message(
                skip_prompt_flag, msg_confirm_ok_to_proceed.format(datasource_name)
            )
        ):
            profiling_results = context.profile_datasource(
                datasource_name,
                batch_kwargs_generator_name=batch_kwargs_generator_name,
                data_assets=data_assets,
                profile_all_data_assets=profile_all_data_assets,
                max_data_assets=max_data_assets,
                dry_run=False,
                additional_batch_kwargs=additional_batch_kwargs,
            )
        else:
            cli_message(msg_skipping)
            return
    else:  # we need to get arguments from user interactively
        do_exit = False
        while not do_exit:
            if (
                profiling_results["error"]["code"]
                == DataContext.PROFILING_ERROR_CODE_SPECIFIED_DATA_ASSETS_NOT_FOUND
            ):
                cli_message(
                    msg_some_data_assets_not_found.format(
                        ",".join(profiling_results["error"]["not_found_data_assets"])
                    )
                )
            elif (
                profiling_results["error"]["code"]
                == DataContext.PROFILING_ERROR_CODE_TOO_MANY_DATA_ASSETS
            ):
                cli_message(
                    msg_too_many_data_assets.format(
                        profiling_results["error"]["num_data_assets"], datasource_name
                    )
                )
            elif (
                profiling_results["error"]["code"]
                == DataContext.PROFILING_ERROR_CODE_MULTIPLE_BATCH_KWARGS_GENERATORS_FOUND
            ):
                cli_message(msg_error_multiple_generators_found.format(datasource_name))
                sys.exit(1)
            elif (
                profiling_results["error"]["code"]
                == DataContext.PROFILING_ERROR_CODE_NO_BATCH_KWARGS_GENERATORS_FOUND
            ):
                cli_message(msg_error_no_generators_found.format(datasource_name))
                sys.exit(1)
            else:  # unknown error
                raise ValueError(
                    "Unknown profiling error code: "
                    + profiling_results["error"]["code"]
                )

            option_selection = click.prompt(
                msg_options, type=click.Choice(["1", "2", "3"]), show_choices=False
            )

            if option_selection == "1":
                data_assets = click.prompt(
                    msg_prompt_enter_data_asset_list.format(
                        ", ".join(
                            [
                                data_asset[0]
                                for data_asset in profiling_results["error"][
                                    "data_assets"
                                ]
                            ][:3]
                        )
                    ),
                    show_default=False,
                )
                if data_assets:
                    data_assets = [item.strip() for item in data_assets.split(",")]
            elif option_selection == "3":
                profile_all_data_assets = True
                data_assets = None
            elif option_selection == "2":  # skip
                cli_message(msg_skipping)
                return
            else:
                raise ValueError("Unrecognized option: " + option_selection)

            # after getting the arguments from the user, let's try to run profiling again
            # (no dry run this time)
            profiling_results = context.profile_datasource(
                datasource_name,
                batch_kwargs_generator_name=batch_kwargs_generator_name,
                data_assets=data_assets,
                profile_all_data_assets=profile_all_data_assets,
                max_data_assets=max_data_assets,
                dry_run=False,
                additional_batch_kwargs=additional_batch_kwargs,
            )

            if profiling_results["success"]:  # data context is ready to profile
                break

    cli_message(msg_data_doc_intro.format(rtd_url_ge_version))
    build_docs(context, view=open_docs, assume_yes=skip_prompt_flag)
    if open_docs:  # This is mostly to keep tests from spawning windows
        context.open_data_docs()


msg_prompt_choose_datasource = """Configure a datasource:
    1. Pandas DataFrame
    2. Relational database (SQL)
    3. Spark DataFrame
    4. Skip datasource configuration
"""

msg_prompt_choose_database = """
Which database backend are you using?
{}
""".format(
    "\n".join([f"    {i}. {db.value}" for i, db in enumerate(SupportedDatabases, 1)])
)

msg_prompt_filesys_enter_base_path = """
Enter the path (relative or absolute) of the root directory where the data files are stored.
"""

msg_prompt_datasource_name = """
Give your new Datasource a short name.
"""

msg_db_config = """
Next, we will configure database credentials and store them in the `{0:s}` section
of this config file: great_expectations/uncommitted/config_variables.yml:
"""

msg_unknown_data_source = """
Do we not have the type of data source you want?
    - Please create a GitHub issue here so we can discuss it!
    - <blue>https://github.com/great-expectations/great_expectations/issues/new</blue>"""
