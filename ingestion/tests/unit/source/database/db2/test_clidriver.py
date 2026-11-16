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
"""Unit tests for DB2 CLI driver installation."""

import errno
import io
import os
import shutil
import sys
import tarfile
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.db2.utils import (
    _clidriver_archive_name,
    _install_clidriver,
    install_clidriver,
)

UTILS_MODULE = "metadata.ingestion.source.database.db2.utils"
ARCHIVE = "linuxx64_odbc_cli.tar.gz"


def _write_driver_archive(mirror: Path, version: str, libdb2: bytes) -> None:
    """Lay out an IBM-style clidriver archive under <mirror>/v<version>/."""
    target = mirror / f"v{version}" / ARCHIVE
    target.parent.mkdir(parents=True)
    with tarfile.open(target, "w:gz") as tar:
        for name, payload in {
            "clidriver/lib/libdb2.so.1": libdb2,
            "clidriver/license/UNIX/odbc_LI_en": b"terms",
        }.items():
            member = tarfile.TarInfo(name)
            member.size = len(payload)
            tar.addfile(member, io.BytesIO(payload))
        link = tarfile.TarInfo("clidriver/lib/libdb2.so")
        link.type = tarfile.SYMTYPE
        link.linkname = "libdb2.so.1"
        tar.addfile(link)


@pytest.fixture
def mirrors(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """A bundled driver as ibm_db installs it, plus empty IBM and GitHub mirrors."""
    site = tmp_path / "site-packages"
    bundled = site / "clidriver"
    (bundled / "lib").mkdir(parents=True)
    (bundled / "__init__.py").write_text("")
    (bundled / "lib" / "libdb2.so.1").write_bytes(b"bundled")
    monkeypatch.syspath_prepend(str(site))
    monkeypatch.delitem(sys.modules, "clidriver", raising=False)

    ibm, github = tmp_path / "ibm", tmp_path / "github"
    ibm.mkdir()
    github.mkdir()
    with (
        patch(f"{UTILS_MODULE}._CLIDRIVER_INSTALL_STATE.version", None),
        patch(f"{UTILS_MODULE}.BASE_CLIDRIVER_URL", ibm.as_uri()),
        patch(f"{UTILS_MODULE}.GITHUB_CLIDRIVER_URL", github.as_uri()),
        patch("platform.system", return_value="Linux"),
        patch("platform.architecture", return_value=("64bit", "ELF")),
    ):
        yield ibm, github, bundled


def test_installs_requested_driver_without_rebuilding_ibm_db(mirrors: tuple[Path, Path, Path]):
    ibm, _, bundled = mirrors
    _write_driver_archive(ibm, "11.5.9", b"v11.5.9")

    with patch("subprocess.check_call") as pip:
        install_clidriver("11.5.9")

    pip.assert_not_called()
    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"v11.5.9"
    assert (bundled / "lib" / "libdb2.so").readlink() == Path("libdb2.so.1")
    assert (bundled / "license" / "UNIX" / "odbc_LI_en").read_bytes() == b"terms"
    # `import clidriver` must keep resolving: the license file is staged through it.
    assert (bundled / "__init__.py").exists()
    assert sorted(path.name for path in bundled.parent.iterdir()) == ["clidriver"]


def test_falls_back_to_github_mirror(mirrors: tuple[Path, Path, Path]):
    _, github, bundled = mirrors
    _write_driver_archive(github, "11.1.4", b"v11.1.4")

    install_clidriver("11.1.4")

    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"v11.1.4"


def test_installs_when_bundled_driver_cannot_be_renamed(mirrors: tuple[Path, Path, Path]):
    """In a container the bundled driver lives in a read-only image layer, and
    overlayfs rejects renaming such a directory with EXDEV."""
    ibm, _, bundled = mirrors
    _write_driver_archive(ibm, "11.5.9", b"v11.5.9")
    rename = os.rename

    def overlayfs_rename(src: str, dst: str) -> None:
        if Path(src) == bundled:
            raise OSError(errno.EXDEV, "Invalid cross-device link")
        rename(src, dst)

    with (
        patch("os.rename", side_effect=overlayfs_rename),
        patch("os.replace", side_effect=overlayfs_rename),
    ):
        install_clidriver("11.5.9")

    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"v11.5.9"
    assert (bundled / "__init__.py").exists()
    assert sorted(path.name for path in bundled.parent.iterdir()) == ["clidriver"]


def test_failed_download_keeps_bundled_driver(mirrors: tuple[Path, Path, Path]):
    _, _, bundled = mirrors

    with pytest.raises(RuntimeError, match=r"11\.5\.9"):
        install_clidriver("11.5.9")

    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"bundled"
    assert sorted(path.name for path in bundled.parent.iterdir()) == ["clidriver"]


def test_archive_without_driver_keeps_bundled_driver(mirrors: tuple[Path, Path, Path]):
    ibm, _, bundled = mirrors
    target = ibm / "v11.5.9" / ARCHIVE
    target.parent.mkdir(parents=True)
    with tarfile.open(target, "w:gz") as tar:
        tar.addfile(tarfile.TarInfo("README"), io.BytesIO(b""))

    with pytest.raises(RuntimeError, match="clidriver"):
        install_clidriver("11.5.9")

    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"bundled"


def test_failed_swap_restores_bundled_driver(mirrors: tuple[Path, Path, Path]):
    ibm, _, bundled = mirrors
    _write_driver_archive(ibm, "11.5.9", b"v11.5.9")
    move = shutil.move

    def fail_moving_new_driver_into_place(src: str, dst: str) -> str:
        if Path(dst) == bundled and "extracted" in Path(src).parts:
            raise OSError("No space left on device")
        return move(src, dst)

    with (
        patch("shutil.move", side_effect=fail_moving_new_driver_into_place),
        pytest.raises(OSError, match="No space left"),
    ):
        install_clidriver("11.5.9")

    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"bundled"
    assert sorted(path.name for path in bundled.parent.iterdir()) == ["clidriver"]


def test_installs_windows_zip_archive(mirrors: tuple[Path, Path, Path]):
    ibm, _, bundled = mirrors
    target = ibm / "v11.5.9" / "ntx64_odbc_cli.zip"
    target.parent.mkdir(parents=True)
    with zipfile.ZipFile(target, "w") as archive:
        archive.writestr("clidriver/bin/db2app64.dll", b"v11.5.9")

    with patch("platform.system", return_value="Windows"):
        install_clidriver("11.5.9")

    assert (bundled / "bin" / "db2app64.dll").read_bytes() == b"v11.5.9"


def test_unsupported_platform_installs_nothing(mirrors: tuple[Path, Path, Path]):
    ibm, _, bundled = mirrors
    _write_driver_archive(ibm, "11.5.9", b"v11.5.9")

    with patch("platform.system", return_value="AIX"):
        assert _install_clidriver("11.5.9") is False

    assert (bundled / "lib" / "libdb2.so.1").read_bytes() == b"bundled"


def test_nothing_is_installed_without_ibm_db(mirrors: tuple[Path, Path, Path]):
    ibm, _, _ = mirrors
    _write_driver_archive(ibm, "11.5.9", b"v11.5.9")

    with patch("importlib.util.find_spec", return_value=None):
        assert _install_clidriver("11.5.9") is False


@pytest.mark.parametrize(
    ("system", "bits", "machine", "archive"),
    [
        ("Linux", "64bit", "x86_64", "linuxx64_odbc_cli.tar.gz"),
        ("Linux", "32bit", "i686", "linuxia32_odbc_cli.tar.gz"),
        ("Darwin", "64bit", "arm64", "macarm64_odbc_cli.tar.gz"),
        ("Darwin", "64bit", "x86_64", "macos64_odbc_cli.tar.gz"),
        ("Windows", "64bit", "AMD64", "ntx64_odbc_cli.zip"),
        ("Windows", "32bit", "x86", "nt32_odbc_cli.zip"),
    ],
)
def test_archive_name_matches_platform(system: str, bits: str, machine: str, archive: str):
    with (
        patch("platform.system", return_value=system),
        patch("platform.architecture", return_value=(bits, "")),
        patch("platform.machine", return_value=machine),
    ):
        assert _clidriver_archive_name() == archive


@pytest.fixture
def install_driver():
    with (
        patch(f"{UTILS_MODULE}._CLIDRIVER_INSTALL_STATE.version", None),
        patch(f"{UTILS_MODULE}._install_clidriver", return_value=True) as install,
    ):
        yield install


def test_same_clidriver_version_is_installed_once(install_driver: MagicMock):
    install_clidriver("12.1.0")
    install_clidriver("12.1.0")

    assert install_driver.call_count == 1


def test_failed_clidriver_installation_is_retried(install_driver: MagicMock):
    install_driver.side_effect = [RuntimeError("download failed"), True]

    with pytest.raises(RuntimeError):
        install_clidriver("12.1.0")

    install_clidriver("12.1.0")
    assert install_driver.call_count == 2


def test_changing_clidriver_version_reinstalls(install_driver: MagicMock):
    install_clidriver("11.5.9")
    install_clidriver("12.1.0")
    install_clidriver("12.1.0")

    assert install_driver.call_count == 2


def test_concurrent_clidriver_installation_is_serialized(install_driver: MagicMock):
    installation_started = Event()
    allow_installation_to_finish = Event()

    def block_installation(_version: str) -> bool:
        installation_started.set()
        assert allow_installation_to_finish.wait(timeout=5)
        return True

    install_driver.side_effect = block_installation

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(install_clidriver, "12.1.0")
        assert installation_started.wait(timeout=5)
        second = executor.submit(install_clidriver, "12.1.0")
        allow_installation_to_finish.set()

        first.result(timeout=5)
        second.result(timeout=5)

    assert install_driver.call_count == 1
