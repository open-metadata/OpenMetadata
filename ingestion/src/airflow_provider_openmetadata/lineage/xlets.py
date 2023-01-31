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
Handle Airflow inlets and outlets
"""
from typing import List, Optional, Set

from pydantic import BaseModel


class XLets(BaseModel):
    """
    Group inlets and outlets from all tasks in a DAG
    """

    inlets: Set[str]
    outlets: Set[str]


def parse_xlets(xlet: List[dict]) -> Optional[List[str]]:
    """
    Parse airflow xlets for V1
    :param xlet: airflow v2 xlet dict
    :return: table list or None
    """
    if len(xlet) and isinstance(xlet[0], dict):
        tables = xlet[0].get("tables")
        if tables and isinstance(tables, list):
            return tables

    return None


def get_xlets_from_operator(
    operator: "BaseOperator", xlet_mode: str = "_inlets"
) -> Optional[List[str]]:
    """
    Given an Airflow DAG Task, obtain the tables
    set in inlets or outlets.

    We expect xlets to have the following structure:
    [{'tables': ['FQN']}]

    :param operator: task to get xlets from
    :param xlet_mode: get inlet or outlet
    :return: list of tables FQN
    """
    xlet = getattr(operator, xlet_mode)
    tables = parse_xlets(xlet)

    if not tables:
        operator.log.debug(f"Not finding proper {xlet_mode} in task {operator.task_id}")

    else:
        operator.log.info(f"Found {xlet_mode} {tables} in task {operator.task_id}")

    return tables


def get_xlets_from_dag(dag: "DAG") -> XLets:
    """
    Fill the inlets and outlets of the Pipeline by iterating
    over all its tasks
    """
    _inlets = set()
    _outlets = set()

    for task in dag.tasks:
        _inlets.update(
            get_xlets_from_operator(operator=task, xlet_mode="_inlets") or []
        )
        _outlets.update(
            get_xlets_from_operator(operator=task, xlet_mode="_outlets") or []
        )

    return XLets(inlets=_inlets, outlets=_outlets)
