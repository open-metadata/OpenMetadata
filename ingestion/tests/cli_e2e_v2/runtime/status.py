#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Strict typed view of BaseWorkflow's status-file contract."""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pathlib import Path


@dataclass(frozen=True)
class StepStatus:
    name: str
    records: int
    updated_records: int
    warnings: int
    errors: int
    filtered: int
    failures: list[dict[str, Any]]

    @classmethod
    def from_dict(cls, data: object) -> StepStatus:
        if not isinstance(data, dict):
            raise TypeError("status step must be an object")
        if not isinstance(data.get("name"), str):
            raise TypeError("status step.name must be a string")
        counts = {}
        for key in ("records", "updated_records", "warnings", "errors", "filtered"):
            value = data.get(key)
            if type(value) is not int or value < 0:
                raise ValueError(f"status step.{key} must be a nonnegative integer")
            counts[key] = value
        if "failures" not in data:
            raise ValueError("status step.failures is required")
        failures = data["failures"]
        if failures is None:
            failures = []
        if not isinstance(failures, list):
            raise TypeError("status step.failures must be a list or null")
        for failure in failures:
            if not isinstance(failure, dict):
                raise TypeError("status failure must be an object")
            for key in ("name", "error", "stackTrace"):
                if failure.get(key) is not None and not isinstance(failure[key], str):
                    raise ValueError(f"status failure.{key} must be a string or null")
        return cls(name=data["name"], failures=deepcopy(failures), **counts)

    @property
    def failures_truncated(self) -> bool:
        return self.errors > len(self.failures)


@dataclass(frozen=True)
class Status:
    pipeline_type: str | None
    ingestion_pipeline_fqn: str | None
    success: bool
    steps: list[StepStatus]

    @classmethod
    def from_dict(cls, data: object) -> Status:
        if not isinstance(data, dict):
            raise TypeError("status must be an object")
        if type(data.get("success")) is not bool:
            raise ValueError("status.success must be a boolean")
        if not isinstance(data.get("steps"), list) or not data["steps"]:
            raise ValueError("status.steps must be a nonempty list")
        if "pipeline_type" not in data:
            raise ValueError("status.pipeline_type is required")
        for key in ("pipeline_type", "ingestion_pipeline_fqn"):
            if data.get(key) is not None and not isinstance(data[key], str):
                raise ValueError(f"status.{key} must be a string or null")
        return cls(
            pipeline_type=data["pipeline_type"],
            ingestion_pipeline_fqn=data.get("ingestion_pipeline_fqn"),
            success=data["success"],
            steps=[StepStatus.from_dict(step) for step in data["steps"]],
        )

    @classmethod
    def from_json(cls, path: Path) -> Status:
        return cls.from_dict(json.loads(path.read_text(encoding="utf-8")))

    @property
    def total_errors(self) -> int:
        return sum(step.errors for step in self.steps)

    @property
    def all_failures(self) -> list[dict[str, Any]]:
        return [failure for step in self.steps for failure in step.failures]

    def step(self, name: str) -> StepStatus | None:
        return next((step for step in self.steps if step.name == name), None)
