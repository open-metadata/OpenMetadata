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


class ExecutionTimeMetrics(BaseModel):
    """Execution time statistics."""

    total_time: float = 0.0
    call_count: int = 0
    min_time: Optional[float] = None
    max_time: Optional[float] = None

    @property
    def average_time(self) -> float:
        """Average time per call."""
        return self.total_time / self.call_count if self.call_count > 0 else 0.0

    def update(self, elapsed: float):
        """Update with new measurement."""
        self.total_time += elapsed
        self.call_count += 1

        if self.min_time is None or elapsed < self.min_time:
            self.min_time = elapsed

        if self.max_time is None or elapsed > self.max_time:
            self.max_time = elapsed


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
            context for context in self.map.get(thread_id, []) if context.stored
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


class ExecutionTimeTrackerState(metaclass=Singleton):
    """Tracks the ExecutionTime State across multiple threads."""

    def __init__(self):
        """Initializes the state and the lock."""
        self.state: Dict[str, ExecutionTimeMetrics] = {}
        self.lock = threading.Lock()

    def add(self, context: ExecutionTimeTrackerContext, elapsed: float):
        """Update metrics with elapsed time."""
        with self.lock:
            if context.name not in self.state:
                self.state[context.name] = ExecutionTimeMetrics()
            self.state[context.name].update(elapsed)

    def get_metrics(self, context_name: str) -> Optional[ExecutionTimeMetrics]:
        """Get metrics by name."""
        return self.state.get(context_name)


class ExecutionTimeTrackerMeta(Singleton):
    """Custom metaclass for ExecutionTimeTracker.

    Extends Singleton to also update the 'enabled' flag when __call__ is invoked
    on an existing instance. This is needed because Singleton's __call__ returns
    the existing instance without calling __init__.
    """

    def __call__(cls, *args, **kwargs):
        """Override to update enabled flag on existing singleton instance."""
        instance = super().__call__(*args, **kwargs)

        enabled = kwargs.get("enabled", args[0] if args else None)
        # Update enabled only if explicitly passed as argument
        if enabled is not None:
            instance.enabled = enabled
        return instance


class ExecutionTimeTracker(metaclass=ExecutionTimeTrackerMeta):
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

        # Thread-local pending context storage to fix race conditions
        # between __call__ and __enter__ in multi-threaded environments
        self._pending_context: Dict[int, str] = {}
        self._pending_store: Dict[int, bool] = {}

    def __call__(self, context: str, store: bool = True):
        """At every point we open a new Context Manager we can pass the current 'context' and
        if we want to 'store' it.

        Uses thread-local storage for pending context to avoid race conditions
        in multi-threaded environments.
        """
        thread_id = threading.get_ident()
        new_context = ".".join(
            [
                part
                for part in [self.context_map.get_last_stored_context_level(), context]
                if part
            ]
        )
        self._pending_context[thread_id] = new_context
        self._pending_store[thread_id] = store

        return self

    def __enter__(self):
        """If enabled, when entering the context, we append a new
        ExecutionTimeTrackerContext to the list using thread-local pending values.
        """
        if self.enabled:
            thread_id = threading.get_ident()
            new_context = self._pending_context.pop(thread_id, "")
            store = self._pending_store.pop(thread_id, True)

            self.context_map.append(
                ExecutionTimeTrackerContext(
                    name=new_context, start=perf_counter(), stored=store
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
                "%s executed in %s",
                context.name,
                pretty_print_time_duration(elapsed),
            )

            if context.stored:
                self.state.add(context, elapsed)

    def get_summary(self) -> Dict[str, ExecutionTimeMetrics]:
        """Get all metrics."""
        return dict(self.state.state)

    def get_context_metrics(self, context_name: str) -> Optional[ExecutionTimeMetrics]:
        """Get metrics by name."""
        return self.state.get_metrics(context_name)

    def reset(self) -> None:
        """Reset all metrics."""
        with self.state.lock:
            self.state.state.clear()


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
