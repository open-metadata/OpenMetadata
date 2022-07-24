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
Validate filter patterns
"""
from unittest import TestCase

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.utils.filters import filter_by_dashboard, filter_by_fqn


class FilterPatternTests(TestCase):
    """
    Validate filter patterns
    """

    @staticmethod
    def test_filter_by_fqn():
        """
        Check FQN filters
        """
        fqn_filter_db = FilterPattern(includes=["^.*my_database.*$"])

        assert not filter_by_fqn(fqn_filter_db, "service.my_database.schema.table")
        assert filter_by_fqn(fqn_filter_db, "service.another_db.schema.table")

        fqn_filter_schema = FilterPattern(includes=["^.*my_db.my_schema.*$"])

        assert not filter_by_fqn(fqn_filter_schema, "service.my_db.my_schema.table")
        assert filter_by_fqn(fqn_filter_schema, "service.another_db.my_schema.table")

    @staticmethod
    def test_filter_numbers():
        """
        Check numeric filtering
        """

        num_filter = FilterPattern(includes=["^[4]"])

        assert not filter_by_dashboard(num_filter, "40")
        assert not filter_by_dashboard(num_filter, "41")

        assert filter_by_dashboard(num_filter, "50")
        assert filter_by_dashboard(num_filter, "54")
