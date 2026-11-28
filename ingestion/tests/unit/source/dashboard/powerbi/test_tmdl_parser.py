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
Unit tests for the pure-Python Power BI TMDL parser.
"""

import json
from pathlib import Path

from metadata.ingestion.source.dashboard.powerbi.tmdl_parser import (
    parse_tmdl_directory,
    parse_tmdl_files,
)


class TestTmdlIdentifiersAndComments:
    def test_quoted_identifiers_escaped_quotes_and_doc_comments(self):
        table_tmdl = (
            "/// Primary sales orders table\n"
            "/// Contains one row per order line\n"
            "table 'Sales''s Orders'\n"
            "\t/// Unique identifier\n"
            "\tcolumn 'Customer''s Name'\n"
            "\t\tdataType: string\n"
            "\t\tisHidden\n"
            "\n"
            "\t/// This orphan comment must be cleared by the blank line below\n"
            "\n"
            "\tcolumn 'Order = Value'\n"
            "\t\tdataType: double\n"
            "\n"
            "\t/// Calculated full label\n"
            "\tcolumn 'Full = Label' = 'Sales''s Orders'[Customer''s Name] & \"!\"\n"
            "\t\tdataType: string\n"
        )

        schema = parse_tmdl_files({"tables/Sales.tmdl": table_tmdl})

        assert schema is not None
        assert schema.tables is not None
        assert len(schema.tables) == 1
        table = schema.tables[0]
        assert table.name == "Sales's Orders"
        assert table.description == "Primary sales orders table\nContains one row per order line"

        cols = {col.name: col for col in table.columns or []}
        assert cols["Customer's Name"].dataType == "string"
        assert cols["Customer's Name"].description == "Unique identifier"
        assert cols["Customer's Name"].isHidden is True

        assert cols["Order = Value"].dataType == "double"
        assert cols["Order = Value"].description is None
        assert cols["Order = Value"].isHidden is False

        assert cols["Full = Label"].dataType == "string"
        assert cols["Full = Label"].columnType == "calculated"
        assert cols["Full = Label"].description == "Calculated full label"

    def test_utf8_bom_in_memory_and_on_disk(self, tmp_path: Path):
        tmdl_content = "table Orders\n\tcolumn OrderId\n\t\tdataType: int64\n"

        # In-memory with leading BOM
        mem_schema = parse_tmdl_files({"tables/Orders.tmdl": "\ufeff" + tmdl_content})
        assert mem_schema is not None
        assert [t.name for t in mem_schema.tables or []] == ["Orders"]

        # On disk with UTF-8 BOM bytes
        tables_dir = tmp_path / "Sales.SemanticModel" / "definition" / "tables"
        tables_dir.mkdir(parents=True)
        (tables_dir / "Orders.tmdl").write_bytes(b"\xef\xbb\xbf" + tmdl_content.encode("utf-8"))

        disk_schema = parse_tmdl_directory(tmp_path / "Sales.SemanticModel")
        assert disk_schema is not None
        assert disk_schema.modelName == "Sales"
        assert [t.name for t in disk_schema.tables or []] == ["Orders"]
        assert disk_schema.tables[0].columns[0].name == "OrderId"


class TestTmdlExpressionsAndIndentation:
    def test_tabs_spaces_and_multiline_dax_and_m_expressions(self):
        # 2-space indented table with inline measure, 1-level multiline measure, and M partition
        space_table = (
            "table Orders\n"
            "  column Amount\n"
            "    dataType: double\n"
            "  measure 'Simple Sum' = SUM(Orders[Amount])\n"
            "    formatString: #,0\n"
            "    isHidden: true\n"
            "  measure 'Handwritten Multiline' =\n"
            "    DIVIDE(\n"
            "      SUM(Orders[Amount]),\n"
            "      COUNTROWS(Orders)\n"
            "    )\n"
            "    formatString: 0.00%\n"
            "    isHidden\n"
            "  partition Orders-M = m\n"
            "    mode: import\n"
            "    source =\n"
            "      let\n"
            '        Source = AmazonRedshift.Database("cluster.redshift.amazonaws.com:5439","analytics"),\n'
            '        public = Source{[Name="public"]}[Data],\n'
            '        orders = public{[Name="orders"]}[Data]\n'
            "      in\n"
            "        orders\n"
        )

        # Tab-indented table with Power BI Desktop 2-level multiline measure and tab+space M query
        tab_table = (
            "table Customers\n"
            "\t/// Total distinct customers\n"
            "\tmeasure 'Customer Count' =\n"
            "\t\t\tVAR active = FILTER(Customers, Customers[Active] = TRUE())\n"
            "\t\t\tRETURN COUNTROWS(active)\n"
            "\t\tformatString: #,0\n"
            "\t\tlineageTag: m-1\n"
            "\tpartition Customers-M = m\n"
            "\t\tmode: directQuery\n"
            "\t\tsource =\n"
            "\t\t\t\tlet\n"
            '\t\t\t\t    Source = Snowflake.Databases("acct.snowflakecomputing.com", "WH"),\n'
            '\t\t\t\t    DB = Source{[Name="PROD",Kind="Database"]}[Data]\n'
            "\t\t\t\tin\n"
            "\t\t\t\t    DB\n"
        )

        schema = parse_tmdl_files(
            {
                "tables/Orders.tmdl": space_table,
                "tables/Customers.tmdl": tab_table,
            }
        )

        assert schema is not None
        tables = {t.name: t for t in schema.tables or []}

        orders_measures = {m.name: m for m in tables["Orders"].measures or []}
        assert orders_measures["Simple Sum"].expression == "SUM(Orders[Amount])"
        assert orders_measures["Simple Sum"].formatString == "#,0"
        assert orders_measures["Simple Sum"].isHidden is True
        assert "DIVIDE(" in (orders_measures["Handwritten Multiline"].expression or "")
        assert orders_measures["Handwritten Multiline"].formatString == "0.00%"
        assert orders_measures["Handwritten Multiline"].isHidden is True

        assert tables["Orders"].partitions[0].mode == "import"
        assert "AmazonRedshift.Database" in (tables["Orders"].source[0].expression or "")

        cust_measure = tables["Customers"].measures[0]
        assert cust_measure.name == "Customer Count"
        assert cust_measure.description == "Total distinct customers"
        assert cust_measure.formatString == "#,0"
        assert "VAR active" in (cust_measure.expression or "")
        assert "RETURN COUNTROWS(active)" in (cust_measure.expression or "")
        assert tables["Customers"].partitions[0].mode == "directQuery"
        assert "Snowflake.Databases" in (tables["Customers"].source[0].expression or "")

    def test_triple_backtick_verbatim_expressions_preserve_keyword_like_lines(self):
        tmdl = (
            "table VerbatimTest\n"
            "\tmeasure 'Tricky DAX' = ```\n"
            '\t\tVAR label = "formatString: not a property"\n'
            "\t\t// blank line below must stay inside expression\n"
            "\n"
            '\t\tRETURN IF(TRUE(), "isHidden", label)\n'
            "\t\t```\n"
            "\t\tformatString: 0.0\n"
            "\t\tisHidden\n"
            "\tmeasure 'Inline Backticks' = ```SUM(VerbatimTest[X])```\n"
            "\t\tformatString: 0\n"
            "\tpartition Verbatim-M = m\n"
            "\t\tmode: import\n"
            "\t\tsource = ```\n"
            "\t\t\tlet\n"
            '\t\t\t    Source = Sql.Database("srv", "db", [Query="SELECT 1\n'
            'FROM dbo.orders"]),\n'
            "\t\t\t    Result = Source\n"
            "\t\t\tin\n"
            "\t\t\t    Result\n"
            "\t\t\t```\n"
        )

        schema = parse_tmdl_files({"tables/VerbatimTest.tmdl": tmdl})
        assert schema is not None
        table = schema.tables[0]
        measures = {m.name: m for m in table.measures or []}

        assert "formatString: not a property" in (measures["Tricky DAX"].expression or "")
        assert '"isHidden"' in (measures["Tricky DAX"].expression or "")
        assert measures["Tricky DAX"].formatString == "0.0"
        assert measures["Tricky DAX"].isHidden is True

        assert measures["Inline Backticks"].expression == "SUM(VerbatimTest[X])"
        assert measures["Inline Backticks"].formatString == "0"

        assert "Sql.Database" in (table.source[0].expression or "")
        assert "FROM dbo.orders" in (table.source[0].expression or "")

    def test_partitions_m_calculated_and_entity_and_ignored_hierarchy(self):
        tmdl = (
            "table Calendar\n"
            "\tcolumn Date\n"
            "\t\tdataType: dateTime\n"
            "\t\tvariation Variation\n"
            "\t\t\tisDefault\n"
            "\t\t\trelationship: rel-auto\n"
            "\thierarchy 'Date Hierarchy'\n"
            "\t\tlineageTag: h-1\n"
            "\t\tlevel Year\n"
            "\t\t\tlineageTag: l-1\n"
            "\t\t\tcolumn: Date\n"
            "\tpartition Calendar-Calc = calculated\n"
            "\t\tmode: import\n"
            "\t\tsource = CALENDARAUTO()\n"
            "\tpartition Calendar-M = m\n"
            "\t\tmode: import\n"
            "\t\tsource =\n"
            "\t\t\tlet\n"
            '\t\t\t    Source = Snowflake.Databases("acct", "WH")\n'
            "\t\t\tin\n"
            "\t\t\t    Source\n"
            "\tpartition Calendar-Lake = entity\n"
            "\t\tmode: directLake\n"
            "\t\tsource\n"
            "\t\t\tentityName: dim_calendar\n"
            "\t\t\tschemaName: dbo\n"
            "\t\t\texpressionSource: DatabaseQuery\n"
        )

        schema = parse_tmdl_files({"tables/Calendar.tmdl": tmdl})
        assert schema is not None
        table = schema.tables[0]

        # `column: Date` inside hierarchy level must NOT create a duplicate column
        assert [c.name for c in table.columns or []] == ["Date"]
        assert [p.name for p in table.partitions or []] == ["Calendar-Calc", "Calendar-M", "Calendar-Lake"]
        assert table.partitions[2].mode == "directLake"
        # M partition source must be prioritized first in table.source for M-query lineage parsers
        assert table.source is not None
        assert "Snowflake.Databases" in (table.source[0].expression or "")


class TestTmdlFullModelDirectoryAndMetadata:
    def test_full_pbip_directory_with_expressions_relationships_platform_and_pbir(self, tmp_path: Path):
        sm_dir = tmp_path / "Sales.SemanticModel"
        def_dir = sm_dir / "definition"
        tables_dir = def_dir / "tables"
        tables_dir.mkdir(parents=True)

        (sm_dir / ".platform").write_text(
            json.dumps(
                {
                    "metadata": {"type": "SemanticModel", "displayName": "Enterprise Sales"},
                    "config": {"version": "2.0", "logicalId": "logical-guid-1234"},
                }
            ),
            encoding="utf-8",
        )
        (def_dir / "database.tmdl").write_text("database SalesDB\n\tcompatibilityLevel: 1567\n", encoding="utf-8")
        (def_dir / "model.tmdl").write_text(
            "model Model\n\tculture: en-US\n\nref table Orders\nref table Customers\n",
            encoding="utf-8",
        )
        (def_dir / "expressions.tmdl").write_text(
            'expression DatabaseName = "PROD_DW" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n'
            "\tlineageTag: e-1\n"
            "\n"
            "expression 'Shared Base' =\n"
            "\t\tlet\n"
            '\t\t    Source = GoogleBigQuery.Database([BillingProject="gcp-proj"])\n'
            "\t\tin\n"
            "\t\t    Source\n"
            "\tlineageTag: e-2\n",
            encoding="utf-8",
        )
        (def_dir / "relationships.tmdl").write_text(
            "relationship rel_orders_customers\n"
            "\tfromColumn: Orders.CustomerID\n"
            "\ttoColumn: Customers.CustomerID\n"
            "\tfromCardinality: many\n"
            "\ttoCardinality: one\n"
            "\tcrossFilteringBehavior: bothDirections\n"
            "\n"
            "relationship 'Inactive Rel'\n"
            "\tfromColumn: Orders.ShipDate\n"
            "\ttoColumn: Calendar.Date\n"
            "\tisActive: false\n",
            encoding="utf-8",
        )
        (tables_dir / "Orders.tmdl").write_text(
            "table Orders\n\tcolumn CustomerID\n\t\tdataType: int64\n",
            encoding="utf-8",
        )

        # Sibling report with matching stem and byConnection DatasetId
        report_dir = tmp_path / "Sales.Report"
        report_dir.mkdir()
        (report_dir / "definition.pbir").write_text(
            json.dumps(
                {
                    "version": "4.0",
                    "datasetReference": {
                        "byPath": None,
                        "byConnection": {
                            "pbiModelDatabaseName": "dataset-guid-9999",
                            "connectionType": "pbiServiceXmlaStyleLive",
                        },
                    },
                }
            ),
            encoding="utf-8",
        )

        # Unrelated report pointing via byPath to another model must be ignored
        other_report = tmp_path / "Other.Report"
        other_report.mkdir()
        (other_report / "definition.pbir").write_text(
            json.dumps(
                {
                    "version": "4.0",
                    "datasetReference": {
                        "byPath": {"path": "../Other.SemanticModel"},
                        "byConnection": {"pbiModelDatabaseName": "wrong-dataset-guid"},
                    },
                }
            ),
            encoding="utf-8",
        )

        schema = parse_tmdl_directory(sm_dir)

        assert schema is not None
        assert schema.modelName == "Enterprise Sales"
        assert schema.logicalId == "logical-guid-1234"
        assert schema.connectionFile is not None
        assert schema.connectionFile.RemoteArtifacts[0].DatasetId == "dataset-guid-9999"

        exprs = {e.name: e.expression for e in schema.expressions or []}
        assert (
            exprs["DatabaseName"]
            == '"PROD_DW" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]'
        )
        assert "GoogleBigQuery.Database" in (exprs["Shared Base"] or "")

        rels = {r.name: r for r in schema.relationships or []}
        assert rels["rel_orders_customers"].fromColumn == "Orders.CustomerID"
        assert rels["rel_orders_customers"].toColumn == "Customers.CustomerID"
        assert rels["rel_orders_customers"].fromCardinality == "many"
        assert rels["rel_orders_customers"].toCardinality == "one"
        assert rels["rel_orders_customers"].crossFilteringBehavior == "bothDirections"
        assert rels["rel_orders_customers"].isActive is True

        assert rels["Inactive Rel"].isActive is False

        # Passing `definition/` directly should still discover `.platform` and sibling `.Report/definition.pbir`
        schema_from_def = parse_tmdl_directory(def_dir)
        assert schema_from_def is not None
        assert schema_from_def.modelName == "Enterprise Sales"
        assert schema_from_def.logicalId == "logical-guid-1234"
        assert schema_from_def.connectionFile.RemoteArtifacts[0].DatasetId == "dataset-guid-9999"

    def test_database_name_fallback_when_no_platform_or_semanticmodel_suffix(self, tmp_path: Path):
        (tmp_path / "database.tmdl").write_text("database FinanceDB\n", encoding="utf-8")
        (tmp_path / "tables").mkdir()
        (tmp_path / "tables" / "Ledger.tmdl").write_text(
            "table Ledger\n\tcolumn Id\n\t\tdataType: int64\n", encoding="utf-8"
        )

        schema = parse_tmdl_directory(tmp_path)
        assert schema is not None
        assert schema.modelName == "FinanceDB"
        assert schema.connectionFile is None
        assert schema.logicalId is None

    def test_empty_and_malformed_inputs_return_none_safely(self, tmp_path: Path):
        assert parse_tmdl_files({}) is None
        assert parse_tmdl_directory(tmp_path / "does_not_exist") is None

        # Only comments / ignored metadata / invalid JSON -> no tables/expressions/relationships -> None
        assert (
            parse_tmdl_files(
                {
                    ".platform": "{not valid json",
                    "definition.pbir": "[]",
                    "model.tmdl": "/// just a comment\nmodel Model\n\tref table Missing\n",
                }
            )
            is None
        )

        # Unclosed quote and unclosed backticks should not raise
        partial = parse_tmdl_files({"tables/Broken.tmdl": ("table 'Unclosed\n\tmeasure M = ```\n\t\tSUM(A[B])\n")})
        assert partial is not None
        assert partial.tables[0].name == "Unclosed"
        assert partial.tables[0].measures[0].expression == "SUM(A[B])"

    def test_report_platform_json_is_ignored_for_semantic_model_metadata(self):
        schema = parse_tmdl_files(
            {
                "Sales.Report/.platform": json.dumps(
                    {
                        "metadata": {"type": "Report", "displayName": "Wrong Report Name"},
                        "config": {"logicalId": "wrong-report-logical-id"},
                    }
                ),
                "tables/Orders.tmdl": "table Orders\n\tcolumn Id\n\t\tdataType: int64\n",
            },
            model_name="Sales",
        )
        assert schema is not None
        assert schema.modelName == "Sales"
        assert schema.logicalId is None
