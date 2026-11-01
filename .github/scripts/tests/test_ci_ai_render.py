"""The advisory comment section: what it always shows, what the model may add, and how
the model's text is disarmed."""

import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))

from ci_ai import bundle, model, render, repro  # noqa: E402

TEST_ID = "org.openmetadata.it.tests.TableResourceIT#patch_tableOwners_200(TestNamespace)"
PLANNER_COMMAND = "mvn -B verify -pl :openmetadata-integration-tests -am -Pmysql-elasticsearch -Dit.test=TableResourceIT#patch_tableOwners_200"


def section(explanation=None, gate_class="introduced", **kwargs):
    test = bundle.BlockingTest(TEST_ID, gate_class, "3/3 failed", "0/3 failed", "f", "java-it")
    result = bundle.Bundle("bundle", [test], 1, frozenset({"src/Table.java", "src/Ahead.java"}), frozenset({"src/Ahead.java"}))
    repros = [repro.Repro(TEST_ID, [PLANNER_COMMAND], "failed in CI on `mysql-elasticsearch`")]
    decision = {"decision": {"verdict": "fail", "blocking": [{"test": TEST_ID}]}}
    return render.render_section(decision, result, repros, explanation, model="claude-opus-5-5", effort="low", **kwargs)


def explanation(verdict="pr_caused", next_step="fix_then_requeue", text="setFields stopped adding owners.", culprits=(("src/Table.java", "drops owners"),)):
    return model.Explanation(verdict, "high", text, next_step, list(culprits))


def test_ai_section_has_the_banner_reading_culprits_repro_and_ci_fix_hint():
    text = section(explanation())

    assert text.startswith(f"{render.MARKER}\n{render.TITLE}\n")
    assert "🤖 Advisory explanation — does not affect merging" in text
    assert "**AI reading:** caused by this PR (high confidence)" in text
    assert "> setFields stopped adding owners." in text
    assert "- `src/Table.java`: drops owners" in text
    assert f"```bash\n{PLANNER_COMMAND}\n```" in text
    assert render.CI_FIX_HINT in text
    assert "Written by `claude-opus-5-5` (effort `low`)" in text


def test_the_ci_fix_hint_follows_the_ai_verdict_when_there_is_one():
    assert render.CI_FIX_HINT not in section(explanation(verdict="entry_ahead"))


def test_without_ai_the_section_is_deterministic_and_says_why():
    text = section(None, note="No AI explanation: the model declined this evidence.")

    assert render.TITLE in text
    assert "_No AI explanation: the model declined this evidence._" in text
    assert "AI reading" not in text
    assert f"| `{TEST_ID}` | introduced | 3/3 failed | 0/3 failed |" in text
    assert PLANNER_COMMAND in text
    assert render.CI_FIX_HINT in text  # the same-run evidence says introduced
    assert render.CI_FIX_HINT not in section(None, gate_class="ambiguous")


def test_model_text_cannot_mention_link_or_inject_markup_or_commands():
    hostile = model.Explanation(
        "pr_caused",
        "high",
        "# Approved @octocat <img src=x onerror=alert(1)> run `rm -rf ~` [docs](https://github.com/open-metadata/OpenMetadata/pull/1)",
        "fix_then_requeue",
        [("src/Table.java", "ping @maintainers <b>now</b>")],
    )

    text = section(hostile)

    assert "@octocat" not in text and "@maintainers" not in text
    assert "<img" not in text and "<b>" not in text
    assert "> \\# Approved @&#8203;octocat &lt;img" in text
    code_blocks = text.split("```bash\n")[1:]
    assert all("rm -rf" not in block.split("```")[0] for block in code_blocks)


def test_a_culprit_changed_by_a_pr_ahead_is_labelled():
    text = section(explanation(verdict="entry_ahead", culprits=(("src/Ahead.java", "renamed a method"),)))

    assert "- `src/Ahead.java` (changed by a PR ahead): renamed a method" in text


def test_an_ai_reading_that_contradicts_the_reproduction_gets_a_note():
    flaky = section(explanation(verdict="main_or_flaky", next_step="requeue_unchanged", culprits=()))

    assert render.CONTRADICTION in flaky
    assert render.CONTRADICTION not in section(explanation())


def test_hostile_test_names_stay_inside_their_table_cell():
    test = bundle.BlockingTest("Evil|IT#t`x`\n| injected | row |", "introduced", "3/3 failed", "0/3 failed", "f", "java-it")
    result = bundle.Bundle("b", [test], 1, frozenset(), frozenset())

    text = render.render_section({"decision": {}}, result, [], None)

    row = next(line for line in text.splitlines() if line.startswith("| ``"))
    assert row.count(" | ") == 3
    assert "\\|" in row and "\n| injected" not in text
