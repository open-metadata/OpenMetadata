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
from enum import Enum

from sqlalchemy import and_, join, sql
from sqlalchemy.engine import reflection

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

BASE_CLIDRIVER_URL = (
    "https://public.dhe.ibm.com/ibmdl/export/pub/software/data/db2/drivers/odbc_cli"
)


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
def get_unique_constraints(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
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


# pylint: disable=too-many-statements,too-many-branches
def install_clidriver(clidriver_version: str) -> None:
    """
    Install the CLI Driver for DB2
    """
    # pylint: disable=import-outside-toplevel
    import os
    import platform
    import subprocess
    import sys
    from urllib.request import URLError, urlopen

    import pkg_resources

    clidriver_version = f"v{clidriver_version}"
    system = platform.system().lower()
    is_64bits = platform.architecture()[0] == "64bit"
    clidriver_url = None
    default_clidriver_url = None

    def is_valid_url(url: str) -> bool:
        """Check if the URL is valid and accessible"""
        try:
            with urlopen(url) as _:
                return True
        except URLError:
            return False

    if system == "darwin":  # macOS
        machine = platform.machine().lower()
        if machine == "arm64":  # Apple Silicon
            default_clidriver_url = f"{BASE_CLIDRIVER_URL}/macarm64_odbc_cli.tar.gz"
            clidriver_url = f"{BASE_CLIDRIVER_URL}/macarm64_odbc_cli.tar.gz"
        elif machine == "x86_64":  # Intel
            default_clidriver_url = f"{BASE_CLIDRIVER_URL}/macos64_odbc_cli.tar.gz"
            clidriver_url = (
                f"{BASE_CLIDRIVER_URL}/{str(clidriver_version)}/macos64_odbc_cli.tar.gz"
            )
    elif system == "linux":
        if is_64bits:
            default_clidriver_url = f"{BASE_CLIDRIVER_URL}/linuxx64_odbc_cli.tar.gz"
            clidriver_url = f"{BASE_CLIDRIVER_URL}/{str(clidriver_version)}/linuxx64_odbc_cli.tar.gz"
        else:
            default_clidriver_url = f"{BASE_CLIDRIVER_URL}/linuxia32_odbc_cli.tar.gz"
            clidriver_url = f"{BASE_CLIDRIVER_URL}/{str(clidriver_version)}/linuxia32_odbc_cli.tar.gz"
    elif system == "windows":
        if is_64bits:
            default_clidriver_url = f"{BASE_CLIDRIVER_URL}/ntx64_odbc_cli.zip"
            clidriver_url = (
                f"{BASE_CLIDRIVER_URL}/{str(clidriver_version)}/ntx64_odbc_cli.zip"
            )
        else:
            default_clidriver_url = f"{BASE_CLIDRIVER_URL}/nt32_odbc_cli.zip"
            clidriver_url = (
                f"{BASE_CLIDRIVER_URL}/{str(clidriver_version)}/nt32_odbc_cli.zip"
            )
    else:
        logger.error(
            f"Unsupported operating system for db2 driver installation: {system}"
        )
        return None

    # set env variables for CLIDRIVER_VERSION and IBM_DB_INSTALLER_URL
    os.environ["CLIDRIVER_VERSION"] = clidriver_version
    if is_valid_url(clidriver_url):
        os.environ["IBM_DB_INSTALLER_URL"] = clidriver_url
    else:
        os.environ["IBM_DB_INSTALLER_URL"] = default_clidriver_url
    logger.info(f"Set IBM_DB_INSTALLER_URL to {os.environ['IBM_DB_INSTALLER_URL']}")
    logger.info(f"Set CLIDRIVER_VERSION to {os.environ['CLIDRIVER_VERSION']}")
    # Uninstall ibm_db if it is already installed
    try:
        pkg_resources.get_distribution("ibm_db")
        # If we get here, ibm_db is installed, so uninstall it first
        subprocess.check_call(
            [sys.executable, "-m", "pip", "uninstall", "-y", "ibm_db"]
        )
    except pkg_resources.DistributionNotFound:
        # ibm_db is not installed, proceed with installation
        pass
    # Install ibm_db with specific flags
    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "ibm_db~=3.2.6",
            "--no-binary",
            ":all:",
            "--no-cache-dir",
        ]
    )
    return None
