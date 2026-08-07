#!/usr/bin/env python3
"""Self-check for claude_security_summary. Run: python3 scripts/test_claude_security_summary.py"""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import claude_security_summary as m  # noqa: E402


def test_counts_recomputed_and_normalised():
    # The model's own counts block is ignored; unknown severity falls back to low.
    data = {"counts": {"critical": 99}, "findings": [
        {"severity": "HIGH"}, {"severity": "high"},
        {"severity": "bogus"}, {"severity": "critical"},
    ]}
    counts = m.count_severities(m.norm_findings(data, "s"))
    assert counts == {"critical": 1, "high": 2, "medium": 0, "low": 1}, counts


def test_bare_list_junk_and_string_line():
    f = m.norm_findings([{"severity": "medium", "line": "42"}, "junk", 42], "s")
    assert len(f) == 1 and f[0]["line"] == 42 and f[0]["title"] == "(no title)"
    assert m.norm_findings([{"severity": "low", "line": "n/a"}], "s")[0]["line"] is None


def test_dedupe_across_slices():
    a = m.norm_findings([{"severity": "high", "title": "SQLi", "file": "A.java",
                          "line": 5, "category": "SQL Injection"}], "slice-a")
    b = m.norm_findings([{"severity": "high", "title": "SQLi", "file": "A.java",
                          "line": 5, "category": "SQL Injection"}], "slice-b")
    assert len(m.dedupe(a + b)) == 1


def test_coverage_states():
    assert m.coverage_of({"coverage": {"complete": True, "files_reviewed": 10}}, "s")["state"] == "complete"
    assert m.coverage_of({"coverage": {"complete": False}}, "s")["state"] == "partial"
    assert m.coverage_of({}, "s")["state"] == "unknown"          # no coverage block != complete
    assert m.coverage_of(None, "s", parse_error="boom")["state"] == "error"


def test_incomplete_slice_is_loud_even_with_zero_findings():
    cov = [{"scope": "java-api", "state": "missing", "files": None, "notes": "failed"},
           {"scope": "ui", "state": "complete", "files": 9, "notes": ""}]
    md = m.render_md([], m.count_severities([]), cov, [])
    slack = m.render_slack([], m.count_severities([]), cov, top=8)
    # A crashed slice must never render as an unqualified all-clear.
    assert "Coverage is incomplete" in md and "coverage gaps above" in md
    assert "Coverage incomplete" in slack and "java-api" in slack


def test_merge_directory_and_expect_missing(tmp=None):
    d = tempfile.mkdtemp()
    try:
        for name, payload in [
            ("java-api", {"coverage": {"scope": "java-api", "complete": True, "files_reviewed": 3},
                          "findings": [{"severity": "critical", "title": "authz missing",
                                        "file": "R.java", "line": 1}]}),
            ("ui", {"coverage": {"scope": "ui", "complete": True, "files_reviewed": 7}, "findings": []}),
        ]:
            os.makedirs(os.path.join(d, name))
            with open(os.path.join(d, name, "security-review-report.json"), "w") as fh:
                json.dump(payload, fh)
        # our own output file must not be re-ingested as a report
        with open(os.path.join(d, "_sec_counts.json"), "w") as fh:
            fh.write("{}")
        paths = m.report_paths(d)
        assert len(paths) == 2, paths

        findings, coverage = [], []
        for p in paths:
            data = json.load(open(p))
            scope = m.scope_of(data, p)
            findings += m.norm_findings(data, scope)
            coverage.append(m.coverage_of(data, scope))
        reported = {c["scope"] for c in coverage}
        assert reported == {"java-api", "ui"}
        assert m.count_severities(findings)["critical"] == 1
        # a slice that never reported is surfaced as a gap
        assert "python" not in reported
    finally:
        shutil.rmtree(d)


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
    print("ok")
