import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
    TableConstraint,
)
from metadata.generated.schema.type.basic import (
    EntityExtension,
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import BaseModel, CustomSecretStr


class CustomPydanticValidationTest(TestCase):

    create_request = CreateTableRequest(
        name=EntityName("Sales::>Territory"),
        displayName="SalesTerritory",
        description=Markdown(root="Sales territory lookup table."),
        tableType="Regular",
        columns=[
            Column(
                name=ColumnName(root="Sales::Last>Year"),
                displayName="SalesLastYear",
                dataType="NUMBER",
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay="NUMBER",
                description=Markdown(root="Sales total of previous year."),
                fullyQualifiedName=None,
                tags=None,
                constraint="NOT_NULL",
                ordinalPosition=7,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="Bonus"),
                displayName="Bonus",
                dataType="NUMBER",
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay="NUMBER",
                description=Markdown(root="Bonus due if quota is met."),
                fullyQualifiedName=None,
                tags=None,
                constraint="NOT_NULL",
                ordinalPosition=4,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName(root="ModifiedDate"),
                displayName="ModifiedDate",
                dataType="DATETIME",
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay="DATETIME",
                description=Markdown(root="Date and time the record was last updated."),
                fullyQualifiedName=None,
                tags=None,
                constraint="NOT_NULL",
                ordinalPosition=9,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
        ],
        dataModel=None,
        tableConstraints=[
            TableConstraint(constraintType="PRIMARY_KEY", columns=["Sales::Last>Year"])
        ],
        tablePartition=None,
        tableProfilerConfig=None,
        owners=None,
        databaseSchema=FullyQualifiedEntityName(
            root='New Gyro 360.New Gyro 360."AdventureWorks2017.HumanResources"'
        ),
        tags=None,
        schemaDefinition=None,
        retentionPeriod=None,
        extension=EntityExtension(
            root={
                "DataQuality": '<div><p><b>Last evaluation:</b> 07/24/2023<br><b>Interval: </b>30 days <br><b>Next run:</b> 08/23/2023, 10:44:20<br><b>Measurement unit:</b> percent [%]</p><br><table><tbody><tr><th>Metric</th><th>Target</th><th>Latest result</th></tr><tr><td><p class="text-success">Completeness</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-success">Integrity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-warning">Timeliness</p></td><td>90%</td><td><div class="bar fabric" style="width: 25%;"><strong>25%</strong></div></td></tr><tr><td><p class="text-warning">Uniqueness</p></td><td>90%</td><td><div class="bar fabric" style="width: 60%;"><strong>60%</strong></div></td></tr><tr><td><p class="text-success">Validity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr></tbody></table><h3>Overall score of the table is: 77%</h3><hr style="border-width: 5px;"></div>'
            }
        ),
        sourceUrl=None,
        domain=None,
        dataProducts=None,
        fileFormat=None,
        lifeCycle=None,
        sourceHash=None,
    )

    def test_replace_separator(self):
        assert (
            self.create_request.name.root
            == "Sales__reserved__colon____reserved__arrow__Territory"
        )
        assert (
            self.create_request.columns[0].name.root
            == "Sales__reserved__colon__Last__reserved__arrow__Year"
        )
        assert (
            self.create_request.tableConstraints[0].columns[0]
            == "Sales__reserved__colon__Last__reserved__arrow__Year"
        )

    def test_revert_separator(self):
        fetch_response_revert_separator = Table(
            id=uuid.uuid4(),
            name="test__reserved__colon__table",
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        fetch_response_revert_separator_2 = Table(
            id=uuid.uuid4(),
            name="test__reserved__colon__table__reserved__arrow__",
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        assert fetch_response_revert_separator.name.root == "test::table"
        assert fetch_response_revert_separator_2.name.root == "test::table>"


def test_model_dump_masked():
    """Test model_dump_masked with root, nested, and list structures."""

    class NestedModel(BaseModel):
        secret: CustomSecretStr
        value: int

    class RootModel(BaseModel):
        root_secret: CustomSecretStr
        nested: NestedModel
        items: list[NestedModel]

    data = {
        "root_secret": "root_password",
        "nested": {"secret": "nested_password", "value": 42},
        "items": [
            {"secret": "item1_password", "value": 1},
            {"secret": "item2_password", "value": 2},
        ],
    }

    model = RootModel(**data)
    masked_data = model.model_dump(mask_secrets=True)

    assert masked_data["root_secret"] == "*******"
    assert masked_data["nested"]["secret"] == "*******"
    assert masked_data["nested"]["value"] == 42
    assert masked_data["items"][0]["secret"] == "*******"
    assert masked_data["items"][0]["value"] == 1
    assert masked_data["items"][1]["secret"] == "*******"
    assert masked_data["items"][1]["value"] == 2

    plain_data = model.model_dump(mask_secrets=False)
    assert plain_data["root_secret"] == "root_password"
    assert plain_data["nested"]["secret"] == "nested_password"
    assert plain_data["items"][0]["secret"] == "item1_password"

    default_dump = model.model_dump()
    assert default_dump["root_secret"] == "root_password"
    assert default_dump["nested"]["secret"] == "nested_password"
    assert default_dump["items"][0]["secret"] == "item1_password"
