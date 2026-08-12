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
"""
The pandas sample query is operator-supplied config that reaches ``DataFrame.query``. That method
resolves ``@name`` against the calling frame, so ``@__builtins__`` used to be reachable and the
expression could run arbitrary code on the ingestion host. These tests pin the sandbox shut and
pin the legitimate filtering behaviour that must keep working.
"""

import pandas as pd
import pytest

from metadata.sampler.pandas.sampler import apply_sample_query

# Each of these executes on the host if the scopes handed to DataFrame.query are not empty.
# They assert on the exception rather than on a side effect so the test never touches the
# filesystem, spawns a process, or depends on anything outside the interpreter.
ESCAPE_ATTEMPTS = [
    "@__builtins__.__import__('os').system('exit 0')",
    "@__builtins__['__import__']('os').system('exit 0')",
    "@__builtins__.len('ab') > 1",
    "@pd.read_pickle('/dev/null')",
    "@open('/dev/null')",
    "__import__('os').system('exit 0')",
    "eval('1+1')",
    "exec('pass')",
    "a.__class__.__init__.__globals__['__builtins__']['eval']('1')",
]


@pytest.fixture
def frame():
    return pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})


@pytest.mark.parametrize("expression", ESCAPE_ATTEMPTS)
def test_sandbox_escape_attempts_are_rejected(frame, expression):
    with pytest.raises(Exception):  # noqa: B017 — pandas raises a different type per construct
        apply_sample_query(frame, expression)


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("a > 1", [2, 3]),
        ("a >= 2 and b != 'z'", [2]),
        ("b == 'x'", [1]),
        ("a in [1, 3]", [1, 3]),
    ],
)
def test_legitimate_filters_still_apply(frame, expression, expected):
    assert list(apply_sample_query(frame, expression)["a"]) == expected


def test_column_names_resolve_without_the_caller_scope(frame):
    """Emptying the scopes must not break column resolution — those come from the frame itself."""
    assert list(apply_sample_query(frame, "a == 2")["a"]) == [2]


def test_caller_locals_are_not_reachable(frame):
    """A local in this frame must not be visible to the expression, even by its real name."""
    injected_threshold = 2  # noqa: F841 — referenced only by the expression under test

    with pytest.raises(Exception):  # noqa: B017
        apply_sample_query(frame, "a > @injected_threshold")
