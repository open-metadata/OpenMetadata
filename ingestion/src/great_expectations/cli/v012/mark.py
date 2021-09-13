from functools import wraps
from typing import Callable

from great_expectations.cli.v012.util import cli_message


class Mark:
    """
    Marks for feature readiness.

    Usage:
    from great_expectations.cli.v012.mark import Mark as mark

    @mark.blah
    def your_function()
    """

    @staticmethod
    def cli_as_experimental(func: Callable) -> Callable:
        """Apply as a decorator to CLI commands that are Experimental."""

        @wraps(func)
        def wrapper(*args, **kwargs):
            cli_message(
                "<yellow>Heads up! This feature is Experimental. It may change. "
                "Please give us your feedback!</yellow>"
            )
            func(*args, **kwargs)

        return wrapper

    @staticmethod
    def cli_as_beta(func: Callable) -> Callable:
        """Apply as a decorator to CLI commands that are beta."""

        @wraps(func)
        def wrapper(*args, **kwargs):
            cli_message(
                "<yellow>Heads up! This feature is in Beta. Please give us "
                "your feedback!</yellow>"
            )
            func(*args, **kwargs)

        return wrapper

    @staticmethod
    def cli_as_deprecation(
        message: str = "<yellow>Heads up! This feature will be deprecated in the next major release</yellow>",
    ) -> Callable:
        """Apply as a decorator to CLI commands that will be deprecated."""

        def inner_decorator(func):
            @wraps(func)
            def wrapped(*args, **kwargs):
                cli_message(message)
                func(*args, **kwargs)

            return wrapped

        return inner_decorator
