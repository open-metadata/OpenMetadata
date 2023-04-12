#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Queries module for airflow
"""

BUILD_DAG_SQL_QUERY = """
SELECT dag.dag_id , dag.fileloc ,serialized_dag.data , dag.max_active_runs , dag.description FROM serialized_dag INNER JOIN dag ON serialized_dag.dag_id = dag.dag_id WHERE serialized_dag.dag_id='{dag_id}'
"""
