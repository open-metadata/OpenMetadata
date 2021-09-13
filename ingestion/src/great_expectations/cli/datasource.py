import enum
import logging
import os
import sys
from typing import Optional, Union

import click

from great_expectations import DataContext
from great_expectations.cli import toolkit
from great_expectations.cli.pretty_printing import cli_message, cli_message_dict
from great_expectations.cli.util import verify_library_dependent_modules
from great_expectations.data_context.templates import YAMLToString
from great_expectations.datasource.types import DatasourceTypes
from great_expectations.render.renderer.datasource_new_notebook_renderer import (
    DatasourceNewNotebookRenderer,
)

logger = logging.getLogger(__name__)

try:
    import sqlalchemy
except ImportError:
    logger.debug(
        "Unable to load SqlAlchemy context; install optional sqlalchemy dependency for support"
    )
    sqlalchemy = None

yaml = YAMLToString()
yaml.indent(mapping=2, sequence=4, offset=2)
yaml.default_flow_style = False


class SupportedDatabaseBackends(enum.Enum):
    MYSQL = "MySQL"
    POSTGRES = "Postgres"
    REDSHIFT = "Redshift"
    SNOWFLAKE = "Snowflake"
    BIGQUERY = "BigQuery"
    OTHER = "other - Do you have a working SQLAlchemy connection string?"
    # TODO MSSQL


@click.group()
@click.pass_context
def datasource(ctx):
    """Datasource operations"""
    directory: str = toolkit.parse_cli_config_file_location(
        config_file_location=ctx.obj.config_file_location
    ).get("directory")
    context: DataContext = toolkit.load_data_context_with_error_handling(
        directory=directory,
        from_cli_upgrade_command=False,
    )
    # TODO consider moving this all the way up in to the CLIState constructor
    ctx.obj.data_context = context
    usage_stats_prefix = f"cli.datasource.{ctx.invoked_subcommand}"
    toolkit.send_usage_message(
        data_context=context,
        event=f"{usage_stats_prefix}.begin",
        success=True,
    )
    ctx.obj.usage_event_end = f"{usage_stats_prefix}.end"


@datasource.command(name="new")
@click.pass_context
@click.option("--name", default=None, help="Datasource name.")
@click.option(
    "--jupyter/--no-jupyter",
    is_flag=True,
    help="By default launch jupyter notebooks unless you specify the --no-jupyter flag",
    default=True,
)
def datasource_new(ctx, name, jupyter):
    """Add a new Datasource to the data context."""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    try:
        _datasource_new_flow(
            context,
            usage_event_end=usage_event_end,
            datasource_name=name,
            jupyter=jupyter,
        )
    except Exception as e:
        toolkit.exit_with_failure_message_and_stats(
            context=context,
            usage_event=usage_event_end,
            message=f"<red>{e}</red>",
        )
        return


@datasource.command(name="delete")
@click.argument("datasource")
@click.pass_context
def delete_datasource(ctx, datasource):
    """Delete the datasource specified as an argument"""
    context: DataContext = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end

    if not ctx.obj.assume_yes:
        toolkit.confirm_proceed_or_exit(
            confirm_prompt=f"""\nAre you sure you want to delete the Datasource "{datasource}" (this action is irreversible)?" """,
            continuation_message=f"Datasource `{datasource}` was not deleted.",
            exit_on_no=True,
            data_context=context,
            usage_stats_event=usage_event_end,
        )

    try:
        context.delete_datasource(datasource)
    except ValueError:
        cli_message(f"<red>Datasource {datasource} could not be found.</red>")
        toolkit.send_usage_message(context, event=usage_event_end, success=False)
        sys.exit(1)
    try:
        context.get_datasource(datasource)
    except ValueError:
        cli_message("<green>{}</green>".format("Datasource deleted successfully."))
        toolkit.send_usage_message(context, event=usage_event_end, success=True)
        sys.exit(0)


@datasource.command(name="list")
@click.pass_context
def datasource_list(ctx):
    """List known Datasources."""
    context = ctx.obj.data_context
    usage_event_end: str = ctx.obj.usage_event_end
    try:
        datasources = context.list_datasources()
        cli_message(_build_datasource_intro_string(datasources))
        for datasource in datasources:
            cli_message("")
            cli_message_dict(
                {
                    "name": datasource["name"],
                    "class_name": datasource["class_name"],
                }
            )

        toolkit.send_usage_message(
            data_context=context, event=usage_event_end, success=True
        )
    except Exception as e:
        toolkit.exit_with_failure_message_and_stats(
            context=context,
            usage_event=usage_event_end,
            message=f"<red>{e}</red>",
        )
        return


def _build_datasource_intro_string(datasources):
    datasource_count = len(datasources)
    if datasource_count == 0:
        return "No Datasources found"
    elif datasource_count == 1:
        return "1 Datasource found:"
    return f"{datasource_count} Datasources found:"


def _datasource_new_flow(
    context: DataContext,
    usage_event_end: str,
    datasource_name: Optional[str] = None,
    jupyter: bool = True,
) -> None:
    files_or_sql_selection = click.prompt(
        """
What data would you like Great Expectations to connect to?
    1. Files on a filesystem (for processing with Pandas or Spark)
    2. Relational database (SQL)
""",
        type=click.Choice(["1", "2"]),
        show_choices=False,
    )
    if files_or_sql_selection == "1":
        selected_files_backend = _prompt_for_execution_engine()
        helper = _get_files_helper(
            selected_files_backend,
            context_root_dir=context.root_directory,
            datasource_name=datasource_name,
        )
    elif files_or_sql_selection == "2":
        if not _verify_sqlalchemy_dependent_modules():
            return None
        selected_database = _prompt_user_for_database_backend()
        helper = _get_sql_yaml_helper_class(selected_database, datasource_name)

    helper.send_backend_choice_usage_message(context)
    if not helper.verify_libraries_installed():
        return None
    helper.prompt()
    notebook_path = helper.create_notebook(context)
    if jupyter is False:
        cli_message(
            f"To continue editing this Datasource, run <green>jupyter notebook {notebook_path}</green>"
        )
        toolkit.send_usage_message(context, event=usage_event_end, success=True)
        return None

    if notebook_path:
        cli_message(
            """<green>Because you requested to create a new Datasource, we'll open a notebook for you now to complete it!</green>\n\n"""
        )
        toolkit.send_usage_message(context, event=usage_event_end, success=True)
        toolkit.launch_jupyter_notebook(notebook_path)


class BaseDatasourceNewYamlHelper:
    """
    This base class defines the interface for helpers used in the datasource new
    flow.
    """

    def __init__(
        self,
        datasource_type: DatasourceTypes,
        usage_stats_payload: dict,
        datasource_name: Optional[str] = None,
    ):
        self.datasource_type: DatasourceTypes = datasource_type
        self.datasource_name: Optional[str] = datasource_name
        self.usage_stats_payload: dict = usage_stats_payload

    def verify_libraries_installed(self) -> bool:
        """Used in the interactive CLI to help users install dependencies."""
        raise NotImplementedError

    def create_notebook(self, context: DataContext) -> str:
        """Create a datasource_new notebook and save it to disk."""
        renderer = self.get_notebook_renderer(context)
        notebook_path = os.path.join(
            context.root_directory,
            context.GE_UNCOMMITTED_DIR,
            "datasource_new.ipynb",
        )
        renderer.render_to_disk(notebook_path)
        return notebook_path

    def get_notebook_renderer(self, context) -> DatasourceNewNotebookRenderer:
        """Get a renderer specifically constructed for the datasource type."""
        raise NotImplementedError

    def send_backend_choice_usage_message(self, context: DataContext) -> None:
        toolkit.send_usage_message(
            data_context=context,
            event="cli.new_ds_choice",
            event_payload={
                "type": self.datasource_type.value,
                **self.usage_stats_payload,
            },
            success=True,
        )

    def prompt(self) -> None:
        """Optional prompt if more information is needed before making a notebook."""
        pass

    def yaml_snippet(self) -> str:
        """Override to create the yaml for the notebook."""
        raise NotImplementedError


class FilesYamlHelper(BaseDatasourceNewYamlHelper):
    """The base class for pandas/spark helpers used in the datasource new flow."""

    def __init__(
        self,
        datasource_type: DatasourceTypes,
        usage_stats_payload: dict,
        class_name: str,
        context_root_dir: str,
        datasource_name: Optional[str] = None,
    ):
        super().__init__(datasource_type, usage_stats_payload, datasource_name)
        self.class_name: str = class_name
        self.base_path: str = ""
        self.context_root_dir: str = context_root_dir

    def get_notebook_renderer(self, context) -> DatasourceNewNotebookRenderer:
        return DatasourceNewNotebookRenderer(
            context,
            datasource_type=self.datasource_type,
            datasource_yaml=self.yaml_snippet(),
            datasource_name=self.datasource_name,
        )

    def yaml_snippet(self) -> str:
        """
        Note the InferredAssetFilesystemDataConnector was selected to get users
        to data assets with minimal configuration. Other DataConnectors are
        available.
        """
        return f'''f"""
name: {{datasource_name}}
class_name: Datasource
execution_engine:
  class_name: {self.class_name}
data_connectors:
  default_inferred_data_connector_name:
    class_name: InferredAssetFilesystemDataConnector
    base_directory: {self.base_path}
    default_regex:
      group_names: 
        - data_asset_name
      pattern: (.*)
  default_runtime_data_connector_name:
    class_name: RuntimeDataConnector
    batch_identifiers:
      - default_identifier_name
"""'''

    def prompt(self) -> None:
        file_url_or_path: str = click.prompt(PROMPT_FILES_BASE_PATH, type=click.Path())
        if not toolkit.is_cloud_file_url(file_url_or_path):
            file_url_or_path = toolkit.get_relative_path_from_config_file_to_base_path(
                self.context_root_dir, file_url_or_path
            )
        self.base_path = file_url_or_path


class PandasYamlHelper(FilesYamlHelper):
    def __init__(
        self,
        context_root_dir: str,
        datasource_name: Optional[str] = None,
    ):
        super().__init__(
            datasource_type=DatasourceTypes.PANDAS,
            usage_stats_payload={
                "type": DatasourceTypes.PANDAS.value,
                "api_version": "v3",
            },
            context_root_dir=context_root_dir,
            class_name="PandasExecutionEngine",
            datasource_name=datasource_name,
        )

    def verify_libraries_installed(self) -> bool:
        return True


class SparkYamlHelper(FilesYamlHelper):
    def __init__(
        self,
        context_root_dir: str,
        datasource_name: Optional[str] = None,
    ):
        super().__init__(
            datasource_type=DatasourceTypes.SPARK,
            usage_stats_payload={
                "type": DatasourceTypes.SPARK.value,
                "api_version": "v3",
            },
            context_root_dir=context_root_dir,
            class_name="SparkDFExecutionEngine",
            datasource_name=datasource_name,
        )

    def verify_libraries_installed(self) -> bool:
        return verify_library_dependent_modules(
            python_import_name="pyspark", pip_library_name="pyspark"
        )


class SQLCredentialYamlHelper(BaseDatasourceNewYamlHelper):
    """The base class for SQL helpers used in the datasource new flow."""

    def __init__(
        self,
        usage_stats_payload: dict,
        datasource_name: Optional[str] = None,
        driver: str = "",
        port: Union[int, str] = "YOUR_PORT",
        host: str = "YOUR_HOST",
        username: str = "YOUR_USERNAME",
        password: str = "YOUR_PASSWORD",
        database: str = "YOUR_DATABASE",
    ):
        super().__init__(
            datasource_type=DatasourceTypes.SQL,
            usage_stats_payload=usage_stats_payload,
            datasource_name=datasource_name,
        )
        self.driver = driver
        self.host = host
        self.port = str(port)
        self.username = username
        self.password = password
        self.database = database

    def credentials_snippet(self) -> str:
        return f'''\
host = "{self.host}"
port = "{self.port}"
username = "{self.username}"
password = "{self.password}"
database = "{self.database}"'''

    def yaml_snippet(self) -> str:
        yaml_str = '''f"""
name: {datasource_name}
class_name: Datasource
execution_engine:
  class_name: SqlAlchemyExecutionEngine'''
        yaml_str += self._yaml_innards()
        if self.driver:
            yaml_str += f"""
    drivername: {self.driver}"""

        yaml_str += '''
data_connectors:
  default_runtime_data_connector_name:
    class_name: RuntimeDataConnector
    batch_identifiers:
      - default_identifier_name
  default_inferred_data_connector_name:
    class_name: InferredAssetSqlDataConnector
    name: whole_table"""'''
        return yaml_str

    def _yaml_innards(self) -> str:
        """Override if needed."""
        return """
  credentials:
    host: {host}
    port: '{port}'
    username: {username}
    password: {password}
    database: {database}"""

    def get_notebook_renderer(self, context) -> DatasourceNewNotebookRenderer:
        return DatasourceNewNotebookRenderer(
            context,
            datasource_type=self.datasource_type,
            datasource_yaml=self.yaml_snippet(),
            datasource_name=self.datasource_name,
            sql_credentials_snippet=self.credentials_snippet(),
        )


class MySQLCredentialYamlHelper(SQLCredentialYamlHelper):
    def __init__(self, datasource_name: Optional[str]):
        # We are insisting on pymysql driver when adding a MySQL datasource
        # through the CLI to avoid over-complication of this flow. If user wants
        # to use another driver, they must use a sqlalchemy connection string.
        super().__init__(
            datasource_name=datasource_name,
            usage_stats_payload={
                "type": DatasourceTypes.SQL.value,
                "db": SupportedDatabaseBackends.MYSQL.value,
                "api_version": "v3",
            },
            driver="mysql+pymysql",
            port=3306,
        )

    def verify_libraries_installed(self) -> bool:
        return verify_library_dependent_modules(
            python_import_name="pymysql",
            pip_library_name="pymysql",
            module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
        )


class PostgresCredentialYamlHelper(SQLCredentialYamlHelper):
    def __init__(self, datasource_name: Optional[str]):
        super().__init__(
            datasource_name=datasource_name,
            usage_stats_payload={
                "type": "sqlalchemy",
                "db": SupportedDatabaseBackends.POSTGRES.value,
                "api_version": "v3",
            },
            driver="postgresql",
            port=5432,
            database="postgres",
        )

    def verify_libraries_installed(self) -> bool:
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


class RedshiftCredentialYamlHelper(SQLCredentialYamlHelper):
    def __init__(self, datasource_name: Optional[str]):
        # We are insisting on psycopg2 driver when adding a Redshift datasource
        # through the CLI to avoid over-complication of this flow. If user wants
        # to use another driver, they must use a sqlalchemy connection string.
        super().__init__(
            datasource_name=datasource_name,
            usage_stats_payload={
                "type": "sqlalchemy",
                "db": SupportedDatabaseBackends.REDSHIFT.value,
                "api_version": "v3",
            },
            driver="postgresql+psycopg2",
            port=5439,
        )

    def verify_libraries_installed(self) -> bool:
        # noinspection SpellCheckingInspection
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
        postgresql_success: bool = psycopg2_success and postgresql_psycopg2_success
        redshift_success: bool = verify_library_dependent_modules(
            python_import_name="sqlalchemy_redshift.dialect",
            pip_library_name="sqlalchemy-redshift",
            module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
        )
        return redshift_success or postgresql_success

    def _yaml_innards(self) -> str:
        return (
            super()._yaml_innards()
            + """
    query:
      sslmode: prefer"""
        )


class SnowflakeAuthMethod(enum.IntEnum):
    USER_AND_PASSWORD = 0
    SSO = 1
    KEY_PAIR = 2


class SnowflakeCredentialYamlHelper(SQLCredentialYamlHelper):
    def __init__(self, datasource_name: Optional[str]):
        super().__init__(
            datasource_name=datasource_name,
            usage_stats_payload={
                "type": "sqlalchemy",
                "db": SupportedDatabaseBackends.SNOWFLAKE.value,
                "api_version": "v3",
            },
            driver="snowflake",
        )
        self.auth_method = SnowflakeAuthMethod.USER_AND_PASSWORD

    def verify_libraries_installed(self) -> bool:
        return verify_library_dependent_modules(
            python_import_name="snowflake.sqlalchemy.snowdialect",
            pip_library_name="snowflake-sqlalchemy",
            module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
        )

    def prompt(self) -> None:
        self.auth_method = _prompt_for_snowflake_auth_method()

    def credentials_snippet(self) -> str:
        snippet = f"""\
host = "{self.host}"  # The account name (include region -- ex 'ABCD.us-east-1')
username = "{self.username}"
database = ""  # The database name (optional -- leave blank for none)
schema = ""  # The schema name (optional -- leave blank for none)
warehouse = ""  # The warehouse name (optional -- leave blank for none)
role = ""  # The role name (optional -- leave blank for none)"""

        if self.auth_method == SnowflakeAuthMethod.USER_AND_PASSWORD:
            snippet += '''
password = "YOUR_PASSWORD"'''
        elif self.auth_method == SnowflakeAuthMethod.SSO:
            snippet += """
authenticator_url = "externalbrowser"  # A valid okta URL or 'externalbrowser' used to connect through SSO"""
        elif self.auth_method == SnowflakeAuthMethod.KEY_PAIR:
            snippet += """
private_key_path = "YOUR_KEY_PATH"  # Path to the private key used for authentication
private_key_passphrase = ""   # Passphrase for the private key used for authentication (optional -- leave blank for none)"""

        return snippet

    def _yaml_innards(self) -> str:
        snippet = """
  credentials:
    host: {host}
    username: {username}
    database: {database}
    query:
      schema: {schema}
      warehouse: {warehouse}
      role: {role}
"""
        if self.auth_method == SnowflakeAuthMethod.USER_AND_PASSWORD:
            snippet += "    password: {password}"
        elif self.auth_method == SnowflakeAuthMethod.SSO:
            snippet += """\
    connect_args:
      authenticator: {authenticator_url}"""
        elif self.auth_method == SnowflakeAuthMethod.KEY_PAIR:
            snippet += """\
    private_key_path: {private_key_path}
    private_key_passphrase: {private_key_passphrase}"""
        return snippet


class BigqueryCredentialYamlHelper(SQLCredentialYamlHelper):
    def __init__(self, datasource_name: Optional[str]):
        super().__init__(
            datasource_name=datasource_name,
            usage_stats_payload={
                "type": "sqlalchemy",
                "db": "BigQuery",
                "api_version": "v3",
            },
        )

    def credentials_snippet(self) -> str:
        return '''\
# The SQLAlchemy url/connection string for the BigQuery connection
# (reference: https://github.com/mxmzdlv/pybigquery#connection-string-parameters)"""
connection_string = "YOUR_BIGQUERY_CONNECTION_STRING"'''

    def verify_libraries_installed(self) -> bool:
        return verify_library_dependent_modules(
            python_import_name="pybigquery.sqlalchemy_bigquery",
            pip_library_name="pybigquery",
            module_names_to_reload=CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES,
        )

    def _yaml_innards(self) -> str:
        return "\n  connection_string: {connection_string}"


class ConnectionStringCredentialYamlHelper(SQLCredentialYamlHelper):
    def __init__(self, datasource_name: Optional[str]):
        super().__init__(
            datasource_name=datasource_name,
            usage_stats_payload={
                "type": "sqlalchemy",
                "db": "other",
                "api_version": "v3",
            },
        )

    def verify_libraries_installed(self) -> bool:
        return True

    def credentials_snippet(self) -> str:
        return '''\
# The url/connection string for the sqlalchemy connection
# (reference: https://docs.sqlalchemy.org/en/latest/core/engines.html#database-urls)
connection_string = "YOUR_CONNECTION_STRING"'''

    def _yaml_innards(self) -> str:
        return "\n  connection_string: {connection_string}"


def _get_sql_yaml_helper_class(
    selected_database: SupportedDatabaseBackends, datasource_name: Optional[str]
) -> Union[
    MySQLCredentialYamlHelper,
    PostgresCredentialYamlHelper,
    RedshiftCredentialYamlHelper,
    SnowflakeCredentialYamlHelper,
    BigqueryCredentialYamlHelper,
    ConnectionStringCredentialYamlHelper,
]:
    helper_class_by_backend = {
        SupportedDatabaseBackends.POSTGRES: PostgresCredentialYamlHelper,
        SupportedDatabaseBackends.MYSQL: MySQLCredentialYamlHelper,
        SupportedDatabaseBackends.REDSHIFT: RedshiftCredentialYamlHelper,
        SupportedDatabaseBackends.SNOWFLAKE: SnowflakeCredentialYamlHelper,
        SupportedDatabaseBackends.BIGQUERY: BigqueryCredentialYamlHelper,
        SupportedDatabaseBackends.OTHER: ConnectionStringCredentialYamlHelper,
    }
    helper_class = helper_class_by_backend[selected_database]
    return helper_class(datasource_name)


def _prompt_for_execution_engine() -> str:
    selection = str(
        click.prompt(
            """
What are you processing your files with?
1. Pandas
2. PySpark
""",
            type=click.Choice(["1", "2"]),
            show_choices=False,
        )
    )
    return selection


def _get_files_helper(
    selection: str, context_root_dir: str, datasource_name: Optional[str] = None
) -> Union[PandasYamlHelper, SparkYamlHelper,]:
    helper_class_by_selection = {
        "1": PandasYamlHelper,
        "2": SparkYamlHelper,
    }
    helper_class = helper_class_by_selection[selection]
    return helper_class(context_root_dir, datasource_name)


def _prompt_user_for_database_backend() -> SupportedDatabaseBackends:
    enumerated_list = "\n".join(
        [f"    {i}. {db.value}" for i, db in enumerate(SupportedDatabaseBackends, 1)]
    )
    msg_prompt_choose_database = f"""
Which database backend are you using?
{enumerated_list}
"""
    db_choices = [str(x) for x in list(range(1, 1 + len(SupportedDatabaseBackends)))]
    selected_database_index = (
        int(
            click.prompt(
                msg_prompt_choose_database,
                type=click.Choice(db_choices),
                show_choices=False,
            )
        )
        - 1
    )  # don't show user a zero index list :)
    selected_database = list(SupportedDatabaseBackends)[selected_database_index]
    return selected_database


def _prompt_for_snowflake_auth_method() -> SnowflakeAuthMethod:
    auth_method = click.prompt(
        """\
What authentication method would you like to use?
    1. User and Password
    2. Single sign-on (SSO)
    3. Key pair authentication
""",
        type=click.Choice(["1", "2", "3"]),
        show_choices=False,
    )
    return SnowflakeAuthMethod(int(auth_method) - 1)


def _verify_sqlalchemy_dependent_modules() -> bool:
    return verify_library_dependent_modules(
        python_import_name="sqlalchemy", pip_library_name="sqlalchemy"
    )


def sanitize_yaml_and_save_datasource(
    context: DataContext, datasource_yaml: str, overwrite_existing: bool = False
) -> None:
    """A convenience function used in notebooks to help users save secrets."""
    if not datasource_yaml:
        raise ValueError("Please verify the yaml and try again.")
    if not isinstance(datasource_yaml, str):
        raise TypeError("Please pass in a valid yaml string.")
    config = yaml.load(datasource_yaml)
    try:
        datasource_name = config.pop("name")
    except KeyError:
        raise ValueError("The datasource yaml is missing a `name` attribute.")
    if not overwrite_existing and check_if_datasource_name_exists(
        context=context, datasource_name=datasource_name
    ):
        print(
            f'**WARNING** A Datasource named "{datasource_name}" already exists in this Data Context. The Datasource has *not* been saved. Please use a different name or set overwrite_existing=True if you want to overwrite!'
        )
        return
    if "credentials" in config.keys():
        credentials = config["credentials"]
        config["credentials"] = "${" + datasource_name + "}"
        context.save_config_variable(datasource_name, credentials)
    context.add_datasource(name=datasource_name, **config)


# TODO it might be nice to hint that remote urls can be entered here!
PROMPT_FILES_BASE_PATH = """
Enter the path of the root directory where the data files are stored. If files are on local disk enter a path relative to your current working directory or an absolute path.
"""

CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES: list = [
    # 'great_expectations.datasource.batch_kwargs_generator.query_batch_kwargs_generator',
    "great_expectations.datasource.batch_kwargs_generator.table_batch_kwargs_generator",
    "great_expectations.dataset.sqlalchemy_dataset",
    "great_expectations.validator.validator",
    "great_expectations.datasource.sqlalchemy_datasource",
]


def check_if_datasource_name_exists(context: DataContext, datasource_name: str) -> bool:
    """
    Check if a Datasource name already exists in the on-disk version of the given DataContext and if so raise an error
    Args:
        context: DataContext to check for existing Datasource
        datasource_name: name of the proposed Datasource
    Returns:
        boolean True if datasource name exists in on-disk config, else False
    """

    # TODO: 20210324 Anthony: Note reading the context from disk is a temporary fix to allow use in a notebook
    #  after test_yaml_config(). test_yaml_config() should update a copy of the in-memory data context rather than
    #  making changes directly to the in-memory context.
    context_on_disk: DataContext = DataContext(context.root_directory)

    return datasource_name in [d["name"] for d in context_on_disk.list_datasources()]
