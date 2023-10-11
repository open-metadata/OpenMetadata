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
Test datalake utils
"""

from unittest import TestCase
from metadata.generated.schema.entity.data.table import Column

from metadata.utils.datalake.datalake_utils import unique_json_structure, construct_json_column_children

STRUCTURE = {
            "a": "w",
            "b": 4,
            "c": {
                "d": 2,
                "e": 4,
                "f": {
                    "g": 9,
                    "h": {
                        "i": 6
                    },
                    "n": {
                        "o": 10,
                        "p": 11,
                    },
                },
                "j": 7,
                "k": 8,
            }
        }

class TestDatalakeUtils(TestCase):
    """class for datalake utils test"""
    def test_unique_json_structure(self):
        """test unique json structure fn"""
        sample_data = [
            {"a": "x", "b": 1, "c": {"d": 2}},
            {"a": "y", "b": 2, "c": {"e": 4, "f": {"g": 5, "h": {"i": 6}, "n": 5}}},
            {"a": "z", "b": 3, "c": {"j": 7}},
            {"a": "w", "b": 4, "c": {"k": 8, "f": {"g": 9, "n": {"o": 10, "p": 11}}}},
        ]
        expected = STRUCTURE

        actual = unique_json_structure(sample_data)

        self.assertDictEqual(expected, actual)

    def test_construct_column(self):
        """test construct column fn"""
        expected = [
            {'dataTypeDisplay': 'STRING', 'dataType': 'STRING', 'name': 'a', 'displayName': 'a'},
            {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'b', 'displayName': 'b'},
            {'dataTypeDisplay': 'JSON', 'dataType': 'JSON', 'name': 'c', 'displayName': 'c', 'children':
                [
                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'd', 'displayName': 'd'},
                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'e', 'displayName': 'e'},
                    {'dataTypeDisplay': 'JSON', 'dataType': 'JSON', 'name': 'f', 'displayName': 'f', 'children':
                        [
                            {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'g', 'displayName': 'g'},
                            {'dataTypeDisplay': 'JSON', 'dataType': 'JSON', 'name': 'h', 'displayName': 'h', 'children':
                                [
                                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'i', 'displayName': 'i'}
                                ]
                            },
                            {'dataTypeDisplay': 'JSON', 'dataType': 'JSON', 'name': 'n', 'displayName': 'n', 'children':
                                [
                                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'o', 'displayName': 'o'},
                                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'p', 'displayName': 'p'}
                                ]
                            }
                        ]
                    },
                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'j', 'displayName': 'j'},
                    {'dataTypeDisplay': 'INT', 'dataType': 'INT', 'name': 'k', 'displayName': 'k'}
                ]
            }
        ]
        actual = construct_json_column_children(STRUCTURE)

        for el in zip(expected, actual):
            self.assertDictEqual(el[0], el[1])

    def test_create_column_object(self):
        """test create column object fn"""
        formatted_column = construct_json_column_children(STRUCTURE)
        column = {'dataTypeDisplay': 'STRING', 'dataType': 'STRING', 'name': 'a', 'displayName': 'a', "children": formatted_column}
        column_obj = Column(**column)
        assert len(column_obj.children) == 3
        