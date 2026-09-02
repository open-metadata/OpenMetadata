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
"""Unit tests for the shared probe-scope helpers."""

import pytest

from metadata.core.connections.test_connection.checks.scope import (
    DEFAULT_MAX_TARGETS,
    ProbeScope,
    probe_targets,
)
from metadata.generated.schema.type.filterPattern import FilterPattern

NAMES = ["system", "sales", "system_auth", "marketing"]


def test_a_pinned_target_is_the_only_one_probed():
    """A configured pin is the only object ingestion reads, so nothing is listed"""
    assert ProbeScope(pinned="sales").targets(NAMES) == ["sales"]


def test_a_pinned_target_needs_no_listing():
    assert ProbeScope(pinned="sales").targets([]) == ["sales"]


def test_excluded_names_are_dropped():
    scope = ProbeScope(excluded=FilterPattern(excludes=["system.*"]))
    assert scope.targets(NAMES) == ["sales", "marketing"]


def test_only_included_names_survive():
    scope = ProbeScope(excluded=FilterPattern(includes=["sales"]))
    assert scope.targets(NAMES) == ["sales"]


def test_last_resort_names_are_probed_after_the_others():
    """Ingestion reads them too, so they are deferred rather than dropped"""
    scope = ProbeScope(last_resort=frozenset({"system", "system_auth"}))
    assert scope.targets(NAMES) == ["sales", "marketing", "system", "system_auth"]


def test_last_resort_matching_ignores_case():
    scope = ProbeScope(last_resort=frozenset({"SYSTEM"}))
    assert scope.targets(["system", "sales"]) == ["sales", "system"]


def test_targets_are_capped():
    """Each target costs a round-trip, so a wide catalog cannot exhaust the timeout"""
    scope = ProbeScope()
    assert len(scope.targets(f"schema_{index}" for index in range(50))) == DEFAULT_MAX_TARGETS


def test_nothing_in_scope_yields_no_targets():
    scope = ProbeScope(excluded=FilterPattern(excludes=[".*"]))
    assert scope.targets(NAMES) == []


def test_probe_returns_the_first_target_that_answers():
    probed = []

    def probe(target: str) -> None:
        probed.append(target)
        if target != "marketing":
            raise PermissionError(f"not authorized on {target}")

    assert probe_targets(["system", "sales", "marketing"], probe) == "marketing"
    assert probed == ["system", "sales", "marketing"]


def test_probe_stops_at_the_first_success():
    probed = []
    assert probe_targets(["sales", "marketing"], probed.append) == "sales"
    assert probed == ["sales"]


def test_probe_raises_the_last_error_when_every_target_fails():
    def probe(target: str) -> None:
        raise PermissionError(f"not authorized on {target}")

    with pytest.raises(PermissionError, match="marketing"):
        probe_targets(["sales", "marketing"], probe)


def test_probe_of_nothing_is_not_a_failure():
    """A scope that resolves to nothing is a configuration answer, not an error"""
    assert probe_targets([], lambda target: None) is None
