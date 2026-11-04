"""Failure identity for the explain step, and the bounded cache of what was explained.

Fingerprints are the gate's own: merge_gate_evidence.fingerprint, the test id plus its
normalized first error line, so the registry, the verify ledger and this cache agree on
what "the same failure" is. An ejection's key is the set of its blocking fingerprints.

The verdict cache lets a re-queued PR that fails the same way reuse its explanation
instead of paying for another call. It is an LRU of MAX_ENTRIES with a TTL, stored as
JSON (the workflow keeps it in the Actions cache). A verdict that blames a specific PR
is only reused for that PR: the same flaky test failing on another PR deserves a fresh
look at that PR's diff.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import OrderedDict
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from pathlib import Path

import merge_gate_evidence
from ci_ai import bundle as bundle_mod

MAX_ENTRIES = 500
TTL = timedelta(days=14)
SCHEMA_VERSION = 1
MAX_CACHE_BYTES = 8 * 1024 * 1024
PR_SPECIFIC_VERDICTS = frozenset({"pr_caused", "entry_ahead"})
VERDICTS = frozenset({"pr_caused", "entry_ahead", "main_or_flaky", "infra", "unknown"})


def blocking_fingerprints(decision_doc: dict, evidence: bundle_mod.Evidence) -> dict[str, str]:
    """Fingerprint of every blocking test: the gate's when it recorded one, else the
    same function over the message the evidence holds."""
    known = bundle_mod.as_dict(bundle_mod.as_dict(decision_doc.get("context")).get("fingerprints"))
    fingerprints: dict[str, str] = {}
    for item in bundle_mod.blocking_items(decision_doc):
        test_id = bundle_mod.clean_id(item["test"])
        value = item.get("fingerprint") or known.get(str(item["test"])) or known.get(test_id)
        value = value or (evidence.verify.get(test_id) or {}).get("fingerprint")
        fingerprints[test_id] = str(value or merge_gate_evidence.fingerprint(test_id, evidence.find(test_id).message))
    return fingerprints


def explain_key(fingerprints: Iterable[str]) -> str | None:
    values = sorted({value for value in fingerprints if value})
    if not values:
        return None
    return hashlib.sha256("|".join(values).encode()).hexdigest()[:16]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: object) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def valid_entry(item: object) -> bool:
    if not isinstance(item, dict) or not isinstance(item.get("key"), str):
        return False
    culprits = item.get("culprit_files")
    return (
        item.get("verdict") in VERDICTS
        and isinstance(item.get("explanation"), str)
        and isinstance(culprits, list)
        and all(isinstance(c, dict) and isinstance(c.get("path"), str) and isinstance(c.get("why"), str) for c in culprits)
        and parse_iso(item.get("storedAt")) is not None
    )


class VerdictCache:
    """LRU by use, expiry by age. Reads refresh recency; writes evict the least recent."""

    def __init__(self, path: Path | None, entries: OrderedDict[str, dict] | None = None):
        self.path = path
        self.entries: OrderedDict[str, dict] = entries if entries is not None else OrderedDict()

    @classmethod
    def load(cls, path: Path | None, now: datetime) -> "VerdictCache":
        """A missing, oversized or unreadable file is an empty cache, never an error."""
        entries: OrderedDict[str, dict] = OrderedDict()
        document = None
        if path is not None:
            raw = bundle_mod.read_capped(path, MAX_CACHE_BYTES)
            try:
                document = json.loads(raw) if raw else None
            except (UnicodeDecodeError, json.JSONDecodeError):
                document = None
        if isinstance(document, dict) and document.get("schemaVersion") == SCHEMA_VERSION:
            for item in bundle_mod.as_list(document.get("entries")):
                if valid_entry(item) and not cls.expired(item, now):
                    entries[item["key"]] = item
                    entries.move_to_end(item["key"])
        cache = cls(path, entries)
        cache.evict()
        return cache

    @staticmethod
    def expired(item: dict, now: datetime) -> bool:
        stored = parse_iso(item.get("storedAt"))
        return stored is None or now - stored > TTL

    def get(self, key: str, pr: int, now: datetime) -> dict | None:
        item = self.entries.get(key)
        if item is None:
            return None
        if self.expired(item, now):
            del self.entries[key]
            return None
        if item["verdict"] in PR_SPECIFIC_VERDICTS and item.get("pr") != pr:
            return None
        item["usedAt"] = iso(now)
        self.entries.move_to_end(key)
        return item

    def put(self, key: str, value: dict, pr: int, now: datetime) -> None:
        self.entries[key] = {**value, "key": key, "pr": pr, "storedAt": iso(now), "usedAt": iso(now)}
        self.entries.move_to_end(key)
        self.evict()

    def evict(self) -> None:
        while len(self.entries) > MAX_ENTRIES:
            self.entries.popitem(last=False)

    def save(self) -> None:
        if self.path is None:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_name(self.path.name + ".tmp")
        temporary.write_text(json.dumps({"schemaVersion": SCHEMA_VERSION, "entries": list(self.entries.values())}, indent=1, sort_keys=True))
        os.replace(temporary, self.path)
