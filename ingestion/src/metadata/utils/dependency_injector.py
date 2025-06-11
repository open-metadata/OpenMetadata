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
    Protocol,
    Type,
    TypeVar,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

from metadata.utils.logger import utils_logger

logger = utils_logger()

T = TypeVar("T")


if TYPE_CHECKING:
    Inject = Annotated[Union[T, None], "Inject Marker"]
else:

    class Inject(Generic[T]):
        """
        Type for dependency injection that uses parameter names as keys.

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

    def register(self, key: str, dependency: T) -> None:
        """
        Register a dependency with the container.

        Args:
            key: The key to identify the dependency
            dependency: The dependency to register
        """
        with self._lock:
            self._dependencies[key] = dependency

    def override(self, key: str, dependency: T) -> None:
        """
        Override a dependency with a new implementation.
        The override takes precedence over the original dependency.

        Args:
            key: The key of the dependency to override
            dependency: The new dependency implementation
        """
        with self._lock:
            self._overrides[key] = dependency

    def remove_override(self, key: str) -> None:
        """
        Remove an override for a dependency.

        Args:
            key: The key of the dependency override to remove
        """
        with self._lock:
            self._overrides.pop(key, None)

    def get(self, key: str) -> Optional[T]:
        """
        Get a dependency from the container.
        Checks overrides first, then falls back to original dependencies.

        Args:
            key: The key of the dependency to retrieve

        Returns:
            The dependency if found, None otherwise
        """
        with self._lock:
            return self._overrides.get(key) or self._dependencies.get(key)

    def clear(self) -> None:
        """Clear all dependencies and overrides."""
        with self._lock:
            self._dependencies.clear()
            self._overrides.clear()

    def has(self, key: str) -> bool:
        """
        Check if a dependency exists in the container.

        Args:
            key: The key to check

        Returns:
            True if the dependency exists, False otherwise
        """
        with self._lock:
            return key in self._overrides or key in self._dependencies


def _validate_protocol(dependency: Any, expected_type: Any) -> bool:
    """
    Validate if a dependency matches a Protocol type.

    Args:
        dependency: The dependency to validate
        expected_type: The Protocol type to check against

    Returns:
        True if the dependency matches the Protocol
    """
    try:
        return issubclass(type(dependency), expected_type)
    except Exception as e:
        logger.debug(f"Failed to validate Protocol type: {e}")
        return False


def _validate_generic(dependency: Any, expected_type: Type) -> bool:
    """
    Validate if a dependency matches a generic type.

    Args:
        dependency: The dependency to validate
        expected_type: The generic type to check against

    Returns:
        True if the dependency matches the generic type
    """
    origin = get_origin(expected_type)

    if origin is Callable:
        return callable(dependency)

    if isinstance(origin, type):
        return isinstance(dependency, origin)

    logger.debug(f"Unhandled generic type origin: {origin}")
    return False


def _validate_concrete_type(dependency: Any, expected_type: Type) -> bool:
    """
    Validate if a dependency matches a concrete type.

    Args:
        dependency: The dependency to validate
        expected_type: The concrete type to check against

    Returns:
        True if the dependency matches the concrete type
    """
    try:
        return isinstance(dependency, expected_type)
    except TypeError:
        # Special case for callables
        if (
            callable(dependency)
            and hasattr(expected_type, "__origin__")
            and expected_type.__origin__ is Callable
        ):
            return True
        logger.debug(f"TypeError during concrete type validation: {expected_type}")
        return False


def _validate_type(dependency: Any, expected_type: Type) -> bool:
    """
    Validate if a dependency matches the expected type.
    Handles Protocols, Callables, and concrete types.

    Args:
        dependency: The dependency to validate
        expected_type: The expected type

    Returns:
        True if the dependency matches the expected type
    """
    logger.debug(
        f"Validating dependency of type {type(dependency)} against {expected_type}"
    )

    # Handle Protocols (structural subtyping)
    if isinstance(expected_type, type) and issubclass(expected_type, Protocol):
        return _validate_protocol(dependency, expected_type)

    # Handle generics
    origin = get_origin(expected_type)
    if origin is not None:
        return _validate_generic(dependency, expected_type)

    # Normal class/type
    return _validate_concrete_type(dependency, expected_type)


def inject(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to inject dependencies based on type hints.
    Uses parameter names as keys for dependency lookup.
    Allows explicit injection by passing dependencies as keyword arguments.

    Args:
        func: The function to inject dependencies into

    Returns:
        A function with dependencies injected
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        container = DependencyContainer[Any]()
        type_hints = get_type_hints(func, include_extras=True)

        for param_name, param_type in type_hints.items():
            # Skip if parameter is already provided explicitly
            if param_name in kwargs:
                continue

            # Check if it's an Inject type
            # if get_origin(param_type) is Inject:
            if is_inject_type(param_type):
                dependency_type = extract_inject_arg(param_type)
                # dependency_type = get_args(param_type)[0]
                dependency = container.get(param_name)
                if dependency is None:
                    raise ValueError(
                        f"Dependency '{param_name}' not found in container"
                    )
                if not _validate_type(dependency, dependency_type):
                    raise TypeError(
                        f"Dependency '{param_name}' is of type {type(dependency)}, "
                        f"expected {dependency_type}"
                    )
                kwargs[param_name] = dependency

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
