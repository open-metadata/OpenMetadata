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
Unit tests for Power BI file client TMDL discovery, PBIT expression extraction,
cloud blob grouping, path-traversal guards, and local TMDL deletion safety.
"""

import json
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.powerbi.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    LocalConfig,
    PowerBIConnection,
)
from metadata.ingestion.source.dashboard.powerbi.file_client import (
    PowerBiFileClient,
    PowerBIFileConfigException,
    _safe_local_path,
    download_pbit_files,
    get_blobs_grouped_by_dir,
    get_datamodel_schema_files_from_pbit,
    get_pbit_files,
)


def _write_pbit(path: Path, members: dict[str, str]) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        for name, content in members.items():
            zf.writestr(name, content)


def _create_tmdl_semantic_model(
    base_dir: Path,
    model_folder: str = "Sales.SemanticModel",
    display_name: str = "Sales",
    logical_id: str = "logical-1",
    table_name: str = "Orders",
) -> Path:
    sm_dir = base_dir / model_folder
    tables_dir = sm_dir / "definition" / "tables"
    tables_dir.mkdir(parents=True)
    (sm_dir / ".platform").write_text(
        json.dumps(
            {
                "metadata": {"type": "SemanticModel", "displayName": display_name},
                "config": {"version": "2.0", "logicalId": logical_id},
            }
        ),
        encoding="utf-8",
    )
    (sm_dir / "definition.pbism").write_text(json.dumps({"version": "4.0"}), encoding="utf-8")
    (sm_dir / "definition" / "model.tmdl").write_text(
        f"model Model\n\tref table {table_name}\n",
        encoding="utf-8",
    )
    (tables_dir / f"{table_name}.tmdl").write_text(
        f"table {table_name}\n"
        "\tcolumn OrderId\n"
        "\t\tdataType: int64\n"
        f"\tpartition {table_name} = m\n"
        "\t\tmode: import\n"
        "\t\tsource =\n"
        "\t\t\tlet\n"
        '\t\t\t    Source = Snowflake.Databases("acct.snowflakecomputing.com", "WH"),\n'
        '\t\t\t    DB = Source{[Name="PROD",Kind="Database"]}[Data],\n'
        '\t\t\t    Schema = DB{[Name="PUBLIC",Kind="Schema"]}[Data],\n'
        f'\t\t\t    Tbl = Schema{{[Name="{table_name}",Kind="Table"]}}[Data]\n'
        "\t\t\tin\n"
        "\t\t\t    Tbl\n",
        encoding="utf-8",
    )
    return sm_dir


class TestLocalTmdlAndMixedDiscovery:
    def test_local_tmdl_discovery_no_duplicates(self, tmp_path: Path):
        _create_tmdl_semantic_model(tmp_path, "Sales.SemanticModel", "Sales", "logical-sales", "Orders")
        _create_tmdl_semantic_model(tmp_path, "Marketing.SemanticModel", "Marketing", "logical-mkt", "Campaigns")

        local_cfg = LocalConfig(path=str(tmp_path))
        schemas = get_pbit_files(local_cfg)

        assert schemas is not None
        assert len(schemas) == 2
        by_name = {s.modelName: s for s in schemas}
        assert set(by_name) == {"Sales", "Marketing"}
        assert [t.name for t in by_name["Sales"].tables or []] == ["Orders"]
        assert [t.name for t in by_name["Marketing"].tables or []] == ["Campaigns"]
        # Pure TMDL directory should not create an `extracted/` directory
        assert not (tmp_path / "extracted").exists()

    def test_mixed_pbit_and_tmdl_in_same_directory_and_pbit_expressions(self, tmp_path: Path):
        _create_tmdl_semantic_model(tmp_path, "Sales.SemanticModel", "Sales", "logical-sales", "Orders")
        _write_pbit(
            tmp_path / "Legacy.pbit",
            {
                "Connections": json.dumps({"RemoteArtifacts": [{"DatasetId": "pbit-ds-1", "ReportId": "rep-1"}]}),
                "DataModelSchema": json.dumps(
                    {
                        "model": {
                            "tables": [{"name": "LegacyOrders"}],
                            "expressions": [
                                {
                                    "name": "TargetDb",
                                    "kind": "m",
                                    "expression": ['"LEGACY_DW" meta [IsParameterQuery=true, Type="Text"]'],
                                }
                            ],
                        }
                    }
                ),
            },
        )

        schemas = get_datamodel_schema_files_from_pbit(str(tmp_path))

        assert schemas is not None
        assert len(schemas) == 2

        pbit_schemas = [s for s in schemas if s.connectionFile is not None]
        tmdl_schemas = [s for s in schemas if s.connectionFile is None]
        assert len(pbit_schemas) == 1
        assert len(tmdl_schemas) == 1

        assert pbit_schemas[0].connectionFile.RemoteArtifacts[0].DatasetId == "pbit-ds-1"
        assert [t.name for t in pbit_schemas[0].tables or []] == ["LegacyOrders"]
        assert pbit_schemas[0].expressions is not None
        assert pbit_schemas[0].expressions[0].name == "TargetDb"
        assert pbit_schemas[0].expressions[0].expression == '"LEGACY_DW" meta [IsParameterQuery=true, Type="Text"]'

        assert tmdl_schemas[0].modelName == "Sales"
        assert [t.name for t in tmdl_schemas[0].tables or []] == ["Orders"]


class TestCloudBlobGroupingAndPathTraversal:
    def test_get_blobs_grouped_by_dir_accepts_pbit_and_tmdl_files_only(self):
        blobs = [
            "Legacy.pbit",
            "Sales.SemanticModel/.platform",
            "Sales.SemanticModel/definition.pbism",
            "Sales.SemanticModel/definition/database.tmdl",
            "Sales.SemanticModel/definition/model.tmdl",
            "Sales.SemanticModel/definition/expressions.tmdl",
            "Sales.SemanticModel/definition/relationships.tmdl",
            "Sales.SemanticModel/definition/tables/Orders.tmdl",
            "Sales.Report/definition.pbir",
            "Sales.Report/report.json",
            "Sales.pbip",
            "README.md",
            "diagram.png",
        ]

        grouped = get_blobs_grouped_by_dir(blobs)
        flattened = sorted(key for keys in grouped.values() for key in keys)

        assert flattened == sorted(
            [
                "Legacy.pbit",
                "Sales.SemanticModel/.platform",
                "Sales.SemanticModel/definition.pbism",
                "Sales.SemanticModel/definition/database.tmdl",
                "Sales.SemanticModel/definition/model.tmdl",
                "Sales.SemanticModel/definition/expressions.tmdl",
                "Sales.SemanticModel/definition/relationships.tmdl",
                "Sales.SemanticModel/definition/tables/Orders.tmdl",
                "Sales.Report/definition.pbir",
            ]
        )

    @patch("metadata.ingestion.source.dashboard.powerbi.file_client.get_reader")
    def test_tmdl_traversal_blobs_rejected_while_valid_tmdl_downloads(self, mock_get_reader, tmp_path: Path):
        class _FakeReader:
            def download(self, path, local_file_path, **__):
                Path(local_file_path).write_text(f"downloaded:{path}", encoding="utf-8")

        mock_get_reader.return_value = _FakeReader()
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        outside = tmp_path / "outside"
        outside.mkdir()

        malicious_keys = [
            "Sales.SemanticModel/../../outside/evil.tmdl",
            "Sales.SemanticModel/../../outside/.platform",
            "/etc/evil.tmdl",
            "Sales.Report/../../outside/definition.pbir",
        ]
        for key in malicious_keys:
            with pytest.raises(PowerBIFileConfigException, match="escapes the extract directory"):
                _safe_local_path(str(extract_dir), key)

        grouped = get_blobs_grouped_by_dir(
            malicious_keys
            + [
                "Sales.SemanticModel/.platform",
                "Sales.SemanticModel/definition/tables/Orders.tmdl",
            ]
        )
        download_pbit_files(
            blob_grouped_by_directory=grouped,
            config=MagicMock(),
            client=MagicMock(),
            bucket_name="my-bucket",
            extract_dir=str(extract_dir),
        )

        assert not (outside / "evil.tmdl").exists()
        assert not (outside / ".platform").exists()
        assert not (outside / "definition.pbir").exists()
        assert (extract_dir / "Sales.SemanticModel" / ".platform").is_file()
        assert (extract_dir / "Sales.SemanticModel" / "definition" / "tables" / "Orders.tmdl").is_file()


class TestDeleteTmpFilesSafety:
    def _make_local_connection(self, path: str | None, extract_dir: str) -> PowerBIConnection:
        payload: dict = {
            "pbitFileConfigType": "local",
            "pbitFilesExtractDir": extract_dir,
        }
        if path is not None:
            payload["path"] = path
        return PowerBIConnection.model_validate(
            {
                "clientId": "cid",
                "clientSecret": "csec",
                "tenantId": "tid",
                "pbitFilesSource": payload,
            }
        )

    def test_delete_tmp_files_never_deletes_local_tmdl_directory_on_overlap(self, tmp_path: Path):
        workspace_dir = tmp_path / "pbip_workspace"
        sm_dir = _create_tmdl_semantic_model(workspace_dir)
        marker_file = sm_dir / "definition" / "tables" / "Orders.tmdl"

        # Case 1: extract_dir == local path
        PowerBiFileClient(self._make_local_connection(str(workspace_dir), str(workspace_dir))).delete_tmp_files()
        assert marker_file.is_file()

        # Case 2: extract_dir is an ancestor of local path
        PowerBiFileClient(self._make_local_connection(str(sm_dir), str(workspace_dir))).delete_tmp_files()
        assert marker_file.is_file()

        # Case 3: extract_dir is inside local path
        PowerBiFileClient(self._make_local_connection(str(workspace_dir), str(sm_dir))).delete_tmp_files()
        assert marker_file.is_file()

        # Case 4: path is None, but extract_dir itself contains local TMDL files
        PowerBiFileClient(self._make_local_connection(None, str(workspace_dir))).delete_tmp_files()
        assert marker_file.is_file()

    def test_delete_tmp_files_still_removes_cloud_extract_dir_with_downloaded_tmdl(self, tmp_path: Path):
        cloud_extract = tmp_path / "cloud_tmp"
        _create_tmdl_semantic_model(cloud_extract)

        s3_source = MagicMock(spec=S3Config)
        s3_source.pbitFilesExtractDir = str(cloud_extract)
        conn = MagicMock(spec=PowerBIConnection)
        conn.pbitFilesSource = s3_source

        PowerBiFileClient(conn).delete_tmp_files()
        assert not cloud_extract.exists()
