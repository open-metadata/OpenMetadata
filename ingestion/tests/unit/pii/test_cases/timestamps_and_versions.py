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
            name=ColumnName(root="version"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.example_table.version"
            ),
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="transactionDateUtc"),
            ColumnName(root="version"),
        ],
        rows=[
            # Recent timestamps (late 2025) that pass both CC regex AND Luhn checksum
            [1760000000008, "V1"],
            [1760000000016, "V1"],
            [1760000000024, "V1"],
            [1760000000032, "V1"],
            [1760000000040, "V1"],
            [1760000000057, "V1"],
            [1760000000065, "V1"],
            [1760000000073, "V1"],
            [1760000000081, "V1"],
            [1760000000099, "V1"],
            [1760000000107, "V1"],
            [1760000000115, "V1"],
            [1760000000123, "V1"],
            [1760000000131, "V1"],
            [1760000000149, "V1"],
            [1760000000156, "V1"],
            [1760000000164, "V1"],
            [1760000000172, "V1"],
            [1760000000180, "V1"],
            [1760000000198, "V1"],
        ],
    )
)

expected_column_tags = []
