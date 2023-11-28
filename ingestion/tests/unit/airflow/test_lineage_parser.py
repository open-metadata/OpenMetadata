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
Test lineage parser to get inlets and outlets information
"""
from datetime import datetime
from typing import List, Set
from unittest import TestCase

from airflow import DAG
from airflow.lineage import entities
from airflow.operators.bash import BashOperator

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
    OMEntity,
    XLets,
    XLetsMode,
    get_xlets_from_dag,
    get_xlets_from_operator,
    parse_xlets,
)

SLEEP = "sleep 1"


def xlet_fqns(xlet: XLets, xlet_mode: XLetsMode) -> Set[str]:
    """Helper method to get a set of FQNs out of the xlet"""
    return set(elem.fqn for elem in getattr(xlet, xlet_mode.value))


class TestAirflowLineageParser(TestCase):
    """
    Handle airflow lineage parser validations
    """

    def assertXLetsEquals(self, first: List[XLets], second: List[XLets]):
        """
        Check that both XLet lists are the same

        Even if they are lists, we don't care about the order.

        Note that we cannot use sets since `OMEntity` is not hashable.

        For this test, we will assume that by having the same FQN, the
        entity type will also be the same.
        """
        self.assertEquals(len(first), len(second))

        for xlet1 in first:
            match = False

            first_inlets = xlet_fqns(xlet1, XLetsMode.INLETS)
            first_outlets = xlet_fqns(xlet1, XLetsMode.OUTLETS)

            for xlet2 in second:
                second_inlets = xlet_fqns(xlet2, XLetsMode.INLETS)
                second_outlets = xlet_fqns(xlet2, XLetsMode.OUTLETS)

                if first_inlets == second_inlets and first_outlets == second_outlets:
                    match = True
                    break

            self.assertTrue(match)

    def test_parse_xlets(self):
        """
        Handle the shape validation of inlets and outlets, e.g.,
        [{
            "tables": ["A"],
            "more_tables": ["X"]
        }],
        """
        raw_xlet = [{"tables": ["A"], "more_tables": ["X"]}]
        self.assertEqual(
            parse_xlets(raw_xlet),
            {
                "tables": [OMEntity(entity=Table, fqn="A")],
                "more_tables": [OMEntity(entity=Table, fqn="X")],
            },
        )

        raw_xlet_without_list = [{"tables": ["A"], "more_tables": "random"}]
        self.assertEqual(
            parse_xlets(raw_xlet_without_list),
            {
                "tables": [OMEntity(entity=Table, fqn="A")],
            },
        )

        not_an_xlet_list = {"tables": ["A"]}
        self.assertIsNone(parse_xlets(not_an_xlet_list))

    def test_get_xlets_from_operator(self):
        """
        Check how to get xlet data from operators
        """
        operator = BashOperator(
            task_id="print_date",
            bash_command="date",
            outlets={"tables": ["A"]},
        )

        self.assertIsNone(get_xlets_from_operator(operator, XLetsMode.INLETS))
        # But the outlets are parsed correctly
        self.assertEqual(
            get_xlets_from_operator(operator, xlet_mode=XLetsMode.OUTLETS),
            {"tables": [OMEntity(entity=Table, fqn="A")]},
        )

        operator = BashOperator(
            task_id="print_date",
            bash_command="date",
            inlets={"tables": ["A"], "more_tables": ["X"]},
        )

        self.assertEqual(
            get_xlets_from_operator(operator, xlet_mode=XLetsMode.INLETS),
            {
                "tables": [OMEntity(entity=Table, fqn="A")],
                "more_tables": [OMEntity(entity=Table, fqn="X")],
            },
        )
        self.assertIsNone(
            get_xlets_from_operator(operator, xlet_mode=XLetsMode.OUTLETS)
        )

    def test_get_string_xlets_from_dag(self):
        """
        Check that we can properly join the xlet information from
        all operators in the DAG
        """

        with DAG("test_dag", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets={"tables": ["A"]},
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets={"tables": ["B"]},
            )

            self.assertXLetsEquals(
                get_xlets_from_dag(dag),
                [
                    XLets(
                        inlets=[OMEntity(entity=Table, fqn="A")],
                        outlets=[OMEntity(entity=Table, fqn="B")],
                    )
                ],
            )

        with DAG("test_dag", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets={"tables": ["A", "A"], "this is a bit random": "foo"},
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets={"tables": ["B"]},
            )

            self.assertXLetsEquals(
                get_xlets_from_dag(dag),
                [
                    XLets(
                        inlets=[OMEntity(entity=Table, fqn="A")],
                        outlets=[OMEntity(entity=Table, fqn="B")],
                    )
                ],
            )

        with DAG("test_dag", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets={
                    "tables": ["A", "A"],
                    "more_tables": ["X", "Y"],
                    "this is a bit random": "foo",
                },
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets={
                    "tables": ["B"],
                    "more_tables": ["Z"],
                },
            )

            self.assertXLetsEquals(
                get_xlets_from_dag(dag),
                [
                    XLets(
                        inlets=[OMEntity(entity=Table, fqn="A")],
                        outlets=[OMEntity(entity=Table, fqn="B")],
                    ),
                    XLets(
                        inlets=[
                            OMEntity(entity=Table, fqn="X"),
                            OMEntity(entity=Table, fqn="Y"),
                        ],
                        outlets=[OMEntity(entity=Table, fqn="Z")],
                    ),
                ],
            )

        with DAG("test_dag_cycle", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets={
                    "tables": ["A", "B"],
                },
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets={
                    "tables": ["B"],
                },
            )

            self.assertXLetsEquals(
                get_xlets_from_dag(dag),
                [
                    XLets(
                        inlets=[
                            OMEntity(entity=Table, fqn="A"),
                            OMEntity(entity=Table, fqn="B"),
                        ],
                        outlets=[OMEntity(entity=Table, fqn="B")],
                    ),
                ],
            )

    def test_get_dataset_xlets_from_dag(self):
        """
        Check that we can properly join the xlet information from
        all operators in the DAG
        """
        with DAG("test_dag", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets={"tables": ["A"]},
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets=[
                    entities.Table(name="name", database="schema", cluster="database"),
                    entities.File("FQN"),
                ],
            )

            # self.assertEqual(
            #    get_xlets_from_dag(dag), [XLets(inlets={"A"}, outlets={"B"})]
            # )
