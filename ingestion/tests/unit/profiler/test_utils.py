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
Tests utils function for the profiler
"""

import os
from unittest import TestCase

from sqlalchemy import Column, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql.sqltypes import Integer, String

from metadata.profiler.metrics.hybrid.histogram import Histogram
from metadata.utils.profiler_utils import ColumnLike
from metadata.utils.sqa_utils import handle_array, is_array

Base = declarative_base()


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(30))
    fullname = Column(String)


class TestHistogramUtils(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.histogram = Histogram()

    def test_histogram_label_formatter_positive(self):
        """test label formatter for histogram"""
        formatted_label = self.histogram._format_bin_labels(18927, 23456)
        assert formatted_label == "18.93K to 23.46K"

        formatted_label = self.histogram._format_bin_labels(18927)
        assert formatted_label == "18.93K and up"

    def test_histogram_label_formatter_negative(self):
        """test label formatter for histogram for negative numbers"""
        formatted_label = self.histogram._format_bin_labels(-18927, -23456)
        assert formatted_label == "-18.93K to -23.46K"

        formatted_label = self.histogram._format_bin_labels(-18927)
        assert formatted_label == "-18.93K and up"

    def test_histogram_label_formatter_none(self):
        """test label formatter for histogram for None"""
        formatted_label = self.histogram._format_bin_labels(None)
        assert formatted_label == "null and up"

    def test_histogram_label_formatter_zero(self):
        """test label formatter for histogram with zero"""
        formatted_label = self.histogram._format_bin_labels(0)
        assert formatted_label == "0 and up"

    def test_histogram_label_formatter_nines(self):
        """test label formatter for histogram for nines"""
        formatted_label = self.histogram._format_bin_labels(99999999)
        assert formatted_label == "100.00M and up"

    def test_histogram_label_formatter_floats(self):
        """test label formatter for histogram for floats"""
        formatted_label = self.histogram._format_bin_labels(167893.98542, 194993.98542)
        assert formatted_label == "167.89K to 194.99K"


def test_handle_array():
    """test handle array"""
    db_path = os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Session = sessionmaker(bind=engine)
    session = Session()
    query = session.query(Users)

    array_formatted_query = handle_array(query, ColumnLike(True, "name"), Users)
    assert (
        str(array_formatted_query)
        == "SELECT users.id AS users_id, users.name AS users_name, users.fullname AS users_fullname \nFROM users, unnest(name) AS name"
    )

    formatted_query = handle_array(query, ColumnLike(False, None), Users)
    assert (
        str(formatted_query)
        == "SELECT users.id AS users_id, users.name AS users_name, users.fullname AS users_fullname \nFROM users"
    )


def test_is_array():
    """test is array function"""
    kwargs = {}
    assert is_array(kwargs) is False
    assert not kwargs

    kwargs = {"is_array": True, "array_col": "name"}
    assert kwargs["is_array"] is True
    assert is_array(kwargs) is True
    assert kwargs["array_col"] == "name"
    assert len(kwargs) == 1

    kwargs = {"is_array": False, "array_col": "name"}
    assert kwargs["is_array"] is False
    assert is_array(kwargs) is False
    assert not kwargs


def test_column_like_object():
    """test is array function"""
    kwargs = {}
    column_like = ColumnLike.create(kwargs)
    assert not kwargs
    assert column_like._is_array is False
    assert column_like._array_col is None

    kwargs = {"is_array": True, "array_col": "name"}
    assert kwargs["is_array"] is True
    column_like = ColumnLike.create(kwargs)
    assert not kwargs
    assert column_like._is_array is True
    assert column_like._array_col is "name"

    kwargs = {"is_array": False, "array_col": "name"}
    assert kwargs["is_array"] is False
    column_like = ColumnLike.create(kwargs)
    assert not kwargs
    assert column_like._is_array is False
    assert column_like._array_col is None
