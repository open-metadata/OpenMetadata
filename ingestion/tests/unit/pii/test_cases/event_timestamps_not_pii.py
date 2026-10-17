"""Test case: event / audit timestamp columns should NOT be tagged as PII.

Reproduces issue #33503 — auto-classification incorrectly tags ordinary event timestamps
as PII.NonSensitive via ValidatedDateRecognizer at score 1.0.

Expected outcome:
  - event_timestamp  (TIMESTAMP type, datetime values) → no PII tag
  - event_timestamp_text (STRING type, ISO-8601 strings) → no PII tag
  - birth_date        (DATE type, date objects)          → PII.NonSensitive  (control)
"""
import datetime
import uuid

from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
    TableData,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.sampler.models import SampleData

table = Table(
    id=Uuid(root=uuid.uuid4()),
    name=EntityName(root="events"),
    fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.events"),
    columns=[
        Column(
            name=ColumnName(root="event_timestamp"),
            dataType=DataType.TIMESTAMP,
            dataLength=1,
            precision=1,
            dataTypeDisplay="timestamp",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.events.event_timestamp"
            ),
        ),
        Column(
            name=ColumnName(root="event_timestamp_text"),
            dataType=DataType.STRING,
            dataLength=1,
            precision=1,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.events.event_timestamp_text"
            ),
        ),
        Column(
            name=ColumnName(root="birth_date"),
            dataType=DataType.DATE,
            dataLength=1,
            precision=1,
            dataTypeDisplay="date",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.events.birth_date"
            ),
        ),
    ],
)

_ts_values = [
    str(datetime.datetime(2026, 1, 15, 10, 30, 45)),
    str(datetime.datetime(2026, 1, 16, 11, 45, 0)),
    str(datetime.datetime(2026, 1, 17, 9, 0, 0)),
    str(datetime.datetime(2026, 2, 1, 8, 15, 30)),
    str(datetime.datetime(2026, 2, 2, 14, 22, 10)),
]

_iso_values = [
    "2026-01-15T10:30:45Z",
    "2026-01-16T11:45:00Z",
    "2026-01-17T09:00:00Z",
    "2026-02-01T08:15:30Z",
    "2026-02-02T14:22:10Z",
]

_dob_values = [
    str(datetime.date(1990, 4, 12)),
    str(datetime.date(1985, 9, 23)),
    str(datetime.date(1978, 12, 1)),
    str(datetime.date(2001, 7, 7)),
    str(datetime.date(1995, 3, 18)),
]

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="event_timestamp"),
            ColumnName(root="event_timestamp_text"),
            ColumnName(root="birth_date"),
        ],
        rows=list(zip(_ts_values, _iso_values, _dob_values, strict=True)),
    )
)

# Only birth_date should receive a PII tag; the two timestamp columns must not.
expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.events.birth_date",
        tag_label=TagLabel(
            name="NonSensitive",
            tagFQN=TagFQN(root="PII.NonSensitive"),
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
        ),
    ),
]
