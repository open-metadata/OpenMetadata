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

from unittest.mock import create_autospec, patch

from openmetadata_managed_apis.operations import trigger as trigger_module


def test_runs_triggered_in_the_same_second_keep_distinct_logical_dates():
    """Airflow keys a run by (dag_id, logical_date) and by default truncates the date to the
    second, so a second trigger within the same second would collide with the first."""
    trigger_dag = create_autospec(trigger_module.trigger_dag)

    with patch.object(trigger_module, "trigger_dag", trigger_dag):
        trigger_module.trigger(dag_id="suite", run_id=None)
        trigger_module.trigger(dag_id="suite", run_id=None)

    first, second = (call.kwargs for call in trigger_dag.call_args_list)
    assert first["replace_microseconds"] is False
    assert second["replace_microseconds"] is False
