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
Module to define overriden dialect methods
"""

import importlib.util
import platform
import shutil
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from enum import Enum
from pathlib import Path
from threading import Lock
from types import SimpleNamespace

from sqlalchemy import and_, join, select, sql, text
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes as sa_types

from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

BASE_CLIDRIVER_URL = "https://public.dhe.ibm.com/ibmdl/export/pub/software/data/db2/drivers/odbc_cli"
# IBM's mirror of the same archives; ibm_db's own installer falls back to it as well.
GITHUB_CLIDRIVER_URL = "https://github.com/ibmdb/db2drivers/raw/main/clidriver"

_CLIDRIVER_INSTALL_LOCK = Lock()
_CLIDRIVER_INSTALL_STATE = SimpleNamespace(version=None)


class DB2CLIDriverVersions(Enum):
    """
    Enum for the DB2 CLI Driver versions
    """

    V11_1_4 = "11.1.4"
    V11_5_4 = "11.5.4"
    V11_5_5 = "11.5.5"
    V11_5_6 = "11.5.6"
    V11_5_8 = "11.5.8"
    V11_5_9 = "11.5.9"
    V12_1_0 = "12.1.0"


@reflection.cache
def get_columns_os390(self, connection, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    """Override OS390Reflector.get_columns to handle empty/unrecognized types
    gracefully instead of emitting SAWarnings."""
    current_schema = self.denormalize_name(schema or self.default_schema_name)
    table_name = self.denormalize_name(table_name)
    syscols = self.sys_columns

    query = (
        sql.select(
            syscols.c.colname,
            syscols.c.typename,
            syscols.c.defaultval,
            syscols.c.nullable,
            syscols.c.length,
            syscols.c.scale,
            syscols.c.generated,
            syscols.c.remark,
        )
        .where(
            and_(
                syscols.c.tabschema == current_schema,
                syscols.c.tabname == table_name,
            )
        )
        .order_by(syscols.c.colno)
    )
    sa_columns = []
    for r in connection.execute(query):
        coltype = r[1].strip().upper() if r[1] else ""
        if coltype in ["DECIMAL", "NUMERIC"]:
            coltype = self.ischema_names.get(coltype)(int(r[4]), int(r[5]))
        elif coltype in ["CHARACTER", "CHAR", "VARCHAR", "GRAPHIC", "VARGRAPHIC"]:
            coltype = self.ischema_names.get(coltype)(int(r[4]))
        elif coltype and coltype in self.ischema_names:
            coltype = self.ischema_names[coltype]
        else:
            if not coltype:
                logger.warning(f"Empty type for column '{r[0]}' - ingesting as UNKNOWN")
            else:
                logger.warning(f"Did not recognize type '{coltype}' of column '{r[0]}' - ingesting as UNKNOWN")
            coltype = sa_types.NULLTYPE

        sa_columns.append(
            {
                "name": self.normalize_name(r[0]),
                "type": coltype,
                "nullable": r[3] == "Y",
                "default": r[2] or None,
                "autoincrement": r[6] not in (" ", None),
                "comment": r[7] or None,
            }
        )
    return sa_columns


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    """Small Method to override the Dialect default as it is not filtering properly the Schema and Table Name."""
    current_schema = self.denormalize_name(schema or self.default_schema_name)
    table_name = self.denormalize_name(table_name)
    syskeycol = self.sys_keycoluse
    sysconst = self.sys_tabconst
    query = (
        sql.select(syskeycol.c.constname, syskeycol.c.colname)
        .select_from(
            join(
                syskeycol,
                sysconst,
                and_(
                    syskeycol.c.constname == sysconst.c.constname,
                    syskeycol.c.tabschema == sysconst.c.tabschema,
                    syskeycol.c.tabname == sysconst.c.tabname,
                ),
            )
        )
        .where(
            and_(
                sysconst.c.tabname == table_name,
                sysconst.c.tabschema == current_schema,
                sysconst.c.type == "U",
            )
        )
        .order_by(syskeycol.c.constname)
    )
    unique_consts = []
    curr_const = None
    for r in connection.execute(query):
        if curr_const == r[0]:
            unique_consts[-1]["column_names"].append(self.normalize_name(r[1]))
        else:
            curr_const = r[0]
            unique_consts.append(
                {
                    "name": self.normalize_name(curr_const),
                    "column_names": [self.normalize_name(r[1])],
                }
            )
    return unique_consts


def check_clidriver_version(clidriver_version: str):
    """
    Check if the CLI Driver version is valid
    """
    if clidriver_version not in [v.value for v in DB2CLIDriverVersions]:
        logger.warning(f"Invalid CLI Driver version provided: {clidriver_version}")
        return None
    return DB2CLIDriverVersions(clidriver_version)


def install_clidriver(clidriver_version: str) -> None:
    """Install a DB2 CLI driver version once per process."""
    with _CLIDRIVER_INSTALL_LOCK:
        if _CLIDRIVER_INSTALL_STATE.version == clidriver_version:
            return

        _CLIDRIVER_INSTALL_STATE.version = None
        if _install_clidriver(clidriver_version):
            sys.modules.pop("clidriver", None)
            _CLIDRIVER_INSTALL_STATE.version = clidriver_version


def _install_clidriver(clidriver_version: str) -> bool:
    """Swap the CLI driver bundled with ibm_db for the requested version.

    The prebuilt ibm_db extension loads libdb2 through its RUNPATH
    ($ORIGIN/clidriver/lib) and only binds the stable CLI API, so replacing the
    driver files switches the version. Rebuilding ibm_db against the driver would
    also work, but needs a C compiler that the ingestion images no longer ship.
    """
    archive_name = _clidriver_archive_name()
    if archive_name is None:
        logger.error("Unsupported operating system for db2 driver installation: %s", platform.system())
        return False

    spec = importlib.util.find_spec("clidriver")
    if spec is None or not spec.submodule_search_locations:
        logger.error("ibm_db is not installed, so DB2 CLI driver %s cannot be installed", clidriver_version)
        return False
    driver_dir = Path(next(iter(spec.submodule_search_locations)))

    if "ibm_db" in sys.modules:
        logger.warning(
            "ibm_db is already loaded in this process; DB2 CLI driver %s applies from the next run",
            clidriver_version,
        )

    # Staged next to the installed driver, which stays in place until the new one is
    # fully on disk. shutil.move, not a plain rename: in a container the bundled
    # driver sits in a read-only image layer, and overlayfs refuses to rename such a
    # directory (EXDEV), so it has to be copied out instead.
    with tempfile.TemporaryDirectory(
        prefix=".clidriver-", dir=driver_dir.parent, ignore_cleanup_errors=True
    ) as staging:
        archive = Path(staging, archive_name)
        _download_clidriver(clidriver_version, archive)
        new_driver = _extract_clidriver(archive, Path(staging, "extracted"))
        if (driver_dir / "__init__.py").exists():
            # `import clidriver` locates the directory the license file is staged into.
            shutil.copy2(driver_dir / "__init__.py", new_driver / "__init__.py")
        previous = Path(shutil.move(driver_dir, Path(staging, "previous")))
        try:
            shutil.move(new_driver, driver_dir)
        except OSError:
            shutil.move(previous, driver_dir)
            raise
    logger.info("Installed DB2 CLI driver %s in %s", clidriver_version, driver_dir)
    return True


def _clidriver_archive_name() -> str | None:
    system = platform.system().lower()
    is_64bits = platform.architecture()[0] == "64bit"
    if system == "linux":
        return "linuxx64_odbc_cli.tar.gz" if is_64bits else "linuxia32_odbc_cli.tar.gz"
    if system == "darwin":
        return "macarm64_odbc_cli.tar.gz" if platform.machine().lower() == "arm64" else "macos64_odbc_cli.tar.gz"
    if system == "windows":
        return "ntx64_odbc_cli.zip" if is_64bits else "nt32_odbc_cli.zip"
    return None


def _download_clidriver(clidriver_version: str, archive: Path) -> None:
    failures: list[str] = []
    for base_url in (BASE_CLIDRIVER_URL, GITHUB_CLIDRIVER_URL):
        url = f"{base_url}/v{clidriver_version}/{archive.name}"
        try:
            with urllib.request.urlopen(url, timeout=THREE_MIN) as response, archive.open("wb") as file:
                shutil.copyfileobj(response, file)
        except OSError as exc:
            logger.warning("Could not download DB2 CLI driver from %s: %s", url, exc)
            failures.append(f"{url}: {exc}")
        else:
            logger.info("Downloaded DB2 CLI driver %s from %s", clidriver_version, url)
            return
    raise RuntimeError(f"Could not download DB2 CLI driver {clidriver_version}: {'; '.join(failures)}")


def _extract_clidriver(archive: Path, destination: Path) -> Path:
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as zip_file:
            zip_file.extractall(destination)
    else:
        with tarfile.open(archive) as tar:
            if hasattr(tarfile, "data_filter"):
                # Rejects members that would land outside destination (Python 3.10.12+).
                tar.extractall(destination, filter="data")
            else:
                tar.extractall(destination)
    driver = destination / "clidriver"
    if not driver.is_dir():
        raise RuntimeError(f"{archive.name} does not contain a clidriver directory")
    return driver


_IBMI_PATCHED = False


def _ibmi_compat_select(*args, **kwargs):
    """Translate the SA-1.x ``select([cols], whereclause, order_by=...)`` form to
    the modern signature. sqlalchemy-ibmi 0.9.3 uses the legacy form, removed in
    SA 2.0. ``order_by`` must be carried over: get_foreign_keys and get_indexes
    rely on it to group multi-column constraints in column order."""
    if args and isinstance(args[0], (list, tuple)):
        statement = select(*args[0])
        for whereclause in args[1:]:
            if whereclause is not None:
                statement = statement.where(whereclause)
        order_by = kwargs.pop("order_by", None)
        if order_by is not None:
            statement = statement.order_by(*order_by)
        if kwargs:
            raise TypeError(f"Unsupported legacy select() keywords: {sorted(kwargs)}")
        return statement
    return select(*args, **kwargs)


def get_default_schema_name_ibmi(self, connection):
    """SA 2.0 rejects raw strings passed to ``Connection.execute``."""
    return self.normalize_name(connection.execute(text("VALUES CURRENT_SCHEMA")).scalar())


def check_text_server_ibmi(self, connection):
    """SA 2.0 rejects raw strings passed to ``Connection.execute``."""
    return connection.execute(text("SELECT COUNT(*) FROM QSYS2.SYSTEXTSERVERS")).scalar()


def patch_ibmi_dialect() -> bool:
    """Adapt the sqlalchemy-ibmi dialect to SQLAlchemy 2.0 at runtime.

    sqlalchemy-ibmi 0.9.3 pins sqlalchemy<2 but is installed with --no-deps, so
    its SA-1.x call sites survive into a SA 2.0 runtime and fail on first use.
    Reassigning the module-level ``select`` covers every legacy reflection query
    at once, since the dialect resolves it as a global on each call.
    """
    global _IBMI_PATCHED  # noqa: PLW0603
    if _IBMI_PATCHED:
        return True
    try:
        import sqlalchemy_ibmi.base as ibmi_base
    except ImportError:
        logger.debug("sqlalchemy-ibmi not installed - ibmi scheme unavailable")
        return False

    # A partially-initialised module (interrupted import) satisfies the import
    # above but lacks the dialect, so assigning onto it would raise instead.
    dialect = getattr(ibmi_base, "IBMiDb2Dialect", None)
    if dialect is None:
        logger.debug("sqlalchemy-ibmi is not usable - ibmi scheme unavailable")
        return False

    ibmi_base.select = _ibmi_compat_select
    dialect._get_default_schema_name = get_default_schema_name_ibmi
    dialect._check_text_server = check_text_server_ibmi
    _IBMI_PATCHED = True
    return True
