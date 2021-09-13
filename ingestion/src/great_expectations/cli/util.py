import importlib
import sys
from types import ModuleType
from typing import Optional

import pkg_resources
from pkg_resources import Distribution, WorkingSet

from great_expectations.cli import toolkit
from great_expectations.cli.pretty_printing import cli_message
from great_expectations.cli.python_subprocess import (
    execute_shell_command_with_progress_polling,
)
from great_expectations.util import import_library_module, is_library_loadable


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
