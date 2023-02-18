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
Handle Airflow inlets and outlets.

We can have different scenarios of inlets and outlets:

```
t1 = BashOperator(
    task_id="print_date",
    bash_command="date",
    inlets={
        "tables": ["A"]
    },
)

t2 = BashOperator(
    task_id="sleep",
    bash_command="sleep 1",
    outlets={
        "tables": ["B"]
    },
)
```

we'll join the keys and get XLet(inlets=[A], outlets=[B])

But we can also have a pipeline working on different sets of tables:

```
t1 = BashOperator(
    task_id="print_date",
    bash_command="date",
    inlets={
        "tables": ["A"],
        "more_tables": ["X"]
    },
)

t2 = BashOperator(
    task_id="sleep",
    bash_command="sleep 1",
    outlets={
        "tables": ["B"],
        "more_tables": ["Y", "Z"]
    },
)
```

we'll join the keys and get [
    XLet(inlets=[A], outlets=[B]),
    XLet(inlets=[X], outlets=[Y, Z]),
]
and we'll treat this as independent sets of lineage
"""
from typing import Dict, List, Optional, Set

from pydantic import BaseModel

INLETS_ATTR = "_inlets"
OUTLETS_ATTR = "_outlets"


class XLets(BaseModel):
    """
    Group inlets and outlets from all tasks in a DAG
    """

    inlets: Set[str]
    outlets: Set[str]


def parse_xlets(xlet: List[dict]) -> Optional[Dict[str, List[str]]]:
    """
    Parse airflow xlets for V1
    :param xlet: airflow v2 xlet dict
    :return: dictionary of xlet list or None
    """
    if isinstance(xlet, list) and len(xlet) and isinstance(xlet[0], dict):
        xlet_dict = xlet[0]

        return {
            key: value for key, value in xlet_dict.items() if isinstance(value, list)
        }

    return None


def get_xlets_from_operator(
    operator: "BaseOperator", xlet_mode: str = INLETS_ATTR
) -> Optional[Dict[str, List[str]]]:
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
    xlet_data = parse_xlets(xlet)

    if not xlet_data:
        operator.log.debug(f"Not finding proper {xlet_mode} in task {operator.task_id}")

    else:
        operator.log.info(f"Found {xlet_mode} {xlet_data} in task {operator.task_id}")

    return xlet_data


def get_xlets_from_dag(dag: "DAG") -> List[XLets]:
    """
    Fill the inlets and outlets of the Pipeline by iterating
    over all its tasks
    """
    _inlets = {}
    _outlets = {}

    # First, grab all the inlets and outlets from all tasks grouped by keys
    for task in dag.tasks:
        _inlets.update(
            get_xlets_from_operator(operator=task, xlet_mode=INLETS_ATTR) or []
        )
        _outlets.update(
            get_xlets_from_operator(operator=task, xlet_mode=OUTLETS_ATTR) or []
        )

    # We expect to have the same keys in both inlets and outlets dicts
    # We will then iterate over the inlet keys to build the list of XLets
    return [
        XLets(inlets=set(value), outlets=set(_outlets[key]))
        for key, value in _inlets.items()
        if value and _outlets.get(key)
    ]
