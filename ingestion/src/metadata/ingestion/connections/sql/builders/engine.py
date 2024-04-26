from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool

# TODO: Add listener for supportsQueryComment

class SqlAlchemyEngineBuilder:
    def __init__(
            self,
            engine_config: Optional[dict] = None
    ):
        self._engine_config = engine_config or {}

    @classmethod
    def default(cls):
        default_config = {
            "url": None,
            "connect_args": {},
            "poolclass": QueuePool,
            "pool_reset_on_return": None, # https://docs.sqlalchemy.org/en/14/core/pooling.html#reset-on-return
            "echo": False,
            "max_overflow": -1
        }

        return cls(
            engine_config=default_config
        )

    def with_url(self, url: str):
        self._engine_config["url"] = url

    def with_connect_args(self, connect_args: dict):
        self._engine_config["connect_args"] = connect_args

    def build(self) -> Engine:
        return create_engine(**self._engine_config)


def default_engine_builder(url: str, connection_args: dict) -> SqlAlchemyEngineBuilder:
    builder = SqlAlchemyEngineBuilder.default()

    builder.with_url(url)
    builder.with_connect_args(connection_args)

    return builder
