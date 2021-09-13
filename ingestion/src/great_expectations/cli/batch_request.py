import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple, Union, cast

try:
    from typing import Final
except ImportError:
    # Fallback for python < 3.8
    from typing_extensions import Final

import click

from great_expectations import DataContext
from great_expectations import exceptions as ge_exceptions
from great_expectations.cli import toolkit
from great_expectations.datasource import (
    BaseDatasource,
    Datasource,
    SimpleSqlalchemyDatasource,
)
from great_expectations.execution_engine import SqlAlchemyExecutionEngine
from great_expectations.util import filter_properties_dict

logger = logging.getLogger(__name__)

try:
    import sqlalchemy
    from sqlalchemy.engine.reflection import Inspector
except ImportError:
    logger.debug(
        "Unable to load SqlAlchemy context; install optional sqlalchemy dependency for support"
    )
    sqlalchemy = None
    Inspector = None

DEFAULT_DATA_CONNECTOR_NAMES: Final[List[str]] = [
    "default_runtime_data_connector_name",
    "default_inferred_data_connector_name",
]


def get_batch_request(
    datasource: BaseDatasource,
    additional_batch_request_args: Optional[Dict[str, Any]] = None,
) -> Dict[str, Union[str, Dict[str, Any]]]:
    """
    This method manages the interaction with user necessary to obtain batch_request for a batch of a data asset.

    In order to get batch_request this method needs datasource_name, data_connector_name and data_asset_name
    to combine them into a batch_request dictionary.

    All three arguments are optional. If they are present, the method uses their values. Otherwise, the method
    prompts user to enter them interactively. Since it is possible for any of these three components to be
    passed to this method as empty values and to get their values after interacting with user, this method
    returns these components' values in case they changed.

    If the datasource has data connectors, the method lets user choose a name from that list (note: if there are
    multiple data connectors, user has to choose one first).

    # :param datasource:
    # :param additional_batch_request_args:
    # :return: batch_request
    """
    available_data_asset_names_by_data_connector_dict: Dict[
        str, List[str]
    ] = datasource.get_available_data_asset_names()
    data_connector_name: Optional[str] = select_data_connector_name(
        available_data_asset_names_by_data_connector_dict=available_data_asset_names_by_data_connector_dict,
    )

    batch_request: Dict[str, Union[str, int, Dict[str, Any]]] = {
        "datasource_name": datasource.name,
        "data_connector_name": data_connector_name,
    }

    data_asset_name: str

    if isinstance(datasource, Datasource):
        msg_prompt_enter_data_asset_name: str = f'\nWhich data asset (accessible by data connector "{data_connector_name}") would you like to use?\n'
        data_asset_name = _get_data_asset_name_from_data_connector(
            datasource=datasource,
            data_connector_name=data_connector_name,
            msg_prompt_enter_data_asset_name=msg_prompt_enter_data_asset_name,
        )
    elif isinstance(datasource, SimpleSqlalchemyDatasource):
        msg_prompt_enter_data_asset_name: str = (
            "\nWhich table would you like to use? (Choose one)\n"
        )
        data_asset_name = _get_data_asset_name_for_simple_sqlalchemy_datasource(
            datasource=datasource,
            data_connector_name=data_connector_name,
            msg_prompt_enter_data_asset_name=msg_prompt_enter_data_asset_name,
        )
    else:
        raise ge_exceptions.DataContextError(
            "Datasource {:s} of unsupported type {:s} was encountered.".format(
                datasource.name, str(type(datasource))
            )
        )

    batch_request.update(
        {
            "data_asset_name": data_asset_name,
        }
    )

    if additional_batch_request_args and isinstance(
        additional_batch_request_args, dict
    ):
        batch_request.update(additional_batch_request_args)

    batch_spec_passthrough: Dict[str, Union[str, Dict[str, Any]]] = batch_request.get(
        "batch_spec_passthrough"
    )
    if batch_spec_passthrough is None:
        batch_spec_passthrough = {}

    batch_spec_passthrough.update(_get_batch_spec_passthrough(datasource=datasource))
    batch_request["batch_spec_passthrough"] = batch_spec_passthrough

    filter_properties_dict(properties=batch_request, clean_falsy=True, inplace=True)

    return batch_request


def select_data_connector_name(
    available_data_asset_names_by_data_connector_dict: Optional[
        Dict[str, List[str]]
    ] = None,
) -> Optional[str]:
    msg_prompt_select_data_connector_name = "Select data_connector"

    num_available_data_asset_names_by_data_connector = len(
        available_data_asset_names_by_data_connector_dict
    )

    if (
        available_data_asset_names_by_data_connector_dict is None
        or num_available_data_asset_names_by_data_connector == 0
    ):
        return None

    if num_available_data_asset_names_by_data_connector == 1:
        return list(available_data_asset_names_by_data_connector_dict.keys())[0]

    elif num_available_data_asset_names_by_data_connector == 2:
        # if only default data_connectors are configured, select default_inferred_asset_data_connector
        default_data_connector = _check_default_data_connectors(
            available_data_asset_names_by_data_connector_dict
        )
        if default_data_connector:
            return default_data_connector

    data_connector_names: List[str] = list(
        available_data_asset_names_by_data_connector_dict.keys()
    )
    choices: str = "\n".join(
        [
            f"    {i}. {data_connector_name}"
            for i, data_connector_name in enumerate(data_connector_names, 1)
        ]
    )
    choices += "\n"  # Necessary for consistent spacing between prompts
    option_selection: str = click.prompt(
        msg_prompt_select_data_connector_name + "\n" + choices,
        type=click.Choice(
            [str(i) for i, data_connector_name in enumerate(data_connector_names, 1)]
        ),
        show_choices=False,
    )
    data_connector_name: str = data_connector_names[int(option_selection) - 1]

    return data_connector_name


def _get_data_asset_name_from_data_connector(
    datasource: BaseDatasource,
    data_connector_name: str,
    msg_prompt_enter_data_asset_name: str,
) -> str:
    data_asset_name: Optional[str]

    available_data_asset_names_by_data_connector_dict: Dict[
        str, List[str]
    ] = datasource.get_available_data_asset_names(
        data_connector_names=data_connector_name
    )
    available_data_asset_names: List[str] = sorted(
        available_data_asset_names_by_data_connector_dict[data_connector_name],
        key=lambda x: x,
    )
    available_data_asset_names_str: List[str] = [
        f"{name}" for name in available_data_asset_names
    ]

    data_asset_names_to_display: List[str] = available_data_asset_names_str[:50]
    choices: str = "\n".join(
        [f"    {i}. {name}" for i, name in enumerate(data_asset_names_to_display, 1)]
    )
    prompt: str = msg_prompt_enter_data_asset_name + choices + "\n"
    data_asset_name_selection: str = click.prompt(prompt, show_default=False)
    data_asset_name_selection = data_asset_name_selection.strip()
    try:
        data_asset_index: int = int(data_asset_name_selection) - 1
        try:
            data_asset_name = available_data_asset_names[data_asset_index]
        except IndexError:
            data_asset_name = None
    except ValueError:
        data_asset_name = data_asset_name_selection

    return data_asset_name


def _get_data_asset_name_for_simple_sqlalchemy_datasource(
    datasource: SimpleSqlalchemyDatasource,
    data_connector_name: str,
    msg_prompt_enter_data_asset_name: str,
) -> str:
    msg_prompt_how_to_connect_to_data: str = """
You have selected a datasource that is a SQL database. How would you like to specify the data?
1. Enter a table name and schema
2. List all tables in the database (this may take a very long time)
"""
    data_asset_name: Optional[str] = None

    default_schema: str = _get_default_schema(datasource=datasource)
    if default_schema is None:
        default_schema = ""

    schema_name: str
    table_name: str
    while data_asset_name is None:
        single_or_multiple_data_asset_selection: str = click.prompt(
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
            if schema_name:
                data_asset_name = f"{schema_name}.{table_name}"
            else:
                data_asset_name = table_name
        elif single_or_multiple_data_asset_selection == "2":  # list it all
            msg_prompt_warning: str = fr"""Warning: If you have a large number of tables in your datasource, this may take a very long time.
Would you like to continue?"""
            confirmation: str = click.prompt(
                msg_prompt_warning, type=click.Choice(["y", "n"]), show_choices=True
            )
            if confirmation == "y":
                data_asset_name = _get_data_asset_name_from_data_connector(
                    datasource=datasource,
                    data_connector_name=data_connector_name,
                    msg_prompt_enter_data_asset_name=msg_prompt_enter_data_asset_name,
                )

    return data_asset_name


def _get_default_schema(datasource: SimpleSqlalchemyDatasource) -> str:
    execution_engine: SqlAlchemyExecutionEngine = cast(
        SqlAlchemyExecutionEngine, datasource.execution_engine
    )
    inspector: Inspector = Inspector.from_engine(execution_engine.engine)
    return inspector.default_schema_name


def _check_default_data_connectors(
    available_data_asset_names_by_data_connector_dict: Dict[str, List[str]]
) -> Optional[str]:
    if all(
        data_connector_name in available_data_asset_names_by_data_connector_dict
        for data_connector_name in DEFAULT_DATA_CONNECTOR_NAMES
    ):
        # return the default_inferred_asset_data_connector
        return DEFAULT_DATA_CONNECTOR_NAMES[1]


def _get_batch_spec_passthrough(
    datasource: BaseDatasource,
) -> Dict[str, Union[str, Dict[str, Any]]]:
    batch_spec_passthrough: Dict[str, Union[str, Dict[str, Any]]] = {}

    if isinstance(datasource, Datasource):
        pass  # TODO: <Alex>Add parameters for Pandas, Spark, and other SQL as CLI functionality expands.</Alex>
    elif isinstance(datasource, SimpleSqlalchemyDatasource):
        # Some backends require named temporary table parameters.  We specifically elicit those and add them
        # where appropriate.
        execution_engine: SqlAlchemyExecutionEngine = cast(
            SqlAlchemyExecutionEngine, datasource.execution_engine
        )
        if execution_engine.engine.dialect.name.lower() == "bigquery":
            # bigquery also requires special handling
            bigquery_temp_table: str = click.prompt(
                "Great Expectations will create a table to use for "
                "validation." + os.linesep + "Please enter a name for this table: ",
                default="SOME_PROJECT.SOME_DATASET.ge_tmp_" + str(uuid.uuid4())[:8],
            )
            if bigquery_temp_table:
                batch_spec_passthrough.update(
                    {
                        "bigquery_temp_table": bigquery_temp_table,
                    }
                )
    else:
        raise ge_exceptions.DataContextError(
            "Datasource {:s} of unsupported type {:s} was encountered.".format(
                datasource.name, str(type(datasource))
            )
        )

    return batch_spec_passthrough


def standardize_batch_request_display_ordering(
    batch_request: Dict[str, Union[str, int, Dict[str, Any]]]
) -> Dict[str, Union[str, Dict[str, Any]]]:
    datasource_name: str = batch_request["datasource_name"]
    data_connector_name: str = batch_request["data_connector_name"]
    data_asset_name: str = batch_request["data_asset_name"]
    batch_request.pop("datasource_name")
    batch_request.pop("data_connector_name")
    batch_request.pop("data_asset_name")
    batch_request = {
        "datasource_name": datasource_name,
        "data_connector_name": data_connector_name,
        "data_asset_name": data_asset_name,
        **batch_request,
    }
    return batch_request
