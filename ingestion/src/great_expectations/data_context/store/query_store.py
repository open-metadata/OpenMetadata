import logging
from string import Template

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.data_context_key import StringKey
from great_expectations.data_context.store.store import Store
from great_expectations.util import filter_properties_dict

try:
    import sqlalchemy
    from sqlalchemy import (
        Column,
        MetaData,
        String,
        Table,
        and_,
        column,
        create_engine,
        select,
        text,
    )
    from sqlalchemy.engine.url import URL
    from sqlalchemy.exc import SQLAlchemyError
except ImportError:
    sqlalchemy = None
    create_engine = None


logger = logging.getLogger(__name__)


class SqlAlchemyQueryStore(Store):
    """SqlAlchemyQueryStore stores queries by name, and makes it possible to retrieve the resulting value by query
    name."""

    _key_class = StringKey

    def __init__(
        self,
        credentials,
        queries=None,
        store_backend=None,
        runtime_environment=None,
        store_name=None,
    ):
        if not sqlalchemy:
            raise ge_exceptions.DataContextError(
                "sqlalchemy module not found, but is required for "
                "SqlAlchemyQueryStore"
            )
        super().__init__(
            store_backend=store_backend,
            runtime_environment=runtime_environment,
            store_name=store_name,
        )
        if queries:
            # If queries are defined in configuration, then we load them into an InMemoryStoreBackend
            try:
                assert isinstance(
                    queries, dict
                ), "SqlAlchemyQueryStore queries must be defined as a dictionary"
                assert (
                    store_backend is None
                    or store_backend["class_name"] == "InMemoryStoreBackend"
                ), (
                    "If queries are provided in configuration, then store_backend must be empty or an "
                    "InMemoryStoreBackend"
                )
                for k, v in queries.items():
                    self._store_backend.set(tuple([k]), v)

            except (AssertionError, KeyError) as e:
                raise ge_exceptions.InvalidConfigError(str(e))

        if "engine" in credentials:
            self.engine = credentials["engine"]
        elif "url" in credentials:
            self.engine = create_engine(credentials["url"])
        else:
            drivername = credentials.pop("drivername")
            options = URL(drivername, **credentials)
            self.engine = create_engine(options)

        # Gather the call arguments of the present function (include the "module_name" and add the "class_name"), filter
        # out the Falsy values, and set the instance "_config" variable equal to the resulting dictionary.
        self._config = {
            "credentials": credentials,
            "queries": queries,
            "store_backend": store_backend,
            "runtime_environment": runtime_environment,
            "store_name": store_name,
            "module_name": self.__class__.__module__,
            "class_name": self.__class__.__name__,
        }
        filter_properties_dict(properties=self._config, clean_falsy=True, inplace=True)

    def _convert_key(self, key):
        if isinstance(key, str):
            return StringKey(key)
        return key

    def get(self, key):
        return super().get(self._convert_key(key))

    def set(self, key, value):
        return super().set(self._convert_key(key), value)

    def get_query_result(self, key, query_parameters=None):
        if query_parameters is None:
            query_parameters = {}
        result = self._store_backend.get(self._convert_key(key).to_tuple())
        if isinstance(result, dict):
            query = result.get("query")
            return_type = result.get("return_type", "list")
            if return_type not in ["list", "scalar"]:
                raise ValueError(
                    "The return_type of a SqlAlchemyQueryStore query must be one of either 'list' "
                    "or 'scalar'"
                )
        else:
            query = result
            return_type = None

        assert query, "Query must be specified to use SqlAlchemyQueryStore"

        query = Template(query).safe_substitute(query_parameters)
        res = self.engine.execute(query).fetchall()
        # NOTE: 20200617 - JPC: this approach is probably overly opinionated, but we can
        # adjust based on specific user requests
        res = [val for row in res for val in row]
        if return_type == "scalar":
            [res] = res
        return res

    @property
    def config(self) -> dict:
        return self._config
