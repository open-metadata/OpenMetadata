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
Test helpers module
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.feed.suggestion import Suggestion, SuggestionType
from metadata.generated.schema.type.basic import EntityLink
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.utils.helpers import (
    clean_up_starting_ending_double_quotes_in_string,
    deep_size_of_dict,
    find_suggestion,
    format_large_string_numbers,
    get_entity_tier_from_tags,
    is_safe_sql_query,
    list_to_dict,
    pretty_print_time_duration,
)


class TestHelpers(TestCase):
    """
    Test helpers module
    """

    def test_list_to_dict(self):
        original = ["key=value", "a=b"]

        self.assertEqual(list_to_dict(original=original), {"key": "value", "a": "b"})
        self.assertEqual(list_to_dict([]), {})
        self.assertEqual(list_to_dict(None), {})

    def test_clean_up_starting_ending_double_quotes_in_string(self):
        input_ = '"password"'
        output_ = "password"

        assert clean_up_starting_ending_double_quotes_in_string(input_) == output_

    def test_get_entity_tier_from_tags(self):
        """test correct entity tier are returned"""
        table_entity_w_tier = Table(
            id=uuid.uuid4(),
            name="table_entity_test",
            columns=[Column(name="col1", dataType=DataType.STRING)],
            tags=[
                TagLabel(
                    tagFQN="Tier.Tier1",
                    source=TagSource.Classification,
                    labelType=LabelType.Automated,
                    state=State.Confirmed,
                ),
                TagLabel(
                    tagFQN="Foo.Bar",
                    source=TagSource.Classification,
                    labelType=LabelType.Automated,
                    state=State.Confirmed,
                ),
            ],
        )

        assert get_entity_tier_from_tags(table_entity_w_tier.tags) == "Tier.Tier1"

        table_entity_wo_tier = Table(
            id=uuid.uuid4(),
            name="table_entity_test",
            columns=[Column(name="col1", dataType=DataType.STRING)],
            tags=[
                TagLabel(
                    tagFQN="Foo.Bar",
                    source=TagSource.Classification,
                    labelType=LabelType.Automated,
                    state=State.Confirmed,
                )
            ],
        )

        assert get_entity_tier_from_tags(table_entity_wo_tier.tags) is None

    def test_deep_size_of_dict(self):
        """test deep size of dict"""
        test_dict = {
            "a": 1,
            "b": {"c": 2, "d": {"e": "Hello World", "f": [4, 5, 6]}},
        }

        assert deep_size_of_dict(test_dict) >= 1000
        assert deep_size_of_dict(test_dict) <= 1500

    def test_is_safe_sql_query(self):
        """Test is_safe_sql_query function"""

        delete_query = """
         DELETE FROM airflow_task_instance
         WHERE dag_id = 'test_dag_id'
         """

        drop_query = """
         DROP TABLE IF EXISTS test_table
         """

        create_query = """
         CREATE TABLE test_table (
             id INT,
             name VARCHAR(255)
         )
         """

        select_query = """
         SELECT * FROM test_table
         """

        cte_query = """
         WITH foo AS (
             SELECT * FROM test_table
         )
         SELECT * FROM foo
         """

        transaction_query = """
         BEGIN TRAN T1;  
             UPDATE table1 ...;  
             BEGIN TRAN M2 WITH MARK;  
                 UPDATE table2 ...;  
                 SELECT * from table1;  
             COMMIT TRAN M2;  
             UPDATE table3 ...;  
         COMMIT TRAN T1;  
         """

        self.assertFalse(is_safe_sql_query(delete_query))
        self.assertFalse(is_safe_sql_query(drop_query))
        self.assertFalse(is_safe_sql_query(create_query))
        self.assertTrue(is_safe_sql_query(select_query))
        self.assertTrue(is_safe_sql_query(cte_query))
        self.assertFalse(is_safe_sql_query(transaction_query))

    def test_format_large_string_numbers(self):
        """test format_large_string_numbers"""
        assert format_large_string_numbers(1000) == "1.000K"
        assert format_large_string_numbers(1001) == "1.001K"
        assert format_large_string_numbers(1000000) == "1.000M"
        assert format_large_string_numbers(1000000000) == "1.000B"
        assert format_large_string_numbers(1000000000000) == "1.000T"
        assert format_large_string_numbers(10000000000000) == "10.000T"
        assert format_large_string_numbers(100000000000000) == "100.000T"
        assert format_large_string_numbers(1000000000000000) == "1e15"
        assert format_large_string_numbers(10000000000000000) == "10e15"
        assert format_large_string_numbers(100000000000000000) == "100e15"
        assert format_large_string_numbers(1000000000000000000) == "1e18"

    def test_find_suggestion(self):
        """we can get one possible suggestion"""
        suggestions = [
            Suggestion(
                id=uuid.uuid4(),
                type=SuggestionType.SuggestDescription,
                entityLink=EntityLink("<#E::table::tableFQN>"),
                description="something",
            ),
            Suggestion(
                id=uuid.uuid4(),
                type=SuggestionType.SuggestDescription,
                entityLink=EntityLink("<#E::table::tableFQN::columns::col>"),
                description="something",
            ),
        ]

        self.assertIsNone(
            find_suggestion(
                suggestions=suggestions,
                suggestion_type=SuggestionType.SuggestTagLabel,
                entity_link=...,
            )
        )

        self.assertIsNone(
            find_suggestion(
                suggestions=suggestions,
                suggestion_type=SuggestionType.SuggestDescription,
                entity_link=...,
            )
        )

        suggestion_table = find_suggestion(
            suggestions=suggestions,
            suggestion_type=SuggestionType.SuggestDescription,
            entity_link=EntityLink("<#E::table::tableFQN>"),
        )
        self.assertEqual(suggestion_table, suggestions[0])

        suggestion_col = find_suggestion(
            suggestions=suggestions,
            suggestion_type=SuggestionType.SuggestDescription,
            entity_link=EntityLink("<#E::table::tableFQN::columns::col>"),
        )
        self.assertEqual(suggestion_col, suggestions[1])

    def test_pretty_print_time_duration(self):
        self.assertEqual(pretty_print_time_duration(10), "10s")
        self.assertEqual(pretty_print_time_duration(100), "1m 40s")
        self.assertEqual(pretty_print_time_duration(1000), "16m 40s")
        self.assertEqual(pretty_print_time_duration(10000), "2h 46m 40s")
        self.assertEqual(pretty_print_time_duration(100000), "1day(s) 3h 46m 40s")
        self.assertEqual(pretty_print_time_duration(1000000), "11day(s) 13h 46m 40s")
        self.assertEqual(pretty_print_time_duration(20), "20s")
        self.assertEqual(pretty_print_time_duration(200), "3m 20s")
        self.assertEqual(pretty_print_time_duration(2000), "33m 20s")
        self.assertEqual(pretty_print_time_duration(20000), "5h 33m 20s")
        self.assertEqual(pretty_print_time_duration(200000), "2day(s) 7h 33m 20s")
        self.assertEqual(pretty_print_time_duration(2000000), "23day(s) 3h 33m 20s")
