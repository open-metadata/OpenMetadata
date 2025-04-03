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
from typing import List, Optional

from pydantic import BaseModel


class QueryExecutionIdsResponse(BaseModel):
    QueryExecutionIds: Optional[List[str]] = None


class AthenaStatus(BaseModel):
    State: Optional[str] = "FAILED"  # Default value
    SubmissionDateTime: Optional[datetime] = None


class AthenaStatistics(BaseModel):
    TotalExecutionTimeInMillis: Optional[int] = None


class AthenaQueryExecution(BaseModel):
    Query: Optional[str] = None
    Statistics: Optional[AthenaStatistics] = None
    Status: Optional[AthenaStatus] = None


class AthenaQueryExecutionList(BaseModel):
    QueryExecutions: Optional[List[AthenaQueryExecution]] = None


class WorkGroup(BaseModel):
    Name: Optional[str] = None
    State: Optional[str] = None


class WorkGroupsList(BaseModel):
    WorkGroups: Optional[List[WorkGroup]] = []
    NextToken: Optional[str] = None
