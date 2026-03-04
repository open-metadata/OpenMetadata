import datetime
import uuid

from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    DataType,
    Table,
    TableData,
    TableType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
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
    name=EntityName(root="orders"),
    displayName=None,
    fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.orders"),
    description=Markdown(root="testing comments here"),
    tableType=TableType.Partitioned,
    columns=[
        Column(
            name=ColumnName(root="order_id"),
            displayName=None,
            dataType=DataType.INT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="integer",
            description=Markdown(root="This is a unique identifier for an order"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.order_id"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="customer_id"),
            displayName=None,
            dataType=DataType.INT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="integer",
            description=Markdown(root="Foreign key to the customers table"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.customer_id"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="order_date"),
            displayName=None,
            dataType=DataType.DATE,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="date",
            description=Markdown(root="Date (UTC) that the order was placed"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.order_date"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="status"),
            displayName=None,
            dataType=DataType.VARCHAR,
            arrayDataType=None,
            dataLength=14,
            precision=14,
            scale=None,
            dataTypeDisplay="character varying(14)",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.status"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="credit_card_amount"),
            displayName=None,
            dataType=DataType.BIGINT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="bigint",
            description=Markdown(
                root="Amount of the order (AUD) paid for by credit card"
            ),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.credit_card_amount"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="coupon_amount"),
            displayName=None,
            dataType=DataType.BIGINT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="bigint",
            description=Markdown(root="Amount of the order (AUD) paid for by coupon"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.coupon_amount"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="bank_transfer_amount"),
            displayName=None,
            dataType=DataType.BIGINT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="bigint",
            description=Markdown(
                root="Amount of the order (AUD) paid for by bank transfer"
            ),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.bank_transfer_amount"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="gift_card_amount"),
            displayName=None,
            dataType=DataType.BIGINT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="bigint",
            description=Markdown(
                root="Amount of the order (AUD) paid for by gift card"
            ),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.gift_card_amount"
            ),
            constraint=Constraint.NULL,
        ),
        Column(
            name=ColumnName(root="amount"),
            displayName=None,
            dataType=DataType.BIGINT,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="bigint",
            description=Markdown(root="Total amount (AUD) of the order"),
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.orders.amount"
            ),
            constraint=Constraint.NULL,
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="order_id"),
            ColumnName(root="customer_id"),
            ColumnName(root="order_date"),
            ColumnName(root="status"),
            ColumnName(root="credit_card_amount"),
            ColumnName(root="coupon_amount"),
            ColumnName(root="bank_transfer_amount"),
            ColumnName(root="gift_card_amount"),
            ColumnName(root="amount"),
        ],
        rows=[
            [5, 64, datetime.date(2018, 1, 5), "completed", 0, 0, 17, 0, 17],
            [7, 88, datetime.date(2018, 1, 9), "completed", 16, 0, 0, 0, 16],
            [9, 53, datetime.date(2018, 1, 12), "completed", 0, 0, 0, 23, 23],
            [19, 54, datetime.date(2018, 1, 22), "completed", 0, 0, 0, 6, 6],
            [23, 22, datetime.date(2018, 1, 26), "return_pending", 0, 0, 0, 23, 23],
            [25, 51, datetime.date(2018, 1, 28), "completed", 22, 16, 20, 0, 58],
            [27, 94, datetime.date(2018, 1, 29), "completed", 23, 0, 0, 0, 23],
            [29, 57, datetime.date(2018, 1, 31), "completed", 0, 0, 12, 0, 12],
            [33, 42, datetime.date(2018, 2, 4), "completed", 22, 0, 0, 0, 22],
            [35, 80, datetime.date(2018, 2, 8), "completed", 29, 0, 0, 0, 29],
            [37, 1, datetime.date(2018, 2, 10), "completed", 23, 0, 0, 0, 23],
            [39, 26, datetime.date(2018, 2, 11), "completed", 0, 0, 8, 0, 8],
            [47, 50, datetime.date(2018, 2, 20), "completed", 22, 0, 0, 0, 22],
            [57, 93, datetime.date(2018, 3, 1), "completed", 0, 0, 2, 0, 2],
            [59, 30, datetime.date(2018, 3, 2), "completed", 0, 0, 0, 28, 28],
            [63, 70, datetime.date(2018, 3, 6), "completed", 29, 0, 0, 0, 29],
            [67, 79, datetime.date(2018, 3, 11), "completed", 19, 0, 4, 0, 23],
            [73, 19, datetime.date(2018, 3, 16), "completed", 0, 0, 3, 0, 3],
            [81, 76, datetime.date(2018, 3, 23), "shipped", 0, 2, 0, 0, 2],
            [83, 54, datetime.date(2018, 3, 24), "shipped", 1, 0, 0, 0, 1],
            [85, 47, datetime.date(2018, 3, 26), "shipped", 0, 0, 17, 0, 17],
            [87, 46, datetime.date(2018, 3, 27), "placed", 26, 0, 0, 30, 56],
            [89, 21, datetime.date(2018, 3, 28), "placed", 0, 0, 22, 0, 22],
            [93, 66, datetime.date(2018, 4, 3), "placed", 0, 0, 0, 26, 26],
            [95, 27, datetime.date(2018, 4, 4), "placed", 0, 24, 0, 0, 24],
            [2, 3, datetime.date(2018, 1, 2), "completed", 20, 0, 0, 0, 20],
            [4, 50, datetime.date(2018, 1, 5), "completed", 0, 25, 0, 0, 25],
            [10, 7, datetime.date(2018, 1, 14), "completed", 0, 0, 26, 0, 26],
            [16, 39, datetime.date(2018, 1, 18), "completed", 10, 0, 0, 0, 10],
            [18, 64, datetime.date(2018, 1, 20), "returned", 13, 0, 0, 0, 13],
            [22, 86, datetime.date(2018, 1, 24), "completed", 0, 0, 8, 0, 8],
            [24, 3, datetime.date(2018, 1, 27), "completed", 0, 26, 0, 0, 26],
            [28, 8, datetime.date(2018, 1, 29), "completed", 0, 0, 19, 0, 19],
            [38, 51, datetime.date(2018, 2, 10), "completed", 15, 0, 0, 0, 15],
            [40, 33, datetime.date(2018, 2, 13), "completed", 14, 0, 0, 0, 14],
            [42, 92, datetime.date(2018, 2, 16), "completed", 0, 17, 0, 0, 17],
            [44, 66, datetime.date(2018, 2, 17), "completed", 0, 0, 0, 11, 11],
            [46, 6, datetime.date(2018, 2, 19), "completed", 0, 0, 8, 0, 8],
            [52, 54, datetime.date(2018, 2, 25), "return_pending", 0, 0, 15, 0, 15],
            [54, 54, datetime.date(2018, 2, 26), "completed", 18, 0, 11, 0, 29],
            [56, 79, datetime.date(2018, 2, 28), "completed", 4, 0, 0, 0, 4],
            [60, 12, datetime.date(2018, 3, 3), "completed", 4, 0, 0, 0, 4],
            [62, 57, datetime.date(2018, 3, 5), "completed", 0, 0, 0, 14, 14],
            [66, 36, datetime.date(2018, 3, 10), "completed", 28, 0, 0, 0, 28],
            [68, 53, datetime.date(2018, 3, 11), "completed", 16, 0, 0, 0, 16],
            [72, 30, datetime.date(2018, 3, 14), "shipped", 29, 0, 0, 0, 29],
            [74, 9, datetime.date(2018, 3, 17), "shipped", 30, 0, 0, 0, 30],
            [76, 25, datetime.date(2018, 3, 20), "completed", 0, 2, 0, 0, 2],
            [82, 46, datetime.date(2018, 3, 24), "shipped", 8, 0, 0, 0, 8],
            [86, 68, datetime.date(2018, 3, 26), "placed", 0, 23, 0, 0, 23],
        ],
    )
)

expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.orders.order_date",
        tag_label=TagLabel(
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            state=State.Suggested,
            name="NonSensitive",
            tagFQN=TagFQN(
                root="PII.NonSensitive",
            ),
        ),
    ),
]
