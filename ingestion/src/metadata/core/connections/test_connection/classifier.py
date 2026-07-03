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
Maps a connector exception to an actionable ``Diagnosis``.

Each connector owns an ``ErrorPack`` of ordered, first-match-wins rules built
with ``when(matcher).diagnose(...)``. Matchers walk the exception's ``__cause__``
/ ``__context__`` chain, so a driver error wrapped by SQLAlchemy still matches.
An unmatched exception yields ``None`` - the raw ``errorLog`` is always retained.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass

from metadata.core.connections.test_connection.records import Diagnosis

Matcher = Callable[[BaseException], bool]


def exception_chain(error: BaseException) -> Iterator[BaseException]:
    """Yield the exception and its ``__cause__``/``__context__`` ancestors once."""
    seen: set[int] = set()
    current: BaseException | None = error
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        yield current
        current = current.__cause__ or current.__context__


class Matchers:
    """Predicates over an exception (and its cause chain)."""

    @staticmethod
    def contains(text: str) -> Matcher:
        needle = text.lower()
        return lambda error: any(needle in str(e).lower() for e in exception_chain(error))

    @staticmethod
    def errno(*codes: int) -> Matcher:
        """Match a driver error number.

        DBAPI drivers (PyMySQL, ...) put the numeric code in ``exception.args[0]``;
        SQLAlchemy preserves the original at ``exception.orig``. We check both,
        across the cause chain. Codes are the stable signal - message text varies.
        """
        wanted = frozenset(codes)

        def match(error: BaseException) -> bool:
            for current in exception_chain(error):
                for candidate in (current, getattr(current, "orig", None)):
                    args = getattr(candidate, "args", ())
                    if args and isinstance(args[0], int) and args[0] in wanted:
                        return True
            return False

        return match

    @staticmethod
    def exception(*types: type[BaseException]) -> Matcher:
        """Match when the error, or anything in its cause chain, is one of ``types``.

        The signal is the exception type, not its message - the right matcher for
        driver-agnostic failures (e.g. Python socket errors) whose text varies by
        platform but whose class does not.
        """
        return lambda error: any(isinstance(current, types) for current in exception_chain(error))


@dataclass(frozen=True)
class Rule:
    """A matcher paired with the diagnosis to return when it matches."""

    matcher: Matcher
    diagnosis: Diagnosis | None = None

    def diagnose(self, title: str, fix: str | None = None, doc: str | None = None) -> Rule:
        return Rule(self.matcher, Diagnosis(title=title, remediation=fix, doc_url=doc))


def when(matcher: Matcher) -> Rule:
    """Start a rule: ``when(matcher).diagnose(title, fix=..., doc=...)``."""
    return Rule(matcher)


class ErrorPack:
    """An ordered set of exception-to-diagnosis rules for one connector."""

    def __init__(self, *rules: Rule) -> None:
        self._rules = rules

    def including(self, other: ErrorPack) -> ErrorPack:
        """Return a new pack with ``other``'s rules appended as a lower-precedence
        fallback layer: this pack's rules still match first, so a connector can
        always override a shared diagnosis (e.g. network) with a sharper one."""
        return ErrorPack(*self._rules, *other._rules)

    def classify(self, error: BaseException) -> Diagnosis | None:
        """Return the first matching diagnosis, or ``None`` if nothing matches."""
        for rule in self._rules:
            if rule.matcher(error):
                return rule.diagnosis
        return None
