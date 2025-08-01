#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Timeout utilities
"""
import errno
import functools
import inspect
import os
import platform
import signal
import threading
from typing import Callable

from metadata.utils.constants import TEN_MIN
from metadata.utils.logger import utils_logger

logger = utils_logger()


def _handle_timeout(signum, frame):
    """
    Handler for signal timeout
    """
    raise TimeoutError(f"[SIGNUM {signum}] {os.strerror(errno.ETIME)}")


def timeout(seconds: int = TEN_MIN) -> Callable:
    """
    Decorator factory to handle timeouts in functions. Defaults
    to 10 min.

    This functionality is not supported on Windows.

    Args:
         seconds: seconds to wait until raising the timeout
    """

    def decorator(fn):
        @functools.wraps(fn)
        def inner(*args, **kwargs):
            # SIGALRM is not supported on Windows or sub-threads
            if (
                platform.system() != "Windows"
                and threading.current_thread() == threading.main_thread()
            ):
                signal.signal(signal.SIGALRM, _handle_timeout)
                signal.alarm(seconds)
                try:
                    result = fn(*args, **kwargs)
                finally:
                    signal.alarm(0)
                return result

            # If platform is Windows, run the function as-is
            return fn(*args, **kwargs)

        return inner

    return decorator


def cls_timeout(seconds: int = TEN_MIN):
    """
    Decorates with `timeout` all methods
    of a class cls
    :param seconds: timeout to use
    :return: class with decorated methods
    """

    def inner(cls):
        for attr_name, attr in inspect.getmembers(  # pylint: disable=unused-variable
            cls, inspect.ismethod
        ):
            setattr(cls, attr_name, timeout(seconds)(getattr(cls, attr_name)))

        return cls

    return inner
