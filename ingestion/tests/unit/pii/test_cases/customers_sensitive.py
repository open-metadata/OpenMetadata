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
            name=ColumnName(root="SSN"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.SSN"
            ),
        ),
        Column(
            name=ColumnName(root="DWH_X10"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.DWH_X10"
            ),
        ),
        Column(
            name=ColumnName(root="customer_id"),
            displayName=None,
            dataType=DataType.INT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="int",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.customer_id"
            ),
        ),
        Column(
            name=ColumnName(root="user_name"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.user_name"
            ),
        ),
        Column(
            name=ColumnName(root="address"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.address"
            ),
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="SSN"),
            ColumnName(root="DWH_X10"),
            ColumnName(root="customer_id"),
            ColumnName(root="user_name"),
            ColumnName(root="address"),
        ],
        rows=[
            ["--", "harsha@gmail.com", 1, "Harsha", "2240 W Ina Rd"],
            ["--", "suresh@gmail.com", 2, "Suresh", "7192 Kalanianaole Hwy"],
            ["--", "sanket@gmail.com", 3, "Sanket", "5900 N Cannon Ave"],
            ["--", "mayur@gmail.com", 4, "Mayur", "4350 Main St"],
            ["--", "teddy@gmail.com", 5, "Teddy", "903 W Main St"],
            ["--", "akash@gmail.com", 6, "Akash", "2220 Coit Rd"],
            ["--", "shilpa@gmail.com", 7, "Shilpa", "7 Southside Dr"],
            ["--", "chirag@gmail.com", 8, "Chirag", "2929 S 25th Ave"],
        ],
    )
)

expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.example_table.DWH_X10",
        tag_label=TagLabel(
            name="Sensitive",
            tagFQN=TagFQN(root="PII.Sensitive"),
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
        ),
    ),
    ColumnTag(
        column_fqn="Service.database.schema.example_table.user_name",
        tag_label=TagLabel(
            name="Sensitive",
            tagFQN=TagFQN(root="PII.Sensitive"),
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
        ),
    ),
    ColumnTag(
        column_fqn="Service.database.schema.example_table.address",
        tag_label=TagLabel(
            name="NonSensitive",
            tagFQN=TagFQN(root="PII.NonSensitive"),
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
        ),
    ),
]
