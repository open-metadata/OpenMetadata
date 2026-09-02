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
Test that get_dagbag does not parse the whole DAG folder.

A deploy only needs the DAG file it has just written. Collecting the folder made a
single deploy cost O(total DAGs) and a bulk deploy O(total DAGs^2), which is what
made `deploy-pipelines` exceed its client deadline on larger deployments.

Airflow < 3.0 builds the bag with `read_dags_from_db=True`, which already early
returns out of `collect_dags`, so these assertions only apply from 3.0 onwards.
"""

import os
import textwrap
from unittest.mock import patch

import pytest
from airflow.models import DagBag
from airflow.version import version as airflow_version
from packaging import version

pytestmark = pytest.mark.skipif(
    version.parse(airflow_version) < version.parse("3.0.0"),
    reason="get_dagbag only builds a non-collecting DagBag on Airflow 3+",
)


def _write_dag_file(folder, dag_id: str):
    """Write a minimal, parseable DAG file and return its path"""
    dag_file = folder / f"{dag_id}.py"
    dag_file.write_text(
        textwrap.dedent(
            f"""
            from airflow import DAG

            dag = DAG("{dag_id}", schedule=None)
            """
        )
    )
    return dag_file


@pytest.fixture
def dags_folder(tmp_path):
    """A DAG folder holding a few unrelated DAGs, as a real deployment would"""
    folder = tmp_path / "dags"
    folder.mkdir()
    for index in range(3):
        _write_dag_file(folder, f"unrelated_dag_{index}")
    return folder


@patch.dict(os.environ, {"AIRFLOW_HOME": "/tmp"})
def test_get_dagbag_does_not_collect_the_dag_folder(dags_folder):
    """
    The bag comes back empty even though the folder holds DAGs.

    This is the regression lock: any change that repopulates the bag from the folder
    reintroduces an O(total DAGs) cost on every deploy.
    """
    from openmetadata_managed_apis.api import utils

    with patch.object(utils.settings, "DAGS_FOLDER", str(dags_folder)):
        dag_bag = utils.get_dagbag()

    assert dag_bag.size() == 0
    assert dag_bag.dags == {}
    assert dag_bag.dag_folder == str(dags_folder)


@patch.dict(os.environ, {"AIRFLOW_HOME": "/tmp"})
def test_get_dagbag_never_calls_collect_dags(dags_folder):
    """DagBag collects the folder in its constructor unless told not to"""
    from openmetadata_managed_apis.api import utils

    with (
        patch.object(utils.settings, "DAGS_FOLDER", str(dags_folder)),
        patch.object(DagBag, "collect_dags") as collect_dags,
    ):
        utils.get_dagbag()

    collect_dags.assert_not_called()


@patch.dict(os.environ, {"AIRFLOW_HOME": "/tmp"})
def test_process_file_bags_the_deployed_dag(dags_folder):
    """
    The deploy path still works: process_file bags the DAG that was just written.

    `refresh_session_dag` relies on the dag_id being present in the bag after
    `process_file`, so this asserts the behaviour the empty bag has to preserve. It
    also shows the folder walk was never what made the deploy work -- and in fact
    prevented `process_file` from doing anything, since `collect_dags` stamps
    `file_last_changed` for every file it walks and `process_file` then hits its
    `only_if_updated` early return.
    """
    from openmetadata_managed_apis.api import utils

    deployed = _write_dag_file(dags_folder, "the_deployed_dag")

    with patch.object(utils.settings, "DAGS_FOLDER", str(dags_folder)):
        dag_bag = utils.get_dagbag()

    found_dags = dag_bag.process_file(str(deployed))

    assert [dag.dag_id for dag in found_dags] == ["the_deployed_dag"]
    assert "the_deployed_dag" in dag_bag.dags
    # Only the deployed DAG is bagged, not the rest of the folder
    assert dag_bag.size() == 1
