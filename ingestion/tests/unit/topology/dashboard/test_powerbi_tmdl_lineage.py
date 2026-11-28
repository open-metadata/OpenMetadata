#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
End-to-end unit tests for Power BI TMDL lineage extraction, expressions.tmdl
parameter resolution, and schema matching precedence.
"""

import json
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    ConnectionFile,
    DataModelSchema,
    Dataset,
    DatasetExpression,
    Group,
    PowerBiColumns,
    PowerBiTable,
    PowerBITableSource,
    RemoteArtifacts,
)


def _make_source(tmdl_dir: Path | None = None) -> tuple[PowerbiSource, MagicMock]:
    service_conn_cfg: dict = {
        "type": "PowerBI",
        "clientId": "client-id",
        "clientSecret": "client-secret",
        "tenantId": "tenant-id",
        "useAdminApis": False,
    }
    if tmdl_dir is not None:
        service_conn_cfg["pbitFilesSource"] = {
            "pbitFileConfigType": "local",
            "path": str(tmdl_dir),
            "pbitFilesExtractDir": str(tmdl_dir / "_never_delete_me"),
        }

    workflow_config = OpenMetadataWorkflowConfig.model_validate(
        {
            "source": {
                "type": "powerbi",
                "serviceName": "test_powerbi",
                "serviceConnection": {"config": service_conn_cfg},
                "sourceConfig": {
                    "config": {
                        "type": "DashboardMetadata",
                        "lineageInformation": {
                            "dbServicePrefixes": ["test_db"],
                        },
                    }
                },
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "test-token"},
                }
            },
        }
    )

    mock_metadata = MagicMock(spec=OpenMetadata)

    with patch(
        "metadata.ingestion.source.dashboard.powerbi.client.msal.ConfidentialClientApplication",
        return_value=MagicMock(),
    ):
        source = PowerbiSource.create(workflow_config.source.model_dump(), mock_metadata)

    return source, mock_metadata


def _make_datamodel_entity(
    dataset_id: str,
    display_name: str,
    table_name: str,
    column_names: list[str],
) -> DashboardDataModel:
    service_ref = EntityReference(id=uuid.uuid4(), type="dashboardService", name="test_powerbi")
    dm_fqn = f"test_powerbi.model.{dataset_id}"
    child_cols = [
        Column(
            name=col,
            dataType=DataType.STRING,
            fullyQualifiedName=FullyQualifiedEntityName(f"{dm_fqn}.{table_name}.{col}"),
        )
        for col in column_names
    ]
    return DashboardDataModel(
        id=uuid.uuid4(),
        name=EntityName(dataset_id),
        displayName=display_name,
        fullyQualifiedName=FullyQualifiedEntityName(dm_fqn),
        service=service_ref,
        dataModelType=DataModelType.PowerBIDataModel,
        columns=[
            Column(
                name=table_name,
                dataType=DataType.TABLE,
                fullyQualifiedName=FullyQualifiedEntityName(f"{dm_fqn}.{table_name}"),
                children=child_cols,
            )
        ],
    )


def _make_table_entity(fqn_str: str, column_names: list[str]) -> Table:
    table_name = fqn_str.rsplit(".", 1)[-1]
    return Table(
        id=uuid.uuid4(),
        name=EntityName(table_name),
        fullyQualifiedName=FullyQualifiedEntityName(fqn_str),
        columns=[
            Column(
                name=col,
                dataType=DataType.STRING,
                fullyQualifiedName=FullyQualifiedEntityName(f"{fqn_str}.{col}"),
            )
            for col in column_names
        ],
    )


class TestTmdlEndToEndLineage:
    def test_snowflake_tmdl_with_expressions_parameter_resolution_and_column_lineage(self, tmp_path: Path):
        sm_dir = tmp_path / "Sales.SemanticModel"
        tables_dir = sm_dir / "definition" / "tables"
        tables_dir.mkdir(parents=True)

        (sm_dir / ".platform").write_text(
            json.dumps(
                {
                    "metadata": {"type": "SemanticModel", "displayName": "Sales Analytics"},
                    "config": {"version": "2.0", "logicalId": "local-pbip-guid"},
                }
            ),
            encoding="utf-8",
        )
        (sm_dir / "definition" / "expressions.tmdl").write_text(
            'expression TargetDatabase = "PROD_DW" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n'
            "\tlineageTag: e-db\n"
            "\n"
            'expression TargetSchema = "ANALYTICS" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n'
            "\tlineageTag: e-sc\n",
            encoding="utf-8",
        )
        (tables_dir / "Orders.tmdl").write_text(
            "table Orders\n"
            "\tcolumn order_id\n"
            "\t\tdataType: int64\n"
            "\tcolumn revenue\n"
            "\t\tdataType: double\n"
            "\tpartition Orders = m\n"
            "\t\tmode: import\n"
            "\t\tsource =\n"
            "\t\t\tlet\n"
            '\t\t\t    Source = Snowflake.Databases("acct.snowflakecomputing.com", "WH"),\n'
            '\t\t\t    DB = Source{[Name=TargetDatabase,Kind="Database"]}[Data],\n'
            '\t\t\t    Schema = DB{[Name=TargetSchema,Kind="Schema"]}[Data],\n'
            '\t\t\t    OrdersTable = Schema{[Name="FACT_ORDERS",Kind="Table"]}[Data]\n'
            "\t\t\tin\n"
            "\t\t\t    OrdersTable\n",
            encoding="utf-8",
        )

        source, mock_metadata = _make_source(tmp_path)
        # Simulate non-admin workspace where dataset.expressions is empty
        workspace = Group(
            id="ws-1",
            name="Sales Workspace",
            datasets=[Dataset(id="pbi-dataset-guid-1", name="Sales Analytics", expressions=[])],
        )
        source.state.enter(workspace)

        dm_entity = _make_datamodel_entity(
            dataset_id="pbi-dataset-guid-1",
            display_name="Sales Analytics",
            table_name="Orders",
            column_names=["order_id", "revenue"],
        )
        db_table = _make_table_entity("test_db.PROD_DW.ANALYTICS.FACT_ORDERS", ["order_id", "revenue"])

        captured_queries: list[str] = []

        def _fake_search(entity_type, fqn_search_string):
            captured_queries.append(fqn_search_string)
            if (
                "PROD_DW" in fqn_search_string
                and "ANALYTICS" in fqn_search_string
                and "FACT_ORDERS" in fqn_search_string
            ):
                return db_table
            return None

        mock_metadata.search_in_any_service.side_effect = _fake_search

        results = list(
            source.create_table_datamodel_lineage_from_files(
                db_service_prefix="test_db",
                datamodel_entity=dm_entity,
            )
        )

        assert len(results) == 1
        assert results[0].left is None
        lineage_req = results[0].right
        assert lineage_req is not None
        assert lineage_req.edge.fromEntity.id == db_table.id
        assert lineage_req.edge.toEntity.id == dm_entity.id
        assert captured_queries == ["test_db.PROD_DW.ANALYTICS.FACT_ORDERS"]

        col_edges = lineage_req.edge.lineageDetails.columnsLineage
        assert col_edges is not None
        mapped_pairs = {(edge.fromColumns[0].root, edge.toColumn.root) for edge in col_edges}
        assert mapped_pairs == {
            (
                "test_db.PROD_DW.ANALYTICS.FACT_ORDERS.order_id",
                "test_powerbi.model.pbi-dataset-guid-1.Orders.order_id",
            ),
            (
                "test_db.PROD_DW.ANALYTICS.FACT_ORDERS.revenue",
                "test_powerbi.model.pbi-dataset-guid-1.Orders.revenue",
            ),
        }

    def test_bigquery_and_databricks_expression_resolution_from_tmdl(self, tmp_path: Path):
        sm_dir = tmp_path / "MultiCloud.SemanticModel"
        tables_dir = sm_dir / "definition" / "tables"
        tables_dir.mkdir(parents=True)

        (sm_dir / ".platform").write_text(
            json.dumps(
                {
                    "metadata": {"type": "SemanticModel", "displayName": "MultiCloud Model"},
                    "config": {"version": "2.0", "logicalId": "mc-logical-id"},
                }
            ),
            encoding="utf-8",
        )
        (sm_dir / "definition" / "expressions.tmdl").write_text(
            'expression DB_CATALOG = "LAKEHOUSE_PROD" meta [IsParameterQuery=true, Type="Text"]\n'
            "\n"
            "expression SharedBQ =\n"
            "\t\tlet\n"
            '\t\t    Source = GoogleBigQuery.Database([BillingProject="gcp-prod"]),\n'
            '\t\t    Proj = Source{[Name="gcp-prod"]}[Data],\n'
            '\t\t    DS = Proj{[Name="marketing",Kind="Schema"]}[Data],\n'
            '\t\t    Tbl = DS{[Name="events",Kind="Table"]}[Data]\n'
            "\t\tin\n"
            "\t\t    Tbl\n"
            "\n"
            "expression CyclicA =\n"
            "\t\tlet\n"
            "\t\t    Source = CyclicB,\n"
            "\t\t    R = Source\n"
            "\t\tin\n"
            "\t\t    R\n"
            "\n"
            "expression CyclicB =\n"
            "\t\tlet\n"
            "\t\t    Source = CyclicA,\n"
            "\t\t    R = Source\n"
            "\t\tin\n"
            "\t\t    R\n",
            encoding="utf-8",
        )
        (tables_dir / "Events.tmdl").write_text(
            "table Events\n"
            "\tcolumn event_id\n"
            "\t\tdataType: string\n"
            "\tpartition Events = m\n"
            "\t\tmode: import\n"
            "\t\tsource =\n"
            "\t\t\tlet\n"
            "\t\t\t    Source = SharedBQ,\n"
            "\t\t\t    Out = Source\n"
            "\t\t\tin\n"
            "\t\t\t    Out\n",
            encoding="utf-8",
        )
        (tables_dir / "Metrics.tmdl").write_text(
            "table Metrics\n"
            "\tcolumn metric_id\n"
            "\t\tdataType: string\n"
            "\tpartition Metrics = m\n"
            "\t\tmode: import\n"
            "\t\tsource =\n"
            "\t\t\tlet\n"
            '\t\t\t    Source = Databricks.Catalogs("host.databricks.com", "/sql/1.0/warehouses/1", [Catalog="", Database=""]),\n'
            '\t\t\t    Cat = Source{[Name=DB_CATALOG,Kind="Database"]}[Data],\n'
            '\t\t\t    Sch = Cat{[Name="gold",Kind="Schema"]}[Data],\n'
            '\t\t\t    Tbl = Sch{[Name="daily_metrics",Kind="Table"]}[Data]\n'
            "\t\t\tin\n"
            "\t\t\t    Tbl\n",
            encoding="utf-8",
        )
        (tables_dir / "Cyclic.tmdl").write_text(
            "table Cyclic\n"
            "\tpartition Cyclic = m\n"
            "\t\tmode: import\n"
            "\t\tsource =\n"
            "\t\t\tlet\n"
            "\t\t\t    Source = CyclicA,\n"
            "\t\t\t    Out = Source\n"
            "\t\t\tin\n"
            "\t\t\t    Out\n",
            encoding="utf-8",
        )

        source, mock_metadata = _make_source(tmp_path)
        dm_entity = _make_datamodel_entity(
            dataset_id="mc-logical-id",
            display_name="Different Name",
            table_name="Events",
            column_names=["event_id"],
        )

        bq_table = _make_table_entity("test_db.gcp-prod.marketing.events", ["event_id"])
        dbx_table = _make_table_entity("test_db.LAKEHOUSE_PROD.gold.daily_metrics", ["metric_id"])
        tables_by_fqn = {
            "test_db.gcp-prod.marketing.events": bq_table,
            "test_db.LAKEHOUSE_PROD.gold.daily_metrics": dbx_table,
        }
        mock_metadata.search_in_any_service.side_effect = lambda entity_type, fqn_search_string: tables_by_fqn.get(
            fqn_search_string
        )

        results = list(
            source.create_table_datamodel_lineage_from_files(
                db_service_prefix="test_db",
                datamodel_entity=dm_entity,
            )
        )

        assert all(r.left is None for r in results)
        from_ids = {model_str(r.right.edge.fromEntity.id) for r in results if r.right is not None}
        assert from_ids == {model_str(bq_table.id), model_str(dbx_table.id)}


class TestSchemaMatchingPrecedence:
    def _schema_with_table(
        self,
        table_name: str,
        *,
        dataset_id: str | None = None,
        logical_id: str | None = None,
        model_name: str | None = None,
    ) -> DataModelSchema:
        conn = (
            ConnectionFile(RemoteArtifacts=[RemoteArtifacts(DatasetId=dataset_id, ReportId="rep-1")])
            if dataset_id
            else None
        )
        return DataModelSchema(
            connectionFile=conn,
            logicalId=logical_id,
            modelName=model_name,
            tables=[
                PowerBiTable(
                    name=table_name,
                    columns=[PowerBiColumns(name="id", dataType="int64")],
                    source=[
                        PowerBITableSource(
                            expression=(
                                "let\n"
                                '    Source = AmazonRedshift.Database("host:5439","dw"),\n'
                                '    s = Source{[Name="public"]}[Data],\n'
                                f'    t = s{{[Name="{table_name}"]}}[Data]\n'
                                "in\n"
                                "    t"
                            )
                        )
                    ],
                )
            ],
            expressions=[DatasetExpression(name="Unused", expression='"x" meta []')],
        )

    def test_precedence_dataset_id_over_logical_id_over_display_name(self):
        source, mock_metadata = _make_source(None)
        dm_entity = _make_datamodel_entity(
            dataset_id="guid-1",
            display_name="Revenue Model",
            table_name="orders",
            column_names=["id"],
        )

        schema_by_dataset_id = self._schema_with_table("tbl_dataset_id", dataset_id="GUID-1", model_name="Other")
        schema_by_logical_id = self._schema_with_table("tbl_logical_id", logical_id="guid-1", model_name="Other")
        schema_by_display_name = self._schema_with_table("tbl_display_name", model_name="revenue model")
        schema_wrong_dataset_same_name = self._schema_with_table(
            "tbl_wrong_dataset",
            dataset_id="guid-other",
            model_name="Revenue Model",
        )

        # 1. DatasetId wins over logicalId and displayName
        source.datamodel_file_mappings = [
            schema_by_display_name,
            schema_by_logical_id,
            schema_by_dataset_id,
        ]
        matched = source._match_datamodel_schemas(dm_entity)  # pylint: disable=protected-access
        assert [t.name for s in matched for t in s.tables or []] == ["tbl_dataset_id"]

        # 2. logicalId wins over displayName when DatasetId absent
        source.datamodel_file_mappings = [
            schema_by_display_name,
            schema_by_logical_id,
        ]
        matched = source._match_datamodel_schemas(dm_entity)  # pylint: disable=protected-access
        assert [t.name for s in matched for t in s.tables or []] == ["tbl_logical_id"]

        # 3. Case-insensitive displayName matches when connectionFile is None,
        #    and a schema with a conflicting explicit DatasetId does NOT falsely match by modelName
        source.datamodel_file_mappings = [
            schema_wrong_dataset_same_name,
            schema_by_display_name,
        ]
        matched = source._match_datamodel_schemas(dm_entity)  # pylint: disable=protected-access
        assert [t.name for s in matched for t in s.tables or []] == ["tbl_display_name"]

        # Verify end-to-end execution with connectionFile=None produces lineage without error
        target_table = _make_table_entity("test_db.dw.public.tbl_display_name", ["id"])
        mock_metadata.search_in_any_service.return_value = target_table
        results = list(
            source.create_table_datamodel_lineage_from_files(
                db_service_prefix="test_db",
                datamodel_entity=dm_entity,
            )
        )
        assert len(results) == 1
        assert results[0].left is None
        assert results[0].right.edge.fromEntity.id == target_table.id
