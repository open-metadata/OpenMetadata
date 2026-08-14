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
"""Unit tests for the @check decorator and collect_checks."""

from enum import Enum

import pytest

from metadata.core.connections.test_connection.check import (
    DuplicateCheckError,
    check,
    collect_checks,
)


class _Step(str, Enum):
    CheckAccess = "CheckAccess"
    GetTables = "GetTables"


class _Provider:
    errors = None

    @check(_Step.CheckAccess)
    def check_access(self):
        return "ok"

    @check(_Step.GetTables)
    def get_tables(self):
        return "tables"

    def helper(self):
        return "not a check"


def test_decorator_keeps_the_method_callable():
    assert _Provider().check_access() == "ok"


def test_collect_returns_only_decorated_methods_keyed_by_step():
    collected = collect_checks(_Provider())
    assert set(collected) == {_Step.CheckAccess, _Step.GetTables}


def test_collected_values_are_bound_and_runnable():
    collected = collect_checks(_Provider())
    assert collected[_Step.CheckAccess]() == "ok"
    assert collected[_Step.GetTables]() == "tables"


def test_provider_with_no_checks_collects_nothing():
    class _Empty:
        errors = None

        def not_a_check(self):
            return None

    assert collect_checks(_Empty()) == {}


def test_duplicate_step_name_raises():
    class _Conflicting:
        errors = None

        @check(_Step.GetTables)
        def get_tables(self):
            return "a"

        @check(_Step.GetTables)
        def also_tables(self):
            return "b"

    with pytest.raises(DuplicateCheckError, match="GetTables"):
        collect_checks(_Conflicting())


def test_subclass_override_of_same_step_is_not_a_duplicate():
    class _Base:
        errors = None

        @check(_Step.GetTables)
        def get_tables(self):
            return "base"

    class _Sub(_Base):
        @check(_Step.GetTables)
        def get_tables(self):  # same attr name → an override, not a conflict
            return "sub"

    collected = collect_checks(_Sub())
    assert collected[_Step.GetTables]() == "sub"
