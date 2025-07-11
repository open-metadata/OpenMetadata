# OpenMetadata Dependency Injection System

This module provides a type-safe dependency injection system for OpenMetadata that uses Python's type hints to automatically inject dependencies into functions and methods.

## Features

- Type-safe dependency injection using Python's type hints
- Thread-safe singleton container for managing dependencies
- Support for dependency overrides (useful for testing)
- Automatic dependency resolution

## Basic Usage

### 1. Define Your Dependencies

First, define your dependencies as classes or functions:

```python
class Database:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string

    def query(self, query: str) -> dict:
        # Implementation
        pass
```

### 2. Register Dependencies

Register your dependencies with the container:

```python
from metadata.utils.dependency_injector import DependencyContainer, Inject, inject

# Create a container instance
container = DependencyContainer[Callable]()

# Register a dependency (usually as a factory function)
container.register(Database, lambda: Database("postgresql://localhost:5432"))
```

### 3. Use Dependency Injection

Use the `@inject` decorator and `Inject` type to automatically inject dependencies:

```python
@inject
def get_user(user_id: int, db: Inject[Database]) -> dict:
    return db.query(f"SELECT * FROM users WHERE id = {user_id}")

# The db parameter will be automatically injected
user = get_user(user_id=1)
```

## Advanced Usage

### Dependency Overrides

You can temporarily override dependencies, which is useful for testing:

```python
# Override the Database dependency
container.override(Database, lambda: Database("postgresql://test:5432"))

# Use the overridden dependency
user = get_user(user_id=1)

# Remove the override when done
container.remove_override(Database)
```

### Explicit Dependency Injection

You can also explicitly provide dependencies when calling functions:

```python
# Explicitly provide the database
custom_db = Database("postgresql://custom:5432")
user = get_user(user_id=1, db=custom_db)
```

### Checking Dependencies

Check if a dependency is registered:

```python
if container.has(Database):
    print("Database dependency is registered")
```

### Clearing Dependencies

Clear all registered dependencies and overrides:

```python
container.clear()
```

## Best Practices

1. **Use Factory Functions**: Register dependencies as factory functions to ensure fresh instances:
   ```python
   container.register(Database, lambda: Database("postgresql://localhost:5432"))
   ```

2. **Type Safety**: Always use proper type hints with `Inject`:
   ```python
   @inject
   def my_function(db: Inject[Database]):
       pass
   ```

3. **Testing**: Use dependency overrides in tests:
   ```python
   def test_get_user():
       container.override(Database, lambda: MockDatabase())
       try:
           user = get_user(user_id=1)
           assert user is not None
       finally:
           container.remove_override(Database)
   ```

4. **Error Handling**: Handle missing dependencies gracefully:
   ```python
   try:
       user = get_user(user_id=1)
   except DependencyNotFoundError:
       # Handle missing dependency
       pass
   ```

## Error Types

The system provides specific exceptions for different error cases:

- `DependencyInjectionError`: Base exception for all dependency injection errors
- `DependencyNotFoundError`: Raised when a required dependency is not found
- `InvalidInjectionTypeError`: Raised when an invalid injection type is used

## Thread Safety

The dependency container is thread-safe and uses a reentrant lock (RLock) to support:
- Multiple threads accessing the container simultaneously
- The same thread acquiring the lock multiple times
- Safe dependency registration and retrieval

## Limitations

1. Dependencies must be registered before they can be injected
2. The system uses type names as keys, so different types with the same name will conflict
3. Circular dependencies are not supported
4. Dependencies are always treated as optional and can be overridden 
5. Dependencies can't be passed as *arg. Must be passed as *kwargs

### Class-Level Dependency Injection

For cases where you want to share dependencies across all instances of a class, you can use the `@inject_class_attributes` decorator:

```python
from typing import ClassVar

@inject_class_attributes
class UserService:
    db: ClassVar[Inject[Database]]
    cache: ClassVar[Inject[Cache]]

    @classmethod
    def get_user(cls, user_id: int) -> dict:
        cache_key = f"user:{user_id}"
        cached = cls.cache.get(cache_key)
        if cached:
            return cached
        return cls.db.query(f"SELECT * FROM users WHERE id = {user_id}")

# The dependencies are shared across all instances and accessed via class methods
user = UserService.get_user(user_id=1)
```

The `@inject_class_attributes` decorator will:
1. Look for class attributes annotated with `ClassVar[Inject[Type]]`
2. Automatically inject the dependencies at the class level
3. Make the dependencies available to all instances and class methods
4. Raise `DependencyNotFoundError` if a required dependency is not registered

This is particularly useful for:
- Utility classes that don't need instance-specific state
- Services that should share the same dependencies across all instances
- Performance optimization when the same dependencies are used by multiple instances