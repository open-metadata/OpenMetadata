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

"""Regression guard against reintroducing direct sample-fetching on validators.

The original NBN bug came from a validator overriding `result_with_failed_samples`
to bypass the consent gate. After the refactor that method is gone — sampling
flows through `FailedRowSampleHandler` only. This test walks every
`BaseTestValidator` subclass and asserts that none defines that name, so the
bug class cannot be reintroduced.

If a future developer adds `result_with_failed_samples` back, this fails
immediately. The right way to add cross-cutting failed-row behavior is a new
gate or a new handler under `metadata.data_quality.runtime`.
"""

from __future__ import annotations

import importlib
import pkgutil

import metadata.data_quality.validations as validations_pkg
from metadata.data_quality.validations.base_test_handler import BaseTestValidator


def _load_all_validator_modules() -> None:
    """Import every submodule under `metadata.data_quality.validations` so
    `BaseTestValidator.__subclasses__()` returns every concrete subclass."""
    for module_info in pkgutil.walk_packages(
        validations_pkg.__path__,
        prefix=f"{validations_pkg.__name__}.",
    ):
        try:
            importlib.import_module(module_info.name)
        except Exception:  # pylint: disable=broad-except
            # Some submodules pull in heavy optional deps; skip on import failure.
            continue


def _all_subclasses(cls: type) -> set[type]:
    found = set()
    for sub in cls.__subclasses__():
        found.add(sub)
        found.update(_all_subclasses(sub))
    return found


def test_no_validator_defines_result_with_failed_samples():
    _load_all_validator_modules()

    offenders = [
        sub.__qualname__ for sub in _all_subclasses(BaseTestValidator) if "result_with_failed_samples" in sub.__dict__
    ]

    assert offenders == [], (
        "`result_with_failed_samples` is forbidden on BaseTestValidator subclasses. "
        "Sample fetching flows through FailedRowSampleHandler; add a gate or a new "
        f"handler under metadata.data_quality.runtime instead. Offenders: {offenders}"
    )
