#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Status output utilities
"""
import pprint
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Entities are instances of BaseModel
Entity = BaseModel


class StackTraceError(BaseModel):
    """
    Class that represents a failure status
    """

    name: str
    error: str
    stack_trace: Optional[str]


class Either(BaseModel):
    """
    Any execution should return us Either an Entity of an error for us to handle
    - left: Optional error we encounter
    - right: Correct instance of an Entity
    """

    left: Optional[StackTraceError]
    right: Optional[Entity]


class Status(BaseModel):
    """
    Class to handle status
    """

    source_start_time = time.time()

    records: List[Any] = Field(default_factory=list)
    warnings: List[Any] = Field(default_factory=list)
    filtered: List[Dict[str, str]] = Field(default_factory=list)
    failures: List[StackTraceError] = Field(default_factory=list)

    def scanned(self, record: Any) -> None:
        """
        Clean up the status results we want to show
        """

        record_name = record.name.__root__ if hasattr(record, "name") else ""
        scanned_record = f"[{type(record)}] {record_name}"

        self.records.append(scanned_record)

    def warning(self, key: str, reason: str) -> None:
        self.warnings.append({key: reason})

    def filter(self, key: str, reason: str) -> None:
        self.filtered.append({key: reason})

    def as_string(self) -> str:
        return pprint.pformat(self.__dict__, width=150)

    def failed(self, error: StackTraceError) -> None:
        """
        Add a failure to the list of failures
        """
        self.failures.append(error)

    def fail_all(self, failures: List[StackTraceError]) -> None:
        """
        Add a list of failures
        Args:
            failures: a list of stack tracer errors
        """
        self.failures.extend(failures)

    def calculate_success(self) -> float:
        source_success = max(
            len(self.records), 1
        )  # To avoid ZeroDivisionError using minimum value as 1
        source_failed = len(self.failures)
        return round(source_success * 100 / (source_success + source_failed), 2)
