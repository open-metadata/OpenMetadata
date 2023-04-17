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
from unittest import TestCase

from airflow import DAG
from airflow.operators.bash import BashOperator

from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
    INLETS_ATTR,
    OUTLETS_ATTR,
    XLets,
    get_xlets_from_dag,
    get_xlets_from_operator,
    parse_xlets,
)


class TestAirflowLineageParser(TestCase):
    """
    Handle airflow lineage parser validations
    """

    def test_parse_xlets(self):
        """
        Handle the shape validation of inlets and outlets, e.g.,
        [{
            "tables": ["A"],
            "more_tables": ["X"]
        }],
        """
        raw_xlet = [{"tables": ["A"], "more_tables": ["X"]}]
        self.assertEqual(parse_xlets(raw_xlet), {"tables": ["A"], "more_tables": ["X"]})

        raw_xlet_without_list = [{"tables": ["A"], "more_tables": "random"}]
        self.assertEqual(
            parse_xlets(raw_xlet_without_list),
            {
                "tables": ["A"],
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

        # By default we try with inlets. There are none here
        self.assertIsNone(get_xlets_from_operator(operator))
        # But the outlets are parsed correctly
        self.assertEqual(
            get_xlets_from_operator(operator, xlet_mode=OUTLETS_ATTR), {"tables": ["A"]}
        )

        operator = BashOperator(
            task_id="print_date",
            bash_command="date",
            inlets={"tables": ["A"], "more_tables": ["X"]},
        )

        self.assertEqual(
            get_xlets_from_operator(operator, xlet_mode=INLETS_ATTR),
            {"tables": ["A"], "more_tables": ["X"]},
        )
        self.assertIsNone(get_xlets_from_operator(operator, xlet_mode=OUTLETS_ATTR))

    def test_get_xlets_from_dag(self):
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
                bash_command="sleep 1",
                outlets={"tables": ["B"]},
            )

            self.assertEqual(
                get_xlets_from_dag(dag), [XLets(inlets={"A"}, outlets={"B"})]
            )

        with DAG("test_dag", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets={"tables": ["A", "A"], "this is a bit random": "foo"},
            )

            BashOperator(
                task_id="sleep",
                bash_command="sleep 1",
                outlets={"tables": ["B"]},
            )

            self.assertEqual(
                get_xlets_from_dag(dag), [XLets(inlets={"A"}, outlets={"B"})]
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
                bash_command="sleep 1",
                outlets={
                    "tables": ["B"],
                    "more_tables": ["Z"],
                },
            )

            self.assertEqual(
                get_xlets_from_dag(dag),
                [
                    XLets(inlets={"A"}, outlets={"B"}),
                    XLets(inlets={"X", "Y"}, outlets={"Z"}),
                ],
            )
