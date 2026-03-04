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
    name=EntityName(root="users"),
    fullyQualifiedName=FullyQualifiedEntityName(root="Service.database.schema.users"),
    columns=[
        Column(
            name=ColumnName(root="user_id"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.users.user_id"
            ),
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
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.users.email"
            ),
        ),
        Column(
            name=ColumnName(root="full_name"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.users.full_name"
            ),
        ),
        Column(
            name=ColumnName(root="phone_number"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.users.phone_number"
            ),
        ),
        Column(
            name=ColumnName(root="iban"),
            displayName=None,
            dataType=DataType.STRING,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="string",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.users.iban"
            ),
        ),
        Column(
            name=ColumnName(root="registration_date"),
            displayName=None,
            dataType=DataType.DATE,
            arrayDataType=None,
            dataLength=1,
            precision=1,
            scale=None,
            dataTypeDisplay="date",
            fullyQualifiedName=FullyQualifiedEntityName(
                root="Service.database.schema.users.registration_date"
            ),
        ),
    ],
)

sample_data = SampleData(
    data=TableData(
        columns=[
            ColumnName(root="user_id"),
            ColumnName(root="email"),
            ColumnName(root="full_name"),
            ColumnName(root="phone_number"),
            ColumnName(root="iban"),
            ColumnName(root="registration_date"),
        ],
        rows=[
            [
                "USR002",
                "maria.garcia@test.org",
                "Maria Garcia",
                "+34 912 345 678",
                "ES79 2100 0813 6101 2345 6789",
                datetime.date(year=2024, month=1, day=6),
            ],
            [
                "USR003",
                "hans.mueller@domain.de",
                "Hans Mueller",
                "+49 30 12345678",
                "DE89 3704 0044 0532 0130 00",
                datetime.date(year=2024, month=1, day=7),
            ],
            [
                "USR004",
                "sophie.dubois@mail.fr",
                "Sophie Dubois",
                "+33 1 42 34 56 78",
                "FR14 2004 1010 0505 0001 3M02 606",
                datetime.date(year=2024, month=1, day=8),
            ],
            [
                "USR005",
                "marco.rossi@email.it",
                "Marco Rossi",
                "+39 06 1234 5678",
                "IT60 X054 2811 1010 0000 0123 456",
                datetime.date(year=2024, month=1, day=9),
            ],
            [
                "USR006",
                "anna.kowalski@webmail.pl",
                "Anna Kowalski",
                "+48 22 123 45 67",
                "PL61 1090 1014 0000 0712 1981 2874",
                datetime.date(year=2024, month=1, day=20),
            ],
            [
                "USR007",
                "peter.johnson@company.com",
                "Peter Johnson",
                "+1-555-0198",
                "GB29 NWBK 6016 1331 9268 19",
                datetime.date(year=2024, month=1, day=1),
            ],
            [
                "USR008",
                "yuki.tanaka@example.jp",
                "Yuki Tanaka",
                "+81 3-1234-5678",
                "NL91 ABNA 0417 1643 00",
                datetime.date(year=2024, month=1, day=2),
            ],
            [
                "USR009",
                "lars.andersson@service.se",
                "Lars Andersson",
                "+46 8 123 456 78",
                "SE45 5000 0000 0583 9825 7466",
                datetime.date(year=2024, month=1, day=3),
            ],
            [
                "USR011",
                "carlos.silva@internet.br",
                "Carlos Silva",
                "+55 11 98765-4321",
                "BR97 0036 0305 0000 1000 9795 493C 1",
                datetime.date(year=2024, month=1, day=5),
            ],
            [
                "USR012",
                "fatima.ali@connect.ae",
                "Fatima Ali",
                "+971 4 123 4567",
                "AE07 0331 2345 6789 0123 456",
                datetime.date(year=2024, month=1, day=6),
            ],
            [
                "USR013",
                "wei.chen@network.cn",
                "Wei Chen",
                "+86 10 1234 5678",
                "CH93 0076 2011 6238 5295 7",
                datetime.date(year=2024, month=1, day=7),
            ],
            [
                "USR014",
                "olga.petrov@email.ru",
                "Olga Petrov",
                "+7 495 123-45-67",
                "FI21 1234 5600 0007 85",
                datetime.date(year=2024, month=1, day=8),
            ],
            [
                "USR015",
                "ahmed.hassan@comm.eg",
                "Ahmed Hassan",
                "+20 2 1234 5678",
                "EG38 0019 0005 0000 0000 2631 8058 4",
                datetime.date(year=2024, month=1, day=9),
            ],
            [
                "USR016",
                "isabella.santos@web.mx",
                "Isabella Santos",
                "+52 55 1234 5678",
                "MX12 3456 7890 1234 5678 901",
                datetime.date(year=2024, month=1, day=10),
            ],
            [
                "USR017",
                "thomas.berg@system.no",
                "Thomas Berg",
                "+47 22 12 34 56",
                "NO93 8601 1117 947",
                datetime.date(year=2024, month=1, day=1),
            ],
            [
                "USR018",
                "sarah.cohen@platform.il",
                "Sarah Cohen",
                "+972 3 123 4567",
                "IL62 0108 0000 0009 9999 999",
                datetime.date(year=2024, month=2, day=1),
            ],
            [
                "USR019",
                "dimitri.popov@access.bg",
                "Dimitri Popov",
                "+359 2 123 4567",
                "BG80 BNBG 9661 1020 3456 78",
                datetime.date(year=2024, month=2, day=2),
            ],
            [
                "USR020",
                "lisa.van-der-berg@online.nl",
                "Lisa van der Berg",
                "+31 20 123 4567",
                "NL39 RABO 0300 0652 64",
                datetime.date(year=2024, month=2, day=3),
            ],
        ],
    )
)

expected_column_tags = [
    ColumnTag(
        column_fqn="Service.database.schema.users.email",
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
    ColumnTag(
        column_fqn="Service.database.schema.users.full_name",
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
    ColumnTag(
        column_fqn="Service.database.schema.users.phone_number",
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
    ColumnTag(
        column_fqn="Service.database.schema.users.iban",
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
    ColumnTag(
        column_fqn="Service.database.schema.users.registration_date",
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
