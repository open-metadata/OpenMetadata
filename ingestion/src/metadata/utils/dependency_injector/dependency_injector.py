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
Dependency injection utilities for OpenMetadata.

This module provides a type-safe dependency injection system that uses Python's type hints
to automatically inject dependencies into functions and methods.

Example:
    ```python
    from typing import Annotated
    from metadata.utils.dependency_injector import Inject, inject, DependencyContainer

    class Database:
        def __init__(self, connection_string: str):
            self.connection_string = connection_string

    # Register a dependency
    container = DependencyContainer[Callable]()
    container.register(Database, lambda: Database("postgresql://localhost:5432"))

    # Use dependency injection
    @inject
    def get_user(user_id: int, db: Inject[Database]) -> dict:
        return db.query(f"SELECT * FROM users WHERE id = {user_id}")
    ```
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

T = TypeVar("T")


class DependencyInjectionError(Exception):
    """Base exception for dependency injection errors."""

    pass


class DependencyNotFoundError(DependencyInjectionError):
    """Raised when a required dependency is not found in the container."""

    pass


class InvalidInjectionTypeError(DependencyInjectionError):
    """Raised when an invalid injection type is used."""

    pass


if TYPE_CHECKING:
    Inject = Annotated[Union[T, None], "Inject Marker"]
else:

    class Inject(Generic[T]):
        """
        Type for dependency injection that uses types as keys.

        This type is used to mark parameters that should be automatically injected
        by the dependency container. Injection is always treated as Optioonal. It can be overriden.

        Type Parameters:
            T: The type of the dependency to inject

        Example:
            ```python
            @inject
            def my_function(db: Inject[Database]):
                # db will be automatically injected
                pass
            ```
        """


class DependencyContainer:
    """
    Thread-safe singleton container for managing dependencies.

    This container uses RLock to support reentrant locking, allowing the same thread
    to acquire the lock multiple times. It maintains two dictionaries:
    - _dependencies: The original registered dependencies
    - _overrides: Temporary overrides that take precedence over original dependencies

    Type Parameters:
        T: The base type for all dependencies in this container

    Example:
        ```python
        container = DependencyContainer[Callable]()
        container.register(Database, lambda: Database("postgresql://localhost:5432"))
        container.override(Database, lambda: Database("postgresql://test:5432"))
        ```
    """

    _instance: Optional["DependencyContainer"] = None
    _lock = RLock()
    _dependencies: Dict[str, Callable[[], Any]] = {}
    _overrides: Dict[str, Callable[[], Any]] = {}

    def __new__(cls) -> "DependencyContainer":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def get_key(self, dependency_type: Type[Any]) -> str:
        """
        Get the key for a dependency.
        """
        if get_origin(dependency_type) is type:
            inner_type = get_args(dependency_type)[0]
            return f"Type[{inner_type.__name__}]"
        return dependency_type.__name__

    def register(
        self, dependency_type: Type[Any], dependency: Callable[[], Any]
    ) -> None:
        """
        Register a dependency with the container.

        Args:
            dependency_type: The type of the dependency to register
            dependency: The dependency to register (usually a factory function)

        Example:
            ```python
            container.register(Database, lambda: Database("postgresql://localhost:5432"))
            container.register(Type[Metrics], lambda: Metrics)  # For registering types themselves
            ```
        """
        with self._lock:
            self._dependencies[self.get_key(dependency_type)] = dependency

    def override(
        self, dependency_type: Type[Any], dependency: Callable[[], Any]
    ) -> None:
        """
        Override a dependency with a new implementation.

        The override takes precedence over the original dependency and is useful
        for testing or temporary changes.

        Args:
            dependency_type: The type of the dependency to override
            dependency: The new dependency implementation

        Example:
            ```python
            container.override(Database, lambda: Database("postgresql://test:5432"))
            ```
        """
        with self._lock:
            self._overrides[self.get_key(dependency_type)] = dependency

    def remove_override(self, dependency_type: Type[T]) -> None:
        """
        Remove an override for a dependency.

        Args:
            dependency_type: The type of the dependency override to remove

        Example:
            ```python
            container.remove_override(Database)
            ```
        """
        with self._lock:
            self._overrides.pop(self.get_key(dependency_type), None)

    def get(self, dependency_type: Type[Any]) -> Optional[Any]:
        """
        Get a dependency from the container.

        Checks overrides first, then falls back to original dependencies.

        Args:
            dependency_type: The type of the dependency to retrieve

        Returns:
            The dependency if found, None otherwise

        Example:
            ```python
            db_factory = container.get(Database)
            if db_factory:
                db = db_factory()
            ```
        """
        with self._lock:
            factory = self._overrides.get(
                self.get_key(dependency_type)
            ) or self._dependencies.get(self.get_key(dependency_type))
            if factory is None:
                return None
            return factory()

    def clear(self) -> None:
        """
        Clear all dependencies and overrides.

        Example:
            ```python
            container.clear()  # Remove all registered dependencies and overrides
            ```
        """
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

        Example:
            ```python
            if container.has(Database):
                print("Database dependency is registered")
            ```"""
        with self._lock:
            return (
                self.get_key(dependency_type) in self._overrides
                or self.get_key(dependency_type) in self._dependencies
            )


def inject(func: Callable[..., Any]) -> Callable[..., Any]:
    """
    Decorator to inject dependencies based on type hints.

    This decorator automatically injects dependencies into function parameters
    based on their type hints. It uses types as keys for dependency lookup and
    allows explicit injection by passing dependencies as keyword arguments.

    Args:
        func: The function to inject dependencies into

    Returns:
        A function with dependencies injected

    Example:
        ```python
        @inject
        def get_user(user_id: int, db: Inject[Database]) -> dict:
            return db.query(f"SELECT * FROM users WHERE id = {user_id}")

        # Dependencies can also be passed explicitly
        get_user(user_id=1, db=Database("postgresql://localhost:5432"))
        ```
    """

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        container = DependencyContainer()
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
                    raise DependencyNotFoundError(
                        f"Dependency of type {dependency_type} not found in container. "
                        f"Make sure to register it using container.register({dependency_type.__name__}, ...)"
                    )
                kwargs[param_name] = dependency

        return func(*args, **kwargs)

    return wrapper


def is_inject_type(tp: Any) -> bool:
    """
    Check if a type is an Inject type or Optional[Inject].

    Args:
        tp: The type to check

    Returns:
        True if the type is Inject or Optional[Inject], False otherwise
    """
    origin = get_origin(tp)
    if origin is Inject:
        return True
    if origin is Union:
        args = get_args(tp)
        return any(get_origin(arg) is Inject for arg in args)
    return False


def extract_inject_arg(tp: Any) -> Any:
    """
    Extract the type argument from an Inject type.

    Args:
        tp: The type to extract from

    Returns:
        The type argument from the Inject type

    Raises:
        InvalidInjectionTypeError: If the type is not Inject or Optional[Inject]
    """
    origin = get_origin(tp)
    if origin is Inject:
        return get_args(tp)[0]
    if origin is Union:
        for arg in get_args(tp):
            if get_origin(arg) is Inject:
                return get_args(arg)[0]
    raise InvalidInjectionTypeError(
        f"Type {tp} is not Inject or Optional[Inject]. "
        f"Use Annotated[YourType, 'Inject'] to mark a parameter for injection."
    )


def inject_class_attributes(cls: Type[Any]) -> Type[Any]:
    """
    Decorator to inject dependencies into class-level (static) attributes based on type hints.

    This decorator automatically injects dependencies into class attributes
    based on their type hints. The dependencies are shared across all instances
    of the class.

    Args:
        cls: The class to inject dependencies into

    Returns:
        A class with dependencies injected into its class-level attributes

    Example:
        ```python
        @inject_class_attributes
        class UserService:
            db: ClassVar[Inject[Database]]
            cache: ClassVar[Inject[Cache]]

            @classmethod
            def get_user(cls, user_id: int) -> dict:
                return cls.db.query(f"SELECT * FROM users WHERE id = {user_id}")
        ```
    """
    container = DependencyContainer()
    type_hints = get_type_hints(cls, include_extras=True)

    # Inject dependencies into class attributes
    for attr_name, attr_type in type_hints.items():
        # Skip if attribute is already set
        if hasattr(cls, attr_name):
            continue

        # Check if it's an Inject type
        if is_inject_type(attr_type):
            dependency_type = extract_inject_arg(attr_type)
            dependency = container.get(dependency_type)
            if dependency is None:
                raise DependencyNotFoundError(
                    f"Dependency of type {dependency_type} not found in container. "
                    f"Make sure to register it using container.register({dependency_type.__name__}, ...)"
                )
            setattr(cls, attr_name, dependency)

    return cls
