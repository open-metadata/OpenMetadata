"""AI helpers for the merge gate. Advisory, with one bounded exception: a triage answer
can earn a job a re-run, and nothing here can forgive a failure or pass an entry.

Role 1, explaining an ejection, is `explain.py`. `triage.py` reads a job that failed
without test evidence and says whether it was a transient blip; merge_gate_triage.py is
its only caller. The modules split the work so each trust boundary has one owner:

  sanitize     text crossing a boundary: CI evidence into the model, model text out
  bundle       the deterministic, size-capped evidence the model sees
  fingerprint  failure identity (reused from the gate) and the bounded verdict cache
  repro        local repro commands from the repo's planners, never from the model
  model        the one Messages API call and the checks on what comes back
  render       the PR comment section
  usage        token cost, the usage record and the daily cap
  triage       the blip question, its checked answer and its cache
"""
