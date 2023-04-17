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
Test helpers module
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.utils.helpers import (
    clean_up_starting_ending_double_quotes_in_string,
    get_entity_tier_from_tags,
    list_to_dict,
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
