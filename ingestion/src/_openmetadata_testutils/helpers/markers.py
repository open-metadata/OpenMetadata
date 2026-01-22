import functools
import logging
import time
from typing import Callable, Optional, Tuple, Type

import pytest

logger = logging.getLogger(__name__)


def xfail_param(param, reason):
    return pytest.param(param, marks=pytest.mark.xfail(reason=reason, strict=True))


def retry_flaky(
    max_retries: int = 3,
    delay_sec: float = 1.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
):
    """
    Decorator to retry flaky tests that may fail due to transient issues
    (e.g., container startup, network issues, timing problems).

    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        delay_sec: Delay in seconds between retries (default: 1.0)
        exceptions: Tuple of exception types to catch and retry on (default: all exceptions)
        on_retry: Optional callback function called on each retry with (attempt_number, exception)

    Example:
        @retry_flaky(max_retries=3, delay=2.0)
        def test_flaky_container_test():
            ...

        @retry_flaky(exceptions=(ConnectionError, TimeoutError))
        def test_network_dependent():
            ...
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            "Test %s failed on attempt %d/%d: %s. Retrying in %.1fs...",
                            func.__name__,
                            attempt,
                            max_retries,
                            str(e),
                            delay_sec,
                        )
                        if on_retry:
                            on_retry(attempt, e)
                        time.sleep(delay_sec)
                    else:
                        logger.error(
                            "Test %s failed after %d attempts",
                            func.__name__,
                            max_retries,
                        )
            raise last_exception

        return wrapper

    return decorator
