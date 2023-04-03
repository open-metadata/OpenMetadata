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
Athena Models
"""
from datetime import datetime
from typing import List

from pydantic import BaseModel


class QueryExecutionIdsResponse(BaseModel):
    QueryExecutionIds: List[str]


class ResultReuseByAgeConfiguration(BaseModel):
    Enabled: bool


class ResultConfiguration(BaseModel):
    OutputLocation: str


class QueryExecutionContext(BaseModel):
    Database: str
    Catalog: str


class Status(BaseModel):
    State: str
    SubmissionDateTime: datetime
    CompletionDateTime: datetime


class ResultReuseInformation(BaseModel):
    ReusedPreviousResult: bool


class Statistics(BaseModel):
    EngineExecutionTimeInMillis: int
    DataScannedInBytes: int
    TotalExecutionTimeInMillis: int
    QueryQueueTimeInMillis: int
    ServiceProcessingTimeInMillis: int
    ResultReuseInformation: ResultReuseInformation


class EngineVersion(BaseModel):
    SelectedEngineVersion: str
    EffectiveEngineVersion: str


class AthenaQueryExecution(BaseModel):
    QueryExecutionId: str
    Query: str
    StatementType: str
    ResultConfiguration: ResultConfiguration
    ResultReuseConfiguration: dict
    QueryExecutionContext: QueryExecutionContext
    Status: Status
    Statistics: Statistics
    WorkGroup: str
    EngineVersion: EngineVersion
    SubstatementType: str


class AthenaQueryExecutionList(BaseModel):
    QueryExecutions: List[AthenaQueryExecution]
