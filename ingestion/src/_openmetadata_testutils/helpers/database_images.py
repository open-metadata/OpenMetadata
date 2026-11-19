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
"""The MySQL and Postgres images test containers run: the base images of the database
Dockerfiles OpenMetadata ships. MYSQL_IMAGE and POSTGRES_IMAGE replace them for a one-off run.

ADR:2026-11-19-test-database-images-come-from-the-shipped-image
"""

import os
from pathlib import Path

from testcontainers.mysql import MySqlContainer  # noqa: TID251
from testcontainers.postgres import PostgresContainer  # noqa: TID251

__all__ = ["MySqlContainer", "PostgresContainer", "base_image", "mysql_image", "postgres_image"]

MYSQL_DOCKERFILE = "docker/mysql/Dockerfile_mysql"
POSTGRES_DOCKERFILE = "docker/postgresql/Dockerfile_postgres"


def mysql_image() -> str:
    return _resolve("MYSQL_IMAGE", MYSQL_DOCKERFILE)


def postgres_image() -> str:
    return _resolve("POSTGRES_IMAGE", POSTGRES_DOCKERFILE)


def base_image(dockerfile: str, source: str) -> str:
    """The image of the Dockerfile's only FROM line, without a --platform flag or stage name."""
    from_lines = [line.strip() for line in dockerfile.splitlines() if line.strip().upper().startswith("FROM ")]
    if len(from_lines) != 1:
        raise ValueError(
            f"{source} must have exactly one FROM line to name a test database image, found {len(from_lines)}"
        )
    image = next((token for token in from_lines[0].split()[1:] if not token.startswith("--")), None)
    if image is None:
        raise ValueError(f"{source} has a FROM line with no image")
    return image


def _resolve(override_variable: str, dockerfile: str) -> str:
    override = os.environ.get(override_variable, "").strip()
    if override:
        return override
    path = _repository_root() / dockerfile
    return base_image(path.read_text(encoding="utf-8"), str(path))


def _repository_root() -> Path:
    here = Path(__file__).resolve()
    root = next((parent for parent in here.parents if (parent / MYSQL_DOCKERFILE).is_file()), None)
    if root is None:
        raise FileNotFoundError(
            f"No OpenMetadata checkout above {here} holds {MYSQL_DOCKERFILE}; "
            "run from a source checkout or set MYSQL_IMAGE and POSTGRES_IMAGE"
        )
    return root
