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
"""Reject false passes even when healthy entities are already visible."""

import sys
from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from metadata.generated.schema.entity.data.table import Table

from ..features.database.entities import table_query
from ..mysql.test_metadata import test_error_containment_one_broken_view as error_containment_scenario
from ..runtime.cli import CliExecutionError, CliRunner, WorkflowInvocation
from .test_cli import PROBE


@pytest.mark.parametrize(
    "exit_code,failures,expected_error",
    [
        (2, None, CliExecutionError),
        (-1, None, CliExecutionError),
        (1, None, CliExecutionError),
        (0, [], CliExecutionError),
        (1, [{"name": "my_other_table", "error": "unrelated failure"}], AssertionError),
    ],
)
def test_error_containment_rejects_unexpected_execution(tmp_path, exit_code, failures, expected_error):
    with pytest.raises(expected_error):
        _run_scenario(tmp_path, exit_code, failures)


def test_error_containment_accepts_only_the_named_failure_and_healthy_survivors(tmp_path):
    _run_scenario(tmp_path, 1, [{"name": "_broken_view", "error": "invalid view"}])


def _run_scenario(tmp_path, exit_code, failures):
    script = tmp_path / "probe.py"
    script.write_text(PROBE)
    cli = CliRunner(tmp_path / "cli", command=(sys.executable, str(script)))

    def invocation(options):
        return WorkflowInvocation(
            "ingest",
            {
                "workflowConfig": {},
                "probe": {
                    "exit": exit_code,
                    "missing": failures is None,
                    "success": not failures,
                    "errors": len(failures or []),
                    "failures": failures,
                },
            },
        )

    connection = SimpleNamespace(execute=lambda statement: None)
    engine = SimpleNamespace(
        begin=lambda: nullcontext(connection),
        dialect=SimpleNamespace(identifier_preparer=SimpleNamespace(quote_identifier=lambda name: name)),
    )

    def get_by_name(*, entity, fqn, fields, include):
        assert entity is Table
        assert fqn in {
            "my_service.default.my_schema.customers",
            "my_service.default.my_schema.transactions",
            "my_service.default.my_schema.all_types",
        }
        return Table(
            id="00000000-0000-0000-0000-000000000001",
            name=fqn.rsplit(".", 1)[1],
            fullyQualifiedName=fqn,
            columns=[],
            deleted=False,
        )

    om = SimpleNamespace(get_by_name=get_by_name)
    error_containment_scenario(
        cli=cli,
        mysql=SimpleNamespace(
            source=SimpleNamespace(schema="my_schema", admin_engine=engine),
            invocation=invocation,
            table_query=lambda name: table_query(om, f"my_service.default.my_schema.{name}"),
        ),
    )
