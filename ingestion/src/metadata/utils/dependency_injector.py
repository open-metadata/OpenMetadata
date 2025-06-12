"""
Dependency injection utilities for OpenMetadata.
"""
from functools import wraps
from threading import RLock
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    Callable,
    Dict,
    Generic,
    Optional,
    Type,
    TypeVar,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

from metadata.utils.logger import utils_logger

logger = utils_logger()

T = TypeVar("T", bound=Callable)


if TYPE_CHECKING:
    Inject = Annotated[Union[T, None], "Inject Marker"]
else:

    class Inject(Generic[T]):
        """
        Type for dependency injection that uses types as keys.

        Type Parameters:
            T: The type of the dependency to inject
        """


class DependencyContainer(Generic[T]):
    """
    Thread-safe singleton container for managing dependencies.
    Uses RLock to support reentrant locking, allowing the same thread to acquire the lock multiple times.

    Type Parameters:
        T: The base type for all dependencies in this container
    """

    _instance: Optional["DependencyContainer[T]"] = None
    _lock = RLock()
    _dependencies: Dict[str, T] = {}
    _overrides: Dict[str, T] = {}

    def __new__(cls) -> "DependencyContainer[T]":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def register(self, dependency_type: Type[T], dependency: T) -> None:
        """
        Register a dependency with the container.

        Args:
            dependency_type: The type of the dependency to register
            dependency: The dependency to register
        """
        with self._lock:
            self._dependencies[dependency_type.__name__] = dependency

    def override(self, dependency_type: Type[T], dependency: T) -> None:
        """
        Override a dependency with a new implementation.
        The override takes precedence over the original dependency.

        Args:
            dependency_type: The type of the dependency to override
            dependency: The new dependency implementation
        """
        with self._lock:
            self._overrides[dependency_type.__name__] = dependency

    def remove_override(self, dependency_type: Type[T]) -> None:
        """
        Remove an override for a dependency.

        Args:
            dependency_type: The type of the dependency override to remove
        """
        with self._lock:
            self._overrides.pop(dependency_type.__name__, None)

    def get(self, dependency_type: Type[T]) -> Optional[T]:
        """
        Get a dependency from the container.
        Checks overrides first, then falls back to original dependencies.

        Args:
            dependency_type: The type of the dependency to retrieve

        Returns:
            The dependency if found, None otherwise
        """
        with self._lock:
            type_name = dependency_type.__name__
            return self._overrides.get(type_name) or self._dependencies.get(type_name)

    def clear(self) -> None:
        """Clear all dependencies and overrides."""
        with self._lock:
            self._dependencies.clear()
            self._overrides.clear()

    def has(self, dependency_type: Type[T]) -> bool:
        """
        Check if a dependency exists in the container.

        Args:
            dependency_type: The type to check

        Returns:
            True if the dependency exists, False otherwise
        """
        with self._lock:
            type_name = dependency_type.__name__
            return type_name in self._overrides or type_name in self._dependencies


def inject(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to inject dependencies based on type hints.
    Uses types as keys for dependency lookup.
    Allows explicit injection by passing dependencies as keyword arguments.

    Args:
        func: The function to inject dependencies into

    Returns:
        A function with dependencies injected
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        container = DependencyContainer[Callable]()
        type_hints = get_type_hints(func, include_extras=True)

        for param_name, param_type in type_hints.items():
            # Skip if parameter is already provided explicitly
            if param_name in kwargs:
                continue

            # Check if it's an Inject type
            if is_inject_type(param_type):
                dependency_type = extract_inject_arg(param_type)
                dependency = container.get(dependency_type)
                if dependency is None:
                    raise ValueError(
                        f"Dependency of type {dependency_type} not found in container"
                    )
                kwargs[param_name] = dependency()

        return func(*args, **kwargs)

    return wrapper


def is_inject_type(tp: Any) -> bool:
    origin = get_origin(tp)
    if origin is Inject:
        return True
    # Check if Optional[Inject[...]] == Union[Inject[...], NoneType]
    if origin is Union:
        args = get_args(tp)
        # True if any arg is Inject[...] and all others are NoneType
        # or at least one Inject[...] and possibly NoneType
        for arg in args:
            if get_origin(arg) is Inject:
                return True
    return False


def extract_inject_arg(tp: Any) -> Any:
    origin = get_origin(tp)
    if origin is Inject:
        return get_args(tp)[0]
    if origin is Union:
        # Find Inject[...] inside Union
        for arg in get_args(tp):
            if get_origin(arg) is Inject:
                return get_args(arg)[0]
    raise ValueError("Type is not Inject or Optional[Inject]")
