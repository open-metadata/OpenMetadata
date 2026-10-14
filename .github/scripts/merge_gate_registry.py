#!/usr/bin/env python3
"""The merge gate's memory: a flake registry for people and a verify ledger for machines.

The gate forgives a failing test only when the same run proves the failure is not the
entry's. Each forgiveness leaves a test that still needs fixing, and each verify leaves
a parent-control result another entry on the same parent could reuse. This module
keeps both:

  * **Registry**: one GitHub issue per failing test and failure fingerprint, labelled
    `flaky-test`, or `broken-main` when the failure also reproduced on main's tip.
    People triage and fix from it, and the fix PR closes it. The body is a short
    summary plus a fenced JSON block the gate rewrites on every occurrence; a hidden
    `<!-- merge-gate-fingerprint: … -->` marker is how the gate finds the issue again.
    A fingerprint that recurs after its issue was closed as fixed reopens it.
  * **Ledger**: `ledger.jsonl` on the data-only `ci/merge-gate` branch, one line per
    verified test with its parent-control result and the entry's PR set. Verify reads
    it to skip a parent control already run on the same parent commit, and the gate
    reads it for independent history, the ambiguous case's tie-breaker. The controller
    is the only writer; the Contents API's blob sha turns a concurrent write into a
    409, and the append is redone from a fresh read.

Neither store decides a merge: the ledger only saves re-running a control, and history
only breaks the one-in-three tie (see merge_gate_policy).

Test names and error lines come from the run under test and are untrusted. They are
cleaned once on the way in (control characters dropped, `mq.sanitize_external`,
capped) and rendered only inside code spans or the JSON fence, where GitHub resolves
no mention, link or reference. Playwright titles carry tags such as
`@domain-isolation`, which would otherwise ping whoever owns that login. Owners come
from CODEOWNERS on main.

Everything is bounded: an issue keeps its last 20 occurrences and 50 PRs, and the
ledger keeps 30 days, at most 5,000 records and 2 MB, oldest out first.

  record   after a decision: append the run's verified tests to the ledger and, for a
           PASS, create, update or reopen one issue per forgiven test

MERGE_GATE_REGISTRY (set from vars.CI_REGISTRY_MODE) = off | dry-run | on, default
dry-run. A dry run reads everything and prints the writes it would make.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

import merge_gate_evidence as evidence_mod
import merge_gate_policy as gate
import merge_queue_metrics as mq

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parents[1]
CODEOWNERS_PATH = REPO / ".github" / "CODEOWNERS"

MODE_ENV = "MERGE_GATE_REGISTRY"
MODES = ("off", "dry-run", "on")
GATE_MODES = ("shadow", "enforce", "strict")
SUITES = ("java-it", "playwright", "python")

FLAKY = "flaky-test"
BROKEN_MAIN = "broken-main"
LABELS = (FLAKY, BROKEN_MAIN)
TITLE_PREFIX = {FLAKY: "Flaky: ", BROKEN_MAIN: "Broken on main: "}
MARKER = "<!-- merge-gate-fingerprint: {} -->"
MARKER_RE = re.compile(r"<!-- merge-gate-fingerprint: ([0-9a-f]{8,64}) -->")
STATS_RE = re.compile(r"```json\n(.*?)\n```", re.DOTALL)
FINGERPRINT_RE = re.compile(r"[0-9a-f]{8,64}")
SHA_RE = re.compile(r"[0-9a-f]{40}")
CLASS_RE = re.compile(r"[a-z][a-z-]{0,39}")
OWNER_RE = re.compile(r"@[A-Za-z0-9][A-Za-z0-9-]*(?:/[A-Za-z0-9][A-Za-z0-9._-]*)?")
REPOSITORY_RE = re.compile(r"[A-Za-z0-9-]+/[A-Za-z0-9._-]+")
COUNTS_RE = re.compile(r"(\d+)/(\d+) failed")
VERIFY_ARTIFACT_RE = re.compile(r"verify-(java-it|playwright|python)\b")

STATS_SCHEMA = 1
MAX_OCCURRENCES = 20
MAX_PRS_LET_THROUGH = 50
# A PR set is never truncated: a dropped PR could make two entries look disjoint.
MAX_ENTRY_PRS = 100
MAX_CLASSES = 10
MAX_OWNERS = 10
MAX_TEST_ID_CHARS = 300
MAX_ERROR_CHARS = 300
MAX_PATH_CHARS = 300
MAX_TITLE_CHARS = 200  # GitHub rejects titles over 256
MAX_BODY_CHARS = 60_000  # and bodies over 65,536
ISSUE_LIST_PAGES = 5
SEARCH_RESULTS = 20
MAX_VERIFY_DOCUMENTS = 50
MAX_VERIFY_BYTES = 8 * 1024 * 1024
MAX_FLAKY_PER_OUTCOME = 20

LEDGER_BRANCH = "ci/merge-gate"
LEDGER_PATH = "ledger.jsonl"
LEDGER_MAX_AGE = timedelta(days=30)
LEDGER_MAX_RECORDS = 5_000
LEDGER_MAX_BYTES = 2 * 1024 * 1024
LEDGER_MAX_READ_BYTES = 16 * 1024 * 1024
LEDGER_CONFLICT_RETRIES = 3
DEFAULT_PARENT_RUNS = 3

# An `introduced` failure is the regression of the entry it was seen in, not the
# test's history; counting it would let one PR's breakage excuse another's.
HISTORY_CLASSES = frozenset({gate.FLAKY, gate.PRE_EXISTING, gate.AMBIGUOUS})

UI_ROOT = "openmetadata-ui/src/main/resources/ui"
E2E_ROOT = f"{UI_ROOT}/playwright/e2e"
IT_ROOT = "openmetadata-integration-tests/src/test/java"
INGESTION_ROOT = "ingestion"
JAVA_CLASS_RE = re.compile(r"[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*")
PY_NAME_RE = re.compile(r"[A-Za-z_]\w*")
# No segment may start with a dot, so `.` and `..` cannot walk out of the e2e tree.
SPEC_PATH_RE = re.compile(r"[\w@+-][\w@+.-]*(?:/[\w@+-][\w@+.-]*)*")
PARAMS = re.compile(r"(\(.*\)|\[.*\])$")


# ----------------------------------------------------------------------- text


_UNSAFE_CATEGORIES = frozenset({"Cc", "Cf", "Zl", "Zp"})


def _strip_controls(text: str) -> str:
    """Newlines would end a code span, and format characters (bidi overrides, zero
    widths) let a name disguise itself; both become plain spaces."""
    kept = "".join(" " if unicodedata.category(ch) in _UNSAFE_CATEGORIES else ch for ch in text)
    return " ".join(kept.split())


def _cap(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    # Cut before a half-written entity rather than leave `&am…` behind.
    return re.sub(r"&[a-z]{0,3}$", "", text[: limit - 1]) + "…"


def clean_text(value: Any, limit: int) -> str:
    """Untrusted text made safe once, on the way in: no markup, no controls, capped."""
    return _cap(mq.sanitize_external(_strip_controls(str(value or ""))), limit)


def _guard(value: Any, limit: int) -> str:
    """The same guarantees for text read back from an issue or the ledger, which a
    maintainer can edit. Idempotent on clean text, where sanitize_external would
    escape every `&amp;` once more on each update."""
    if not isinstance(value, str):
        return ""
    text = _strip_controls(value).replace("`", "'").replace("<", "&lt;").replace(">", "&gt;")
    return _cap(text, limit)


def _code(text: str) -> str:
    return f"`{text.replace('`', chr(39))}`" if text else "none"


def _inert_title(text: str) -> str:
    """Titles have no code span to hide in. Fullwidth `@` and `#` read the same but
    neither ping anyone nor link an issue; `#` stays as is before a letter, so a Java
    `Class#method` id is still searchable."""
    return re.sub(r"#(?=\d)", "\uff03", text.replace("@", "\uff20"))


# ----------------------------------------------------------------- validation


def valid_fingerprint(value: Any) -> str:
    """Fingerprints land in the hidden marker and a search query, so only the hex
    merge_gate_evidence.fingerprint produces is accepted."""
    text = str(value or "").strip()
    return text if FINGERPRINT_RE.fullmatch(text) else ""


def _sha(value: Any) -> str | None:
    text = str(value or "").strip().lower()
    return text if SHA_RE.fullmatch(text) else None


def _number(value: Any) -> int | None:
    """A positive id (run, attempt, PR), as an int or a digit string."""
    if isinstance(value, bool):
        return None
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value.strip())
    return value if isinstance(value, int) and value > 0 else None


def _count(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value


def _counts(value: Any) -> dict | None:
    if not isinstance(value, dict):
        return None
    failed, runs = _count(value.get("failed")), _count(value.get("runs"))
    if failed is None or runs is None or failed > runs:
        return None
    return {"failed": failed, "runs": runs}


def _parse_counts(value: Any) -> dict | None:
    """The decision's `"1/3 failed"` form."""
    match = COUNTS_RE.fullmatch(str(value or ""))
    return _counts({"failed": int(match[1]), "runs": int(match[2])}) if match else None


def _prs(value: Any) -> list[int] | None:
    """A PR set, or None when it is not a clean list of PR numbers: an unknown set is
    never treated as an empty one, which would read as main."""
    if not isinstance(value, (list, tuple, set, frozenset)):
        return None
    prs = [_number(item) for item in value]
    if None in prs or len(prs) > MAX_ENTRY_PRS:
        return None
    return sorted(set(prs))


def _when(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        moment = mq.parse_ts(value)
    except ValueError:
        return None
    return moment if moment.tzinfo else None


def _iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _human(timestamp: str) -> str:
    return f"{timestamp[:10]} {timestamp[11:16]} UTC"


def _class(value: Any) -> str:
    text = str(value or "")
    return text if CLASS_RE.fullmatch(text) else "unknown"


def infer_suite(test_id: str) -> str:
    if " :: " in test_id:
        return "playwright"
    if test_id.startswith("tests."):
        return "python"
    return "java-it"


# ----------------------------------------------------------------- CODEOWNERS


@dataclass(frozen=True)
class OwnerRule:
    pattern: str
    regex: re.Pattern
    owners: tuple[str, ...]


def _segment(segment: str) -> str:
    out, escaped = [], False
    for ch in segment:
        if escaped:
            out.append(re.escape(ch))
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == "*":
            out.append("[^/]*")
        elif ch == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(ch))
    return "".join(out)


def codeowners_regex(pattern: str) -> re.Pattern | None:
    """CODEOWNERS matching as GitHub documents it, which is not quite gitignore: a
    leading or inner slash anchors at the root, a lone segment matches at any depth, a
    trailing slash or a final named segment covers everything below it, and a final
    bare `*` covers direct children only (`docs/*` owns docs/a.md, not docs/b/c.md)."""
    if not pattern or pattern == "/" or "***" in pattern:
        return None
    segments = pattern.split("/")
    if segments[0] == "":
        segments = segments[1:]
    elif (len(segments) == 1 or (len(segments) == 2 and segments[1] == "")) and segments[0] != "**":
        segments = ["**", *segments]
    if len(segments) > 1 and segments[-1] == "":
        segments[-1] = "**"
    last = len(segments) - 1
    out, need_slash = [], False
    for index, segment in enumerate(segments):
        if segment == "**":
            if index == 0:
                out.append(".+" if index == last else "(?:.+/)?")
                need_slash = False
            elif index == last:
                out.append("/.*")
            else:
                out.append("(?:/.+)?")
                need_slash = True
            continue
        out.append("/" if need_slash else "")
        if segment == "*":
            out.append("[^/]+")
        else:
            out.append(_segment(segment))
            if index == last:
                out.append("(?:/.*)?")
        need_slash = True
    return re.compile("".join(out))


def parse_codeowners(text: str) -> list[OwnerRule]:
    rules = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        pattern, *tokens = line.split()
        owners = []
        for token in tokens:
            if token.startswith("#"):
                break
            # Email owners are valid CODEOWNERS but cannot be shown as a team.
            if OWNER_RE.fullmatch(token):
                owners.append(token)
        regex = codeowners_regex(pattern)
        if regex is not None:
            rules.append(OwnerRule(pattern, regex, tuple(owners)))
    return rules


def load_codeowners(path: Path = CODEOWNERS_PATH) -> list[OwnerRule]:
    try:
        return parse_codeowners(path.read_text(encoding="utf-8"))
    except OSError:
        return []


def owners_for(path: str, rules: Iterable[OwnerRule]) -> tuple[str, ...]:
    """The last matching rule wins, as on GitHub, and a rule without owners unowns."""
    owners: tuple[str, ...] = ()
    for rule in rules:
        if rule.regex.fullmatch(path):
            owners = rule.owners
    return owners


def _python_module(dotted: str, root: Path) -> str:
    parts = dotted.split(".")
    if not all(PY_NAME_RE.fullmatch(part) for part in parts):
        return ""
    for cut in range(len(parts), 0, -1):
        module = "/".join(parts[:cut]) + ".py"
        if (root / INGESTION_ROOT / module).is_file():
            return f"{INGESTION_ROOT}/{module}"
    # Not in this checkout: dropping the class names still lands in the right
    # directory, which is all a CODEOWNERS rule looks at.
    while len(parts) > 1 and parts[-1][:1].isupper():
        parts = parts[:-1]
    return f"{INGESTION_ROOT}/{'/'.join(parts)}.py"


def test_source_path(test_id: str, suite: str, root: Path = REPO) -> str:
    """The repo path whose CODEOWNERS rule owns a test, or "" when the id names no
    plausible file. Java ITs map to their class under the IT module, Playwright ids to
    their spec, Python ids to the ingestion module that defines them."""
    if suite == "playwright" or " :: " in test_id:
        parts = test_id.split(" :: ", 2)
        if len(parts) < 3:
            return ""
        spec = parts[1].strip().split(":", 1)[0].removeprefix("./")
        if not SPEC_PATH_RE.fullmatch(spec):
            return ""
        if spec.startswith(f"{UI_ROOT}/"):
            return spec
        if spec.startswith("playwright/"):
            return f"{UI_ROOT}/{spec}"
        return f"{E2E_ROOT}/{spec}"
    dotted = PARAMS.sub("", test_id.split("#", 1)[0]).strip()
    if suite == "python" or dotted.startswith("tests."):
        return _python_module(dotted, root)
    outer = dotted.split("$", 1)[0]
    if not JAVA_CLASS_RE.fullmatch(outer):
        return ""
    return f"{IT_ROOT}/{outer.replace('.', '/')}.java"


def owning_team(test_id: str, suite: str, rules: list[OwnerRule], root: Path = REPO) -> tuple[list[str], str]:
    path = test_source_path(test_id, suite, root)
    return (list(owners_for(path, rules)) if path else []), _cap(path, MAX_PATH_CHARS)


# ----------------------------------------------------------------- issue stats


def occurrence_kind(occurrence: dict) -> str:
    """broken-main when the parent control reproduced the failure and the parent was
    main's tip: an entry whose PR set is only its own PR was built directly on main."""
    if occurrence.get("class") != gate.PRE_EXISTING:
        return FLAKY
    prs, pr = occurrence.get("prs"), occurrence.get("pr")
    if prs is None or pr is None:
        return FLAKY
    return BROKEN_MAIN if not set(prs) - {pr} else FLAKY


def _compact(occurrence: dict) -> dict:
    """What an issue keeps of one occurrence: enough to audit it and to count it as
    independent history, which is why it carries the entry's PR set."""
    return {
        "ts": occurrence["ts"],
        "fingerprint": occurrence["fingerprint"],
        "runId": occurrence.get("runId"),
        "runAttempt": occurrence.get("runAttempt"),
        "pr": occurrence.get("pr"),
        "prs": occurrence.get("prs"),
        "class": occurrence["class"],
        "entry": occurrence.get("entry"),
        "parent": occurrence.get("parent"),
        "parentSha": occurrence.get("parentSha"),
        "mode": occurrence.get("mode"),
    }


def merge_stats(
    stats: dict | None, occurrence: dict, *, owners: list[str], owner_path: str, repository: str
) -> tuple[dict, bool]:
    """Fold one occurrence into an issue's stats: (stats, whether it was new). The same
    run recorded twice, by a re-run controller, counts once."""
    base = stats or {
        "kind": FLAKY,
        "firstSeen": occurrence["ts"],
        "lastSeen": occurrence["ts"],
        "occurrenceCount": 0,
        "occurrences": [],
        "prsLetThrough": [],
        "classes": {},
        "lastError": "",
        "reopenedCount": 0,
        "lastReopenedAt": None,
    }
    key = (occurrence.get("runId"), occurrence.get("runAttempt"))
    occurrences = list(base["occurrences"])
    classes = dict(base["classes"])
    count = base["occurrenceCount"]
    is_new = all((item.get("runId"), item.get("runAttempt")) != key for item in occurrences)
    if is_new:
        occurrences = (occurrences + [_compact(occurrence)])[-MAX_OCCURRENCES:]
        count += 1
        name = occurrence["class"]
        if name in classes or len(classes) < MAX_CLASSES:
            classes[name] = classes.get(name, 0) + 1
    prs = list(base["prsLetThrough"])
    pr = occurrence.get("pr")
    if occurrence.get("letThrough") and pr and pr not in prs:
        prs = (prs + [pr])[-MAX_PRS_LET_THROUGH:]
    # A broken main is never downgraded by a later flaky-looking occurrence.
    broken = base["kind"] == BROKEN_MAIN or occurrence_kind(occurrence) == BROKEN_MAIN
    merged = {
        "schemaVersion": STATS_SCHEMA,
        "fingerprint": occurrence["fingerprint"],
        "testId": occurrence["testId"],
        "suite": occurrence["suite"],
        "kind": BROKEN_MAIN if broken else FLAKY,
        "repository": repository if REPOSITORY_RE.fullmatch(repository) else "",
        "owners": [owner for owner in owners if OWNER_RE.fullmatch(owner)][:MAX_OWNERS],
        "ownerPath": owner_path,
        "firstSeen": min(base["firstSeen"], occurrence["ts"]),
        "lastSeen": max(base["lastSeen"], occurrence["ts"]),
        "occurrenceCount": count,
        "occurrences": occurrences,
        "prsLetThrough": prs,
        "classes": classes,
        "lastError": occurrence.get("error") or base["lastError"],
        "reopenedCount": base["reopenedCount"],
        "lastReopenedAt": base["lastReopenedAt"],
    }
    return merged, is_new


def _normalize_occurrence(raw: Any) -> dict | None:
    if not isinstance(raw, dict) or (when := _when(raw.get("ts"))) is None:
        return None
    fingerprint = valid_fingerprint(raw.get("fingerprint"))
    if not fingerprint:
        return None
    return {
        "ts": _iso(when),
        "fingerprint": fingerprint,
        "runId": _number(raw.get("runId")),
        "runAttempt": _number(raw.get("runAttempt")),
        "pr": _number(raw.get("pr")),
        "prs": _prs(raw.get("prs")),
        "class": _class(raw.get("class")),
        "entry": _counts(raw.get("entry")),
        "parent": _counts(raw.get("parent")),
        "parentSha": _sha(raw.get("parentSha")),
        "mode": raw.get("mode") if raw.get("mode") in GATE_MODES else None,
    }


def normalize_stats(data: Any, fingerprint: str) -> dict | None:
    """Stats read back from an issue body, type-checked and re-bounded field by field:
    the body is editable, so it is input like any other."""
    if not isinstance(data, dict) or data.get("schemaVersion") != STATS_SCHEMA:
        return None
    if data.get("fingerprint") != fingerprint:
        return None
    first, last = _when(data.get("firstSeen")), _when(data.get("lastSeen"))
    if first is None or last is None:
        return None
    raw_occurrences = data.get("occurrences") if isinstance(data.get("occurrences"), list) else []
    occurrences = [o for o in map(_normalize_occurrence, raw_occurrences) if o][-MAX_OCCURRENCES:]
    classes: dict[str, int] = {}
    for name, count in (data.get("classes") if isinstance(data.get("classes"), dict) else {}).items():
        if CLASS_RE.fullmatch(name) and _count(count) is not None and len(classes) < MAX_CLASSES:
            classes[name] = count
    test_id = _guard(data.get("testId"), MAX_TEST_ID_CHARS)
    owners = data.get("owners") if isinstance(data.get("owners"), list) else []
    let_through = data.get("prsLetThrough") if isinstance(data.get("prsLetThrough"), list) else []
    reopened = _when(data.get("lastReopenedAt"))
    return {
        "schemaVersion": STATS_SCHEMA,
        "fingerprint": fingerprint,
        "testId": test_id,
        "suite": data["suite"] if data.get("suite") in SUITES else infer_suite(test_id),
        "kind": BROKEN_MAIN if data.get("kind") == BROKEN_MAIN else FLAKY,
        "repository": data["repository"] if REPOSITORY_RE.fullmatch(str(data.get("repository") or "")) else "",
        "owners": [o for o in owners if isinstance(o, str) and OWNER_RE.fullmatch(o)][:MAX_OWNERS],
        "ownerPath": _guard(data.get("ownerPath"), MAX_PATH_CHARS),
        "firstSeen": _iso(first),
        "lastSeen": _iso(last),
        "occurrenceCount": max(_count(data.get("occurrenceCount")) or 0, len(occurrences)),
        "occurrences": occurrences,
        "prsLetThrough": [pr for pr in map(_number, let_through) if pr][-MAX_PRS_LET_THROUGH:],
        "classes": classes,
        "lastError": _guard(data.get("lastError"), MAX_ERROR_CHARS),
        "reopenedCount": _count(data.get("reopenedCount")) or 0,
        "lastReopenedAt": _iso(reopened) if reopened else None,
    }


def parse_issue_body(body: Any) -> dict | None:
    """The stats an issue body carries, or None when a person rewrote them; the caller
    then starts a fresh count on the same issue."""
    if not isinstance(body, str):
        return None
    marker, fenced = MARKER_RE.search(body), STATS_RE.search(body)
    if not marker or not fenced:
        return None
    try:
        data = json.loads(fenced[1])
    except ValueError:
        return None
    return normalize_stats(data, marker[1])


def issue_title(stats: dict) -> str:
    prefix = TITLE_PREFIX[stats["kind"]]
    return prefix + _cap(_inert_title(stats["testId"]), MAX_TITLE_CHARS - len(prefix))


def _render(stats: dict, mention_owners: bool) -> str:
    test = _code(stats["testId"])
    if stats["kind"] == BROKEN_MAIN:
        lead = (
            f"**Broken on main:** {test} failed in the merge queue and again when re-run on "
            "main's tip, so main itself fails it. The merge gate did not eject the entries that hit it."
        )
    else:
        lead = (
            f"**Flaky test:** {test} failed in the merge queue. Targeted re-runs proved the failure "
            "was not caused by the queue entry, so the merge gate did not eject it."
        )
    owners = ", ".join(owner if mention_owners else _code(owner) for owner in stats["owners"])
    path = _code(stats["ownerPath"])
    if owners:
        team = f"{owners} (CODEOWNERS for {path})"
    elif stats["ownerPath"]:
        team = f"none: no CODEOWNERS rule owns {path}"
    else:
        team = "unknown: the test id names no source file"
    count = stats["occurrenceCount"]
    classes = ", ".join(f"{_code(name)} ×{n}" for name, n in sorted(stats["classes"].items()))
    let_through = ", ".join(f"#{pr}" for pr in stats["prsLetThrough"]) or "none"
    if any(o.get("mode") == "shadow" for o in stats["occurrences"]):
        let_through += " (decisions in shadow mode merge nothing)"
    lines = [
        MARKER.format(stats["fingerprint"]),
        lead,
        "",
        f"- **Suite:** {_code(stats['suite'])}",
        f"- **Owning team:** {team}",
        f"- **Seen:** {count} time{'' if count == 1 else 's'}, first {_human(stats['firstSeen'])}, "
        f"last {_human(stats['lastSeen'])}",
        f"- **Verify classes:** {classes or 'none'}",
        f"- **PRs let through:** {let_through}",
    ]
    latest = stats["occurrences"][-1] if stats["occurrences"] else {}
    if latest.get("runId") and stats["repository"]:
        attempt = f" (attempt {latest['runAttempt']})" if latest.get("runAttempt") else ""
        lines.append(
            f"- **Latest run:** https://github.com/{stats['repository']}/actions/runs/{latest['runId']}{attempt}"
        )
    if stats["lastError"]:
        lines.append(f"- **Latest error:** {_code(stats['lastError'])}")
    if stats["reopenedCount"]:
        lines.append(
            f"- **Recurred after a fix:** {stats['reopenedCount']} time(s), last "
            f"{_human(stats['lastReopenedAt'] or stats['lastSeen'])}"
        )
    lines += [
        "",
        "Fix the test and close this issue from the fix PR (`Fixes #<this issue>`). If the failure "
        "recurs after that, the merge gate reopens it. The merge gate rewrites this description "
        "on every occurrence.",
        "",
        "<details><summary>Merge-gate stats</summary>",
        "",
        "```json",
        json.dumps(stats, indent=1, sort_keys=True, ensure_ascii=False),
        "```",
        "",
        "</details>",
        "",
    ]
    return "\n".join(lines)


def render_issue_body(stats: dict, *, mention_owners: bool = False) -> str:
    """Hidden marker, a summary for people, then the stats as JSON for the gate. Every
    value from a run is already clean and sits only in a code span or the JSON fence.
    Owners come from CODEOWNERS and are @-mentioned only when asked: otherwise every
    new fingerprint would ping a whole team, and the label is how teams triage."""
    body = _render(stats, mention_owners)
    # The caps keep a body near 30 KB; this only guards against a future field.
    while len(body) > MAX_BODY_CHARS and stats["occurrences"]:
        stats = {**stats, "occurrences": stats["occurrences"][1:]}
        body = _render(stats, mention_owners)
    return body


# ------------------------------------------------------------------- GitHub


def _api_message(exc: urllib.error.HTTPError) -> str:
    try:
        detail = json.loads(exc.read(4096) or b"{}").get("message") or ""
    except (ValueError, OSError, AttributeError):
        detail = ""
    return clean_text(detail, 200)


def send(method: str, path: str, body: dict | None, token: str) -> Any:
    """One write, never retried here: a retried issue create opens a duplicate, and a
    ledger conflict needs a fresh read, not the same request again. The API's message
    is kept in the error, since it is what tells a lost race from a bad request."""
    request = urllib.request.Request(
        f"{mq.GITHUB_REST}{path}",
        data=json.dumps(body or {}).encode(),
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "openmetadata-merge-gate",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        raise mq.ApiError(
            f"HTTP {exc.code} {exc.reason} for {method} {path}: {_api_message(exc)}", exc.code
        ) from exc
    return json.loads(payload) if payload.strip() else None


class Writer:
    """Every write goes through here, so a dry run prints exactly the calls a live run
    would make, in order, and makes none of them."""

    def __init__(self, token: str, dry_run: bool = False):
        self.token = token
        self.dry_run = dry_run
        self.calls: list[dict] = []

    def __call__(self, method: str, path: str, body: dict | None, note: str = "") -> dict:
        self.calls.append({"method": method, "path": path, "note": note})
        if self.dry_run:
            print(f"[dry-run] {method} {path}" + (f" ({note})" if note else ""))
            return {}
        response = send(method, path, body, self.token)
        return response if isinstance(response, dict) else {}


def _list_pages(path: str, token: str, max_pages: int) -> tuple[list[dict], bool]:
    """A list endpoint read up to max_pages; True when the cap cut it short."""
    items: list[dict] = []
    separator = "&" if "?" in path else "?"
    for page in range(1, max_pages + 1):
        batch = mq.rest(f"{path}{separator}per_page=100&page={page}", token)
        if not isinstance(batch, list):
            raise mq.ApiError(f"Expected a list from {path}")
        items.extend(item for item in batch if isinstance(item, dict))
        if len(batch) < 100:
            return items, False
    return items, True


# ------------------------------------------------------------------- issues


@dataclass(frozen=True)
class Issue:
    number: int
    state: str
    state_reason: str | None
    title: str
    body: str
    labels: frozenset[str]
    closed_at: str | None
    updated_at: str

    @property
    def fingerprint(self) -> str:
        match = MARKER_RE.search(self.body)
        return match[1] if match else ""


def issue_from_api(item: Any) -> Issue | None:
    """Pull requests come back from the issue endpoints too; none is a registry issue."""
    if not isinstance(item, dict) or "pull_request" in item or not _number(item.get("number")):
        return None
    reason, closed = item.get("state_reason"), item.get("closed_at")
    return Issue(
        number=_number(item["number"]),
        state=str(item.get("state") or ""),
        state_reason=reason if isinstance(reason, str) else None,
        title=str(item.get("title") or ""),
        body=str(item.get("body") or ""),
        labels=frozenset(str(label.get("name")) for label in item.get("labels") or [] if isinstance(label, dict)),
        closed_at=closed if isinstance(closed, str) else None,
        updated_at=str(item.get("updated_at") or ""),
    )


def _rank(issue: Issue) -> tuple:
    return issue.state == "open", issue.updated_at, issue.number


def _preferred(current: Issue | None, candidate: Issue) -> Issue:
    """Two issues can carry one marker (a person copied a body); the open, most
    recently updated one is the registry's."""
    return candidate if current is None or _rank(candidate) > _rank(current) else current


@dataclass
class IssueListing:
    """The registry's issues by fingerprint, read once per invocation. `complete` is
    False when the page cap cut the listing short, so a miss there is not conclusive."""

    by_fingerprint: dict[str, Issue]
    complete: bool

    def remember(self, issue: Issue) -> None:
        if issue.fingerprint:
            self.by_fingerprint[issue.fingerprint] = issue


def list_registry_issues(owner: str, repo: str, token: str, max_pages: int = ISSUE_LIST_PAGES) -> IssueListing:
    """Open and closed issues of both labels, most recently updated first. The issues
    endpoint reads the database, so an issue created a second ago is already there,
    which the search index cannot promise."""
    found: dict[str, Issue] = {}
    complete = True
    for label in LABELS:
        items, truncated = _list_pages(
            f"/repos/{owner}/{repo}/issues?labels={label}&state=all&sort=updated&direction=desc",
            token,
            max_pages,
        )
        complete = complete and not truncated
        for item in items:
            issue = issue_from_api(item)
            if issue and issue.fingerprint:
                found[issue.fingerprint] = _preferred(found.get(issue.fingerprint), issue)
    return IssueListing(found, complete)


def find_issue(owner: str, repo: str, fingerprint: str, token: str, listing: IssueListing | None = None) -> Issue | None:
    """The registry issue for a fingerprint: the labelled issue whose hidden marker
    names it. The label listing answers; the search API (30 calls a minute, and an index
    that lags) is asked only when the listing was cut short, and its hits are checked
    for the marker and a registry label, never trusted on a text match."""
    fingerprint = valid_fingerprint(fingerprint)
    if not fingerprint:
        return None
    if listing is None:
        listing = list_registry_issues(owner, repo, token)
    if fingerprint in listing.by_fingerprint:
        return listing.by_fingerprint[fingerprint]
    if listing.complete:
        return None
    query = urllib.parse.quote(f'repo:{owner}/{repo} is:issue in:body "{fingerprint}"')
    result = mq.rest(f"/search/issues?q={query}&per_page={SEARCH_RESULTS}", token)
    best = None
    for item in (result or {}).get("items") or []:
        issue = issue_from_api(item)
        if issue and issue.fingerprint == fingerprint and issue.labels & set(LABELS):
            best = _preferred(best, issue)
    if best:
        listing.remember(best)
    return best


def recurred_after_fix(issue: Issue, occurrence: dict) -> bool:
    """Closed as fixed, and seen in a run that started after the close. A run already
    going when the fix merged proves nothing about the fix, and an issue closed as not
    planned or duplicate stays closed: a person decided that."""
    if issue.state_reason in ("not_planned", "duplicate"):
        return False
    closed = _when(issue.closed_at)
    seen = _when(occurrence.get("runCreatedAt")) or _when(occurrence.get("ts"))
    return closed is None or (seen is not None and seen > closed)


def _recurred_comment(occurrence: dict, repository: str) -> str:
    run = occurrence.get("runId")
    where = f"https://github.com/{repository}/actions/runs/{run}" if run and REPOSITORY_RE.fullmatch(repository) else "a merge-queue run"
    entry = f" in the queue entry for #{occurrence['pr']}" if occurrence.get("pr") else ""
    return (
        f"Recurred after fix: the merge gate saw this failure again{entry} ({where}) after the "
        "issue was closed, so it is reopened."
    )


def upsert_issue(
    owner: str,
    repo: str,
    occurrence: dict,
    token: str,
    *,
    writer: Writer | None = None,
    listing: IssueListing | None = None,
    rules: list[OwnerRule] | None = None,
    mention_owners: bool = False,
) -> dict:
    """Create, update or reopen the registry issue for one occurrence; returns what it
    did. Labels are only ever added (flaky to broken-main), never removed, so a label a
    person set survives."""
    writer = writer or Writer(token)
    fingerprint = valid_fingerprint(occurrence.get("fingerprint"))
    result = {"fingerprint": fingerprint, "testId": occurrence.get("testId", "")}
    if not fingerprint:
        return {**result, "action": "skip", "reason": "no valid fingerprint"}
    if listing is None:
        listing = list_registry_issues(owner, repo, token)
    owners, owner_path = owning_team(occurrence["testId"], occurrence["suite"], load_codeowners() if rules is None else rules)
    repository = f"{owner}/{repo}"
    issue = find_issue(owner, repo, fingerprint, token, listing)
    stats, is_new = merge_stats(
        parse_issue_body(issue.body) if issue else None,
        occurrence,
        owners=owners,
        owner_path=owner_path,
        repository=repository,
    )
    base = f"/repos/{owner}/{repo}/issues"
    if issue is None:
        title = issue_title(stats)
        body = render_issue_body(stats, mention_owners=mention_owners)
        created = writer("POST", base, {"title": title, "body": body, "labels": [stats["kind"]]}, f'create "{title}" [{stats["kind"]}]')
        number = _number(created.get("number"))
        if number:
            listing.remember(Issue(number, "open", None, title, body, frozenset({stats["kind"]}), None, _iso(mq.utcnow())))
        return {**result, "action": "create", "number": number, "kind": stats["kind"]}

    reopen = issue.state == "closed" and is_new and recurred_after_fix(issue, occurrence)
    if reopen:
        stats["reopenedCount"] += 1
        stats["lastReopenedAt"] = occurrence["ts"]
    escalate = stats["kind"] == BROKEN_MAIN and BROKEN_MAIN not in issue.labels
    body = render_issue_body(stats, mention_owners=mention_owners)
    patch: dict[str, Any] = {}
    if body != issue.body:
        patch["body"] = body
    if escalate:
        patch["title"] = issue_title(stats)
    if reopen:
        patch["state"] = "open"
    action = "reopen" if reopen else "update" if issue.state == "open" else "update-closed"
    if not patch:
        return {**result, "action": "unchanged", "number": issue.number, "kind": stats["kind"]}
    if escalate:
        writer("POST", f"{base}/{issue.number}/labels", {"labels": [BROKEN_MAIN]}, f"add {BROKEN_MAIN}")
    writer("PATCH", f"{base}/{issue.number}", patch, "set " + ", ".join(sorted(patch)))
    if reopen:
        writer("POST", f"{base}/{issue.number}/comments", {"body": _recurred_comment(occurrence, repository)}, "recurred after fix")
    listing.remember(
        replace(
            issue,
            body=body,
            title=patch.get("title", issue.title),
            state="open" if reopen else issue.state,
            labels=issue.labels | ({BROKEN_MAIN} if escalate else set()),
        )
    )
    return {**result, "action": action, "number": issue.number, "kind": stats["kind"]}


# ------------------------------------------------------------------- ledger


@dataclass
class LedgerFile:
    records: list[dict]
    sha: str | None
    branch_exists: bool


def ledger_record(observation: dict) -> dict:
    """One ledger line: the spec'd fields plus the entry's own PR and PR set (what
    independent history needs) and the attempt and entry counts (what the shadow
    comparison needs)."""
    entry = observation.get("entry") or {}
    parent = observation.get("parent") or {}
    return {
        "ts": observation["ts"],
        "testId": observation["testId"],
        "fingerprint": observation["fingerprint"],
        "class": observation["class"],
        "runId": observation.get("runId"),
        "runAttempt": observation.get("runAttempt"),
        "entrySha": observation.get("entrySha"),
        "entryFailed": entry.get("failed"),
        "entryRuns": entry.get("runs"),
        "parentSha": observation.get("parentSha"),
        "parentFailed": parent.get("failed"),
        "parentRuns": parent.get("runs"),
        "pr": observation.get("pr"),
        "prs": observation.get("prs"),
    }


def _normalize_record(raw: Any) -> dict | None:
    """A ledger line as data: wrong types become null, and a line without a time or a
    fingerprint is dropped, so it ages out instead of living forever."""
    if not isinstance(raw, dict) or (when := _when(raw.get("ts"))) is None:
        return None
    fingerprint = valid_fingerprint(raw.get("fingerprint"))
    if not fingerprint:
        return None
    entry = _counts({"failed": raw.get("entryFailed"), "runs": raw.get("entryRuns")}) or {}
    parent = _counts({"failed": raw.get("parentFailed"), "runs": raw.get("parentRuns")}) or {}
    return {
        "ts": _iso(when),
        "testId": _guard(raw.get("testId"), MAX_TEST_ID_CHARS),
        "fingerprint": fingerprint,
        "class": _class(raw.get("class")),
        "runId": _number(raw.get("runId")),
        "runAttempt": _number(raw.get("runAttempt")),
        "entrySha": _sha(raw.get("entrySha")),
        "entryFailed": entry.get("failed"),
        "entryRuns": entry.get("runs"),
        "parentSha": _sha(raw.get("parentSha")),
        "parentFailed": parent.get("failed"),
        "parentRuns": parent.get("runs"),
        "pr": _number(raw.get("pr")),
        "prs": _prs(raw.get("prs")),
    }


def parse_ledger(text: str) -> list[dict]:
    records = []
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            record = _normalize_record(json.loads(line))
        except ValueError:
            continue
        if record:
            records.append(record)
    return records


def _line(record: dict) -> str:
    # ASCII-only, so characters are bytes and the size cap is exact.
    return json.dumps(record, sort_keys=True, separators=(",", ":"))


def serialize_ledger(records: Iterable[dict]) -> str:
    return "".join(f"{_line(record)}\n" for record in records)


def prune_ledger(
    records: list[dict],
    now: datetime,
    *,
    max_age: timedelta = LEDGER_MAX_AGE,
    max_records: int = LEDGER_MAX_RECORDS,
    max_bytes: int = LEDGER_MAX_BYTES,
) -> list[dict]:
    """The rolling window, then the hard caps, oldest out first. The file is only ever
    appended to, so file order is age order. A time more than a day ahead is a broken
    clock or an edit, and would otherwise never age out."""
    cutoff, horizon = now - max_age, now + timedelta(days=1)
    kept = [r for r in records if (when := _when(r.get("ts"))) is not None and cutoff <= when <= horizon]
    kept = kept[len(kept) - max_records :] if len(kept) > max_records else kept
    sizes = [len(_line(record)) + 1 for record in kept]
    total, start = sum(sizes), 0
    while total > max_bytes and start < len(kept):
        total -= sizes[start]
        start += 1
    return kept[start:]


def _contents_path(owner: str, repo: str) -> str:
    return f"/repos/{owner}/{repo}/contents/{LEDGER_PATH}"


def _branch_exists(owner: str, repo: str, token: str) -> bool:
    try:
        mq.rest(f"/repos/{owner}/{repo}/git/ref/heads/{LEDGER_BRANCH}", token)
        return True
    except mq.ApiError as exc:
        if exc.status == 404:
            return False
        raise


def _ledger_fetch(owner: str, repo: str, token: str) -> LedgerFile:
    ref = urllib.parse.quote(LEDGER_BRANCH, safe="")
    try:
        meta = mq.rest(f"{_contents_path(owner, repo)}?ref={ref}", token)
    except mq.ApiError as exc:
        if exc.status != 404:
            raise
        # A missing branch and a missing file both read as 404, and are written differently.
        return LedgerFile([], None, _branch_exists(owner, repo, token))
    if not isinstance(meta, dict) or meta.get("type") != "file" or not meta.get("sha"):
        raise mq.ApiError(f"{LEDGER_PATH} on {LEDGER_BRANCH} is not a file")
    sha, size = str(meta["sha"]), int(meta.get("size") or 0)
    if size > LEDGER_MAX_READ_BYTES:
        # The gate never writes one this large; start over rather than load it.
        print(f"::warning::{LEDGER_PATH} is {size} bytes; its records are ignored", file=sys.stderr)
        return LedgerFile([], sha, True)
    content = meta.get("content") if meta.get("encoding") == "base64" else ""
    if not content and size:
        # Over 1 MB the Contents API returns metadata only; the blob API has the bytes.
        content = (mq.rest(f"/repos/{owner}/{repo}/git/blobs/{sha}", token) or {}).get("content") or ""
    text = base64.b64decode(content or "").decode("utf-8", errors="replace")
    return LedgerFile(parse_ledger(text), sha, True)


def ledger_read(owner: str, repo: str, token: str) -> list[dict]:
    """Every ledger record, oldest first; empty before the first write. Raises
    mq.ApiError when the ledger exists but cannot be read, so a caller can choose to
    run the control instead of reusing nothing silently."""
    return _ledger_fetch(owner, repo, token).records


def _record_key(record: dict) -> tuple:
    return record.get("runId") or record["ts"], record.get("runAttempt"), record["fingerprint"]


def _lost_race(exc: mq.ApiError) -> bool:
    """409: the file moved since it was read. 422 on a create: another writer created
    the file or the branch first. A fresh read fixes both."""
    if exc.status == 409:
        return True
    text = str(exc).lower()
    return exc.status == 422 and ("sha" in text or "already exists" in text)


def _create_ledger_branch(owner: str, repo: str, content: str, message: str, writer: Writer, note: str) -> None:
    """An orphan commit holding only the ledger: the data branch shares no history with
    main, so it never appears in a diff or a merge base."""
    base = f"/repos/{owner}/{repo}/git"
    tree = writer(
        "POST",
        f"{base}/trees",
        {"tree": [{"path": LEDGER_PATH, "mode": "100644", "type": "blob", "content": content}]},
        f"tree with {LEDGER_PATH}",
    )
    commit = writer("POST", f"{base}/commits", {"message": message, "tree": tree.get("sha"), "parents": []}, "orphan commit")
    writer("POST", f"{base}/refs", {"ref": f"refs/heads/{LEDGER_BRANCH}", "sha": commit.get("sha")}, f"create {LEDGER_BRANCH}: {note}")


def ledger_append(
    owner: str, repo: str, records: Iterable[dict], token: str, *, writer: Writer | None = None, now: datetime | None = None
) -> dict:
    """Append records and prune, as a compare-and-swap: the PUT names the blob it
    replaces, so a write that lands in between turns this one into a 409, and the
    whole read-append-prune is redone from the new file, up to 3 times. Records
    already on the ledger (a re-run controller) are not appended twice."""
    writer = writer or Writer(token)
    now = now or mq.utcnow()
    new = [record for record in map(_normalize_record, records) if record]
    if not new:
        return {"appended": 0, "reason": "no valid records"}
    attempt = 0
    while True:
        attempt += 1
        current = _ledger_fetch(owner, repo, token)
        known = {_record_key(record) for record in current.records}
        fresh = [record for record in new if _record_key(record) not in known]
        if not fresh:
            return {"appended": 0, "duplicates": len(new), "attempts": attempt}
        merged = prune_ledger(current.records + fresh, now)
        pruned = len(current.records) + len(fresh) - len(merged)
        runs = ", ".join(sorted({str(r["runId"]) for r in fresh if r.get("runId")})) or "unknown"
        message = f"merge-gate ledger: +{len(fresh)} record(s) from run {runs}"
        note = f"+{len(fresh)} record(s), {len(merged)} kept, {pruned} pruned"
        try:
            if not current.branch_exists:
                _create_ledger_branch(owner, repo, serialize_ledger(merged), message, writer, note)
            else:
                body = {
                    "message": message,
                    "content": base64.b64encode(serialize_ledger(merged).encode()).decode(),
                    "branch": LEDGER_BRANCH,
                }
                if current.sha:
                    body["sha"] = current.sha
                writer("PUT", _contents_path(owner, repo), body, note + ("" if current.sha else ", new file"))
        except mq.ApiError as exc:
            if attempt <= LEDGER_CONFLICT_RETRIES and _lost_race(exc):
                continue
            raise
        return {"appended": len(fresh), "kept": len(merged), "pruned": pruned, "attempts": attempt}


def ledger_lookup(
    records: Iterable[dict], test_id: str, fingerprint: str, parent_sha: str, min_runs: int = DEFAULT_PARENT_RUNS
) -> dict | None:
    """A parent control already run for this test, failure and parent commit, in the
    shape verify_failures writes for its parent side, or None when verify must run it.

    Controls on one parent are pooled. One failure proves the failure pre-exists; a
    clean result is reused only once it has as many runs as a fresh control
    (verify.parentRuns) would make. Pass the raw test id: it is cleaned the way it was
    stored."""
    parent_sha, fingerprint = _sha(parent_sha), valid_fingerprint(fingerprint)
    if not parent_sha or not fingerprint:
        return None
    ids = {test_id, clean_text(test_id, MAX_TEST_ID_CHARS)}
    failed = runs = 0
    sources: list[int] = []
    for record in records:
        if record.get("fingerprint") != fingerprint or record.get("parentSha") != parent_sha:
            continue
        if record.get("testId") not in ids:
            continue
        counts = _counts({"failed": record.get("parentFailed"), "runs": record.get("parentRuns")})
        if not counts or not counts["runs"]:
            continue
        failed += counts["failed"]
        runs += counts["runs"]
        if record.get("runId") and len(sources) < 20:
            sources.append(record["runId"])
    if failed or (runs and runs >= min_runs):
        return {"failed": failed, "runs": runs, "problems": [], "reusedFrom": sources}
    return None


def _observed_prs(record: dict) -> frozenset[int] | None:
    """The PR set of the commit a failure was seen on. When the parent control failed
    too, it was seen on the parent, which holds every PR of the entry but its own."""
    prs = _prs(record.get("prs"))
    if prs is None:
        return None
    pr = _number(record.get("pr"))
    parent = record.get("parent") if isinstance(record.get("parent"), dict) else {}
    parent_failed = _count(record.get("parentFailed")) or _count(parent.get("failed"))
    if pr is not None and parent_failed:
        return frozenset(prs) - {pr}
    return frozenset(prs)


def independent_history(records: Iterable[dict], fingerprints: Iterable[str], entry_prs: Iterable[int]) -> frozenset[str]:
    """The fingerprints this entry's PRs cannot explain: seen failing on main (an empty
    PR set), or in an entry sharing no PR with this one. Entries are cumulative, so a
    failure in M+A, or in M+A+B, says nothing about B.

    Takes ledger records or issue occurrences. A record without a PR set proves
    nothing, and an `introduced` failure belongs to its own entry's diff."""
    wanted = {fingerprint for fingerprint in fingerprints if fingerprint}
    entry = frozenset(pr for pr in map(_number, entry_prs) if pr)
    found: set[str] = set()
    for record in records:
        fingerprint = record.get("fingerprint")
        if fingerprint not in wanted or fingerprint in found:
            continue
        observed = _observed_prs(record)
        if observed is None or observed & entry:
            continue
        if observed and record.get("class") not in HISTORY_CLASSES:
            continue
        found.add(fingerprint)
    return frozenset(found)


# ------------------------------------------------------------------- record


def _suite_from_path(path: Path, root: Path) -> str:
    for part in path.relative_to(root).parts:
        if match := VERIFY_ARTIFACT_RE.match(part):
            return match[1]
    return ""


def load_verify_documents(directory: Path | None) -> list[dict]:
    """verify.json files under a directory, as `actions/download-artifact` lays out
    `verify-<suite>-a<attempt>` artifacts. Each carries `suite`: its own if it has one,
    else the artifact directory's."""
    if directory is None or not directory.is_dir():
        return []
    documents = []
    for path in sorted(directory.rglob("verify.json"))[:MAX_VERIFY_DOCUMENTS]:
        try:
            if path.stat().st_size > MAX_VERIFY_BYTES:
                continue
            document = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(document, dict):
            suite = document.get("suite") if document.get("suite") in SUITES else _suite_from_path(path, directory)
            documents.append({**document, "suite": suite})
    return documents


def load_flaky_tests(directory: Path | None) -> list[dict]:
    """Tests that failed and then passed on an in-job re-run (classify_test_outcome's
    `flakyTests`), from the run's downloaded `evidence-*` artifacts. Their job passed,
    so the gate never saw them; the registry still has to, or the flake is never fixed.
    Each carries the run and attempt its outcome was written in."""
    if directory is None or not directory.is_dir():
        return []
    found = []
    for path in sorted(directory.rglob("outcome.json"))[:MAX_VERIFY_DOCUMENTS]:
        try:
            if path.stat().st_size > MAX_VERIFY_BYTES:
                continue
            outcome = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(outcome, dict) or not isinstance(outcome.get("flakyTests"), list):
            continue
        context = outcome.get("context") if isinstance(outcome.get("context"), dict) else {}
        for item in outcome["flakyTests"][:MAX_FLAKY_PER_OUTCOME]:
            if isinstance(item, dict) and item.get("id"):
                found.append(
                    {
                        "id": str(item["id"]),
                        "message": str(item.get("message") or ""),
                        "runId": _number(context.get("runId")),
                        "runAttempt": _number(context.get("runAttempt")),
                    }
                )
    return found


def collect(
    payload: dict, documents: list[dict], now: datetime, flaky: Iterable[dict] = ()
) -> tuple[list[dict], list[dict], list[str]]:
    """(observations for the ledger, occurrences for issues, notes) from one decision
    report (merge_gate.py --out), its run's verify documents and the tests that passed
    only on an in-job re-run.

    Every verified test is observed, whatever the verdict: a control that ejected one
    entry is reusable by the next on the same parent. Issues are only for tests a PASS
    forgave, the in-job re-runs included. Inputs of another run or attempt are ignored."""
    context = payload.get("context") or {}
    decision = payload.get("decision") or {}
    mode = context.get("mode") if context.get("mode") in GATE_MODES else None
    run_id, attempt = _number(context.get("runId")), _number(context.get("attempt"))
    created = _when(context.get("runCreatedAt"))
    base = {
        "ts": _iso(now),
        "runId": run_id,
        "runAttempt": attempt,
        "runCreatedAt": _iso(created) if created else None,
        "entrySha": _sha(context.get("headSha")),
        "pr": _number(context.get("pr")),
        # A truncated compare may have dropped PRs; an incomplete set must not look disjoint.
        "prs": None if context.get("truncatedDiff") else _prs(context.get("prs")),
        "mode": mode,
    }
    trusted_parent = _sha(context.get("parentSha"))
    notes: list[str] = []
    observations: dict[str, dict] = {}
    for document in documents:
        if run_id and _number(document.get("runId")) != run_id:
            continue
        if attempt and _number(document.get("runAttempt")) != attempt:
            continue
        parent_sha = _sha(document.get("parentSha"))
        mismatch = bool(trusted_parent and parent_sha and parent_sha != trusted_parent)
        if mismatch:
            notes.append(
                f"verify-{document.get('suite') or '?'} ran its parent control on another commit; "
                "its parent results are not kept"
            )
        for item in document.get("tests") or []:
            if not isinstance(item, dict):
                continue
            raw_id, fingerprint = str(item.get("id") or ""), valid_fingerprint(item.get("fingerprint"))
            if not raw_id or not fingerprint:
                notes.append("skipped a verify record without an id or a valid fingerprint")
                continue
            entry, parent = _counts(item.get("entry")), _counts(item.get("parent"))
            test_class = gate.classify_test(
                gate.VerifiedTest(
                    raw_id,
                    fingerprint,
                    entry["failed"] if entry else 0,
                    entry["runs"] if entry else 0,
                    parent["failed"] if parent else None,
                    parent["runs"] if parent else None,
                )
            )
            if test_class == gate.NOT_VERIFIED:
                continue
            observations[raw_id] = {
                **base,
                "testId": clean_text(raw_id, MAX_TEST_ID_CHARS),
                "fingerprint": fingerprint,
                "suite": document.get("suite") or infer_suite(raw_id),
                "class": test_class,
                "entry": entry,
                "parent": None if mismatch else parent,
                "parentSha": None if mismatch else trusted_parent or parent_sha,
                "error": clean_text(item.get("error") or item.get("message") or "", MAX_ERROR_CHARS),
            }

    in_job: list[str] = []
    for item in flaky:
        raw_id = item["id"]
        if (run_id and item.get("runId") != run_id) or (attempt and item.get("runAttempt") != attempt):
            continue
        if raw_id in observations:
            continue
        in_job.append(raw_id)
        observations[raw_id] = {
            **base,
            "testId": clean_text(raw_id, MAX_TEST_ID_CHARS),
            "fingerprint": evidence_mod.fingerprint(raw_id, item["message"]),
            "suite": infer_suite(raw_id),
            "class": gate.FLAKY,
            # One failure, then a pass on the in-job re-run; no parent control was run.
            "entry": {"failed": 1, "runs": 2},
            "parent": None,
            "parentSha": None,
            "error": clean_text(item["message"], MAX_ERROR_CHARS),
        }

    occurrences = []
    if decision.get("verdict") == gate.PASS:
        let_through = mode != "shadow"
        occurrences += [{**observations[raw_id], "letThrough": let_through} for raw_id in in_job]
        fingerprints = context.get("fingerprints") if isinstance(context.get("fingerprints"), dict) else {}
        for item in decision.get("forgiven") or []:
            if not isinstance(item, dict):
                continue
            raw_id = str(item.get("test") or "")
            if raw_id in in_job:
                continue
            observation = observations.get(raw_id)
            if observation is None:
                # Forgiven without a verify record (a pass-on-retry): the decision's own fields.
                fingerprint = valid_fingerprint(item.get("fingerprint")) or valid_fingerprint(fingerprints.get(raw_id))
                if not raw_id or not fingerprint:
                    notes.append("skipped a forgiven test without an id or a valid fingerprint")
                    continue
                observation = observations[raw_id] = {
                    **base,
                    "testId": clean_text(raw_id, MAX_TEST_ID_CHARS),
                    "fingerprint": fingerprint,
                    "suite": infer_suite(raw_id),
                    "class": _class(item.get("class")),
                    "entry": _parse_counts(item.get("entry")),
                    "parent": _parse_counts(item.get("parent")),
                    "parentSha": trusted_parent,
                    "error": "",
                }
            occurrences.append({**observation, "letThrough": let_through})
    return list(observations.values()), occurrences, notes


def record_decision(
    owner: str,
    repo: str,
    payload: dict,
    documents: list[dict],
    token: str,
    *,
    mode: str = "dry-run",
    now: datetime | None = None,
    rules: list[OwnerRule] | None = None,
    mention_owners: bool = False,
    flaky: Iterable[dict] = (),
) -> dict:
    """The `record` command for a caller that already holds the decision, the verify
    documents and the in-job flaky tests. The ledger and each issue fail
    independently; `errors` says which."""
    context = payload.get("context") or {}
    report: dict[str, Any] = {
        "mode": mode,
        "runId": context.get("runId"),
        "verdict": (payload.get("decision") or {}).get("verdict"),
        "ledger": None,
        "issues": [],
        "notes": [],
        "errors": [],
        "calls": [],
    }
    if mode == "off":
        report["skipped"] = f"{MODE_ENV}=off"
        return report
    now = now or mq.utcnow()
    observations, occurrences, report["notes"] = collect(payload, documents, now, flaky)
    if not observations and not occurrences:
        report["skipped"] = "nothing verified or forgiven"
        return report
    writer = Writer(token, dry_run=mode != "on")
    if observations:
        try:
            report["ledger"] = ledger_append(owner, repo, map(ledger_record, observations), token, writer=writer, now=now)
        except (mq.ApiError, OSError, ValueError) as exc:
            report["errors"].append(f"ledger: {exc}")
    if occurrences:
        try:
            listing = list_registry_issues(owner, repo, token)
        except (mq.ApiError, OSError, ValueError) as exc:
            report["errors"].append(f"issues: {exc}")
        else:
            rules = load_codeowners() if rules is None else rules
            for occurrence in occurrences:
                try:
                    report["issues"].append(
                        upsert_issue(
                            owner, repo, occurrence, token,
                            writer=writer, listing=listing, rules=rules, mention_owners=mention_owners,
                        )
                    )
                except (mq.ApiError, OSError, ValueError) as exc:
                    report["errors"].append(f"issue {occurrence['fingerprint']}: {exc}")
    report["calls"] = writer.calls
    return report


def write_summary(report: dict) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    lines = [f"### merge-gate registry ({report['mode']})", ""]
    if report.get("skipped"):
        lines.append(f"Skipped: {report['skipped']}.")
    ledger = report.get("ledger") or {}
    if ledger:
        lines.append(f"- ledger: +{ledger.get('appended', 0)} record(s), {ledger.get('kept', '?')} kept")
    for issue in report["issues"]:
        number = f"#{issue['number']}" if issue.get("number") else "(new)"
        lines.append(f"- {issue['action']} {number}: {_code(issue.get('testId') or '')}")
    lines += [f"- error: {_code(clean_text(error, 300))}" for error in report["errors"]]
    with open(path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--owner", default="open-metadata")
    parser.add_argument("--repo", default="OpenMetadata")
    parser.add_argument("--mode", choices=MODES, help=f"overrides ${MODE_ENV} (default dry-run)")
    parser.add_argument("--dry-run", action="store_true", help="read everything, write nothing, print the writes")
    parser.add_argument("--out", type=Path, help="also write the JSON report here")
    commands = parser.add_subparsers(dest="command", required=True)
    record = commands.add_parser("record", help="ledger records and registry issues for one decision")
    record.add_argument("--decision", type=Path, required=True, help="merge_gate.py --out report")
    record.add_argument("--verify-dir", type=Path, required=True, help="the run's downloaded verify-* artifacts")
    record.add_argument("--evidence-dir", type=Path, help="the run's downloaded evidence-* artifacts (in-job flaky tests)")
    record.add_argument("--codeowners", type=Path, default=CODEOWNERS_PATH)
    record.add_argument("--mention-owners", action="store_true", help="@-mention CODEOWNERS owners in new issues")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    mode = "dry-run" if args.dry_run else (args.mode or os.environ.get(MODE_ENV) or "dry-run").strip().lower()
    if mode not in MODES:
        print(f"::error::Unknown {MODE_ENV} {mode!r}; expected one of {', '.join(MODES)}", file=sys.stderr)
        return 1
    try:
        if mode == "off":
            # The kill switch reads nothing, not even the decision file.
            report = record_decision(args.owner, args.repo, {}, [], "", mode="off")
        else:
            report = record_decision(
                args.owner,
                args.repo,
                json.loads(args.decision.read_text(encoding="utf-8")),
                load_verify_documents(args.verify_dir),
                mq.env_token(),
                mode=mode,
                rules=load_codeowners(args.codeowners),
                mention_owners=args.mention_owners,
                flaky=load_flaky_tests(args.evidence_dir),
            )
    except (mq.ApiError, OSError, ValueError) as exc:
        print(f"::error::merge-gate registry could not record: {exc}", file=sys.stderr)
        return 1
    text = json.dumps(report, indent=1, sort_keys=True, default=str)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
    write_summary(report)
    print(text)
    for error in report["errors"]:
        print(f"::warning::merge-gate registry: {clean_text(error, 300)}", file=sys.stderr)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
