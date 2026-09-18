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
"""Unit tests for the shared probe loop."""

import pytest

from metadata.core.connections.test_connection.checks.probe import probe_targets


def test_the_first_accepted_target_is_returned_with_its_result():
    assert probe_targets(["sales", "marketing"], lambda target: f"{target}!") == ("sales", "sales!")


def test_a_target_that_refuses_is_followed_by_the_next():
    probed = []

    def probe(target: str) -> str | None:
        probed.append(target)
        if target != "marketing":
            raise PermissionError(f"not authorized on {target}")
        return target

    assert probe_targets(["system", "sales", "marketing"], probe) == ("marketing", "marketing")
    assert probed == ["system", "sales", "marketing"]


def test_returning_none_keeps_looking():
    """Proving there is data to read needs a non-empty result, not just a call
    that did not raise"""
    rows = {"empty": [], "sales": ["orders"]}
    probed = []

    def probe(target: str) -> list[str] | None:
        probed.append(target)
        return rows[target] or None

    assert probe_targets(["empty", "sales"], probe) == ("sales", ["orders"])
    assert probed == ["empty", "sales"]


def test_the_last_error_is_raised_when_no_target_answers():
    def probe(target: str) -> None:
        raise PermissionError(f"not authorized on {target}")

    with pytest.raises(PermissionError, match="marketing"):
        probe_targets(["sales", "marketing"], probe)


def test_an_empty_answer_is_not_a_failure_even_alongside_a_refusal():
    """One target answering empty means the login can read: the outcome is
    "nothing accepted", which the caller reports, not an error"""

    def probe(target: str) -> None:
        if target == "system":
            raise PermissionError("not authorized on system")
        return

    assert probe_targets(["system", "sales"], probe) is None


def test_probing_nothing_is_not_a_failure():
    assert probe_targets([], lambda target: target) is None
