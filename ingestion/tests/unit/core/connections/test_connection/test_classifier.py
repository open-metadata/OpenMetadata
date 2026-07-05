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
"""Unit tests for the ErrorPack classifier."""

from metadata.core.connections.test_connection.classifier import (
    ErrorPack,
    Matchers,
    when,
)


def test_first_matching_rule_wins():
    pack = ErrorPack(
        when(Matchers.contains("denied")).diagnose("Access denied", fix="check grants"),
        when(Matchers.contains("denied")).diagnose("second", fix="nope"),
    )
    diagnosis = pack.classify(Exception("SELECT command denied"))
    assert diagnosis.title == "Access denied"
    assert diagnosis.remediation == "check grants"


def test_no_match_returns_none():
    pack = ErrorPack(when(Matchers.contains("nope")).diagnose("X"))
    assert pack.classify(Exception("something else")) is None


def test_contains_unwraps_cause_and_context():
    inner = Exception("FATAL: permission denied for relation x")
    wrapped = RuntimeError("driver wrapper")
    wrapped.__cause__ = inner
    pack = ErrorPack(when(Matchers.contains("permission denied")).diagnose("Denied"))
    assert pack.classify(wrapped).title == "Denied"


def test_diagnose_carries_remediation_and_doc():
    pack = ErrorPack(when(Matchers.contains("x")).diagnose("T", fix="do Y", doc="https://d/x"))
    diagnosis = pack.classify(Exception("x"))
    assert diagnosis.remediation == "do Y"
    assert diagnosis.doc_url == "https://d/x"


def test_empty_pack_matches_nothing():
    assert ErrorPack().classify(Exception("x")) is None


def test_errno_matches_raw_and_sqlalchemy_orig():
    class WrapperError(Exception):
        def __init__(self, orig):
            super().__init__("wrapped")
            self.orig = orig

    raw = Exception()
    raw.args = (1045, "Access denied for user 'x'@'h'")
    pack = ErrorPack(when(Matchers.errno(1045)).diagnose("Auth failed"))
    assert pack.classify(raw).title == "Auth failed"  # raw driver exception
    assert pack.classify(WrapperError(raw)).title == "Auth failed"  # via SQLAlchemy .orig
    assert pack.classify(Exception("no numeric code")) is None


def test_errno_accepts_multiple_codes():
    err = Exception()
    err.args = (1143, "column denied")
    pack = ErrorPack(when(Matchers.errno(1142, 1143)).diagnose("Denied"))
    assert pack.classify(err).title == "Denied"


def test_exception_matches_type_in_cause_chain():
    inner = ConnectionRefusedError(61, "refused")
    wrapped = RuntimeError("driver wrapper")
    wrapped.__cause__ = inner
    pack = ErrorPack(when(Matchers.exception(ConnectionRefusedError)).diagnose("Refused"))
    assert pack.classify(wrapped).title == "Refused"
    assert pack.classify(Exception("no socket error here")) is None


def test_exception_matches_any_of_several_types():
    pack = ErrorPack(when(Matchers.exception(TimeoutError, ConnectionRefusedError)).diagnose("Net"))
    assert pack.classify(TimeoutError("t")).title == "Net"
    assert pack.classify(ConnectionRefusedError()).title == "Net"


def test_including_appends_other_pack_as_fallback():
    specific = ErrorPack(when(Matchers.contains("denied")).diagnose("Specific"))
    fallback = ErrorPack(when(Matchers.contains("boom")).diagnose("Fallback"))
    combined = specific.including(fallback)
    assert combined.classify(Exception("denied")).title == "Specific"
    assert combined.classify(Exception("boom")).title == "Fallback"


def test_including_keeps_this_packs_precedence_on_overlap():
    specific = ErrorPack(when(Matchers.contains("x")).diagnose("Specific"))
    fallback = ErrorPack(when(Matchers.contains("x")).diagnose("Fallback"))
    assert specific.including(fallback).classify(Exception("x")).title == "Specific"


def test_including_returns_a_new_pack_leaving_the_original_unchanged():
    base = ErrorPack(when(Matchers.contains("a")).diagnose("A"))
    other = ErrorPack(when(Matchers.contains("b")).diagnose("B"))
    base.including(other)
    assert base.classify(Exception("b")) is None
