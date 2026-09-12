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
Validate filter patterns
"""

import pytest

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.utils.filters import (
    InvalidPatternException,
    _filter,
    _filter_server_compatible,
    filter_by_classifications,
    filter_by_dashboard,
    filter_by_fqn,
    filter_pattern_enabled,
    validate_regex,
)


def test_filter():
    """Validate main filter logic"""
    filter_pattern_both = FilterPattern(includes=["^.*potato.*$"], excludes=["^.*tomato.*$"])
    filter_pattern_inc = FilterPattern(includes=["^.*potato.*$"])
    filter_pattern_exc = FilterPattern(excludes=["^.*tomato.*$"])

    # We don't filter out "potato" since it's in includes
    assert not _filter(filter_pattern_both, "potato")
    # We do filter out "tomato" since it's in excludes
    assert _filter(filter_pattern_both, "tomato")

    assert not _filter(filter_pattern_inc, "potato_tomato")
    assert _filter(filter_pattern_exc, "potato_tomato")

    # If we have both includes and excludes, we will check both "include" and "exclude"
    # This was not filter if we only check includes, but is filtered if we check both
    assert _filter(filter_pattern_both, "potato_tomato")


def test_filter_server_compatible_no_pattern_keeps_everything():
    """With no FilterPattern, nothing is filtered out."""
    assert _filter_server_compatible(None, "anything") is False
    assert _filter_server_compatible(FilterPattern(), "anything") is False


def test_filter_server_compatible_pattern_without_name_drops():
    """A present FilterPattern combined with a missing name filters the row,
    mirroring ``_filter``'s null-name rule."""
    assert _filter_server_compatible(FilterPattern(excludes=["x"]), None) is True
    assert _filter_server_compatible(FilterPattern(excludes=["x"]), "") is True


def test_filter_server_compatible_substring_exclude_matches_unanchored():
    """Server-side POSIX ``!~`` / ``NOT REGEXP`` is *unanchored*, so a
    substring exclude must drop names containing the pattern anywhere —
    not only names that start with it. This is the core of the bug fix:
    ``_filter`` keeps ``revenue_summary`` because ``re.match`` is
    start-anchored; ``_filter_server_compatible`` mirrors the server's
    unanchored semantics and drops it."""
    substring_excludes = FilterPattern(excludes=["summary"])
    assert _filter_server_compatible(substring_excludes, "revenue_summary") is True
    assert _filter_server_compatible(substring_excludes, "summary") is True
    assert _filter_server_compatible(substring_excludes, "summary_data") is True
    assert _filter_server_compatible(substring_excludes, "data_summary") is True
    assert _filter_server_compatible(substring_excludes, "data_summary_v2") is True
    assert _filter_server_compatible(substring_excludes, "orders") is False


def test_filter_server_compatible_vs_filter_anchoring_divergence():
    """Demonstrate the exact anchoring divergence the bug fix closes: for a
    substring-shaped exclude, ``_filter`` (``re.match`` + ``re.IGNORECASE``,
    start-anchored) keeps the table while ``_filter_server_compatible``
    (``re.search``, unanchored) drops it. After the fix, the deferred
    exclude path uses the server-compatible matcher so both paths agree."""
    substring_excludes = FilterPattern(excludes=["summary"])

    # _filter remains start-anchored (preserved client-side filter contract).
    assert _filter(substring_excludes, "revenue_summary") is False
    # _filter_server_compatible is unanchored — matches the server.
    assert _filter_server_compatible(substring_excludes, "revenue_summary") is True


def test_filter_server_compatible_case_sensitive_postgres_aligned():
    """PostgreSQL ``~`` / ``!~`` is case-sensitive, so the server-compatible
    helper omits ``re.IGNORECASE`` to align with that default. A
    case-mismatched exclude therefore matches the PostgreSQL server: an
    exclude of ``Summary`` (capital) keeps ``summary_table`` (lowercase).

    The legacy client-side ``_filter`` is case-insensitive (``re.IGNORECASE``)
    AND start-anchored (``re.match``), so for a name whose prefix matches the
    pattern case-insensitively it drops the row — the case-sensitivity axis of
    the original divergence. The default ``_filter`` behavior is preserved for
    every other client-side filter (e.g. ``filter_by_topic``) by NOT modifying
    it; only the deferred-exclude path uses the server-compatible helper.

    MySQL ``NOT REGEXP`` is case-insensitive by default, so full backend-aware
    parity on MySQL requires detecting the server's datasource (follow-up)."""
    pattern_capital = FilterPattern(excludes=["Summary"])

    # Server-compatible (case-sensitive): no match -> keeps lowercase name.
    assert _filter_server_compatible(pattern_capital, "summary_table") is False
    # Server-compatible (case-sensitive): match -> drops capital name.
    assert _filter_server_compatible(pattern_capital, "Summary_table") is True

    # Legacy _filter (case-insensitive + anchored) drops the lowercase name:
    # the case axis of the original divergence that the fix removes for the
    # deferred exclude path.
    assert _filter(pattern_capital, "summary_table") is True


def test_filter_server_compatible_unanchored_includes():
    """The helper mirrors ``_filter``'s include semantics but unanchored: a
    name is kept only if some include pattern matches anywhere in it."""
    includes_only = FilterPattern(includes=["finance"])
    assert _filter_server_compatible(includes_only, "finance") is False
    assert _filter_server_compatible(includes_only, "retail_finance") is False
    assert _filter_server_compatible(includes_only, "sales") is True


def test_filter_server_compatible_exclude_takes_precedence_over_include():
    """Mirror ``_filter``: when both includes and excludes are set and a name
    matches the exclude, it is filtered out (exclude wins). A name matching
    the include but not the exclude is kept."""
    both = FilterPattern(includes=["finance"], excludes=["temp"])
    assert _filter_server_compatible(both, "finance_temp") is True  # exclude wins
    assert _filter_server_compatible(both, "finance_ledger") is False  # kept by include
    assert _filter_server_compatible(both, "retail_ledger") is True  # no include match


def test_filter_server_compatible_multiple_excludes_or_semantics():
    """Multiple exclude patterns combine with OR; any one match drops the
    name. This mirrors ``_filter`` and the server's ``(a)|(b)`` combination
    built in ``_build_regex_from_filter`` / ``_combine_patterns``."""
    multi = FilterPattern(excludes=["summary", "^temp_"])
    assert _filter_server_compatible(multi, "revenue_summary") is True
    assert _filter_server_compatible(multi, "temp_orders") is True
    assert _filter_server_compatible(multi, "orders") is False


def test_filter_server_compatible_anchored_patterns_still_match():
    """Patterns that explicitly use ``^`` / ``$`` anchors behave identically
    under ``re.search`` and ``re.match`` for anchored prefixes, so existing
    configurations that rely on anchoring continue to work."""
    anchored = FilterPattern(excludes=["^temp_.*$"])
    assert _filter_server_compatible(anchored, "temp_orders") is True
    assert _filter_server_compatible(anchored, "data_temp") is False


def test_filter_server_compatible_invalid_regex_raises():
    """An invalid exclude regex raises ``InvalidPatternException``, mirroring
    ``_filter``'s pre-match validation."""
    with pytest.raises(InvalidPatternException):
        _filter_server_compatible(FilterPattern(excludes=["["]), "anything")


def test_filter_pattern_enabled():
    """A pattern is enabled only when includes or excludes are configured"""
    assert filter_pattern_enabled(None) is False
    assert filter_pattern_enabled(FilterPattern()) is False
    assert filter_pattern_enabled(FilterPattern(includes=[])) is False
    assert filter_pattern_enabled(FilterPattern(excludes=[])) is False
    assert filter_pattern_enabled(FilterPattern(includes=["^keep$"])) is True
    assert filter_pattern_enabled(FilterPattern(excludes=["^skip$"])) is True


def test_filter_by_classifications():
    """An entity is matched against the full set of its tags: a single matching
    include tag keeps it, a single matching exclude tag drops it, and exclude
    takes precedence over include."""
    include_tier = FilterPattern(includes=["Tier.*"])
    exclude_pii = FilterPattern(excludes=["PII.*"])
    both = FilterPattern(includes=["Tier.*"], excludes=["PII.*"])

    # One matching include tag is enough to keep, despite other non-matching tags
    assert not filter_by_classifications(include_tier, ["Tier1", "Finance", "PII"])
    # No tag matches the include -> filtered out
    assert filter_by_classifications(include_tier, ["Finance", "PII"])

    # A matching exclude tag drops the entity; no excluded tag keeps it
    assert filter_by_classifications(exclude_pii, ["PII", "Finance"])
    assert not filter_by_classifications(exclude_pii, ["Tier1", "Finance"])

    # Exclude takes precedence: matches both include and exclude -> filtered out
    assert filter_by_classifications(both, ["Tier1", "PII"])

    # No pattern, or no tags with only excludes -> kept
    assert not filter_by_classifications(None, ["PII"])
    assert not filter_by_classifications(exclude_pii, [])
    # No tags but includes set -> filtered out
    assert filter_by_classifications(include_tier, [])


def test_validate_regex():
    """Validate regex"""
    with pytest.raises(InvalidPatternException):
        validate_regex(["[", ".*"])

    # empty validation is OK
    validate_regex([])
    validate_regex(None)


def test_filter_by_fqn():
    """Check FQN filters"""
    fqn_filter_db = FilterPattern(includes=["^.*my_database.*$"])

    assert not filter_by_fqn(fqn_filter_db, "service.my_database.schema.table")
    assert filter_by_fqn(fqn_filter_db, "service.another_db.schema.table")

    fqn_filter_schema = FilterPattern(includes=["^.*my_db.my_schema.*$"])

    assert not filter_by_fqn(fqn_filter_schema, "service.my_db.my_schema.table")
    assert filter_by_fqn(fqn_filter_schema, "service.another_db.my_schema.table")


def test_filter_numbers():
    """Check numeric filtering"""

    num_filter = FilterPattern(includes=["^[4]"])

    assert not filter_by_dashboard(num_filter, "40")
    assert not filter_by_dashboard(num_filter, "41")

    assert filter_by_dashboard(num_filter, "50")
    assert filter_by_dashboard(num_filter, "54")
