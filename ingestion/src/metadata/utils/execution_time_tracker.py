#  Copyright 2021 Collate
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
ExecutionTimeTracker implementation to help track the execution time of different parts
of the code.
"""
from functools import wraps
from time import perf_counter
from typing import Dict, List, Optional

from pydantic import BaseModel

from metadata.utils.helpers import pretty_print_time_duration
from metadata.utils.logger import utils_logger
from metadata.utils.singleton import Singleton

logger = utils_logger()


class ExecutionTimeTrackerContext(BaseModel):
    """Small Model to hold the ExecutionTimeTracker context."""

    name: str
    start: float
    stored: bool


class ExecutionTimeTracker(metaclass=Singleton):
    """ExecutionTimeTracker is implemented as a Singleton in order to hold state globally.

    It works as a Context Manager in order to track and log execution times.

    Example:

        def my_function():
            tracker = ExecutionTimeTracker()

            with tracker(context="MyFunction", store=True):
                other_opeartion()

    """

    def __init__(self, enabled: bool = False):
        """When instantiated we can pass if we want it enabled or disabled in order to
        avoid overhead when not needed.

        Attrs
        ------
            enabled: Defines if it will be enabled or not.
            context: Keeps track of the context levels and their state.
            state: Keeps track of the global state for the Execution Time Tracker.
        """
        self.enabled: bool = enabled
        self.context: List[ExecutionTimeTrackerContext] = []
        self.state: Dict[str, float] = {}
        self.new_context = None
        self.store = True

    @property
    def last_stored_context_level(self) -> Optional[str]:
        """Returns the last stored context level.

        In order to provide better logs and keep track where in the code the time is being
        measured we keep track of nested contexts.

        If a given context is not stored it will only log to debug but won't be part of the
        global state.
        """
        stored_context = [context for context in self.context if context.stored]

        if stored_context:
            return stored_context[-1].name

        return None

    def __call__(self, context: str, store: bool = True):
        """At every point we open a new Context Manager we can pass the current 'context' and
        if we want to 'store' it.

        Sets the temporary attributes used within the context:

            new_context: Full Context name, appending the given context to the last stored context level.
            store: If True, it will take part of the global state. Otherwise it will only log to debug.
        """
        self.new_context = ".".join(
            [part for part in [self.last_stored_context_level, context] if part]
        )
        self.store = store

        return self

    def __enter__(self):
        """If enabled, when entering the context, we append a new
        ExecutionTimeTrackerContext to the list.
        """
        if self.enabled:
            self.context.append(
                ExecutionTimeTrackerContext(
                    name=self.new_context, start=perf_counter(), stored=self.store
                )
            )

    def __exit__(self, exc_type, exc_val, exc_tb):
        """If enabled, when exiting the context, we calculate the elapsed time and log to debug.
        If the context.stored is True, we also save it to the global state."""
        if self.enabled:
            stop = perf_counter()
            context = self.context.pop(-1)

            if not context:
                return

            elapsed = stop - context.start

            logger.debug(
                "%s executed in %s", context.name, pretty_print_time_duration(elapsed)
            )

            if context.stored:
                self._save(context, elapsed)

    def _save(self, context: ExecutionTimeTrackerContext, elapsed: float):
        """Small utility to save the new measure to the global accumulator."""
        self.state[context.name] = self.state.get(context.name, 0) + elapsed


def calculate_execution_time(context: Optional[str] = None, store: bool = True):
    """Utility decorator to be able to use the ExecutionTimeTracker on a function.

    It receives the context and if it should store it.

    Example:

        @calculate_execution_time(context="MyContext")
        def my_function():
            ...
    """

    def decorator(func):
        @wraps(func)
        def inner(*args, **kwargs):
            execution_time = ExecutionTimeTracker()

            with execution_time(context or func.__name__, store):
                result = func(*args, **kwargs)

            return result

        return inner

    return decorator


def calculate_execution_time_generator(
    context: Optional[str] = None, store: bool = True
):
    """Utility decorator to be able to use the ExecutionTimeTracker on a generator function.

    It receives the context and if it should store it.

    Example:

        @calculate_execution_time_generator(context="MyContext")
        def my_generator():
            ...
    """

    def decorator(func):
        @wraps(func)
        def inner(*args, **kwargs):
            # NOTE: We are basically implementing by hand a simplified version of 'yield from'
            # in order to be able to calculate the time difference correctly.
            # The 'while True' loop allows us to guarantee we are iterating over all thje values
            # from func(*args, **kwargs).
            execution_time = ExecutionTimeTracker()

            generator = func(*args, **kwargs)

            while True:
                with execution_time(context or func.__name__, store):
                    try:
                        element = next(generator)
                    except StopIteration:
                        return

                yield element

        return inner

    return decorator
