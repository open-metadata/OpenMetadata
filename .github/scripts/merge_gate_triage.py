#!/usr/bin/env python3
"""Read the failing step of a CI job that left no test evidence, for the merge gate.

A job that failed without a test report and without a known signature in its
annotations is "unknown" to the gate. Its log usually says more, so for each such job
(at most transient.triageMaxJobs) this reads the failing step's tail, in order:

  1. test-failure markers (Maven, Jest, pytest summaries): the job failed on its tests,
     which no re-run excuses; nothing else is tried.
  2. policy.json's infraSignatures over the log: the job is "infra", like a signature
     found in its annotations.
  3. one triage call (ci_ai/triage.py) when CI_AI_TRIAGE_MODE allows: a checked
     "transient" answer marks the job "transient". In shadow mode the answer is only
     reported.

The gate's policy never imports this module; it only sees FailedJob.log_signal, which
earns a job a bounded re-run and can never forgive a failure or pass an entry.
"""

from __future__ import annotations

import dataclasses
import os
import re
import subprocess
from collections.abc import Callable
from pathlib import Path

import merge_gate_policy as gate

LOG_TAIL_BYTES = 4 * 1024 * 1024
TIMESTAMP = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z ?")


def fetch_log(owner: str, repo: str, job_id: int, token: str) -> str:
    """The job's log, last LOG_TAIL_BYTES of it. gh follows the API's redirect to the
    signed log URL without sending the token there."""
    completed = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/actions/jobs/{job_id}/logs"],
        env={**os.environ, "GH_TOKEN": token},
        capture_output=True,
        timeout=120,
        check=False,
    )
    if completed.returncode:
        raise OSError(f"log download failed for job {job_id}")
    return completed.stdout[-LOG_TAIL_BYTES:].decode("utf-8", errors="replace")


def failing_step_excerpt(log: str, max_lines: int, max_chars: int) -> str:
    """The step that ended the job: from its last `##[group]Run` line up to the last
    `##[error]` line, at most max_lines and max_chars, timestamps removed."""
    lines = [TIMESTAMP.sub("", line) for line in log.splitlines()]
    errors = [index for index, line in enumerate(lines) if line.startswith("##[error]")]
    end = errors[-1] if errors else len(lines) - 1
    starts = [index for index in range(end + 1) if lines[index].startswith("##[group]Run ")]
    start = max(starts[-1] if starts else 0, end - max_lines + 1)
    return "\n".join(lines[start : end + 1])[-max_chars:]


def _matching_line(pattern: re.Pattern, text: str) -> str:
    match = pattern.search(text)
    if not match:
        return ""
    begin = text.rfind("\n", 0, match.start()) + 1
    finish = text.find("\n", match.end())
    return text[begin : finish if finish != -1 else len(text)].strip()[:200]


def _settings(env) -> tuple[str, str, str, int, Path | None]:
    mode = (env.get("CI_AI_TRIAGE_MODE") or "off").strip().lower()
    if mode not in ("shadow", "on"):
        return "off", "", "", 0, None
    from ci_ai import triage as ai  # Imported only when triage is on: the SDK is optional.

    mode, model, effort = ai.settings(env)
    cache = env.get("CI_AI_TRIAGE_CACHE")
    return mode, model, effort, ai.daily_max(env), Path(cache) if cache else None


def read_jobs(
    owner: str,
    repo: str,
    jobs: list[gate.FailedJob],
    policy: gate.Policy,
    policy_doc: dict,
    token: str,
    *,
    blind_retry_left: bool,
    env=None,
    log_fetcher: Callable[[str, str, int, str], str] | None = None,
    triage_call: Callable[..., dict] | None = None,
) -> tuple[list[gate.FailedJob], list[dict]]:
    """(the jobs, each unknown one with its log_signal set, and a reading per job read).

    In "on" mode the triage call is made only when no blind retry is left, since a
    retry would happen anyway; in shadow mode every unexplained failure is read, so
    the answers can be compared with what the retries did."""
    env = os.environ if env is None else env
    log_fetcher = log_fetcher or fetch_log
    limits = policy_doc.get("transient") or {}
    unknown = [job for job in jobs if gate.job_kind(job, policy)[0] == "unknown"]
    if not unknown:
        return jobs, []
    if len(unknown) > int(limits.get("triageMaxJobs", 5)):
        return jobs, [{"job": job.name, "signal": "", "why": "too many unexplained jobs to read"} for job in unknown]
    mode, model, effort, daily_cap, cache_path = _settings(env)
    ask_ai = mode == "shadow" or (mode == "on" and not blind_retry_left)
    cache = None
    if mode != "off" and ask_ai and triage_call is None:
        from ci_ai import triage as ai

        cache = ai.Cache(cache_path)
        triage_call = ai.triage
    readings: dict[str, dict] = {}
    signals: dict[str, tuple[str, str]] = {}
    for job in unknown:
        reading: dict = {"job": job.name, "signal": "", "why": ""}
        readings[job.name] = reading
        if job.job_id is None:
            reading["why"] = "no job id"
            continue
        try:
            log = log_fetcher(owner, repo, job.job_id, token)
        except (OSError, subprocess.SubprocessError) as exc:
            reading["why"] = f"log unavailable: {exc}"
            continue
        excerpt = failing_step_excerpt(log, int(limits.get("excerptLines", 300)), int(limits.get("excerptChars", 16000)))
        if policy.test_failure_markers and policy.test_failure_markers.search(excerpt):
            reading.update(signal="test", why=_matching_line(policy.test_failure_markers, excerpt))
            continue
        signature = next((s for s in policy.infra_signatures if s.search(excerpt)), None)
        if signature:
            line = _matching_line(signature.pattern, excerpt)
            reading.update(signal="infra", why=f"{signature.id}: {line}")
            signals[job.name] = ("infra", reading["why"])
            continue
        if mode == "off" or not ask_ai or triage_call is None:
            continue
        kwargs = {"model": model, "effort": effort, "daily_cap": daily_cap}
        if cache is not None:
            kwargs["cache"] = cache
        answer = triage_call(job.name, job.failed_step or "", job.conclusion, excerpt, **kwargs)
        reading["ai"] = {key: answer.get(key) for key in ("verdict", "category", "evidence", "confidence", "outcome", "cached")}
        reading["usage"] = answer.get("usage")
        if answer.get("verdict") == "transient":
            why = f"{answer.get('category')}: {answer.get('evidence')}"[:200]
            if mode == "on":
                reading.update(signal="transient", why=why)
                signals[job.name] = ("transient", why)
            else:
                reading["shadow"] = f"would mark transient ({why})"
    if cache is not None:
        try:
            cache.save()
        except OSError as exc:
            print(f"::warning::triage cache not saved: {exc}")
    updated = [
        dataclasses.replace(job, log_signal=signals[job.name][0], log_why=signals[job.name][1]) if job.name in signals else job
        for job in jobs
    ]
    return updated, list(readings.values())
