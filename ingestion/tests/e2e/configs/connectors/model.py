"""Connector model config for testing."""

from typing import Optional
from pydantic import BaseModel


class IngestionFilterConfig(BaseModel):
    includes: Optional[list[str]] = []
    excludes: Optional[list[str]] = []

class IngestionTestConfig(BaseModel):
    database: Optional[IngestionFilterConfig]
    schema_: Optional[IngestionFilterConfig]
    table: Optional[IngestionFilterConfig]

class ConnectorIngestionTestConfig(BaseModel):
    metadata: Optional[IngestionTestConfig]
    profiler: Optional[IngestionTestConfig]

class ValidationTestConfig(BaseModel):
    service: Optional[str]
    database: Optional[str]
    schema_: Optional[str]
    table: Optional[str]

class ConnectorValidationTestConfig(BaseModel):
    metadata: Optional[ValidationTestConfig]
    profiler: Optional[ValidationTestConfig]

class ConnectorTestConfig(BaseModel):
    ingestion: Optional[ConnectorIngestionTestConfig]
    validation: Optional[ConnectorValidationTestConfig]