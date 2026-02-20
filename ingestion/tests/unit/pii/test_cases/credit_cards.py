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
            name=ColumnName(root="card_number"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.card_number"
            ),
        ),
        Column(
            name=ColumnName(root="card_family"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.card_family"
            ),
        ),
        Column(
            name=ColumnName(root="credit_limit"),
            displayName=None,
            dataType=DataType.FLOAT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="float",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.credit_limit"
            ),
        ),
        Column(
            name=ColumnName(root="customer_id"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.customer_id"
            ),
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="card_number"),
            ColumnName(root="card_family"),
            ColumnName(root="credit_limit"),
            ColumnName(root="customer_id"),
        ],
        rows=[
            # Test cards from https://docs.stripe.com/testing?locale=es-ES#cards
            ["4242-4242-4242-4242", "Gold", 25762.41, "CC13478"],
            ["5555-5555-5555-4444", "Platinum", 65331.54, "CC59797"],
            ["4000-0566-5566-5556", "Premium", 315373.15, "CC19116"],
            ["2223-0031-2200-3222", "Premium", 761992.75, "CC94939"],
            ["5200-8282-8282-8210", "Platinum", 110174.72, "CC18675"],
            ["5105-1051-0510-5100", "Platinum", 184673.43, "CC62350"],
            ["5328-7101-2269-1668", "Premium", 797672.83, "CC79352"],
            ["4801-8451-4627-0484", "Gold", 25876.4, "CC23947"],
            ["4893-2528-8095-7013", "Platinum", 181808.28, "CC50306"],
            ["3782-822463-10005", "Premium", 723459.82, "CC65461"],
            ["3714-496353-98431", "Premium", 532352.91, "CC87128"],
            ["6011-1111-1111-1117", "Gold", 36444.28, "CC84847"],
            ["4874-0164-0052-4279", "Gold", 20728.44, "CC54473"],
            ["4216-0733-7543-3033", "Gold", 3478.83, "CC80855"],
            ["4586-8501-4294-0198", "Platinum", 92787.38, "CC82845"],
            ["6011-0009-9013-9424", "Premium", 294459.64, "CC76562"],
            ["6011-9811-1111-1113", "Platinum", 148605.97, "CC84085"],
            ["3056-9300-0902-0004", "Premium", 799072.66, "CC23104"],
            ["3622-720627-1667", "Premium", 790311.99, "CC95717"],
            ["6555-9000-0060-4105", "Premium", 405728.17, "CC93130"],
            ["3566-0020-2036-0505", "Premium", 623400.47, "CC83519"],
            ["6200-0000-0000-0005", "Gold", 45047.31, "CC37535"],
            ["6200-0000-0000-0047", "Premium", 718438.42, "CC42527"],
            ["6205-5000-0000-0000-004", "Platinum", 99239.29, "CC19099"],
        ],
    )
)

expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.example_table.card_number",
        tag_label=TagLabel(
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
            name="Sensitive",
            tagFQN=TagFQN(
                root="PII.Sensitive",
            ),
        ),
    )
]
