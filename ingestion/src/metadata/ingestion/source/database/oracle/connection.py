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
Source connection handler
"""

import base64
import binascii
import io
import os
import shutil
import sys
import tempfile
import weakref
import zipfile
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Optional  # noqa: UP035
from urllib.parse import quote_plus

import oracledb
from oracledb.exceptions import DatabaseError
from pydantic import SecretStr
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleAutonomousConnection,
    OracleDatabaseSchema,
    OracleServiceName,
    OracleTNSConnection,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection as OracleConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.secrets import connection_with_options_secrets
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.oracle.queries import (
    CHECK_ACCESS_TO_ALL,
    TEST_MATERIALIZED_VIEWS,
    TEST_ORACLE_GET_STORED_PACKAGES,
    TEST_QUERY_HISTORY,
)
from metadata.ingestion.source.database.oracle.utils import (
    get_table_prefix_from_connection,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

CX_ORACLE_LIB_VERSION = "8.3.0"
LD_LIB_ENV = "LD_LIBRARY_PATH"

logger = ingestion_logger()


class OracleConnection(BaseConnection[OracleConnectionConfig, Engine]):
    def __init__(self, connection: OracleConnectionConfig):
        super().__init__(connection)
        # Use typing.Optional rather than `str | None` for consistency with the
        # rest of the connector codebase (which targets older runtimes that
        # cannot use PEP 604 union syntax in evaluated annotations).
        self._wallet_temp_dir: Optional[str] = None  # noqa: UP045
        self._wallet_cleanup_finalizer: Any = None

    def _set_wallet_temp_dir(self, wallet_temp_dir: str) -> None:
        self._cleanup_wallet_temp_dir()
        self._wallet_temp_dir = wallet_temp_dir
        self._wallet_cleanup_finalizer = weakref.finalize(
            self,
            shutil.rmtree,
            wallet_temp_dir,
            ignore_errors=True,
        )

    def _cleanup_wallet_temp_dir(self) -> None:
        wallet_temp_dir = self._wallet_temp_dir
        if self._wallet_cleanup_finalizer and self._wallet_cleanup_finalizer.alive:
            self._wallet_cleanup_finalizer()
        elif wallet_temp_dir:
            shutil.rmtree(wallet_temp_dir, ignore_errors=True)

        self._wallet_cleanup_finalizer = None
        self._wallet_temp_dir = None

    def _is_autonomous_connection(self) -> bool:
        return isinstance(self.service_connection.oracleConnectionType, OracleAutonomousConnection)

    @staticmethod
    def _autonomous_inner(autonomous: OracleAutonomousConnection):
        """Unwrap the Pydantic RootModel.

        OracleAutonomousConnection is generated as
        RootModel[Union[OracleAutonomousConnection1, OracleAutonomousConnection2]]
        because the JSON schema uses ``anyOf`` to enforce that either walletPath
        or walletContent must be present. The inner variant carries the actual
        ``tnsAlias``, ``walletPath``, ``walletContent`` and ``walletPassword``
        fields, so callers must go through ``.root`` to read them.
        """
        return autonomous.root

    @staticmethod
    def _safe_extract_wallet_archive(zip_ref: zipfile.ZipFile, target_dir: str) -> None:
        target_root = Path(target_dir).resolve()

        for member in zip_ref.infolist():
            member_path = (target_root / member.filename).resolve()

            if member_path != target_root and target_root not in member_path.parents:
                raise ValueError("Invalid walletContent. Wallet zip contains unsafe file paths.")

            if member.is_dir():
                OracleConnection._mkdir_secure_within(member_path, target_root)
                continue

            OracleConnection._mkdir_secure_within(member_path.parent, target_root)
            with (
                zip_ref.open(member, "r") as source_file,
                open(
                    member_path,
                    "wb",
                    opener=OracleConnection._secure_open,
                ) as target_file,
            ):
                shutil.copyfileobj(source_file, target_file)

    # O_EXCL: refuse to overwrite an existing file, so a malicious zip with
    # duplicate entries cannot replace previously extracted wallet files.
    # O_NOFOLLOW: refuse to follow a symlink at the final path component on
    # platforms that support it (POSIX). On Windows the attribute does not
    # exist, so we fall back to a 0 mask — the symlink-pre-place attack model
    # is Unix-shared-tmp specific.
    _O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)

    @staticmethod
    def _secure_open(path: str, flags: int) -> int:
        return os.open(path, flags | os.O_EXCL | OracleConnection._O_NOFOLLOW, 0o600)

    @staticmethod
    def _mkdir_secure_within(path: Path, root: Path) -> None:
        """Create path and any intermediate dirs with 0o700, only within root."""
        if path == root:
            return
        if root not in path.parents:
            raise ValueError(f"Refusing to create {path}: outside wallet root {root}.")

        current_path = root
        for part in path.relative_to(root).parts:
            current_path = current_path / part
            try:
                current_path.mkdir(mode=0o700, exist_ok=False)
            except FileExistsError as exc:
                if not current_path.is_dir():
                    raise ValueError(
                        f"Invalid walletContent. Expected directory path but found existing file: {current_path}"
                    ) from exc
            # Always chmod after we've confirmed it's a directory — covers both
            # the just-created case (which mkdir(mode=0o700) sets correctly but
            # umask can mask) and the pre-existing case (which may have been
            # created with looser permissions by an earlier extraction run).
            current_path.chmod(0o700)

    def _extract_wallet_content(self, wallet_content: SecretStr) -> str:
        # Strip whitespace/newlines so wrapped base64 (e.g. from `base64 -i` on macOS,
        # which inserts line breaks every 76 chars) decodes the same as a single line.
        sanitized = "".join(wallet_content.get_secret_value().split())
        # Reject empty / whitespace-only walletContent explicitly. An empty
        # string would otherwise decode to b"" and only fail later as a zip
        # error, hiding the real cause (the field was never set).
        if not sanitized:
            raise ValueError("walletContent is empty. Provide a base64-encoded wallet zip.")
        try:
            decoded_wallet = base64.b64decode(sanitized, validate=True)
        except (binascii.Error, TypeError) as exc:
            raise ValueError("Invalid walletContent. Expected a base64-encoded wallet zip.") from exc

        wallet_temp_dir = tempfile.mkdtemp(prefix="oracle_wallet_")
        self._set_wallet_temp_dir(wallet_temp_dir)

        try:
            with zipfile.ZipFile(io.BytesIO(decoded_wallet)) as zip_ref:
                self._safe_extract_wallet_archive(zip_ref, wallet_temp_dir)
        except zipfile.BadZipFile as exc:
            self._cleanup_wallet_temp_dir()
            raise ValueError("Invalid walletContent. Expected a valid zip archive.") from exc
        except Exception:
            self._cleanup_wallet_temp_dir()
            raise

        return wallet_temp_dir

    def _configure_autonomous_connection_arguments(self) -> None:
        autonomous_connection = self.service_connection.oracleConnectionType
        if not isinstance(autonomous_connection, OracleAutonomousConnection):
            return
        autonomous = self._autonomous_inner(autonomous_connection)

        if not self.service_connection.connectionArguments:
            self.service_connection.connectionArguments = init_empty_connection_arguments()
        if self.service_connection.connectionArguments.root is None:
            self.service_connection.connectionArguments.root = {}

        connection_arguments: Dict[str, Any] = self.service_connection.connectionArguments.root  # noqa: UP006

        wallet_path = autonomous.walletPath
        if autonomous.walletContent:
            if self._wallet_temp_dir and Path(self._wallet_temp_dir).is_dir():
                wallet_path = self._wallet_temp_dir
            else:
                wallet_path = self._extract_wallet_content(autonomous.walletContent)
        else:
            self._cleanup_wallet_temp_dir()

        if not wallet_path:
            raise ValueError("Oracle Autonomous connections require either walletPath or walletContent.")

        connection_arguments["config_dir"] = wallet_path
        connection_arguments["wallet_location"] = wallet_path
        # wallet_password is intentionally NOT persisted into connectionArguments.
        # The raw secret is materialised only inside _build_connection_args at
        # the SQLAlchemy/oracledb call boundary, so it never lives on the
        # service_connection object and cannot leak via get_connection_dict(),
        # repr, or logging of the connection.
        connection_arguments.pop("wallet_password", None)

    def _uses_inline_wallet_content(self) -> bool:
        connection_type = self.service_connection.oracleConnectionType
        if not isinstance(connection_type, OracleAutonomousConnection):
            return False
        return bool(self._autonomous_inner(connection_type).walletContent)

    def _build_connection_args(self, connection: OracleConnectionConfig) -> dict:
        """Build SQLAlchemy connect_args, injecting wallet_password just-in-time.

        Keeping wallet_password off connectionArguments avoids leaking it
        through any path that serialises or logs the persisted connection
        (e.g. get_connection_dict()).
        """
        args = dict(get_connection_args_common(connection))
        connection_type = connection.oracleConnectionType
        if isinstance(connection_type, OracleAutonomousConnection):
            autonomous = self._autonomous_inner(connection_type)
            if autonomous.walletPassword:
                args["wallet_password"] = autonomous.walletPassword.get_secret_value()
        return args

    def _get_client(self) -> Engine:
        """
        Create connection
        """
        self._configure_autonomous_connection_arguments()

        if not self._is_autonomous_connection():
            try:
                if self.service_connection.instantClientDirectory:
                    logger.info(f"Initializing Oracle thick client at {self.service_connection.instantClientDirectory}")
                    os.environ[LD_LIB_ENV] = self.service_connection.instantClientDirectory
                    oracledb.init_oracle_client(lib_dir=self.service_connection.instantClientDirectory)
            except DatabaseError as err:
                logger.info(f"Could not initialize Oracle thick client: {err}")

        try:
            return create_generic_db_connection(
                connection=self.service_connection,
                get_connection_url_fn=self.get_connection_url,
                get_connection_args_fn=self._build_connection_args,
            )
        except Exception:
            if self._uses_inline_wallet_content():
                self._cleanup_wallet_temp_dir()
            raise

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        table_prefix = get_table_prefix_from_connection(self.service_connection)
        self.client.dialect.table_prefix = table_prefix
        test_conn_queries = {
            "CheckAccess": CHECK_ACCESS_TO_ALL.format(prefix=table_prefix),
            "PackageAccess": TEST_ORACLE_GET_STORED_PACKAGES.format(prefix=table_prefix),
            "GetMaterializedViews": TEST_MATERIALIZED_VIEWS.format(prefix=table_prefix),
            "GetQueryHistory": TEST_QUERY_HISTORY,
        }

        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=test_conn_queries,
            timeout_seconds=timeout_seconds,
        )

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        url = self.client.url
        connection_copy = deepcopy(self.service_connection)

        connection_dict = {
            "driver": url.drivername,
            "host": f"{url.host}:{url.port}",  # This is the format expected by data-diff. If we start using this for something else, we need to change it and modify the data-diff code.
            "user": url.username,
        }

        # Add password if present in the connection
        if connection_copy.password:
            connection_dict["password"] = connection_copy.password.get_secret_value()

        # Add connection type specific information
        if isinstance(connection_copy.oracleConnectionType, OracleDatabaseSchema):
            connection_dict["database"] = connection_copy.oracleConnectionType.databaseSchema
        elif isinstance(connection_copy.oracleConnectionType, OracleServiceName):
            connection_dict["database"] = connection_copy.oracleConnectionType.oracleServiceName
        elif isinstance(connection_copy.oracleConnectionType, OracleTNSConnection):
            connection_dict["host"] = connection_copy.oracleConnectionType.oracleTNSConnection
        elif isinstance(connection_copy.oracleConnectionType, OracleAutonomousConnection):
            connection_dict["host"] = self._autonomous_inner(connection_copy.oracleConnectionType).tnsAlias

        # Add connection options if present
        if connection_copy.connectionOptions and connection_copy.connectionOptions.root:
            connection_with_options_secrets(lambda: connection_copy)
            connection_dict.update(connection_copy.connectionOptions.root)

        # Add connection arguments if present
        if connection_copy.connectionArguments and connection_copy.connectionArguments.root:
            connection_dict.update(get_connection_args_common(connection_copy))

        return connection_dict

    @staticmethod
    def get_connection_url(connection: OracleConnectionConfig) -> str:
        """
        Build the URL and handle driver version at system level
        """

        oracledb.version = CX_ORACLE_LIB_VERSION
        sys.modules["cx_Oracle"] = oracledb

        url = f"{connection.scheme.value}://"
        if connection.username:
            url += f"{quote_plus(connection.username)}"
            if not connection.password:
                connection.password = SecretStr("")
            url += f":{quote_plus(connection.password.get_secret_value())}"
            url += "@"

        url = OracleConnection._handle_connection_type(url=url, connection=connection)

        options = get_connection_options_dict(connection)
        if options:
            params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
            if isinstance(connection.oracleConnectionType, OracleServiceName):
                url = f"{url}&{params}"
            else:
                url = f"{url}?{params}"

        return url

    @staticmethod
    def _handle_connection_type(url: str, connection: OracleConnectionConfig) -> str:
        """
        Depending on the oracle connection type, we need to handle the URL differently
        """

        if isinstance(connection.oracleConnectionType, OracleTNSConnection):
            # ref https://stackoverflow.com/questions/14140902/using-oracle-service-names-with-sqlalchemy
            url += connection.oracleConnectionType.oracleTNSConnection
            return url

        if isinstance(connection.oracleConnectionType, OracleAutonomousConnection):
            url += OracleConnection._autonomous_inner(connection.oracleConnectionType).tnsAlias
            return url

        # If not TNS, we add the hostPort
        url += connection.hostPort

        if isinstance(connection.oracleConnectionType, OracleDatabaseSchema):
            url += (
                f"/{connection.oracleConnectionType.databaseSchema}"
                if connection.oracleConnectionType.databaseSchema
                else ""
            )
            return url

        if isinstance(connection.oracleConnectionType, OracleServiceName):
            url = f"{url}/?service_name={connection.oracleConnectionType.oracleServiceName}"
            return url  # noqa: RET504

        raise ValueError(f"Unknown connection type {connection.oracleConnectionType}")
