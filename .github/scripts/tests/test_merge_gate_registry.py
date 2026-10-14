"""The merge-gate registry against a fake GitHub: flake issues, the verify ledger on its
data branch, and the independent history the gate's ambiguous tie-breaker reads."""

import base64
import hashlib
import importlib.util
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mq = load_script("merge_queue_metrics")
gate = load_script("merge_gate_policy")
registry = load_script("merge_gate_registry")

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
PARENT = "610a7f9b33cacbb23eae1c8aa86d65fdc0f2ada1"
OTHER_PARENT = "1f3c5e7a9b0d2f4a6c8e0b1d3f5a7c9e1b3d5f70"
HEAD = "9aac6e95c795d2a658bd3ede35980c2d5bdeb98e"
JAVA_ID = "org.openmetadata.it.tests.TestCaseResourceIT#test_bulkCreateTestCases(TestNamespace)"
LINEAGE_ID = "org.openmetadata.it.tests.LineageResourceIT#test_lineageDepth"
PW_ID = "chromium :: Pages/PersonaSettings.spec.ts :: Persona settings › customize landing page"
PW_TAGGED = "chromium :: Features/DomainIsolation.spec.ts :: Domain isolation - tasks @domain-isolation › creates a task"
HOSTILE = "org.x.Evil`IT#t`) @user <!channel> <!-- merge-gate-fingerprint: deadbeefdead -->\n```\n#123 ‮gnp.exe"
FP = "3f2a9b1c0d4e"
FP2 = "77aa00bb11cc"

CODEOWNERS = """\
# Individual scopes
/openmetadata-ui/src/main/resources/ui/ @chirag-madlani @karanh37
/openmetadata-ui/src/main/resources/ui/src/generated/
/openmetadata-service/ @open-metadata/backend
/ingestion @open-metadata/ingestion
/.github @akash-jain-10 @open-metadata/mergers
.github/scripts/*playwright*                  @chirag-madlani # UI owns Playwright CI
*.md @docs-team docs@example.com
docs/* @docs-top
apps/ @apps-team
**/logs @logs-team
/apps/github
"""
RULES = registry.parse_codeowners(CODEOWNERS)


@pytest.fixture(autouse=True)
def environment(monkeypatch):
    monkeypatch.setenv("GH_TOKEN", "t")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.delenv(registry.MODE_ENV, raising=False)


def iso(moment):
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def blob_sha(text):
    data = text.encode()
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def wrapped_base64(data):
    encoded = base64.b64encode(data).decode()
    return "\n".join(encoded[i : i + 60] for i in range(0, len(encoded), 60)) + "\n"


def api_issue(number, body, *, title="Flaky: x", state="open", labels=("flaky-test",), state_reason=None, closed_at=None, updated_at=None):
    return {
        "url": f"https://api.github.com/repos/o/r/issues/{number}",
        "html_url": f"https://github.com/o/r/issues/{number}",
        "number": number,
        "title": title,
        "state": state,
        "state_reason": state_reason,
        "body": body,
        "user": {"login": "merge-gate[bot]", "type": "Bot"},
        "labels": [{"id": 9000 + i, "name": name, "color": "d73a4a", "default": False} for i, name in enumerate(labels)],
        "comments": 0,
        "created_at": iso(NOW - timedelta(days=10)),
        "updated_at": iso(updated_at or NOW - timedelta(days=1)),
        "closed_at": iso(closed_at) if closed_at else None,
    }


def record(fp=FP, test=JAVA_ID, parent=PARENT, parent_failed=None, parent_runs=None, cls="flaky", prs=(35297,), pr=35297, run_id=500, attempt=1, ts=NOW, entry_failed=0, entry_runs=3):
    return {
        "ts": iso(ts),
        "testId": test,
        "fingerprint": fp,
        "class": cls,
        "runId": run_id,
        "runAttempt": attempt,
        "entrySha": HEAD,
        "entryFailed": entry_failed,
        "entryRuns": entry_runs,
        "parentSha": parent,
        "parentFailed": parent_failed,
        "parentRuns": parent_runs,
        "pr": pr,
        "prs": None if prs is None else list(prs),
    }


def line(item):
    return json.dumps(item, sort_keys=True, separators=(",", ":")) + "\n"


def occurrence(test=JAVA_ID, fp=FP, cls="flaky", run_id=500, pr=35297, prs=(35297, 35301), parent=None, ts=NOW, created=None, let_through=True, mode="enforce", error="expected <2> but was <0>"):
    return {
        "ts": iso(ts),
        "testId": registry.clean_text(test, registry.MAX_TEST_ID_CHARS),
        "fingerprint": fp,
        "suite": registry.infer_suite(test),
        "class": cls,
        "runId": run_id,
        "runAttempt": 1,
        "runCreatedAt": iso(created) if created else None,
        "entrySha": HEAD,
        "pr": pr,
        "prs": list(prs),
        "mode": mode,
        "entry": {"failed": 0 if cls == "flaky" else 1, "runs": 3 if cls == "flaky" else 1},
        "parent": parent,
        "parentSha": PARENT if parent else None,
        "error": registry.clean_text(error, registry.MAX_ERROR_CHARS),
        "letThrough": let_through,
    }


def issue_body(*occurrences):
    stats = None
    for item in occurrences:
        stats, _ = registry.merge_stats(stats, item, owners=[], owner_path="", repository="o/r")
    return registry.render_issue_body(stats)


def outside_code(markdown):
    """What GitHub renders as prose: not the JSON fence, a code span or an HTML comment."""
    text = re.sub(r"```.*?```", "", markdown, flags=re.DOTALL)
    text = re.sub(r"`[^`\n]*`", "", text)
    return re.sub(r"<!--.*?--!?>", "", text, flags=re.DOTALL)


class FakeGitHub:
    """Issues and the ledger file on its data branch, read through mq.rest and written
    through registry.send, with GitHub's response shapes and its compare-and-swap."""

    def __init__(self, monkeypatch, issues=(), ledger=None, branch=True):
        self.issues = {issue["number"]: issue for issue in issues}
        self.comments = []
        self.searches = []
        self.writes = []
        self.branch = branch
        self.ledger, self.ledger_sha = None, None
        if ledger is not None:
            self.store(ledger)
        self.concurrent_writes = 0
        self.trees, self.commits = {}, {}
        monkeypatch.setattr(mq, "rest", self.rest)
        monkeypatch.setattr(registry, "send", self.send)

    def store(self, text):
        self.ledger, self.ledger_sha = text, blob_sha(text)

    def rest(self, path, token):
        parts = urlsplit(path)
        query = {key: values[0] for key, values in parse_qs(parts.query).items()}
        if parts.path == "/repos/o/r/issues":
            assert query["state"] == "all"
            labelled = [i for i in self.issues.values() if query["labels"] in {label["name"] for label in i["labels"]}]
            labelled.sort(key=lambda i: i["updated_at"], reverse=True)
            page, size = int(query["page"]), int(query["per_page"])
            return labelled[(page - 1) * size : page * size]
        if parts.path == "/search/issues":
            self.searches.append(query["q"])
            needle = query["q"].split('"')[1]
            items = [i for i in self.issues.values() if needle in (i["body"] or "")]
            return {"total_count": len(items), "incomplete_results": False, "items": items}
        if parts.path == "/repos/o/r/contents/ledger.jsonl":
            assert query["ref"] == "ci/merge-gate"
            if not self.branch or self.ledger is None:
                raise mq.ApiError(f"HTTP 404 Not Found for https://api.github.com{path}", 404)
            data = self.ledger.encode()
            meta = {
                "type": "file",
                "name": "ledger.jsonl",
                "path": "ledger.jsonl",
                "size": len(data),
                "sha": self.ledger_sha,
                "url": "https://api.github.com/repos/o/r/contents/ledger.jsonl?ref=ci/merge-gate",
            }
            if len(data) > 1024 * 1024:
                return {**meta, "encoding": "none", "content": ""}
            return {**meta, "encoding": "base64", "content": wrapped_base64(data)}
        if parts.path == f"/repos/o/r/git/blobs/{self.ledger_sha}":
            data = self.ledger.encode()
            return {"sha": self.ledger_sha, "size": len(data), "encoding": "base64", "content": wrapped_base64(data)}
        if parts.path == "/repos/o/r/git/ref/heads/ci/merge-gate":
            if not self.branch:
                raise mq.ApiError(f"HTTP 404 Not Found for https://api.github.com{path}", 404)
            return {"ref": "refs/heads/ci/merge-gate", "object": {"sha": "c" * 40, "type": "commit"}}
        raise AssertionError(f"unexpected GET {path}")

    def send(self, method, path, body, token):
        self.writes.append((method, path, body))
        if (method, path) == ("POST", "/repos/o/r/issues"):
            number = max(self.issues, default=100) + 1
            self.issues[number] = api_issue(number, body["body"], title=body["title"], labels=body["labels"], updated_at=NOW)
            return self.issues[number]
        if method == "PATCH" and re.fullmatch(r"/repos/o/r/issues/\d+", path):
            issue = self.issues[int(path.rsplit("/", 1)[1])]
            issue.update({key: body[key] for key in ("title", "body") if key in body})
            if body.get("state") == "open":
                issue.update(state="open", state_reason="reopened", closed_at=None)
            issue["updated_at"] = iso(NOW)
            return issue
        if method == "POST" and path.endswith("/comments"):
            self.comments.append((int(path.split("/")[-2]), body["body"]))
            return {"id": 1, "body": body["body"]}
        if method == "POST" and path.endswith("/labels"):
            issue = self.issues[int(path.split("/")[-2])]
            names = [label["name"] for label in issue["labels"]]
            issue["labels"] += [{"name": name} for name in body["labels"] if name not in names]
            return issue["labels"]
        if (method, path) == ("PUT", "/repos/o/r/contents/ledger.jsonl"):
            assert body["branch"] == "ci/merge-gate"
            if self.concurrent_writes:
                self.concurrent_writes -= 1
                # Another controller's append lands between this one's read and write.
                self.store((self.ledger or "") + line(record(fp="feedface0001", run_id=999)))
            if self.ledger is not None and "sha" not in body:
                raise mq.ApiError(f'HTTP 422 Unprocessable Entity for PUT {path}: Invalid request. "sha" wasn\'t supplied.', 422)
            if body.get("sha") != self.ledger_sha:
                raise mq.ApiError(f"HTTP 409 Conflict for PUT {path}: ledger.jsonl does not match {body.get('sha')}", 409)
            self.store(base64.b64decode(body["content"]).decode())
            return {"content": {"name": "ledger.jsonl", "sha": self.ledger_sha}, "commit": {"sha": "d" * 40}}
        if (method, path) == ("POST", "/repos/o/r/git/trees"):
            sha = f"{len(self.trees) + 1:040x}"
            self.trees[sha] = body["tree"][0]["content"]
            return {"sha": sha, "tree": [{"path": "ledger.jsonl", "type": "blob"}]}
        if (method, path) == ("POST", "/repos/o/r/git/commits"):
            sha = f"{len(self.commits) + 100:040x}"
            self.commits[sha] = body
            return {"sha": sha, "parents": body["parents"]}
        if (method, path) == ("POST", "/repos/o/r/git/refs"):
            if self.branch:
                raise mq.ApiError(f"HTTP 422 Unprocessable Entity for POST {path}: Reference already exists", 422)
            self.branch = True
            self.store(self.trees[self.commits[body["sha"]]["tree"]])
            return {"ref": body["ref"], "object": {"sha": body["sha"], "type": "commit"}}
        raise AssertionError(f"unexpected {method} {path}")


# ------------------------------------------------------------------ issues


def test_a_new_fingerprint_opens_one_labelled_issue_carrying_its_marker_and_stats(monkeypatch):
    fake = FakeGitHub(monkeypatch)
    result = registry.upsert_issue("o", "r", occurrence(), "t", rules=RULES)

    [issue] = fake.issues.values()
    assert result == {"fingerprint": FP, "testId": JAVA_ID, "action": "create", "number": issue["number"], "kind": "flaky-test"}
    assert issue["title"] == f"Flaky: {JAVA_ID}"
    assert [label["name"] for label in issue["labels"]] == ["flaky-test"]
    assert issue["body"].startswith(f"<!-- merge-gate-fingerprint: {FP} -->\n")
    assert "https://github.com/o/r/actions/runs/500" in issue["body"]
    stats = registry.parse_issue_body(issue["body"])
    assert (stats["occurrenceCount"], stats["prsLetThrough"], stats["classes"]) == (1, [35297], {"flaky": 1})
    assert stats["occurrences"][0]["prs"] == [35297, 35301]
    assert stats["ownerPath"] == "openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/TestCaseResourceIT.java"


def test_a_known_fingerprint_updates_its_open_issue_and_a_rerun_controller_counts_once(monkeypatch):
    fake = FakeGitHub(monkeypatch, issues=[api_issue(7, issue_body(occurrence(run_id=400, pr=35100)))])

    result = registry.upsert_issue("o", "r", occurrence(run_id=500), "t", rules=RULES)
    assert (result["action"], result["number"]) == ("update", 7)
    [(method, path, body)] = fake.writes
    assert (method, path, set(body)) == ("PATCH", "/repos/o/r/issues/7", {"body"})
    stats = registry.parse_issue_body(fake.issues[7]["body"])
    assert stats["occurrenceCount"] == 2
    assert stats["prsLetThrough"] == [35100, 35297]
    assert [o["runId"] for o in stats["occurrences"]] == [400, 500]

    fake.writes.clear()
    again = registry.upsert_issue("o", "r", occurrence(run_id=500), "t", rules=RULES)
    assert again["action"] == "unchanged"
    assert fake.writes == []


def test_a_fingerprint_that_recurs_after_its_fix_reopens_the_issue_with_a_note(monkeypatch):
    closed = api_issue(
        9,
        issue_body(occurrence(run_id=400, ts=NOW - timedelta(days=5))),
        state="closed",
        state_reason="completed",
        closed_at=NOW - timedelta(days=2),
    )
    fake = FakeGitHub(monkeypatch, issues=[closed])

    result = registry.upsert_issue("o", "r", occurrence(run_id=500, created=NOW - timedelta(hours=1)), "t", rules=RULES)

    assert result["action"] == "reopen"
    assert fake.issues[9]["state"] == "open"
    [(number, comment)] = fake.comments
    assert number == 9
    assert comment.startswith("Recurred after fix")
    assert "https://github.com/o/r/actions/runs/500" in comment
    stats = registry.parse_issue_body(fake.issues[9]["body"])
    assert (stats["reopenedCount"], stats["occurrenceCount"]) == (1, 2)
    assert "Recurred after a fix:** 1 time(s)" in fake.issues[9]["body"]


@pytest.mark.parametrize(
    "reason, run_created",
    [
        ("completed", NOW - timedelta(days=3)),  # the run was already going when the fix merged
        ("not_planned", NOW - timedelta(hours=1)),  # a person closed it on purpose
    ],
)
def test_a_closed_issue_stays_closed_when_the_run_predates_the_fix_or_a_person_closed_it(monkeypatch, reason, run_created):
    closed = api_issue(
        9,
        issue_body(occurrence(run_id=400, ts=NOW - timedelta(days=5))),
        state="closed",
        state_reason=reason,
        closed_at=NOW - timedelta(days=2),
    )
    fake = FakeGitHub(monkeypatch, issues=[closed])

    result = registry.upsert_issue("o", "r", occurrence(run_id=500, created=run_created), "t", rules=RULES)

    assert result["action"] == "update-closed"
    assert fake.issues[9]["state"] == "closed"
    assert fake.comments == []
    assert registry.parse_issue_body(fake.issues[9]["body"])["occurrenceCount"] == 2


def test_a_flaky_issue_escalates_to_broken_main_and_keeps_the_labels_people_added(monkeypatch):
    issue = api_issue(7, issue_body(occurrence(run_id=400)), title=f"Flaky: {JAVA_ID}", labels=("flaky-test", "area:backend"))
    fake = FakeGitHub(monkeypatch, issues=[issue])
    on_main = occurrence(run_id=500, cls="pre-existing", prs=(35297,), pr=35297, parent={"failed": 1, "runs": 1})

    result = registry.upsert_issue("o", "r", on_main, "t", rules=RULES)

    assert result["kind"] == "broken-main"
    assert [label["name"] for label in fake.issues[7]["labels"]] == ["flaky-test", "area:backend", "broken-main"]
    assert fake.issues[7]["title"] == f"Broken on main: {JAVA_ID}"
    assert "**Broken on main:**" in fake.issues[7]["body"]


def test_only_a_labelled_issue_whose_hidden_marker_names_the_fingerprint_matches(monkeypatch):
    body = issue_body(occurrence())
    fake = FakeGitHub(
        monkeypatch,
        issues=[
            api_issue(1, f"Seen {FP} in a log; see `merge-gate-fingerprint: {FP}`"),
            {**api_issue(2, body), "pull_request": {"url": "https://api.github.com/repos/o/r/pulls/2"}},
            api_issue(3, body.replace(FP, FP2)),
            api_issue(4, body, state="closed", state_reason="completed", closed_at=NOW - timedelta(days=1), updated_at=NOW - timedelta(hours=1)),
            api_issue(5, body, updated_at=NOW - timedelta(days=3)),
        ],
    )
    assert registry.find_issue("o", "r", FP, "t").number == 5  # open beats a more recent closed copy
    assert registry.find_issue("o", "r", FP2, "t").number == 3
    assert registry.find_issue("o", "r", "feedfacecafe", "t") is None
    assert registry.find_issue("o", "r", "zz -->", "t") is None
    assert fake.searches == []  # the listing was complete, so a miss is conclusive


def test_the_search_api_is_asked_only_when_the_label_listing_was_cut_short(monkeypatch):
    recent = [
        api_issue(n, registry.MARKER.format(f"{n:012x}"), updated_at=NOW - timedelta(minutes=n))
        for n in range(1, 1 + 100 * registry.ISSUE_LIST_PAGES)
    ]
    old = api_issue(9000, issue_body(occurrence()), state="closed", state_reason="completed", closed_at=NOW - timedelta(days=200), updated_at=NOW - timedelta(days=200))
    fake = FakeGitHub(monkeypatch, issues=recent + [old])

    listing = registry.list_registry_issues("o", "r", "t")
    assert not listing.complete
    assert registry.find_issue("o", "r", FP, "t", listing).number == 9000
    assert registry.find_issue("o", "r", FP, "t", listing).number == 9000
    [query] = fake.searches
    assert query == f'repo:o/r is:issue in:body "{FP}"'


def test_shadow_decisions_record_the_occurrence_but_let_no_pr_through(monkeypatch):
    fake = FakeGitHub(monkeypatch)
    registry.upsert_issue("o", "r", occurrence(mode="shadow", let_through=False), "t", rules=RULES)
    [issue] = fake.issues.values()
    stats = registry.parse_issue_body(issue["body"])
    assert (stats["occurrenceCount"], stats["prsLetThrough"]) == (1, [])
    assert "PRs let through:** none (decisions in shadow mode merge nothing)" in issue["body"]


@pytest.mark.parametrize("test_id", [HOSTILE, PW_TAGGED])
def test_test_names_cannot_mention_link_break_out_or_forge_a_marker(monkeypatch, test_id):
    fake = FakeGitHub(monkeypatch)
    registry.upsert_issue("o", "r", occurrence(test=test_id), "t", rules=RULES)
    [issue] = fake.issues.values()
    title, body = issue["title"], issue["body"]

    for text in (title, outside_code(body)):
        assert not re.search(r"@(user|domain-isolation)\b", text)
        assert "<!channel>" not in text and "#123" not in text
    assert "`" not in title and "<" not in title and "\n" not in title
    assert "‮" not in body and "<!channel>" not in body
    assert registry.MARKER_RE.findall(body) == [FP]
    stats = registry.parse_issue_body(body)
    assert "`" not in stats["testId"]
    if test_id == HOSTILE:
        assert "&lt;!channel&gt;" in stats["testId"] and "\n" not in stats["testId"]
    else:
        assert stats["owners"] == ["@chirag-madlani", "@karanh37"]


def test_owners_are_listed_without_a_ping_unless_asked():
    stats, _ = registry.merge_stats(
        None, occurrence(test=PW_ID), owners=["@chirag-madlani"], owner_path=f"{registry.E2E_ROOT}/Pages/PersonaSettings.spec.ts", repository="o/r"
    )
    assert "- **Owning team:** `@chirag-madlani` (CODEOWNERS for" in registry.render_issue_body(stats)
    assert "- **Owning team:** @chirag-madlani (CODEOWNERS for" in registry.render_issue_body(stats, mention_owners=True)


def test_issue_stats_round_trip_through_the_body_and_stay_bounded():
    long_id = "org.openmetadata.it.tests." + "Very" * 200 + "LongIT#t"
    stats = None
    for run in range(1, 61):
        item = occurrence(test=long_id, run_id=run, pr=1000 + run, prs=range(40000, 40100), ts=NOW + timedelta(minutes=run), error="x" * 5000)
        stats, _ = registry.merge_stats(stats, item, owners=["@open-metadata/backend"], owner_path="openmetadata-service/A.java", repository="o/r")

    assert stats["occurrenceCount"] == 60
    assert [o["runId"] for o in stats["occurrences"]] == list(range(41, 61))
    assert stats["prsLetThrough"] == list(range(1011, 1061))
    assert len(stats["testId"]) == registry.MAX_TEST_ID_CHARS and stats["testId"].endswith("…")
    assert len(stats["lastError"]) == registry.MAX_ERROR_CHARS
    body = registry.render_issue_body(stats)
    assert len(body) < 65_536
    assert len(registry.issue_title(stats)) <= registry.MAX_TITLE_CHARS
    assert registry.parse_issue_body(body) == stats
    # A person who breaks the JSON costs the count, never the issue or the gate.
    assert registry.parse_issue_body(body.replace('"occurrenceCount": 60', '"occurrenceCount": 60 oops')) is None
    assert registry.parse_issue_body("no marker here") is None


# ---------------------------------------------------------------- CODEOWNERS


def test_owners_come_from_the_last_matching_codeowners_rule(tmp_path):
    module = tmp_path / "ingestion" / "tests" / "integration" / "profiler" / "test_median.py"
    module.parent.mkdir(parents=True)
    module.write_text("")

    def team(test_id, suite):
        return registry.owning_team(test_id, suite, RULES, root=tmp_path)

    assert team(PW_ID, "playwright") == (["@chirag-madlani", "@karanh37"], f"{registry.E2E_ROOT}/Pages/PersonaSettings.spec.ts")
    assert team("chromium :: playwright/e2e/Flow/A.spec.ts :: t", "playwright")[1] == f"{registry.E2E_ROOT}/Flow/A.spec.ts"
    assert team("tests.integration.profiler.test_median.TestMedian#test_a[mysql]", "python") == (
        ["@open-metadata/ingestion"],
        "ingestion/tests/integration/profiler/test_median.py",
    )
    # Java ITs live in a module CODEOWNERS does not list: a known path, no owner.
    assert team("org.openmetadata.it.tests.FooIT$Nested#t(TestNamespace)", "java-it") == (
        [],
        "openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/FooIT.java",
    )
    assert team("chromium :: ../../etc/passwd :: t", "playwright") == ([], "")

    def owners(path):
        return registry.owners_for(path, RULES)

    assert owners("openmetadata-ui/src/main/resources/ui/src/generated/entity/table.ts") == ()
    assert owners(".github/scripts/build_playwright_shards.py") == ("@chirag-madlani",)
    assert owners(".github/scripts/merge_gate.py") == ("@akash-jain-10", "@open-metadata/mergers")
    assert owners("connectors/README.md") == ("@docs-team",)  # unanchored; the email owner is dropped
    assert owners("docs/guide.md") == ("@docs-top",)
    assert owners("docs/nested/guide.txt") == ()  # `docs/*` owns direct children only
    assert owners("services/apps/api/main.py") == ("@apps-team",)
    assert owners("build/deep/logs/out.txt") == ("@logs-team",)
    assert owners("apps/github/x.py") == ()  # an ownerless rule unowns


def test_the_repository_codeowners_file_parses_and_owns_the_ui_specs():
    rules = registry.load_codeowners()
    owners, path = registry.owning_team(PW_ID, "playwright", rules)
    assert path.startswith(registry.E2E_ROOT) and owners
    assert all(registry.OWNER_RE.fullmatch(owner) for owner in owners)


# ------------------------------------------------------------------- ledger


def test_the_ledger_keeps_thirty_days_and_drops_the_oldest_past_either_cap():
    records = [record(run_id=n + 1, ts=NOW - timedelta(days=40 - n)) for n in range(40)]

    assert [r["runId"] for r in registry.prune_ledger(records, NOW)] == list(range(11, 41))
    assert [r["runId"] for r in registry.prune_ledger(records, NOW, max_records=5)] == list(range(36, 41))
    newest = records[-3:]
    assert registry.prune_ledger(records, NOW, max_bytes=sum(len(line(r)) for r in newest)) == newest
    assert registry.prune_ledger([{"ts": "yesterday"}, record(ts=NOW + timedelta(days=3))], NOW) == []


def test_the_first_append_creates_the_data_branch_as_an_orphan_commit(monkeypatch):
    fake = FakeGitHub(monkeypatch, branch=False)
    assert registry.ledger_read("o", "r", "t") == []

    result = registry.ledger_append("o", "r", [record()], "t", now=NOW)

    assert result["appended"] == 1
    assert [(method, path) for method, path, _ in fake.writes] == [
        ("POST", "/repos/o/r/git/trees"),
        ("POST", "/repos/o/r/git/commits"),
        ("POST", "/repos/o/r/git/refs"),
    ]
    assert fake.writes[1][2]["parents"] == []
    assert fake.writes[2][2]["ref"] == "refs/heads/ci/merge-gate"
    assert registry.ledger_read("o", "r", "t") == [record()]


def test_an_existing_branch_without_the_file_gets_it_created_without_a_sha(monkeypatch):
    fake = FakeGitHub(monkeypatch, branch=True)
    registry.ledger_append("o", "r", [record()], "t", now=NOW)
    [(method, _, body)] = fake.writes
    assert method == "PUT" and "sha" not in body


def test_a_write_that_loses_the_race_rereads_and_keeps_both_appends(monkeypatch):
    fake = FakeGitHub(monkeypatch, ledger=line(record(run_id=1)))
    fake.concurrent_writes = 1

    result = registry.ledger_append("o", "r", [record(run_id=2)], "t", now=NOW)

    assert result["attempts"] == 2
    first, second = [body for method, _, body in fake.writes if method == "PUT"]
    assert first["sha"] != second["sha"]
    assert [r["runId"] for r in registry.ledger_read("o", "r", "t")] == [1, 999, 2]


def test_the_ledger_gives_up_after_three_retries_and_says_why(monkeypatch):
    fake = FakeGitHub(monkeypatch, ledger=line(record(run_id=1)))
    fake.concurrent_writes = 10

    with pytest.raises(mq.ApiError) as raised:
        registry.ledger_append("o", "r", [record(run_id=2)], "t", now=NOW)

    assert raised.value.status == 409
    assert sum(method == "PUT" for method, _, _ in fake.writes) == 1 + registry.LEDGER_CONFLICT_RETRIES


def test_a_rerun_controller_appends_nothing_twice(monkeypatch):
    fake = FakeGitHub(monkeypatch, ledger=line(record(run_id=500)))
    assert registry.ledger_append("o", "r", [record(run_id=500)], "t", now=NOW)["appended"] == 0
    assert fake.writes == []


def test_a_ledger_over_one_megabyte_is_read_through_the_blob_api(monkeypatch):
    text = "".join(line(record(run_id=n + 1, test=f"org.openmetadata.it.tests.Generated{n:05d}IT#t")) for n in range(4000))
    assert len(text) > 1024 * 1024
    FakeGitHub(monkeypatch, ledger=text)
    assert len(registry.ledger_read("o", "r", "t")) == 4000


def test_unreadable_lines_are_dropped_not_fatal():
    text = line(record(run_id=1)) + "{not json\n" + line({**record(run_id=2), "fingerprint": "-->"}) + "[1,2]\n" + line(record(run_id=3))
    assert [r["runId"] for r in registry.parse_ledger(text)] == [1, 3]


def test_a_parent_control_is_reused_only_for_the_same_test_failure_and_parent():
    records = [
        record(cls="introduced", entry_failed=3, parent_failed=0, parent_runs=3, run_id=1),
        record(fp=FP2, cls="pre-existing", entry_failed=1, entry_runs=1, parent_failed=1, parent_runs=1, run_id=2),
        record(parent=OTHER_PARENT, cls="pre-existing", parent_failed=1, parent_runs=1, run_id=3),
        record(run_id=4),  # flaky: the parent control never ran
    ]
    assert registry.ledger_lookup(records, JAVA_ID, FP, PARENT) == {"failed": 0, "runs": 3, "problems": [], "reusedFrom": [1]}
    assert registry.ledger_lookup(records, JAVA_ID, FP2, PARENT)["failed"] == 1  # one failure is conclusive
    assert registry.ledger_lookup(records, JAVA_ID, FP, "f" * 40) is None
    assert registry.ledger_lookup(records, LINEAGE_ID, FP, PARENT) is None
    assert registry.ledger_lookup(records, JAVA_ID, FP, "not-a-sha") is None

    short = [record(parent_failed=0, parent_runs=2, run_id=5)]
    assert registry.ledger_lookup(short, JAVA_ID, FP, PARENT) is None  # fewer runs than a fresh control
    pooled = short + [record(parent_failed=0, parent_runs=1, run_id=6)]
    assert registry.ledger_lookup(pooled, JAVA_ID, FP, PARENT)["reusedFrom"] == [5, 6]

    raw = "chromium :: A.spec.ts :: renders <b> & co"
    stored = [record(test=registry.clean_text(raw, registry.MAX_TEST_ID_CHARS), parent_failed=1, parent_runs=1)]
    assert registry.ledger_lookup(stored, raw, FP, PARENT)["failed"] == 1  # raw ids find their cleaned form


def test_independent_history_counts_only_failures_this_entrys_prs_cannot_explain():
    entry_prs = {35297, 35301}
    records = [
        record(fp="aaaaaaaa0001", prs=(35301, 35400), pr=35400),  # shares 35301
        record(fp="aaaaaaaa0002", prs=(35100,), pr=35100),  # disjoint
        record(fp="aaaaaaaa0003", prs=(), pr=None),  # main
        record(fp="aaaaaaaa0004", prs=(35200,), pr=35200, cls="introduced", entry_failed=3, parent_failed=0, parent_runs=3),
        record(fp="aaaaaaaa0005", prs=None),  # PR set unknown
        # Failed on the parent too, which held only 35500.
        record(fp="aaaaaaaa0006", prs=(35301, 35500), pr=35301, cls="pre-existing", parent_failed=1, parent_runs=1),
        record(fp="aaaaaaaa0007", prs=(35297, 35500), pr=35500, cls="pre-existing", parent_failed=1, parent_runs=1),
        record(fp="aaaaaaaa0008", prs=(35100,), pr=35100),  # disjoint, but not asked about
    ]
    asked = [f"aaaaaaaa000{n}" for n in range(1, 8)]
    assert registry.independent_history(records, asked, entry_prs) == {"aaaaaaaa0002", "aaaaaaaa0003", "aaaaaaaa0006"}
    assert registry.independent_history(records, asked, {35999}) >= {"aaaaaaaa0001", "aaaaaaaa0007"}

    stats, _ = registry.merge_stats(None, occurrence(prs=(35100,), pr=35100), owners=[], owner_path="", repository="o/r")
    assert registry.independent_history(stats["occurrences"], [FP], entry_prs) == {FP}


# ------------------------------------------------------------------- record


def write_inputs(tmp_path, *, verdict="pass", mode="enforce", forgiven=None, tests=None, attempt="1", prs=(35297,)):
    tests = tests if tests is not None else [
        {"id": JAVA_ID, "fingerprint": FP, "entry": {"failed": 0, "runs": 3}, "parent": None, "problems": []},
        {"id": LINEAGE_ID, "fingerprint": FP2, "entry": {"failed": 3, "runs": 3}, "parent": {"failed": 1, "runs": 1}, "problems": []},
    ]
    forgiven = forgiven if forgiven is not None else [
        {"test": JAVA_ID, "class": "flaky", "fingerprint": FP, "entry": "0/3 failed"},
        {"test": LINEAGE_ID, "class": "pre-existing", "fingerprint": FP2, "entry": "3/3 failed", "parent": "1/1 failed"},
    ]
    payload = {
        "context": {
            "runId": 500,
            "headSha": HEAD,
            "parentSha": PARENT,
            "mode": mode,
            "pr": 35297,
            "attempt": 1,
            "prs": list(prs),
            "changedFiles": 4,
            "truncatedDiff": False,
            "fingerprints": {JAVA_ID: FP, LINEAGE_ID: FP2},
        },
        "decision": {"verdict": verdict, "summary": "s", "reasons": [], "forgiven": forgiven, "blocking": [], "rerunJobs": [], "alert": False},
    }
    decision = tmp_path / "decision.json"
    decision.write_text(json.dumps(payload))
    verify = tmp_path / "verify" / f"verify-java-it-a{attempt}"
    verify.mkdir(parents=True)
    (verify / "verify.json").write_text(
        json.dumps({"schemaVersion": 1, "runId": "500", "runAttempt": attempt, "parentSha": PARENT, "skipped": "", "tests": tests})
    )
    return decision, tmp_path / "verify"


def run(tmp_path, *args):
    decision, verify = tmp_path / "decision.json", tmp_path / "verify"
    return registry.main(["--owner", "o", "--repo", "r", "--out", str(tmp_path / "report.json"), *args, "record", "--decision", str(decision), "--verify-dir", str(verify)])


def test_on_appends_every_verified_test_and_files_each_forgiven_one_by_kind(monkeypatch, tmp_path):
    write_inputs(tmp_path)
    fake = FakeGitHub(monkeypatch)
    monkeypatch.setenv(registry.MODE_ENV, "on")

    assert run(tmp_path) == 0

    ledger = registry.ledger_read("o", "r", "t")
    assert [(r["testId"], r["class"]) for r in ledger] == [(JAVA_ID, "flaky"), (LINEAGE_ID, "pre-existing")]
    assert (ledger[1]["parentSha"], ledger[1]["parentFailed"], ledger[1]["parentRuns"], ledger[1]["prs"]) == (PARENT, 1, 1, [35297])
    issues = {issue["title"]: [label["name"] for label in issue["labels"]] for issue in fake.issues.values()}
    # The entry was built on main (its PR set is its own PR), so a failure that also
    # failed on its parent is failing on main.
    assert issues == {f"Flaky: {JAVA_ID}": ["flaky-test"], f"Broken on main: {LINEAGE_ID}": ["broken-main"]}
    report = json.loads((tmp_path / "report.json").read_text())
    assert [(i["action"], i["kind"]) for i in report["issues"]] == [("create", "flaky-test"), ("create", "broken-main")]
    assert report["errors"] == []


def test_an_ejected_entry_leaves_its_controls_on_the_ledger_but_files_no_issue(monkeypatch, tmp_path):
    introduced = {"id": LINEAGE_ID, "fingerprint": FP2, "entry": {"failed": 3, "runs": 3}, "parent": {"failed": 0, "runs": 3}, "problems": []}
    write_inputs(tmp_path, verdict="fail", forgiven=[], tests=[introduced])
    fake = FakeGitHub(monkeypatch)
    monkeypatch.setenv(registry.MODE_ENV, "on")

    assert run(tmp_path) == 0

    assert fake.issues == {}
    [entry] = registry.ledger_read("o", "r", "t")
    assert (entry["class"], entry["parentFailed"], entry["parentRuns"]) == ("introduced", 0, 3)
    assert registry.ledger_lookup([entry], LINEAGE_ID, FP2, PARENT)["runs"] == 3


def test_dry_run_is_the_default_reads_everything_and_prints_each_write(monkeypatch, tmp_path, capsys):
    write_inputs(tmp_path)
    FakeGitHub(monkeypatch, branch=False)
    monkeypatch.setattr(registry, "send", lambda *args: pytest.fail("a dry run must not write"))

    assert run(tmp_path) == 0

    out = capsys.readouterr().out
    assert "[dry-run] POST /repos/o/r/git/refs (create ci/merge-gate: +2 record(s)" in out
    assert out.count("[dry-run] POST /repos/o/r/issues (create ") == 2
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["mode"] == "dry-run"
    assert [call["method"] for call in report["calls"]] == ["POST"] * 5


def test_off_reads_and_writes_nothing(monkeypatch, tmp_path):
    monkeypatch.setenv(registry.MODE_ENV, "off")
    monkeypatch.delenv("GH_TOKEN")
    monkeypatch.setattr(mq, "rest", lambda *args: pytest.fail("off must not read GitHub"))
    monkeypatch.setattr(registry, "send", lambda *args: pytest.fail("off must not write"))

    assert run(tmp_path) == 0
    assert json.loads((tmp_path / "report.json").read_text())["skipped"] == "MERGE_GATE_REGISTRY=off"


def test_an_unknown_mode_fails_rather_than_guessing(monkeypatch, tmp_path):
    write_inputs(tmp_path)
    monkeypatch.setenv(registry.MODE_ENV, "enabled")
    assert run(tmp_path) == 1


def test_verify_documents_of_another_attempt_or_parent_are_not_trusted():
    payload = {
        "context": {"runId": 500, "attempt": 2, "headSha": HEAD, "parentSha": PARENT, "pr": 35297, "prs": [35297], "mode": "enforce"},
        "decision": {"verdict": "fail", "forgiven": []},
    }
    stale = {"runId": "500", "runAttempt": "1", "parentSha": PARENT, "suite": "java-it", "tests": [
        {"id": "org.x.StaleIT#t", "fingerprint": FP, "entry": {"failed": 0, "runs": 3}, "parent": None},
    ]}
    elsewhere = {"runId": "500", "runAttempt": "2", "parentSha": OTHER_PARENT, "suite": "java-it", "tests": [
        {"id": LINEAGE_ID, "fingerprint": FP2, "entry": {"failed": 1, "runs": 1}, "parent": {"failed": 1, "runs": 1}},
    ]}

    observations, occurrences, notes = registry.collect(payload, [stale, elsewhere], NOW)

    [observation] = observations
    assert observation["testId"] == LINEAGE_ID
    assert (observation["parent"], observation["parentSha"]) == (None, None)
    assert occurrences == [] and "another commit" in notes[0]


def test_a_truncated_entry_diff_records_no_pr_set():
    payload = {
        "context": {"runId": 500, "attempt": 1, "pr": 35297, "prs": [35297], "truncatedDiff": True},
        "decision": {"verdict": "fail", "forgiven": []},
    }
    document = {"runId": 500, "runAttempt": 1, "tests": [{"id": JAVA_ID, "fingerprint": FP, "entry": {"failed": 0, "runs": 3}}]}
    [observation], _, _ = registry.collect(payload, [document], NOW)
    assert observation["prs"] is None
    assert registry.independent_history([registry.ledger_record(observation)], [FP], {1}) == frozenset()


def write_outcome(directory, name, flaky, run_id="500", attempt="1"):
    folder = directory / name
    folder.mkdir(parents=True)
    (folder / "outcome.json").write_text(
        json.dumps({"classification": "passed", "flakyTests": flaky, "context": {"runId": run_id, "runAttempt": attempt}})
    )


def test_a_test_that_passed_only_on_its_in_job_rerun_is_filed_as_flaky(monkeypatch, tmp_path):
    write_inputs(tmp_path, forgiven=[], tests=[])
    evidence_dir = tmp_path / "evidence"
    write_outcome(evidence_dir, "evidence-it-postgres-opensearch-parallel-a1", [{"id": LINEAGE_ID, "message": "expected 3 but was 2"}])
    write_outcome(evidence_dir, "evidence-it-postgres-opensearch-rdf-a1", [{"id": "org.x.OldIT#t", "message": "x"}], attempt="2")
    fake = FakeGitHub(monkeypatch)
    monkeypatch.setenv(registry.MODE_ENV, "on")

    args = ["--owner", "o", "--repo", "r", "record", "--decision", str(tmp_path / "decision.json"),
            "--verify-dir", str(tmp_path / "verify"), "--evidence-dir", str(evidence_dir)]
    assert registry.main(args) == 0

    [issue] = fake.issues.values()
    assert issue["title"] == f"Flaky: {LINEAGE_ID}"
    [record] = [r for r in registry.ledger_read("o", "r", "t") if r["testId"] == LINEAGE_ID]
    assert (record["class"], record["entryFailed"], record["entryRuns"], record["parentSha"]) == ("flaky", 1, 2, None)
    # No parent control was run, so the record can never stand in for one.
    assert registry.ledger_lookup([record], LINEAGE_ID, record["fingerprint"], PARENT) is None


def test_an_in_job_flake_in_an_ejected_entry_is_kept_on_the_ledger_without_an_issue():
    payload = {
        "context": {"runId": 500, "attempt": 1, "headSha": HEAD, "parentSha": PARENT, "pr": 35297, "prs": [35297], "mode": "enforce"},
        "decision": {"verdict": "fail", "forgiven": []},
    }
    flaky = [{"id": LINEAGE_ID, "message": "boom", "runId": 500, "runAttempt": 1}]

    [observation], occurrences, _ = registry.collect(payload, [], NOW, flaky)

    assert (observation["class"], observation["entry"]) == ("flaky", {"failed": 1, "runs": 2})
    assert occurrences == []
