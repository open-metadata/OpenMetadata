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
import json
import logging
import traceback
from collections import defaultdict
from enum import Enum
from functools import singledispatch
from typing import Any, DefaultDict, Dict, List, Optional, Type

import attr
from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.models import T
from metadata.utils.deprecation import deprecated

logger = logging.getLogger("airflow.task")


class XLetsMode(Enum):
    INLETS = "inlets"
    OUTLETS = "outlets"


class XLetsAttr(Enum):
    INLETS = "inlets"
    PRIVATE_INLETS = "_inlets"

    OUTLETS = "outlets"
    PRIVATE_OUTLETS = "_outlets"


@attr.s(auto_attribs=True, kw_only=True)
class OMEntity:
    """
    Identifies one entity in OpenMetadata.
    We use attr annotated object similar to https://github.com/apache/airflow/blob/main/airflow/lineage/entities.py
    based on https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/lineage.html
    """

    # Entity Type, such as Table, Container or Dashboard.
    entity: Type[T] = attr.ib()
    # Entity Fully Qualified Name, e.g., service.database.schema.table
    fqn: str = attr.ib()
    # We will use the key in case we need to group different lineages from the same DAG
    key: str = "default"

    def __repr__(self):
        """Custom serialization"""
        _dict = self.__dict__
        _dict["entity"] = f"{Table.__module__}.{Table.__name__}"
        return json.dumps(self.__dict__)


class XLets(BaseModel):
    """
    Group inlets and outlets from all tasks in a DAG
    """

    inlets: List[OMEntity]
    outlets: List[OMEntity]

    class Config:
        arbitrary_types_allowed = True


def concat_dict_values(
    d1: DefaultDict[str, List[Any]], d2: Optional[Dict[str, List[Any]]]
) -> DefaultDict[str, List[Any]]:
    """
    Update d1 based on d2 values concatenating their results.
    """
    if d2:
        for key, value in d2.items():
            d1[key] = d1[key] + value

    return d1


def parse_xlets(xlet: List[Any]) -> Optional[Dict[str, List[OMEntity]]]:
    """
    :param xlet: airflow v2 xlet dict
    :return: dictionary of xlet list or None

    If our operators are like
    ```
    BashOperator(
        task_id="print_date",
        bash_command="date",
        inlets={"tables": ["A"]},
    )
    ```
    the inlets/outlets will still be processed in airflow as a `List`.

    Note that when picking them up from Serialized DAGs, the shape is:
    ```
    [{'__var': {'tables': ['sample_data.ecommerce_db.shopify.fact_order']}, '__type': 'dict'}]
    ```

    If using Datasets, we get something like:
    ```
    [Dataset(uri='s3://dataset-bucket/input.csv', extra=None)]
    ```
    We need to figure out how we want to handle information coming in this format.
    """
    # This branch is for lineage parser op
    if isinstance(xlet, list) and len(xlet):
        _parsed_xlets = defaultdict(list)
        for element in xlet:
            parsed_element = _parse_xlets(element) or {}

            # Update our xlet dict based on each parsed element
            # Since we can get a list of elements, concatenate the results from multiple xlets
            _parsed_xlets = concat_dict_values(_parsed_xlets, parsed_element)

        return _parsed_xlets

    return None


@singledispatch
def _parse_xlets(xlet: Any) -> Optional[Dict[str, List[OMEntity]]]:
    """
    Default behavior to handle lineage.

    We can use this function to register further inlets/outlets
    representations, e.g., https://github.com/open-metadata/OpenMetadata/issues/11626
    """
    logger.warning(f"Inlet/Outlet type {type(xlet)} is not supported.")
    return None


@_parse_xlets.register
@deprecated(
    message="Please update your inlets/outlets to follow <TODO DOCS>",
    release="1.4.0",
)
def dictionary_lineage_annotation(xlet: dict) -> Dict[str, List[OMEntity]]:
    """
    Handle OM specific inlet/outlet information. E.g.,

    ```
    BashOperator(
        task_id="print_date",
        bash_command="date",
        inlets={
            "tables": ["A", "A"],
            "more_tables": ["X", "Y"],
            "this is a bit random": "foo",
        },
    )
    ```
    """
    xlet_dict = xlet
    # This is how the Serialized DAG is giving us the info from _inlets & _outlets
    if isinstance(xlet_dict, dict) and xlet_dict.get("__var"):
        xlet_dict = xlet_dict["__var"]

    return {
        key: [
            # We will convert the old dict lineage method into Tables
            OMEntity(entity=Table, fqn=fqn)
            for fqn in set(value)  # Remove duplicates
        ]
        for key, value in xlet_dict.items()
        if isinstance(value, list)
    }


@_parse_xlets.register
def _(xlet: OMEntity) -> Dict[str, List[OMEntity]]:
    """
    Handle OM specific inlet/outlet information. E.g.,

    ```
    BashOperator(
        task_id="sleep",
        bash_command=SLEEP,
        outlets=[OMEntity(entity=Table, fqn="B")],
    )
    ```

    We'll be able to simplify this method once we can deprecate
    the logic for dict-based xlets above.
    """
    return {xlet.key: [xlet]}


def get_xlets_from_operator(
    operator: "BaseOperator", xlet_mode: XLetsMode
) -> Optional[Dict[str, List[OMEntity]]]:
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
    _inlets = defaultdict(list)
    _outlets = defaultdict(list)

    # First, grab all the inlets and outlets from all tasks grouped by keys
    for task in dag.tasks:
        try:
            _inlets = concat_dict_values(
                _inlets,
                get_xlets_from_operator(
                    operator=task,
                    xlet_mode=XLetsMode.INLETS,
                ),
            )

            _outlets = concat_dict_values(
                _outlets,
                get_xlets_from_operator(
                    operator=task,
                    xlet_mode=XLetsMode.OUTLETS,
                ),
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
        XLets(inlets=value, outlets=_outlets[key])
        for key, value in _inlets.items()
        if value and _outlets.get(key)
    ]
