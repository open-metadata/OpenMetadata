#  Copyright 2026 Collate
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
Tests for the shared secret temporary-file helpers
"""

import os
import stat
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from metadata.utils.secure_tempfile import (
    remove_secret_temp_file,
    secret_temp_file,
    write_secret_temp_file,
)

PEM = "-----BEGIN PRIVATE KEY-----\nMIIEvg==\n-----END PRIVATE KEY-----\n"


def file_mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def spy_mkstemp(created: list[Path]):
    """
    Real mkstemp, recording the paths it hands out so a test can assert cleanup.

    The real callable is bound here, before patching: patching
    ``secure_tempfile.tempfile.mkstemp`` replaces the attribute on the shared
    ``tempfile`` module, so looking it up inside the spy would re-enter the mock.
    """
    real_mkstemp = tempfile.mkstemp

    def _mkstemp(**kwargs):
        file_descriptor, path = real_mkstemp(**kwargs)
        created.append(Path(path))

        return file_descriptor, path

    return _mkstemp


class TestWriteSecretTempFile:
    def test_writes_the_content_verbatim(self):
        path = write_secret_temp_file(PEM)
        try:
            assert path.read_text() == PEM
        finally:
            path.unlink()

    def test_accepts_bytes(self):
        path = write_secret_temp_file(b"\x01\x02binary-ish")
        try:
            assert path.read_bytes() == b"\x01\x02binary-ish"
        finally:
            path.unlink()

    def test_is_readable_only_by_the_owner(self):
        path = write_secret_temp_file(PEM)
        try:
            assert file_mode(path) == 0o600
        finally:
            path.unlink()

    def test_owner_only_even_under_a_permissive_umask(self):
        previous = os.umask(0o000)
        try:
            path = write_secret_temp_file(PEM)
            try:
                assert file_mode(path) == 0o600
            finally:
                path.unlink()
        finally:
            os.umask(previous)

    def test_honours_the_suffix(self):
        path = write_secret_temp_file(PEM, suffix=".pem")
        try:
            assert path.suffix == ".pem"
        finally:
            path.unlink()

    def test_leaves_no_partial_file_when_the_write_fails(self):
        created: list[Path] = []
        real_fdopen = os.fdopen

        def failing_fdopen(file_descriptor, *args, **kwargs):
            # Close the descriptor before failing so the test does not leak one.
            real_fdopen(file_descriptor, *args, **kwargs).close()

            raise OSError("disk full")

        with (
            patch(
                "metadata.utils.secure_tempfile.tempfile.mkstemp",
                side_effect=spy_mkstemp(created),
            ),
            patch("metadata.utils.secure_tempfile.os.fdopen", failing_fdopen),
            pytest.raises(OSError),
        ):
            write_secret_temp_file(PEM)

        assert created, "expected mkstemp to have been called"
        assert not created[0].exists()


class TestRemoveSecretTempFile:
    def test_removes_the_file(self):
        path = write_secret_temp_file(PEM)

        assert remove_secret_temp_file(path) is True
        assert not path.exists()

    def test_an_already_removed_file_counts_as_success(self):
        path = write_secret_temp_file(PEM)
        path.unlink()

        assert remove_secret_temp_file(path) is True

    def test_reports_failure_instead_of_raising(self):
        with patch("metadata.utils.secure_tempfile.Path.unlink", side_effect=OSError("busy")):
            assert remove_secret_temp_file("/tmp/whatever") is False

    def test_logs_the_path_but_never_the_secret(self, caplog):
        path = write_secret_temp_file(PEM)

        try:
            with patch(
                "metadata.utils.secure_tempfile.Path.unlink",
                side_effect=OSError("device busy"),
            ):
                assert remove_secret_temp_file(path) is False
        finally:
            path.unlink()

        assert str(path) in caplog.text
        assert "BEGIN PRIVATE KEY" not in caplog.text


class TestSecretTempFileContextManager:
    def test_exposes_the_content_inside_the_block(self):
        with secret_temp_file(PEM, suffix=".pem") as path:
            assert path.read_text() == PEM
            assert file_mode(path) == 0o600

    def test_removes_the_file_on_success(self):
        with secret_temp_file(PEM) as path:
            captured = path

        assert not captured.exists()

    def test_removes_the_file_when_the_body_raises(self):
        captured = None

        with pytest.raises(ValueError), secret_temp_file(PEM) as path:
            captured = path

            raise ValueError("boom")

        assert captured is not None
        assert not captured.exists()
