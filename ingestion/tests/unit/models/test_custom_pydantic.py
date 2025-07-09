import uuid
from typing import List
from unittest import TestCase

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
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
                dataTypeDisplay="NUMBER",
                description=Markdown(root="Sales total of previous year."),
                constraint="NOT_NULL",
                ordinalPosition=7,
            ),
            Column(
                name=ColumnName(root="Bonus"),
                displayName="Bonus",
                dataType="NUMBER",
                dataTypeDisplay="NUMBER",
                description=Markdown(root="Bonus due if quota is met."),
                constraint="NOT_NULL",
                ordinalPosition=4,
            ),
            Column(
                name=ColumnName(root="ModifiedDate"),
                displayName="ModifiedDate",
                dataType="DATETIME",
                dataTypeDisplay="DATETIME",
                description=Markdown(root="Date and time the record was last updated."),
                constraint="NOT_NULL",
                ordinalPosition=9,
            ),
        ],
        tableConstraints=[
            TableConstraint(constraintType="PRIMARY_KEY", columns=["Sales::Last>Year"])
        ],
        databaseSchema=FullyQualifiedEntityName(
            root='New Gyro 360.New Gyro 360."AdventureWorks2017.HumanResources"'
        ),
        extension=EntityExtension(
            root={
                "DataQuality": '<div><p><b>Last evaluation:</b> 07/24/2023<br><b>Interval: </b>30 days <br><b>Next run:</b> 08/23/2023, 10:44:20<br><b>Measurement unit:</b> percent [%]</p><br><table><tbody><tr><th>Metric</th><th>Target</th><th>Latest result</th></tr><tr><td><p class="text-success">Completeness</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-success">Integrity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-warning">Timeliness</p></td><td>90%</td><td><div class="bar fabric" style="width: 25%;"><strong>25%</strong></div></td></tr><tr><td><p class="text-warning">Uniqueness</p></td><td>90%</td><td><div class="bar fabric" style="width: 60%;"><strong>60%</strong></div></td></tr><tr><td><p class="text-success">Validity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr></tbody></table><h3>Overall score of the table is: 77%</h3><hr style="border-width: 5px;"></div>'
            }
        ),
    )

    create_request_dashboard_datamodel = CreateDashboardDataModelRequest(
        name=EntityName('test"dashboarddatamodel"'),
        displayName='test"dashboarddatamodel"',
        description=Markdown(
            root='test"dashboarddatamodel"'
        ),
        dataModelType=DataModelType.PowerBIDataModel,
        service=FullyQualifiedEntityName(
            root='New Gyro 360.New Gyro 360."AdventureWorks2017.HumanResources"'
        ),
        columns=[
            Column(
                name="struct",
                dataType=DataType.STRUCT,
                arrayDataType="UNKNOWN",
                children=[
                    Column(name='test "struct_children"', dataType=DataType.BIGINT)
                ],
            )
        ],
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

        assert (
            self.create_request_dashboard_datamodel.name.root
            == 'test"dashboarddatamodel"'
        )

        assert (
            self.create_request_dashboard_datamodel.columns[0].children[0].name.root
            == 'test "struct_children"'
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

        fetch_response_revert_separator_3 = DashboardDataModel(
            id=uuid.uuid4(),
            name='test"dashboarddatamodel"',
            fullyQualifiedName='test-service-table.test-db.test-schema.test"dashboarddatamodel"',
            dataModelType=DataModelType.PowerBIDataModel,
            columns=[
                Column(
                    name="struct",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(name='test "struct_children"', dataType=DataType.BIGINT)
                    ],
                )
            ],
        )
        assert fetch_response_revert_separator_3.name.root == 'test"dashboarddatamodel"'
        assert (
            fetch_response_revert_separator_3.columns[0].children[0].name.root
            == 'test "struct_children"'
        )
        assert fetch_response_revert_separator.name.root == "test::table"
        assert fetch_response_revert_separator_2.name.root == "test::table>"


class NestedModel(BaseModel):
    secret: CustomSecretStr
    value: int


class RootModel(BaseModel):
    root_secret: CustomSecretStr
    nested: NestedModel
    items: List[NestedModel]


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


def test_model_dump_secrets():
    """Test model_dump_masked with root, nested, and list structures."""

    assert masked_data["root_secret"] == "**********"
    assert masked_data["nested"]["secret"] == "**********"
    assert masked_data["nested"]["value"] == 42
    assert masked_data["items"][0]["secret"] == "**********"
    assert masked_data["items"][0]["value"] == 1
    assert masked_data["items"][1]["secret"] == "**********"
    assert masked_data["items"][1]["value"] == 2

    plain_data = model.model_dump(mask_secrets=False)
    assert plain_data["root_secret"] == "root_password"
    assert plain_data["nested"]["secret"] == "nested_password"
    assert plain_data["items"][0]["secret"] == "item1_password"

    default_dump = model.model_dump()
    assert default_dump["root_secret"] == "root_password"
    assert default_dump["nested"]["secret"] == "nested_password"
    assert default_dump["items"][0]["secret"] == "item1_password"


def test_model_dump_json_secrets():
    assert (
        model.model_validate_json(
            model.model_dump_json()
        ).root_secret.get_secret_value()
        == "**********"
    )
    assert (
        model.model_validate_json(
            model.model_dump_json(mask_secrets=True)
        ).root_secret.get_secret_value()
        == "**********"
    )
    assert (
        model.model_validate_json(
            model.model_dump_json(mask_secrets=False)
        ).root_secret.get_secret_value()
        == "root_password"
    )
