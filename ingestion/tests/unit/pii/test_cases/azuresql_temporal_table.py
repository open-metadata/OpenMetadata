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
    name=EntityName(root="customers_temporal"),
    fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.customers_temporal"),
    columns=[
        Column(
            name=ColumnName(root="id"),
            displayName=None,
            dataType=DataType.INT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="int",
            fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.customers_temporal.id"),
        ),
        Column(
            name=ColumnName(root="name"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.customers_temporal.name"),
        ),
        Column(
            name=ColumnName(root="email"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.customers_temporal.email"),
        ),
        Column(
            name=ColumnName(root="ValidFrom"),
            displayName=None,
            dataType=DataType.DATETIME,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="datetime",
            fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.customers_temporal.ValidFrom"),
        ),
        Column(
            name=ColumnName(root="ValidTo"),
            displayName=None,
            dataType=DataType.DATETIME,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="datetime",
            fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.customers_temporal.ValidTo"),
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="id"),
            ColumnName(root="name"),
            ColumnName(root="email"),
        ],
        rows=[
            [1, "Alice", "alice@example.com"],
            [2, "Bob", "bob@example.com"],
            [3, "Charlie", "charlie@example.com"],
            [4, "Diana", "diana@example.com"],
            [5, "Eve", "eve@example.com"],
            [6, "Frank", "frank@example.com"],
            [7, "Grace", "grace@example.com"],
            [8, "Henry", "henry@example.com"],
            [9, "Iris", "iris@example.com"],
            [10, "Jack", "jack@example.com"],
        ],
    )
)

expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.customers_temporal.email",
        tag_label=TagLabel(
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
            name="Sensitive",
            tagFQN=TagFQN(
                root="PII.Sensitive",
            ),
        ),
    ),
]
