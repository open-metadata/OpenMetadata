#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Utility functions for testing
"""
from contextlib import contextmanager


class MultipleException(Exception):
    def __init__(self, exceptions):
        self.exceptions = exceptions
        super().__init__(f"Multiple exceptions occurred: {exceptions}")


class ErrorHandler:
    """
    A context manager that accumulates errors and raises them at the end of the block.
    Useful for cleaning up resources and ensuring that all errors are raised at the end of a test.
    Example:
    ```
    from metadata.utils.test_utils import accumulate_errors
    with accumulate_errors() as error_handler:
        error_handler.try_execute(lambda : 1 / 0)
        error_handler.try_execute(print, "Hello, World!")
    ```

    ```
    > Hello, World!
    > Traceback (most recent call last):
    >  ...
    > ZeroDivisionError: division by zero
    ```
    """

    def __init__(self):
        self.errors = []

    def try_execute(self, func, *args, **kwargs):
        try:
            func(*args, **kwargs)
        except Exception as exc:
            self.errors.append(exc)

    def raise_if_errors(self):
        if len(self.errors) == 1:
            raise self.errors[0]
        if len(self.errors) > 1:
            raise MultipleException(self.errors)


@contextmanager
def accumulate_errors():
    error_handler = ErrorHandler()
    try:
        yield error_handler
    finally:
        error_handler.raise_if_errors()
