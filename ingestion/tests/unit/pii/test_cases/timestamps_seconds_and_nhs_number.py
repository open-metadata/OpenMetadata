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
    name=EntityName(root="example_table"),
    fullyQualifiedName=FullyQualifiedEntityName(
        root="Service.database.schema.example_table"
    ),
    columns=[
        Column(
            name=ColumnName(root="transactionDateUtc"),
            displayName=None,
            dataType=DataType.INT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="int",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.transactionDateUtc"
            ),
        ),
        Column(
            name=ColumnName(root="nhs_number"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.nhs_number"
            ),
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="transactionDateUtc"),
            ColumnName(root="nhs_number"),
        ],
        rows=[
            [1744631964, "1744631964"],
            [1744631964, "1744631964"],
            [1744631964, "1744631964"],
            [1744631964, "1744631964"],
            [1744631964, "1744631964"],
        ],
    )
)

expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.example_table.nhs_number",
        tag_label=TagLabel(
            name="Sensitive",
            tagFQN=TagFQN(root="PII.Sensitive"),
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
        ),
    ),
]
