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
"""Test database images are constants an environment variable can replace."""

from _openmetadata_testutils.helpers import database_images


def test_environment_overrides_the_image(monkeypatch):
    monkeypatch.setenv("MYSQL_IMAGE", " example/db:9 ")
    monkeypatch.setenv("POSTGRES_IMAGE", "example/db:8")

    assert database_images.mysql_image() == "example/db:9"
    assert database_images.postgres_image() == "example/db:8"


def test_blank_or_missing_override_falls_back_to_the_constant(monkeypatch):
    monkeypatch.setenv("MYSQL_IMAGE", " ")
    monkeypatch.delenv("POSTGRES_IMAGE", raising=False)

    assert database_images.mysql_image() == database_images.MYSQL_IMAGE
    assert database_images.postgres_image() == database_images.POSTGRES_IMAGE
