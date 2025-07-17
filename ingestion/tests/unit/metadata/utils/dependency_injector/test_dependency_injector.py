from typing import Optional

import pytest

from metadata.utils.dependency_injector.dependency_injector import (
    DependencyContainer,
    DependencyNotFoundError,
    Inject,
    inject,
    inject_class_attributes,
)


# Test classes for dependency injection
class Database:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string

    def query(self, query: str) -> str:
        return f"Executed: {query}"


class Cache:
    def __init__(self, host: str):
        self.host = host

    def get(self, key: str) -> Optional[str]:
        if key == "user:1":
            return "Cache hit for user:1"
        return None


# Test functions for injection
@inject
def get_user(user_id: int, db: Inject[Database] = None) -> str:
    if db is None:
        raise DependencyNotFoundError("Database dependency not found")
    return db.query(f"SELECT * FROM users WHERE id = {user_id}")


@inject
def get_cached_user(user_id: int, db: Inject[Database], cache: Inject[Cache]) -> str:
    if db is None:
        raise DependencyNotFoundError("Database dependency not found")
    if cache is None:
        raise DependencyNotFoundError("Cache dependency not found")
    cache_key = f"user:{user_id}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    return db.query(f"SELECT * FROM users WHERE id = {user_id}")


class TestDependencyContainer:
    def test_register_and_get_dependency(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")

        container.register(Database, db_factory)
        db = container.get(Database)

        assert db is not None
        assert isinstance(db, Database)
        assert db.connection_string == "postgresql://localhost:5432"

    def test_override_dependency(self):
        container = DependencyContainer()
        original_factory = lambda: Database("postgresql://localhost:5432")
        override_factory = lambda: Database("postgresql://test:5432")

        container.register(Database, original_factory)
        container.override(Database, override_factory)

        db = container.get(Database)
        assert db is not None
        assert db.connection_string == "postgresql://test:5432"

    def test_remove_override(self):
        container = DependencyContainer()
        original_factory = lambda: Database("postgresql://localhost:5432")
        override_factory = lambda: Database("postgresql://test:5432")

        container.register(Database, original_factory)
        container.override(Database, override_factory)
        container.remove_override(Database)

        db = container.get(Database)
        assert db is not None
        assert db.connection_string == "postgresql://localhost:5432"

    def test_clear_dependencies(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        cache_factory = lambda: Cache("localhost")

        container.register(Database, db_factory)
        container.register(Cache, cache_factory)
        container.clear()

        assert container.get(Database) is None
        assert container.get(Cache) is None

    def test_has_dependency(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")

        assert not container.has(Database)
        container.register(Database, db_factory)
        assert container.has(Database)


class TestInjectDecorator:
    def test_inject_single_dependency(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        container.register(Database, db_factory)

        result = get_user(user_id=1)
        assert result == "Executed: SELECT * FROM users WHERE id = 1"

    def test_inject_multiple_dependencies(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        cache_factory = lambda: Cache("localhost")

        container.register(Database, db_factory)
        container.register(Cache, cache_factory)

        result = get_cached_user(user_id=1)
        assert result == "Cache hit for user:1"

    def test_missing_dependency(self):
        container = DependencyContainer()
        container.clear()  # Ensure no dependencies are registered

        with pytest.raises(DependencyNotFoundError):
            get_user(user_id=1)

    def test_explicit_dependency_override(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        container.register(Database, db_factory)

        custom_db = Database("postgresql://custom:5432")
        result = get_user(user_id=1, db=custom_db)
        assert result == "Executed: SELECT * FROM users WHERE id = 1"


class TestInjectClassAttributes:
    def test_inject_class_attributes_single_dependency(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        container.register(Database, db_factory)

        @inject_class_attributes
        class UserService:
            db: Inject[Database]

            @classmethod
            def get_user(cls, user_id: int) -> str:
                if cls.db is None:
                    raise DependencyNotFoundError("Database dependency not found")
                return cls.db.query(f"SELECT * FROM users WHERE id = {user_id}")

        result = UserService.get_user(user_id=1)
        assert result == "Executed: SELECT * FROM users WHERE id = 1"

    def test_inject_class_attributes_multiple_dependencies(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        cache_factory = lambda: Cache("localhost")

        container.register(Database, db_factory)
        container.register(Cache, cache_factory)

        @inject_class_attributes
        class UserService:
            db: Inject[Database]
            cache: Inject[Cache]

            @classmethod
            def get_user(cls, user_id: int) -> str:
                if cls.db is None:
                    raise DependencyNotFoundError("Database dependency not found")
                if cls.cache is None:
                    raise DependencyNotFoundError("Cache dependency not found")
                cache_key = f"user:{user_id}"
                cached = cls.cache.get(cache_key)
                if cached:
                    return cached
                return cls.db.query(f"SELECT * FROM users WHERE id = {user_id}")

        result = UserService.get_user(user_id=1)
        assert result == "Cache hit for user:1"

    def test_inject_class_attributes_missing_dependency(self):
        container = DependencyContainer()
        container.clear()  # Ensure no dependencies are registered

        with pytest.raises(DependencyNotFoundError):

            @inject_class_attributes
            class UserService:
                db: Inject[Database]

                @classmethod
                def get_user(cls, user_id: int) -> str:
                    if cls.db is None:
                        raise DependencyNotFoundError("Database dependency not found")
                    return cls.db.query(f"SELECT * FROM users WHERE id = {user_id}")

    def test_inject_class_attributes_shared_dependencies(self):
        container = DependencyContainer()
        db_factory = lambda: Database("postgresql://localhost:5432")
        container.register(Database, db_factory)

        @inject_class_attributes
        class UserService:
            db: Inject[Database]
            counter: int = 0

            @classmethod
            def increment_counter(cls) -> int:
                cls.counter += 1
                return cls.counter

            @classmethod
            def get_user(cls, user_id: int) -> str:
                if cls.db is None:
                    raise DependencyNotFoundError("Database dependency not found")
                return f"Counter: {cls.counter}, {cls.db.query(f'SELECT * FROM users WHERE id = {user_id}')}"

        # First call
        result1 = UserService.get_user(user_id=1)
        assert result1 == "Counter: 0, Executed: SELECT * FROM users WHERE id = 1"

        # Increment counter
        UserService.increment_counter()

        # Second call - counter should be shared
        result2 = UserService.get_user(user_id=1)
        assert result2 == "Counter: 1, Executed: SELECT * FROM users WHERE id = 1"
