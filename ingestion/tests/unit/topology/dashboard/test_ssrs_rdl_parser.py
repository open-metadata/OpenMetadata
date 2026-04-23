#  Copyright 2025 Collate
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
Unit tests for SSRS RDL parser
"""
from pathlib import Path

import pytest

from metadata.ingestion.source.dashboard.ssrs.rdl_parser import (
    parse_connect_string,
    parse_rdl,
)

FIXTURES = Path(__file__).parent / "fixtures" / "ssrs"


def _load(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


class TestParseRdl:
    def test_inline_single_dataset_2016(self):
        result = parse_rdl(_load("inline_single_dataset_2016.rdl"))
        assert len(result.data_sources) == 1
        ds = result.data_sources[0]
        assert ds.name == "SalesDS"
        assert ds.data_provider == "SQL"
        assert ds.server == "sql01.example.com"
        assert ds.database == "SalesDB"
        assert ds.shared_reference is None

        assert len(result.data_sets) == 1
        dataset = result.data_sets[0]
        assert dataset.name == "SalesDataset"
        assert dataset.data_source_name == "SalesDS"
        assert dataset.command_type == "Text"
        assert "SELECT OrderId" in dataset.command_text
        assert "@minTotal" in dataset.command_text
        assert [f.name for f in dataset.fields] == [
            "OrderId",
            "CustomerName",
            "Total",
        ]

    def test_inline_multi_dataset_2010(self):
        result = parse_rdl(_load("inline_multi_dataset_2010.rdl"))
        assert len(result.data_sources) == 1
        assert result.data_sources[0].server == "finance01"
        assert result.data_sources[0].database == "FinanceDB"

        names = [d.name for d in result.data_sets]
        assert names == ["Revenue", "Expenses"]
        assert result.data_sets[0].command_text.startswith("SELECT MonthName, Amount")
        assert result.data_sets[1].command_text.startswith("SELECT Category, Amount")

    def test_shared_datasource_reference(self):
        result = parse_rdl(_load("shared_datasource.rdl"))
        assert len(result.data_sources) == 1
        ds = result.data_sources[0]
        assert ds.name == "SharedDS"
        assert ds.shared_reference == "/Shared Data Sources/Warehouse"
        assert ds.connect_string is None
        assert ds.database is None

    def test_no_datasource(self):
        result = parse_rdl(_load("no_datasource.rdl"))
        assert result.data_sources == []
        assert result.data_sets == []

    def test_expression_command_type(self):
        result = parse_rdl(_load("expression_commandtype.rdl"))
        dataset = result.data_sets[0]
        assert dataset.command_type == "Expression"

    def test_malformed_raises_value_error(self):
        with pytest.raises(ValueError):
            parse_rdl(_load("malformed.rdl"))

    def test_empty_bytes_raises_value_error(self):
        with pytest.raises(ValueError):
            parse_rdl(b"")

    def test_doctype_is_rejected(self):
        payload = (
            b'<?xml version="1.0"?>'
            b'<!DOCTYPE lolz [<!ENTITY lol "lol">]>'
            b"<Report />"
        )
        with pytest.raises(ValueError, match="DTD or entity"):
            parse_rdl(payload)

    def test_entity_is_rejected(self):
        payload = b'<?xml version="1.0"?><!ENTITY x "y"><Report />'
        with pytest.raises(ValueError, match="DTD or entity"):
            parse_rdl(payload)

    @pytest.mark.parametrize(
        "variant",
        [
            b"<!DocType",
            b"<!dOcTyPe",
            b"<!DOCTYPE",
            b"<!doctype",
            b"<!Entity",
            b"<!eNtItY",
            b"<!ENTITY",
            b"<!entity",
        ],
    )
    def test_mixed_case_dtd_variants_rejected(self, variant):
        payload = b'<?xml version="1.0"?>' + variant + b' x "y"><Report />'
        with pytest.raises(ValueError, match="DTD or entity"):
            parse_rdl(payload)

    def test_doctype_after_leading_comment_rejected(self):
        padding = b"<!-- " + (b"x" * 8192) + b" -->"
        payload = (
            b'<?xml version="1.0"?>'
            + padding
            + b'<!DOCTYPE lolz [<!ENTITY lol "lol">]><Report />'
        )
        with pytest.raises(ValueError, match="DTD or entity"):
            parse_rdl(payload)

    def test_namespace_2008_2010_2016_equivalence(self):
        template = (
            '<Report xmlns="{ns}">'
            "<DataSources>"
            '<DataSource Name="DS">'
            "<ConnectionProperties>"
            "<DataProvider>SQL</DataProvider>"
            "<ConnectString>Data Source=s;Initial Catalog=d</ConnectString>"
            "</ConnectionProperties></DataSource></DataSources>"
            "<DataSets>"
            '<DataSet Name="Q">'
            "<Query><DataSourceName>DS</DataSourceName>"
            "<CommandType>Text</CommandType>"
            "<CommandText>SELECT 1</CommandText></Query>"
            "</DataSet></DataSets></Report>"
        )
        for ns in (
            "http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition",
            "http://schemas.microsoft.com/sqlserver/reporting/2010/01/reportdefinition",
            "http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition",
        ):
            result = parse_rdl(template.format(ns=ns).encode("utf-8"))
            assert result.data_sources[0].database == "d"
            assert result.data_sets[0].command_text == "SELECT 1"


class TestParseConnectString:
    @pytest.mark.parametrize(
        "connect_string,expected_server,expected_db",
        [
            ("Data Source=srv;Initial Catalog=db", "srv", "db"),
            ("data source=srv;initial catalog=db", "srv", "db"),
            ("Server=srv;Database=db", "srv", "db"),
            ("Address=srv;Database=db", "srv", "db"),
            (
                "Data Source=srv;Initial Catalog=db;Integrated Security=SSPI;",
                "srv",
                "db",
            ),
            ("Data Source=srv", "srv", None),
            ("Initial Catalog=db", None, "db"),
            ("", None, None),
            (None, None, None),
            ("Data Source=;Initial Catalog=db", None, "db"),
            ("garbage;no;equals", None, None),
        ],
    )
    def test_variants(self, connect_string, expected_server, expected_db):
        assert parse_connect_string(connect_string) == (
            expected_server,
            expected_db,
        )
