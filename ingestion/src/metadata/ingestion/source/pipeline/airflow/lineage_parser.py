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
import logging
import traceback
from enum import Enum
from typing import Dict, List, Optional, Set

from pydantic import BaseModel

logger = logging.getLogger("airflow.task")


class XLetsMode(Enum):
    INLETS = "inlets"
    OUTLETS = "outlets"


class XLetsAttr(Enum):
    INLETS = "inlets"
    PRIVATE_INLETS = "_inlets"

    OUTLETS = "outlets"
    PRIVATE_OUTLETS = "_outlets"


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

    [{'__var': {'tables': ['sample_data.ecommerce_db.shopify.fact_order']},
        '__type': 'dict'}]

    """
    # This branch is for lineage parser op
    if isinstance(xlet, list) and len(xlet) and isinstance(xlet[0], dict):
        xlet_dict = xlet[0]
        # This is how the Serialized DAG is giving us the info from _inlets & _outlets
        if isinstance(xlet_dict, dict) and xlet_dict.get("__var"):
            xlet_dict = xlet_dict["__var"]
        return {
            key: value for key, value in xlet_dict.items() if isinstance(value, list)
        }

    return None


def get_xlets_from_operator(
    operator: "BaseOperator", xlet_mode: XLetsMode
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
    attribute = None
    if xlet_mode == XLetsMode.INLETS:
        attribute = (
            XLetsAttr.INLETS.value
            if hasattr(operator, XLetsAttr.INLETS.value)
            else XLetsAttr.PRIVATE_INLETS.value
        )

    if xlet_mode == XLetsMode.OUTLETS:
        attribute = (
            XLetsAttr.OUTLETS.value
            if hasattr(operator, XLetsAttr.OUTLETS.value)
            else XLetsAttr.PRIVATE_OUTLETS.value
        )

    if attribute is None:
        raise ValueError(f"Missing attribute for {xlet_mode.value}")

    xlet = getattr(operator, attribute) or []
    xlet_data = parse_xlets(xlet)

    if not xlet_data:
        logger.debug(f"Not finding proper {xlet_mode} in task {operator.task_id}")

    else:
        logger.info(f"Found {xlet_mode} {xlet_data} in task {operator.task_id}")

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
        try:
            _inlets.update(
                get_xlets_from_operator(
                    operator=task,
                    xlet_mode=XLetsMode.INLETS,
                )
                or []
            )
            _outlets.update(
                get_xlets_from_operator(
                    operator=task,
                    xlet_mode=XLetsMode.OUTLETS,
                )
                or []
            )

        except Exception as exc:
            error_msg = (
                f"Error while getting inlets and outlets for task - {task} - {exc}"
            )
            logger.error(error_msg)
            logger.error(traceback.format_exc())

    # We expect to have the same keys in both inlets and outlets dicts
    # We will then iterate over the inlet keys to build the list of XLets
    return [
        XLets(inlets=set(value), outlets=set(_outlets[key]))
        for key, value in _inlets.items()
        if value and _outlets.get(key)
    ]
