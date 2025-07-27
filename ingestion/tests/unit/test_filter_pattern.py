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
Validate filter patterns
"""
import pytest

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.utils.filters import (
    InvalidPatternException,
    _filter,
    filter_by_dashboard,
    filter_by_fqn,
    validate_regex,
)


def test_filter():
    """Validate main filter logic"""
    filter_pattern_both = FilterPattern(
        includes=["^.*potato.*$"], excludes=["^.*tomato.*$"]
    )
    filter_pattern_inc = FilterPattern(includes=["^.*potato.*$"])
    filter_pattern_exc = FilterPattern(excludes=["^.*tomato.*$"])

    # We don't filter out "potato" since it's in includes
    assert not _filter(filter_pattern_both, "potato")
    # We do filter out "tomato" since it's in excludes
    assert _filter(filter_pattern_both, "tomato")

    assert not _filter(filter_pattern_inc, "potato_tomato")
    assert _filter(filter_pattern_exc, "potato_tomato")

    # If we have both includes and excludes, we will check both "include" and "exclude"
    # This was not filter if we only check includes, but is filtered if we check both
    assert _filter(filter_pattern_both, "potato_tomato")


def test_validate_regex():
    """Validate regex"""
    with pytest.raises(InvalidPatternException):
        validate_regex(["[", ".*"])

    # empty validation is OK
    validate_regex([])
    validate_regex(None)


def test_filter_by_fqn():
    """Check FQN filters"""
    fqn_filter_db = FilterPattern(includes=["^.*my_database.*$"])

    assert not filter_by_fqn(fqn_filter_db, "service.my_database.schema.table")
    assert filter_by_fqn(fqn_filter_db, "service.another_db.schema.table")

    fqn_filter_schema = FilterPattern(includes=["^.*my_db.my_schema.*$"])

    assert not filter_by_fqn(fqn_filter_schema, "service.my_db.my_schema.table")
    assert filter_by_fqn(fqn_filter_schema, "service.another_db.my_schema.table")


def test_filter_numbers():
    """Check numeric filtering"""

    num_filter = FilterPattern(includes=["^[4]"])

    assert not filter_by_dashboard(num_filter, "40")
    assert not filter_by_dashboard(num_filter, "41")

    assert filter_by_dashboard(num_filter, "50")
    assert filter_by_dashboard(num_filter, "54")
