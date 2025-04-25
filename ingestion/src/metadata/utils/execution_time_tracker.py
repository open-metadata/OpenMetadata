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
import threading
from copy import deepcopy
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


class ExecutionTimeTrackerContextMap(metaclass=Singleton):
    """Responsible for managing the ExecutionTimeTracker on different threads."""

    def __init__(self):
        """Initializes the map."""
        self.map: dict[int, List[ExecutionTimeTrackerContext]] = {}

    def copy_from_parent(self, parent_thread_id: int, thread_id: Optional[int] = None):
        """Copy the ExecutionTimeTrackerContext from Parent."""
        thread_id = thread_id or threading.get_ident()

        self.map[thread_id] = deepcopy(self.map.get(parent_thread_id, []))

    def get_last_stored_context_level(
        self, thread_id: Optional[int] = None
    ) -> Optional[str]:
        """Gets the last stored context level for a given thread."""
        thread_id = thread_id or threading.get_ident()

        stored_context = [
            context for context in self.map.get(thread_id, {}) if context.stored
        ]

        if stored_context:
            return stored_context[-1].name
        return None

    def append(
        self, context: ExecutionTimeTrackerContext, thread_id: Optional[int] = None
    ):
        """Appends a new context level for a given thread."""
        thread_id = thread_id or threading.get_ident()
        self.map.setdefault(thread_id, []).append(context)

    def pop(self, thread_id: Optional[int] = None) -> ExecutionTimeTrackerContext:
        """Removes the information of a given thread."""
        thread_id = thread_id or threading.get_ident()
        return self.map.get(thread_id, []).pop()

    def __getstate__(self):
        """Called when pickling the object, returns the state without thread-specific objects."""
        return self.__dict__.copy()

    def __setstate__(self, state):
        """Called when unpickling the object."""
        self.__dict__.update(state)


class ExecutionTimeTrackerState(metaclass=Singleton):
    """Tracks the ExecutionTime State across multiple threads."""

    def __init__(self):
        """Initializes the state and the lock."""
        self.state: Dict[str, float] = {}
        self.lock = threading.Lock()

    def add(self, context: ExecutionTimeTrackerContext, elapsed: float):
        """Updates the State."""
        with self.lock:
            self.state[context.name] = self.state.get(context.name, 0) + elapsed

    def __getstate__(self):
        """Called when pickling the object, returns the state without the lock."""
        state = self.__dict__.copy()
        # Don't pickle the lock
        if "lock" in state:
            del state["lock"]
        return state

    def __setstate__(self, state):
        """Called when unpickling the object, restores the lock."""
        self.__dict__.update(state)
        # Restore the lock
        self.lock = threading.Lock()


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

        self.context_map = ExecutionTimeTrackerContextMap()
        self.state = ExecutionTimeTrackerState()

        self.new_context = ""
        self.store = True

    def __call__(self, context: str, store: bool = True):
        """At every point we open a new Context Manager we can pass the current 'context' and
        if we want to 'store' it.

        Sets the temporary attributes used within the context:

            new_context: Full Context name, appending the given context to the last stored context level.
            store: If True, it will take part of the global state. Otherwise it will only log to debug.
        """
        self.new_context = ".".join(
            [
                part
                for part in [self.context_map.get_last_stored_context_level(), context]
                if part
            ]
        )
        self.store = store

        return self

    def __enter__(self):
        """If enabled, when entering the context, we append a new
        ExecutionTimeTrackerContext to the list.
        """
        if self.enabled:
            self.context_map.append(
                ExecutionTimeTrackerContext(
                    name=self.new_context, start=perf_counter(), stored=self.store
                )
            )

    def __exit__(self, exc_type, exc_val, exc_tb):
        """If enabled, when exiting the context, we calculate the elapsed time and log to debug.
        If the context.stored is True, we also save it to the global state."""
        if self.enabled:
            stop = perf_counter()
            context = self.context_map.pop()

            if not context:
                return

            elapsed = stop - context.start

            logger.debug(
                "%s executed in %s", context.name, pretty_print_time_duration(elapsed)
            )

            if context.stored:
                self.state.add(context, elapsed)

    def __getstate__(self):
        """Called when pickling the object."""
        return self.__dict__.copy()

    def __setstate__(self, state):
        """Called when unpickling the object."""
        self.__dict__.update(state)


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
