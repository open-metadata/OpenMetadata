import importlib
import re
import sys
from types import ModuleType
from typing import Optional

import pkg_resources
from pkg_resources import Distribution, WorkingSet

from great_expectations.cli.v012 import toolkit
from great_expectations.cli.v012.python_subprocess import (
    execute_shell_command_with_progress_polling,
)
from great_expectations.util import import_library_module, is_library_loadable

try:
    from termcolor import colored
except ImportError:
    colored = None


def cli_message(string):
    print(cli_colorize_string(string))


def cli_colorize_string(string):
    # the DOTALL flag means that `.` includes newlines for multiline comments inside these tags
    flags = re.DOTALL
    mod_string = re.sub(
        "<blue>(.*?)</blue>", colored(r"\g<1>", "blue"), string, flags=flags
    )
    mod_string = re.sub(
        "<cyan>(.*?)</cyan>", colored(r"\g<1>", "cyan"), mod_string, flags=flags
    )
    mod_string = re.sub(
        "<green>(.*?)</green>", colored(r"\g<1>", "green"), mod_string, flags=flags
    )
    mod_string = re.sub(
        "<yellow>(.*?)</yellow>", colored(r"\g<1>", "yellow"), mod_string, flags=flags
    )
    mod_string = re.sub(
        "<red>(.*?)</red>", colored(r"\g<1>", "red"), mod_string, flags=flags
    )

    return colored(mod_string)


def cli_message_list(string_list, list_intro_string=None):
    """Simple util function for displaying simple lists in cli"""
    if list_intro_string:
        cli_message(list_intro_string)
    for string in string_list:
        cli_message(string)


def action_list_to_string(action_list):
    """Util function for turning an action list into pretty string"""
    action_list_string = ""
    for idx, action in enumerate(action_list):
        action_list_string += "{} ({})".format(
            action["name"], action["action"]["class_name"]
        )
        if idx == len(action_list) - 1:
            continue
        action_list_string += " => "
    return action_list_string


def cli_message_dict(
    dict_, indent=3, bullet_char="-", message_list=None, recursion_flag=False
):
    """Util function for displaying nested dicts representing ge objects in cli"""
    if message_list is None:
        message_list = []
    if dict_.get("name"):
        name = dict_.pop("name")
        message = "{}<cyan>name:</cyan> {}".format(" " * indent, name)
        message_list.append(message)
    if dict_.get("module_name"):
        module_name = dict_.pop("module_name")
        message = "{}<cyan>module_name:</cyan> {}".format(" " * indent, module_name)
        message_list.append(message)
    if dict_.get("class_name"):
        class_name = dict_.pop("class_name")
        message = "{}<cyan>class_name:</cyan> {}".format(" " * indent, class_name)
        message_list.append(message)
    if dict_.get("action_list"):
        action_list = dict_.pop("action_list")
        action_list_string = action_list_to_string(action_list)
        message = "{}<cyan>action_list:</cyan> {}".format(
            " " * indent, action_list_string
        )
        message_list.append(message)
    sorted_keys = sorted(dict_.keys())
    for key in sorted_keys:
        if key == "password":
            message = "{}<cyan>password:</cyan> ******".format(" " * indent)
            message_list.append(message)
            continue
        if isinstance(dict_[key], dict):
            message = "{}<cyan>{}:</cyan>".format(" " * indent, key)
            message_list.append(message)
            cli_message_dict(
                dict_[key],
                indent=indent + 2,
                message_list=message_list,
                recursion_flag=True,
            )
        else:
            message = "{}<cyan>{}:</cyan> {}".format(" " * indent, key, str(dict_[key]))
            message_list.append(message)
    if not recursion_flag:
        if bullet_char and indent > 1:
            first = message_list[0]
            new_first = first[:1] + bullet_char + first[2:]
            message_list[0] = new_first
        cli_message_list(message_list)


CLI_ONLY_SQLALCHEMY_ORDERED_DEPENDENCY_MODULE_NAMES: list = [
    # 'great_expectations.datasource.batch_kwargs_generator.query_batch_kwargs_generator',
    "great_expectations.datasource.batch_kwargs_generator.table_batch_kwargs_generator",
    "great_expectations.dataset.sqlalchemy_dataset",
    "great_expectations.validator.validator",
    "great_expectations.datasource.sqlalchemy_datasource",
]


def verify_library_dependent_modules(
    python_import_name: str, pip_library_name: str, module_names_to_reload: list = None
) -> bool:
    library_status_code: Optional[int]

    library_status_code = library_install_load_check(
        python_import_name=python_import_name, pip_library_name=pip_library_name
    )

    do_reload: bool
    success: bool

    if library_status_code is None or library_status_code == 0:
        do_reload = (
            module_names_to_reload is not None and len(module_names_to_reload) > 0
        )
        success = True
    else:
        do_reload = False
        success = False

    if do_reload:
        reload_modules(module_names=module_names_to_reload)

    return success


def library_install_load_check(
    python_import_name: str, pip_library_name: str
) -> Optional[int]:
    """
    Dynamically load a module from strings, attempt a pip install or raise a helpful error.

    :return: True if the library was loaded successfully, False otherwise

    Args:
        pip_library_name: name of the library to load
        python_import_name (str): a module to import to verify installation
    """
    if is_library_loadable(library_name=python_import_name):
        return None

    confirm_prompt: str = f"""Great Expectations relies on the library `{python_import_name}` to connect to your data, \
but the package `{pip_library_name}` containing this library is not installed.
    Would you like Great Expectations to try to execute `pip install {pip_library_name}` for you?"""
    continuation_message: str = f"""\nOK, exiting now.
    - Please execute `pip install {pip_library_name}` before trying again."""
    pip_install_confirmed = toolkit.confirm_proceed_or_exit(
        confirm_prompt=confirm_prompt,
        continuation_message=continuation_message,
        exit_on_no=True,
        exit_code=1,
    )

    if not pip_install_confirmed:
        cli_message(continuation_message)
        sys.exit(1)

    status_code: int = execute_shell_command_with_progress_polling(
        f"pip install {pip_library_name}"
    )

    # project_distribution: Distribution = get_project_distribution()
    # if project_distribution:
    #     project_name: str = project_distribution.metadata['Name']
    #     version: str = project_distribution.metadata['Version']
    #
    # pkg_resources.working_set = pkg_resources.WorkingSet._build_master()

    working_set: WorkingSet = pkg_resources.working_set
    # noinspection SpellCheckingInspection
    distr: Distribution = pkg_resources.get_distribution(dist=pip_library_name)
    pkg_resources.WorkingSet.add_entry(self=working_set, entry=distr.key)

    library_loadable: bool = is_library_loadable(library_name=python_import_name)

    if status_code == 0 and library_loadable:
        return 0

    if not library_loadable:
        cli_message(
            f"""<red>ERROR: Great Expectations relies on the library `{pip_library_name}` to connect to your data.</red>
        - Please execute `pip install {pip_library_name}` before trying again."""
        )
        return 1

    return status_code


def reload_modules(module_names: list) -> None:
    module_name: str
    for module_name in module_names:
        module_obj: Optional[ModuleType] = import_library_module(
            module_name=module_name
        )
        if module_obj is not None:
            try:
                _ = importlib.reload(module_obj)
            except RuntimeError:
                pass
