import os
import sys
import time
import traceback
from subprocess import PIPE, CalledProcessError, CompletedProcess, Popen, run
from typing import Optional

import click

from great_expectations.core import logger


def execute_shell_command(command: str) -> int:
    """
    Execute a shell (bash in the present case) command from inside Python program.

    While developed independently, this function is very similar to the one, offered in this StackOverflow article:
    https://stackoverflow.com/questions/30993411/environment-variables-using-subprocess-check-output-python

    :param command: bash command -- as if typed in a shell/Terminal window
    :return: status code -- 0 if successful; all other values (1 is the most common) indicate an error
    """
    cwd: str = os.getcwd()

    path_env_var: str = os.pathsep.join([os.environ.get("PATH", os.defpath), cwd])
    env: dict = dict(os.environ, PATH=path_env_var)

    status_code: int = 0
    try:
        res: CompletedProcess = run(
            args=["bash", "-c", command],
            stdin=None,
            input=None,
            stdout=None,
            stderr=None,
            capture_output=True,
            shell=False,
            cwd=cwd,
            timeout=None,
            check=True,
            encoding=None,
            errors=None,
            text=None,
            env=env,
            universal_newlines=True,
        )
        sh_out: str = res.stdout.strip()
        logger.info(sh_out)
    except CalledProcessError as cpe:
        status_code = cpe.returncode
        sys.stderr.write(cpe.output)
        sys.stderr.flush()
        exception_message: str = "A Sub-Process call Exception occurred.\n"
        exception_traceback: str = traceback.format_exc()
        exception_message += (
            f'{type(cpe).__name__}: "{str(cpe)}".  Traceback: "{exception_traceback}".'
        )
        logger.error(exception_message)

    return status_code


def execute_shell_command_with_progress_polling(command: str) -> int:
    """
    Execute a shell (bash in the present case) command from inside Python program with polling (to enable progress bar).

    :param command: bash command -- as if typed in a shell/Terminal window
    :return: status code -- 0 if successful; all other values (1 is the most common) indicate an error
    """
    cwd: str = os.getcwd()

    path_env_var: str = os.pathsep.join([os.environ.get("PATH", os.defpath), cwd])
    env: dict = dict(os.environ, PATH=path_env_var)

    status_code: int

    bar_length_100_percent: int = 100

    max_work_amount: int = bar_length_100_percent

    poll_period_seconds: int = 1

    gathered: int = 0
    progress: float
    with click.progressbar(length=bar_length_100_percent, label=command) as bar:
        try:
            with Popen(
                args=["bash", "-c", command],
                bufsize=-1,
                executable=None,
                stdin=None,
                stdout=PIPE,
                stderr=PIPE,
                preexec_fn=None,
                close_fds=True,
                shell=False,
                cwd=cwd,
                env=env,
                universal_newlines=True,
                startupinfo=None,
                creationflags=0,
                restore_signals=True,
                start_new_session=False,
                pass_fds=(),
                encoding=None,
                errors=None,
            ) as proc:
                poll_status_code: Optional[int] = proc.poll()
                poll_stdout: str = proc.stdout.readline()
                while poll_status_code is None:
                    gathered += max([len(poll_stdout), poll_period_seconds])
                    progress = float(gathered) / max_work_amount
                    excess: float = progress - 1.0
                    if excess > 0:
                        if 0.0 < excess <= 1.0:
                            max_work_amount += 2.0 * excess * max_work_amount
                        elif 1.0 < excess <= 2.0:
                            max_work_amount += 5.0 * excess * max_work_amount
                        elif 2.0 < excess <= 1.0e1:
                            max_work_amount += 1.0e1 * excess * max_work_amount
                        else:
                            max_work_amount += 1.0e2 * excess * max_work_amount
                        progress = float(gathered) / max_work_amount
                    bar.pos = int(progress * (bar_length_100_percent - 1)) + 1
                    bar.update(0)
                    time.sleep(poll_period_seconds)
                    poll_status_code = proc.poll()
                    poll_stdout = proc.stdout.readline()
                status_code = proc.returncode
                if status_code != poll_status_code:
                    status_code = 1
                else:
                    bar.pos = bar_length_100_percent
                    bar.update(0)
        except CalledProcessError as cpe:
            status_code = cpe.returncode
            sys.stderr.write(cpe.output)
            sys.stderr.flush()
            exception_message: str = "A Sub-Process call Exception occurred.\n"
            exception_traceback: str = traceback.format_exc()
            exception_message += f'{type(cpe).__name__}: "{str(cpe)}".  Traceback: "{exception_traceback}".'
            logger.error(exception_message)

    return status_code
