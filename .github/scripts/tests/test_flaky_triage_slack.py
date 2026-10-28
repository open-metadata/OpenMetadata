"""Which #pw-health messages the flaky-test triage agent picks up."""

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location(
    "flaky_triage_slack", SCRIPTS / "flaky_triage_slack.py"
)
slack = importlib.util.module_from_spec(spec)
sys.modules["flaky_triage_slack"] = slack
spec.loader.exec_module(slack)

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
    ":red_circle: *Playwright on main* — `failed` at <https://github.com/open-metadata/OpenMetadata/commit/abc|abc>\n"
    "• FAILED `Pages/Users.spec.ts` › create user\n"
    "<https://github.com/open-metadata/OpenMetadata/actions/runs/7|run>"
)


def test_parses_oss_queue_alert():
    alert = slack.parse_alert({"ts": "1.1", "text": OSS_QUEUE})
    assert alert["prs"] == ["36295", "36375"]
    assert alert["tests"] == [
        "Pages/Glossary.spec.ts:120 › Glossary term tabs",
        "Features/DataQuality.spec.ts:44 › pie chart click",
    ]
    assert (
        alert["run"]
        == "https://github.com/open-metadata/OpenMetadata/actions/runs/123/attempts/1"
    )


def test_skips_collate_and_alerts_without_flaky_tests():
    assert slack.parse_alert({"ts": "1", "text": COLLATE_QUEUE}) is None
    assert slack.parse_alert({"ts": "1", "text": OSS_MAIN_FAILED_ONLY}) is None


def test_pending_skips_threads_already_triaged(monkeypatch):
    messages = [
        {"ts": "1", "text": OSS_QUEUE, "reply_count": 1},
        {"ts": "2", "text": OSS_QUEUE, "reply_count": 1},
        {"ts": "3", "text": OSS_QUEUE},
        {"ts": "4", "text": COLLATE_QUEUE},
    ]
    monkeypatch.setattr(slack, "history", lambda channel, hours: messages)
    thread = {"1": [{"text": "*Flaky triage* — done"}], "2": [{"text": "looking"}]}
    alerts = slack.pending("C", 24, fetch_replies=lambda channel, ts: thread[ts])
    assert [a["ts"] for a in alerts] == ["2", "3"]
