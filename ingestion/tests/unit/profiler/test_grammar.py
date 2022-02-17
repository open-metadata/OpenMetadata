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
Test the Test Definition grammar
"""
import pytest
from parsimonious import ParseError

from metadata.orm_profiler.validations.grammar import parse


def test_simple_parsing():
    """
    Play with simple expressions
    """
    res = parse("row_count == 100")
    assert res == [{'metric': 'row_count', 'operation': '==', 'value': '100'}]

    res = parse("something_else > random")
    assert res == [{'metric': 'something_else', 'operation': '>', 'value': 'random'}]

    # No spaces are needed
    res = parse("hello!=99")
    assert res == [{'metric': 'hello', 'operation': '!=', 'value': '99'}]

    res = parse("random==Seat500")
    assert res == [{'metric': 'random', 'operation': '==', 'value': 'Seat500'}]


def test_multiple_parsing():
    """
    We can also evaluate multiple test definitions
    """
    res = parse("metric_a < value1 & metric_b == value2 & metric_c != value3")

    expected = [
        {'metric': 'metric_a', 'operation': '<', 'value': 'value1'},
        {'metric': 'metric_b', 'operation': '==', 'value': 'value2'},
        {'metric': 'metric_c', 'operation': '!=', 'value': 'value3'},
    ]

    assert res == expected

    # No spaces are needed
    res = parse("metric_a<value1&metric_b==value2&metric_c!=value3")
    assert res == expected


def test_parse_error():
    """
    Check formats that won't be parsed
    by the grammar
    """

    with pytest.raises(ParseError):
        parse("wont match")

    with pytest.raises(ParseError):
        parse("ok not_an_operand ok")

    with pytest.raises(ParseError):
        parse("ok == !!!")



