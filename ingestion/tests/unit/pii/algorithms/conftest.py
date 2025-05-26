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
import logging
from typing import Callable

import pytest
from faker import Faker

from metadata.pii.algorithms.presidio_utils import (
    build_analyzer_engine,
    set_presidio_logger_level,
)


@pytest.fixture(scope="module")
def analyzer():
    # You might want to comment the following line when debugging tests
    set_presidio_logger_level()
    analyzer = build_analyzer_engine()
    return analyzer


@pytest.fixture
def fake() -> Faker:
    """Return a Faker instance"""
    fake = Faker()
    fake.seed_instance(1234)
    return fake


def build_fake_locale(locale: str) -> Faker:
    """Return a Faker instance with a specific locale"""
    fake = Faker(locale)
    fake.seed_instance(1234)
    return fake


@pytest.fixture
def fake_en_us() -> Faker:
    """Return a Faker instance with en_US locale"""
    return build_fake_locale("en_US")


@pytest.fixture
def local_fake_factory() -> Callable[[str], Faker]:
    """Return a local fake factory"""

    def fake_factory(locale: str) -> Faker:
        fake = Faker(locale)
        fake.seed_instance(1234)
        return fake

    return fake_factory


@pytest.fixture
def pii_test_logger():
    logger = logging.getLogger("pii_test_logger")
    logger.setLevel(logging.INFO)
    return logger
