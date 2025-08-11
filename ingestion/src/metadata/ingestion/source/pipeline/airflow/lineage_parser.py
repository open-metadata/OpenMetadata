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
import textwrap
import traceback
from collections import defaultdict
from copy import deepcopy
from enum import Enum
from functools import singledispatch
from typing import Any, DefaultDict, Dict, List, Optional, Type

import attr
from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.models import T
from metadata.utils.constants import ENTITY_REFERENCE_CLASS_MAP
from metadata.utils.deprecation import deprecated
from metadata.utils.importer import import_from_module

logger = logging.getLogger("airflow.task")
XLET_KEYS = {"entity", "fqn", "key"}


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

    def __str__(self):
        """Custom serialization"""
        _dict = deepcopy(self.__dict__)
        _dict["entity"] = f"{self.entity.__module__}.{self.entity.__name__}"
        return json.dumps(_dict)

    def serialize(self) -> str:
        """Custom serialization to be called in airflow internals"""
        return str(self)


class XLets(BaseModel):
    """
    Group inlets and outlets from all tasks in a DAG
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    inlets: List[OMEntity]
    outlets: List[OMEntity]


def concat_dict_values(
    dict_1: DefaultDict[str, List[Any]], dict_2: Optional[Dict[str, List[Any]]]
) -> DefaultDict[str, List[Any]]:
    """
    Update d1 based on d2 values concatenating their results.
    """
    if dict_2:
        for key, value in dict_2.items():
            dict_1[key] = dict_1[key] + value

    return dict_1


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
def _parse_xlets(xlet: Any) -> None:
    """
    Default behavior to handle lineage.

    We can use this function to register further inlets/outlets
    representations, e.g., https://github.com/open-metadata/OpenMetadata/issues/11626
    """
    logger.warning(f"Inlet/Outlet type {type(xlet)} is not supported.")


@_parse_xlets.register
@deprecated(
    message=textwrap.dedent(
        """
    Please update your inlets/outlets to follow 
    https://docs.open-metadata.org/connectors/pipeline/airflow/configuring-lineage
    """
    ),
    release="1.4.0",
)
def dictionary_lineage_annotation(xlet: dict) -> Dict[str, List[OMEntity]]:
    """
    Handle OM specific inlet/outlet information. E.g.,

    ```python
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

    The Serialized DAG for the old lineage style will look like:
    ```
    "inlets": [
          {
            "__var": {
              "tables": [
                "sample_data.ecommerce_db.shopify.raw_order"
              ]
            },
            "__type": "dict"
          }
        ],
    ```
    With the new lineage style where we annotate tasks' lineage as:
    ```python
    BashOperator(
        task_id="print_date",
        bash_command="date",
        inlets=[
            {"entity": "container", "fqn": "s3_storage_sample.departments", "key": "test"},
        ],
    )
    ```,
    the Serialized DAG looks like
    ```
    "inlets": [
          {
            "__var": {
              "fqn": "s3_storage_sample.departments",
              "key": "test",
              "entity": "container"
            },
            "__type": "dict"
          }
        ],
    ```
    To validate if we are on the first on latter case, we can try to parse the available dict to an OMEntity.
    """
    xlet_dict = xlet
    # This is how the Serialized DAG is giving us the info from _inlets & _outlets
    if isinstance(xlet_dict, dict) and xlet_dict.get("__var"):
        xlet_dict = xlet_dict["__var"]

    # Check if we can properly build the OMEntity class
    if XLET_KEYS.issubset(xlet_dict.keys()):
        return {
            xlet_dict["key"]: [
                OMEntity(
                    entity=ENTITY_REFERENCE_CLASS_MAP[xlet_dict["entity"]],
                    fqn=xlet_dict["fqn"],
                    key=xlet_dict["key"],
                )
            ]
        }

    # Otherwise, fall to the old lineage style
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
def _(xlet: OMEntity) -> Optional[Dict[str, List[OMEntity]]]:
    """
    Handle OM specific inlet/outlet information. E.g.,

    ```
    BashOperator(
        task_id="sleep",
        bash_command=SLEEP,
        outlets=[OMEntity(entity=Table, fqn="B")],
    )
    ```
    """
    return {xlet.key: [xlet]}


@_parse_xlets.register
def _(xlet: str) -> Optional[Dict[str, List[OMEntity]]]:
    """
    Handle OM specific inlet/outlet information. E.g.,

    ```
    BashOperator(
        task_id="sleep",
        bash_command=SLEEP,
        outlets=[OMEntity(entity=Table, fqn="B")],
    )
    ```

    Once a DAG is serialized, the xlet info will be stored as:
    ```
    ['{"entity": "metadata.generated.schema.entity.data.table.Table", "fqn": "FQN", "key": "test"}']
    ```
    based on our custom serialization logic.

    In this method, we need to revert this back to the actual instance of OMEntity.
    Note that we need to properly validate that the string is following the constraints of:
    - Being a JSON representation
    - Following the structure of an OMEntity

    Otherwise, we could be having any other attr-based xlet native from Airflow.
    """
    try:
        body = json.loads(xlet)
        om_entity = OMEntity(
            entity=import_from_module(body.get("entity")),
            fqn=body.get("fqn"),
            key=body.get("key"),
        )

        return {om_entity.key: [om_entity]}
    except Exception as exc:
        logger.error(
            f"We could not parse the inlet/outlet information from [{xlet}] due to [{exc}]"
        )
        return None


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
