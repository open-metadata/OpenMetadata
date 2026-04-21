#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Typed status contract between CliRunner and tests.

Mirrors the JSON shape written by BaseWorkflow.write_status_file (see
ingestion/src/metadata/workflow/base.py). Observed live in smoke testing:
  {
    "pipeline_type": "mysql",
    "ingestion_pipeline_fqn": null,
    "success": true,
    "steps": [
      {"name": "Mysql", "records": 178, "updated_records": 47,
       "warnings": 0, "errors": 0, "filtered": 0,
       "failures": null, "progress": null, "operationMetrics": null,
       "sourceTimeMs": null, "sinkTimeMs": null},
      ...
    ]
  }

Parsing contract:
  - required keys must be present (pipeline_type, success, steps)
  - required step keys must be present (name, records, updated_records,
    warnings, errors, filtered, failures)
  - step `failures` may be `null` (mapped to empty list) or a list of dicts
  - A schema change on the CLI side surfaces as a KeyError at parse time,
    not a silent mis-count — the test halts loudly rather than passing with
    zeroes it inferred from missing keys.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class StepStatus:
    name: str
    records: int
    updated_records: int
    warnings: int
    errors: int
    filtered: int
    failures: list[dict] = field(default_factory=list)

    @classmethod
    def from_dict(cls, step: dict[str, Any]) -> "StepStatus":
        return cls(
            name=str(step["name"]),
            records=int(step["records"] or 0),
            updated_records=int(step["updated_records"] or 0),
            warnings=int(step["warnings"] or 0),
            errors=int(step["errors"] or 0),
            filtered=int(step["filtered"] or 0),
            failures=list(step["failures"] or []),
        )


@dataclass(frozen=True)
class Status:
    pipeline_type: str
    ingestion_pipeline_fqn: str | None
    success: bool
    steps: list[StepStatus]

    @classmethod
    def from_json(cls, path: Path) -> "Status":
        data: dict[str, Any] = json.loads(path.read_text())
        return cls(
            pipeline_type=str(data["pipeline_type"]),
            ingestion_pipeline_fqn=data.get("ingestion_pipeline_fqn"),
            success=bool(data["success"]),
            steps=[StepStatus.from_dict(s) for s in (data.get("steps") or [])],
        )

    @property
    def all_failures(self) -> list[dict]:
        """Flat list of failure detail dicts across all steps."""
        return [f for step in self.steps for f in step.failures]

    def step(self, name: str) -> StepStatus | None:
        """Look up a step by name (e.g. 'Mysql', 'OpenMetadata', 'Profiler')."""
        for s in self.steps:
            if s.name == name:
                return s
        return None
