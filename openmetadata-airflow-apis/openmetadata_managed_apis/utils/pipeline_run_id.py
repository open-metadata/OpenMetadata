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

from uuid import NAMESPACE_URL, UUID, uuid5


def pipeline_run_id(dag_id: str, run_id: str) -> UUID:
    """Keep one metadata identity across queue responses, workers and callbacks."""
    try:
        return UUID(run_id)
    except ValueError:
        # Scheduled and older manual Airflow runs use date-based names, while
        # ingestion workflows require a UUID. Include the DAG to avoid collisions.
        return uuid5(NAMESPACE_URL, f"openmetadata:{dag_id}:{run_id}")
