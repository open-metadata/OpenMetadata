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
"""Connector tests read the newest source version unless the oldest is selected or an image is named."""

import pytest

from _openmetadata_testutils.helpers import database_images

OVERRIDES = ("MYSQL_SOURCE_IMAGE", "POSTGRES_SOURCE_IMAGE", database_images.SOURCE_VERSION_VARIABLE)


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for variable in OVERRIDES:
        monkeypatch.delenv(variable, raising=False)


def test_tests_read_the_newest_version_by_default():
    assert database_images.mysql_source_image() == database_images.MYSQL_NEWEST_SOURCE_IMAGE
    assert database_images.postgres_source_image() == database_images.POSTGRES_NEWEST_SOURCE_IMAGE


def test_selecting_the_oldest_version_reads_the_oldest(monkeypatch):
    monkeypatch.setenv(database_images.SOURCE_VERSION_VARIABLE, " Oldest ")

    assert database_images.mysql_source_image() == database_images.MYSQL_OLDEST_SOURCE_IMAGE
    assert database_images.postgres_source_image() == database_images.POSTGRES_OLDEST_SOURCE_IMAGE


def test_an_unknown_version_fails_instead_of_reading_the_newest(monkeypatch):
    monkeypatch.setenv(database_images.SOURCE_VERSION_VARIABLE, "olde")

    with pytest.raises(ValueError, match="olde"):
        database_images.mysql_source_image()


def test_a_named_image_wins_over_the_selected_version(monkeypatch):
    monkeypatch.setenv(database_images.SOURCE_VERSION_VARIABLE, "oldest")
    monkeypatch.setenv("MYSQL_SOURCE_IMAGE", " example/db:9 ")
    monkeypatch.setenv("POSTGRES_SOURCE_IMAGE", " ")

    assert database_images.mysql_source_image() == "example/db:9"
    assert database_images.postgres_source_image() == database_images.POSTGRES_OLDEST_SOURCE_IMAGE
