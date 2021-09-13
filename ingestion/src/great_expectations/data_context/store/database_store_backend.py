import logging
import uuid
from pathlib import Path
from typing import Dict, Tuple
from urllib.parse import urlparse

import great_expectations.exceptions as ge_exceptions
from great_expectations.data_context.store.store_backend import StoreBackend
from great_expectations.util import filter_properties_dict

try:
    import sqlalchemy as sa
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
    from sqlalchemy.engine.reflection import Inspector
    from sqlalchemy.engine.url import URL
    from sqlalchemy.exc import IntegrityError, NoSuchTableError, SQLAlchemyError
except ImportError:
    sa = None
    create_engine = None


logger = logging.getLogger(__name__)


class DatabaseStoreBackend(StoreBackend):
    def __init__(
        self,
        table_name,
        key_columns,
        fixed_length_key=True,
        credentials=None,
        url=None,
        connection_string=None,
        engine=None,
        store_name=None,
        suppress_store_backend_id=False,
        manually_initialize_store_backend_id: str = "",
        **kwargs,
    ):
        super().__init__(
            fixed_length_key=fixed_length_key,
            suppress_store_backend_id=suppress_store_backend_id,
            manually_initialize_store_backend_id=manually_initialize_store_backend_id,
            store_name=store_name,
        )
        if not sa:
            raise ge_exceptions.DataContextError(
                "ModuleNotFoundError: No module named 'sqlalchemy'"
            )

        if not self.fixed_length_key:
            raise ge_exceptions.InvalidConfigError(
                "DatabaseStoreBackend requires use of a fixed-length-key"
            )

        self._schema_name = None
        self._credentials = credentials
        self._connection_string = connection_string
        self._url = url

        if engine is not None:
            if credentials is not None:
                logger.warning(
                    "Both credentials and engine were provided during initialization of SqlAlchemyExecutionEngine. "
                    "Ignoring credentials."
                )
            self.engine = engine
        elif credentials is not None:
            self.engine = self._build_engine(credentials=credentials, **kwargs)
        elif connection_string is not None:
            self.engine = sa.create_engine(connection_string, **kwargs)
        elif url is not None:
            self.drivername = urlparse(url).scheme
            self.engine = sa.create_engine(url, **kwargs)
        else:
            raise ge_exceptions.InvalidConfigError(
                "Credentials, url, connection_string, or an engine are required for a DatabaseStoreBackend."
            )

        meta = MetaData(schema=self._schema_name)
        self.key_columns = key_columns
        # Dynamically construct a SQLAlchemy table with the name and column names we'll use
        cols = []
        for column in key_columns:
            if column == "value":
                raise ge_exceptions.InvalidConfigError(
                    "'value' cannot be used as a key_element name"
                )
            cols.append(Column(column, String, primary_key=True))
        cols.append(Column("value", String))
        try:
            table = Table(table_name, meta, autoload=True, autoload_with=self.engine)
            # We do a "light" check: if the columns' names match, we will proceed, otherwise, create the table
            if {str(col.name).lower() for col in table.columns} != (
                set(key_columns) | {"value"}
            ):
                raise ge_exceptions.StoreBackendError(
                    f"Unable to use table {table_name}: it exists, but does not have the expected schema."
                )
        except NoSuchTableError:
            table = Table(table_name, meta, *cols)
            try:
                if self._schema_name:
                    self.engine.execute(
                        f"CREATE SCHEMA IF NOT EXISTS {self._schema_name};"
                    )
                meta.create_all(self.engine)
            except SQLAlchemyError as e:
                raise ge_exceptions.StoreBackendError(
                    f"Unable to connect to table {table_name} because of an error. It is possible your table needs to be migrated to a new schema.  SqlAlchemyError: {str(e)}"
                )
        self._table = table
        # Initialize with store_backend_id
        self._store_backend_id = None
        self._store_backend_id = self.store_backend_id

        # Gather the call arguments of the present function (include the "module_name" and add the "class_name"), filter
        # out the Falsy values, and set the instance "_config" variable equal to the resulting dictionary.
        self._config = {
            "table_name": table_name,
            "key_columns": key_columns,
            "fixed_length_key": fixed_length_key,
            "credentials": credentials,
            "url": url,
            "connection_string": connection_string,
            "engine": engine,
            "store_name": store_name,
            "suppress_store_backend_id": suppress_store_backend_id,
            "manually_initialize_store_backend_id": manually_initialize_store_backend_id,
            "module_name": self.__class__.__module__,
            "class_name": self.__class__.__name__,
        }
        self._config.update(kwargs)
        filter_properties_dict(properties=self._config, clean_falsy=True, inplace=True)

    @property
    def store_backend_id(self) -> str:
        """
        Create a store_backend_id if one does not exist, and return it if it exists
        Ephemeral store_backend_id for database_store_backend until there is a place to store metadata
        Returns:
            store_backend_id which is a UUID(version=4)
        """

        if not self._store_backend_id:
            store_id = (
                self._manually_initialize_store_backend_id
                if self._manually_initialize_store_backend_id
                else str(uuid.uuid4())
            )
            self._store_backend_id = f"{self.STORE_BACKEND_ID_PREFIX}{store_id}"
        return self._store_backend_id.replace(self.STORE_BACKEND_ID_PREFIX, "")

    def _build_engine(self, credentials, **kwargs) -> "sa.engine.Engine":
        """
        Using a set of given credentials, constructs an Execution Engine , connecting to a database using a URL or a
        private key path.
        """
        # Update credentials with anything passed during connection time
        drivername = credentials.pop("drivername")
        create_engine_kwargs = kwargs
        self._schema_name = credentials.pop("schema", None)
        connect_args = credentials.pop("connect_args", None)
        if connect_args:
            create_engine_kwargs["connect_args"] = connect_args

        if "private_key_path" in credentials:
            options, create_engine_kwargs = self._get_sqlalchemy_key_pair_auth_url(
                drivername, credentials
            )
        else:
            options = sa.engine.url.URL(drivername, **credentials)

        self.drivername = drivername

        engine = sa.create_engine(options, **create_engine_kwargs)
        return engine

    def _get_sqlalchemy_key_pair_auth_url(
        self, drivername: str, credentials: dict
    ) -> Tuple["URL", Dict]:
        """
        Utilizing a private key path and a passphrase in a given credentials dictionary, attempts to encode the provided
        values into a private key. If passphrase is incorrect, this will fail and an exception is raised.

        Args:
            drivername(str) - The name of the driver class
            credentials(dict) - A dictionary of database credentials used to access the database

        Returns:
            a tuple consisting of a url with the serialized key-pair authentication, and a dictionary of engine kwargs.
        """
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization

        private_key_path = credentials.pop("private_key_path")
        private_key_passphrase = credentials.pop("private_key_passphrase")

        with Path(private_key_path).expanduser().resolve().open(mode="rb") as key:
            try:
                p_key = serialization.load_pem_private_key(
                    key.read(),
                    password=private_key_passphrase.encode()
                    if private_key_passphrase
                    else None,
                    backend=default_backend(),
                )
            except ValueError as e:
                if "incorrect password" in str(e).lower():
                    raise ge_exceptions.DatasourceKeyPairAuthBadPassphraseError(
                        datasource_name="SqlAlchemyDatasource",
                        message="Decryption of key failed, was the passphrase incorrect?",
                    ) from e
                else:
                    raise e
        pkb = p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        credentials_driver_name = credentials.pop("drivername", None)
        create_engine_kwargs = {"connect_args": {"private_key": pkb}}
        return (
            sa.engine.url.URL(drivername or credentials_driver_name, **credentials),
            create_engine_kwargs,
        )

    def _get(self, key):
        sel = (
            select([column("value")])
            .select_from(self._table)
            .where(
                and_(
                    *(
                        getattr(self._table.columns, key_col) == val
                        for key_col, val in zip(self.key_columns, key)
                    )
                )
            )
        )
        try:
            return self.engine.execute(sel).fetchone()[0]
        except (IndexError, SQLAlchemyError) as e:
            logger.debug("Error fetching value: " + str(e))
            raise ge_exceptions.StoreError("Unable to fetch value for key: " + str(key))

    def _set(self, key, value, allow_update=True):
        cols = {k: v for (k, v) in zip(self.key_columns, key)}
        cols["value"] = value

        if allow_update:
            if self.has_key(key):
                ins = (
                    self._table.update()
                    .where(getattr(self._table.columns, self.key_columns[0]) == key[0])
                    .values(**cols)
                )
            else:
                ins = self._table.insert().values(**cols)
        else:
            ins = self._table.insert().values(**cols)

        try:
            self.engine.execute(ins)
        except IntegrityError as e:
            if self._get(key) == value:
                logger.info(f"Key {str(key)} already exists with the same value.")
            else:
                raise ge_exceptions.StoreBackendError(
                    f"Integrity error {str(e)} while trying to store key"
                )

    def _move(self):
        raise NotImplementedError

    def get_url_for_key(self, key):
        url = self._convert_engine_and_key_to_url(key)
        return url

    def _convert_engine_and_key_to_url(self, key):
        # SqlAlchemy engine URL is formatted in the following way
        # postgresql://postgres:password@localhost:5433/work
        # [engine]://[username]:[password]@[host]:[port]/[db_name]

        # which contains information like username and password that should not be public
        # This function changes the formatting to the following:
        # [engine]://[db_name]/[key]

        full_url = str(self.engine.url)
        engine_name = full_url.split("://")[0]
        db_name = full_url.split("/")[-1]
        return engine_name + "://" + db_name + "/" + str(key[0])

    def _has_key(self, key):
        sel = (
            select([sa.func.count(column("value"))])
            .select_from(self._table)
            .where(
                and_(
                    *(
                        getattr(self._table.columns, key_col) == val
                        for key_col, val in zip(self.key_columns, key)
                    )
                )
            )
        )
        try:
            return self.engine.execute(sel).fetchone()[0] == 1
        except (IndexError, SQLAlchemyError) as e:
            logger.debug("Error checking for value: " + str(e))
            return False

    def list_keys(self, prefix=()):
        sel = (
            select([column(col) for col in self.key_columns])
            .select_from(self._table)
            .where(
                and_(
                    *(
                        getattr(self._table.columns, key_col) == val
                        for key_col, val in zip(self.key_columns[: len(prefix)], prefix)
                    )
                )
            )
        )
        return [tuple(row) for row in self.engine.execute(sel).fetchall()]

    def remove_key(self, key):
        delete_statement = self._table.delete().where(
            and_(
                *(
                    getattr(self._table.columns, key_col) == val
                    for key_col, val in zip(self.key_columns, key)
                )
            )
        )
        try:
            return self.engine.execute(delete_statement)
        except SQLAlchemyError as e:
            raise ge_exceptions.StoreBackendError(
                f"Unable to delete key: got sqlalchemy error {str(e)}"
            )

    @property
    def config(self) -> dict:
        return self._config

    _move = None
