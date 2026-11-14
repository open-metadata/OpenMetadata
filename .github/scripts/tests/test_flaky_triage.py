"""What the flaky-test triage agent picks up from #pw-health, and what publish lets through."""

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location(
    "flaky_triage", SCRIPTS / "flaky_triage.py"
)
triage = importlib.util.module_from_spec(spec)
sys.modules["flaky_triage"] = triage
spec.loader.exec_module(triage)

OSS_QUEUE = (
    ":large_yellow_circle: *Merge queue: 2 test(s) passed only on retry* for "
    "<https://github.com/open-metadata/OpenMetadata/pull/36375|#36375>, "
    "<https://github.com/open-metadata/OpenMetadata/pull/36295|#36295>\n"
    "• FLAKY `Pages/Glossary.spec.ts:120 › Glossary term tabs`\n"
    "• FLAKY `Features/DataQuality.spec.ts:44 › pie chart click`\n"
    "<https://github.com/open-metadata/OpenMetadata/actions/runs/123/attempts/1|run>"
)
COLLATE_QUEUE = (
    ":large_yellow_circle: *Merge queue: 1 test(s) passed only on retry* for "
    "<https://github.com/open-metadata/openmetadata-collate/pull/7897|#7897>\n"
    "• FLAKY `Pages/Glossary.spec.ts:120 › Glossary term tabs`\n"
    "<https://github.com/open-metadata/openmetadata-collate/actions/runs/9/attempts/1|run>"
)
OSS_MAIN_FAILED_ONLY = (
    ":red_circle: *Playwright on main* — `failed` at "
    "<https://github.com/open-metadata/OpenMetadata/commit/abc|abc>\n"
    "• FAILED `Pages/Users.spec.ts` › create user\n"
    "<https://github.com/open-metadata/OpenMetadata/actions/runs/7|run>"
)
PW = "openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/Glossary.spec.ts"


def test_parses_oss_queue_alert():
    alert = triage.parse_alert({"ts": "1.1", "text": OSS_QUEUE})
    assert alert["prs"] == ["36295", "36375"]
    assert alert["tests"] == [
        "Pages/Glossary.spec.ts:120 › Glossary term tabs",
        "Features/DataQuality.spec.ts:44 › pie chart click",
    ]
    assert alert["run"].endswith("/actions/runs/123/attempts/1")


def test_skips_collate_and_alerts_without_flaky_tests():
    assert triage.parse_alert({"ts": "1", "text": COLLATE_QUEUE}) is None
    assert triage.parse_alert({"ts": "1", "text": OSS_MAIN_FAILED_ONLY}) is None


def test_collect_keeps_triaged_threads_in_history_only():
    messages = [
        {"ts": "1", "text": OSS_QUEUE, "reply_count": 1},
        {"ts": "2", "text": OSS_QUEUE, "reply_count": 1},
        {"ts": "3", "text": OSS_QUEUE},
        {"ts": "4", "text": COLLATE_QUEUE},
    ]
    thread = {"1": ["*Flaky triage* — fixed by #1"], "2": ["looking"]}
    pending, seen = triage.collect(messages, fetch_replies=thread.__getitem__)
    assert [a["ts"] for a in pending] == ["2", "3"]
    assert [a["ts"] for a in seen] == ["1", "2", "3"]
    assert seen[0]["replies"] == ["*Flaky triage* — fixed by #1"]


def test_fill_links_opened_prs_and_flags_the_rest():
    text = "Fix: {{PR:flaky-fix/a}} / {{PR:flaky-fix/b}}  Owner: {{USER:a@x.io|alice}}"
    filled = triage.fill(
        text, {"flaky-fix/a": "https://pr/1"}, lambda email, login: f"<{login}>", "RUN"
    )
    assert filled == "Fix: https://pr/1 / not opened, see RUN  Owner: <alice>"


def test_fix_problem_only_passes_playwright_changes(tmp_path):
    (tmp_path / "fixes").mkdir()
    (tmp_path / "fixes" / "a.md").write_text("body")
    fix = {
        "branch": "flaky-fix/glossary-tabs",
        "title": "Fix flaky tabs",
        "body": "a.md",
    }
    assert triage.fix_problem(fix, tmp_path, [PW]) is None
    assert "outside" in triage.fix_problem(
        fix, tmp_path, [PW, ".github/workflows/x.yml"]
    )
    assert "nothing" in triage.fix_problem(fix, tmp_path, [])
    assert "branch" in triage.fix_problem({**fix, "branch": "main"}, tmp_path, [PW])
    assert "body" in triage.fix_problem(
        {**fix, "body": "../../etc/passwd"}, tmp_path, [PW]
    )


def test_fix_problem_rejects_code_ci_runs_before_review(tmp_path):
    (tmp_path / "fixes").mkdir()
    (tmp_path / "fixes" / "a.md").write_text("body")
    fix = {"branch": "flaky-fix/a", "title": "Fix flaky a", "body": "a.md"}
    ui = "openmetadata-ui/src/main/resources/ui/playwright/"
    for path in ("eslint-rules/no-x.mjs", "reporters/r.ts", "helper-tests.config.ts"):
        assert "outside" in triage.fix_problem(fix, tmp_path, [ui + path])
    assert triage.fix_problem(fix, tmp_path, [ui + "utils/glossary.ts"]) is None
    assert "safe to test" not in triage.LABELS


def test_publish_still_replies_when_a_fix_cannot_be_opened(tmp_path, monkeypatch):
    (tmp_path / "fixes").mkdir()
    (tmp_path / "replies").mkdir()
    (tmp_path / "fixes" / "a.json").write_text(
        '{"branch": "flaky-fix/a", "title": "t", "body": "a.md"}'
    )
    (tmp_path / "replies" / "1.2.txt").write_text(
        "*Flaky triage* Fix: {{PR:flaky-fix/a}}"
    )

    def missing_branch(*args):
        raise triage.subprocess.CalledProcessError(1, "git", stderr="couldn't find ref")

    posted = []
    monkeypatch.setattr(triage, "git", missing_branch)
    monkeypatch.setattr(triage, "call", lambda method, **kw: posted.append(kw["text"]))
    summary = []
    triage.publish(tmp_path, {"1.2"}, False, "RUN", summary)
    assert posted == ["*Flaky triage* Fix: not opened, see RUN"]
    assert summary[0].startswith("- skipped fix `flaky-fix/a`")
