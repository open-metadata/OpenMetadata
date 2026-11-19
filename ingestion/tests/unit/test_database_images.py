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
"""Test database images come from the shipped database Dockerfiles."""

import pytest

from _openmetadata_testutils.helpers import database_images


def test_images_come_from_the_shipped_dockerfiles(monkeypatch):
    monkeypatch.delenv("MYSQL_IMAGE", raising=False)
    monkeypatch.delenv("POSTGRES_IMAGE", raising=False)
    root = database_images._repository_root()

    assert database_images.mysql_image() == database_images.base_image(
        (root / database_images.MYSQL_DOCKERFILE).read_text(), "mysql"
    )
    assert database_images.mysql_image().startswith("mysql:")
    assert database_images.postgres_image() == database_images.base_image(
        (root / database_images.POSTGRES_DOCKERFILE).read_text(), "postgres"
    )
    assert database_images.postgres_image().startswith("postgres:")


def test_environment_overrides_the_shipped_image(monkeypatch):
    monkeypatch.setenv("MYSQL_IMAGE", " example/db:9 ")
    monkeypatch.setenv("POSTGRES_IMAGE", "example/db:8")

    assert database_images.mysql_image() == "example/db:9"
    assert database_images.postgres_image() == "example/db:8"


def test_blank_override_falls_back_to_the_shipped_image(monkeypatch):
    monkeypatch.setenv("MYSQL_IMAGE", " ")

    assert database_images.mysql_image().startswith("mysql:")


def test_base_image_drops_platform_flag_and_stage_name():
    dockerfile = "# comment\nfrom --platform=linux/amd64 example/db:1.2.3 AS db\nRUN true\n"

    assert database_images.base_image(dockerfile, "probe") == "example/db:1.2.3"


@pytest.mark.parametrize(
    ("dockerfile", "found"),
    [("WORKDIR /x\n", 0), ("FROM example/db:1 AS a\nFROM example/db:2\n", 2)],
)
def test_base_image_needs_exactly_one_from_line(dockerfile, found):
    with pytest.raises(ValueError, match=f"Dockerfile_probe must have exactly one FROM line.*found {found}"):
        database_images.base_image(dockerfile, "Dockerfile_probe")
