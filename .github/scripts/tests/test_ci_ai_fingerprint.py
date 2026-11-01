"""Failure identity for the explain step, and the bounded verdict cache."""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))

import merge_gate_evidence  # noqa: E402
from ci_ai import bundle, fingerprint  # noqa: E402

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)


def entry(verdict="main_or_flaky"):
    return {"verdict": verdict, "confidence": "low", "explanation": "flaky", "next_step": "requeue_unchanged", "culprit_files": []}


def test_explain_key_is_order_independent_and_none_without_fingerprints():
    assert fingerprint.explain_key(["b", "a", "a"]) == fingerprint.explain_key(["a", "b"])
    assert fingerprint.explain_key(["a"]) != fingerprint.explain_key(["a", "b"])
    assert fingerprint.explain_key([]) is None and fingerprint.explain_key([""]) is None


def test_fingerprints_prefer_the_gates_and_fall_back_to_the_gates_function():
    evidence = bundle.Evidence()
    evidence.add("org.x.BIT#b", bundle.Failure(message="expected: <1> but was: <2> at 2026-10-13 id 12345"))
    doc = {
        "context": {"fingerprints": {"org.x.CIT#c": "fromcontext"}},
        "decision": {"blocking": [{"test": "org.x.AIT#a", "fingerprint": "fromdecision"}, {"test": "org.x.BIT#b"}, {"test": "org.x.CIT#c"}, {"job": "static / x"}]},
    }

    fingerprints = fingerprint.blocking_fingerprints(doc, evidence)

    assert fingerprints == {
        "org.x.AIT#a": "fromdecision",
        "org.x.BIT#b": merge_gate_evidence.fingerprint("org.x.BIT#b", "expected: <1> but was: <2> at 2026-10-13 id 12345"),
        "org.x.CIT#c": "fromcontext",
    }


def test_cache_is_bounded_and_evicts_the_least_recently_used(tmp_path):
    cache = fingerprint.VerdictCache(tmp_path / "cache.json")
    for n in range(fingerprint.MAX_ENTRIES):
        cache.put(f"k{n}", entry(), pr=n, now=NOW)
    assert cache.get("k0", pr=1, now=NOW) is not None  # k0 becomes the most recent

    cache.put("new", entry(), pr=9, now=NOW)

    assert len(cache.entries) == fingerprint.MAX_ENTRIES
    assert "k0" in cache.entries and "k1" not in cache.entries and "new" in cache.entries


def test_entries_expire_after_the_ttl(tmp_path):
    path = tmp_path / "cache.json"
    cache = fingerprint.VerdictCache(path)
    cache.put("old", entry(), pr=1, now=NOW - timedelta(days=15))
    cache.put("recent", entry(), pr=1, now=NOW - timedelta(days=13))
    cache.save()

    loaded = fingerprint.VerdictCache.load(path, NOW)

    assert list(loaded.entries) == ["recent"]
    assert loaded.get("recent", pr=2, now=NOW + timedelta(days=2)) is None


def test_a_verdict_blaming_a_pr_is_reused_only_for_that_pr(tmp_path):
    cache = fingerprint.VerdictCache(tmp_path / "cache.json")
    cache.put("blames", entry("pr_caused"), pr=1, now=NOW)
    cache.put("flaky", entry("main_or_flaky"), pr=1, now=NOW)

    assert cache.get("blames", pr=1, now=NOW) is not None
    assert cache.get("blames", pr=2, now=NOW) is None
    assert cache.get("flaky", pr=2, now=NOW) is not None


def test_save_and_load_keep_recency_order(tmp_path):
    path = tmp_path / "nested" / "cache.json"
    cache = fingerprint.VerdictCache(path)
    for key in ("a", "b", "c"):
        cache.put(key, entry(), pr=1, now=NOW)
    cache.get("a", pr=1, now=NOW)
    cache.save()

    assert list(fingerprint.VerdictCache.load(path, NOW).entries) == ["b", "c", "a"]


def test_an_unreadable_or_foreign_cache_file_is_an_empty_cache(tmp_path):
    corrupt = tmp_path / "corrupt.json"
    corrupt.write_text("{not json")
    foreign = tmp_path / "foreign.json"
    foreign.write_text(json.dumps({"schemaVersion": 99, "entries": [{"key": "x", **entry(), "storedAt": "2026-10-13T00:00:00Z"}]}))
    invalid = tmp_path / "invalid.json"
    invalid.write_text(json.dumps({"schemaVersion": 1, "entries": [{"key": "x", "verdict": "merge_now", "storedAt": "2026-10-13T00:00:00Z"}]}))

    for path in (corrupt, foreign, invalid, tmp_path / "missing.json"):
        assert not fingerprint.VerdictCache.load(path, NOW).entries
