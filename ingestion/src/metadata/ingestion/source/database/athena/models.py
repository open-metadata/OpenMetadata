#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Athena Models
"""

from datetime import datetime
from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel


class QueryExecutionIdsResponse(BaseModel):
    QueryExecutionIds: Optional[List[str]] = None  # noqa: UP006, UP045


class AthenaStatus(BaseModel):
    State: Optional[str] = "FAILED"  # Default value  # noqa: UP045
    SubmissionDateTime: Optional[datetime] = None  # noqa: UP045


class AthenaStatistics(BaseModel):
    TotalExecutionTimeInMillis: Optional[int] = None  # noqa: UP045


class AthenaQueryExecution(BaseModel):
    Query: Optional[str] = None  # noqa: UP045
    Statistics: Optional[AthenaStatistics] = None  # noqa: UP045
    Status: Optional[AthenaStatus] = None  # noqa: UP045


class AthenaQueryExecutionList(BaseModel):
    QueryExecutions: Optional[List[AthenaQueryExecution]] = None  # noqa: UP006, UP045


class WorkGroup(BaseModel):
    Name: Optional[str] = None  # noqa: UP045
    State: Optional[str] = None  # noqa: UP045


class WorkGroupsList(BaseModel):
    WorkGroups: Optional[List[WorkGroup]] = []  # noqa: UP006, UP045
    NextToken: Optional[str] = None  # noqa: UP045
