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
test entity link utils
"""

import pytest
from antlr4.error.Errors import ParseCancellationException

from metadata.utils.entity_link import (
    get_decoded_column,
    get_table_fqn,
    get_table_or_column_fqn,
)


@pytest.mark.parametrize(
    "entity_link,expected",
    [
        (
            "<#E::table::rds.dev.dbt_jaffle.column_w_space::columns::first+name>",
            "first name",
        ),
        (
            "<#E::table::rds.dev.dbt_jaffle.column_w_space::columns::last_name>",
            "last_name",
        ),
        (
            "<#E::table::rds.dev.dbt_jaffle.column_w_space::columns::随机的>",
            "随机的",
        ),
        (
            "<#E::table::rds.dev.dbt_jaffle.column_w_space::columns::test__reserved__colon____reserved__arrow__test>",
            "test::>test",
        ),
    ],
)
def test_get_decoded_column(entity_link, expected):
    """test get_decoded_column return expected values"""
    assert get_decoded_column(entity_link) == expected


@pytest.mark.parametrize(
    "entity_link,fqn",
    [
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::number_of_orders>",
            "rds.dev.dbt_jaffle.customers.number_of_orders",
            id="valid_entity_link1",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::a>",
            "rds.dev.dbt_jaffle.customers.a",
            id="valid_entity_link2",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::阿比西]/>",
            "rds.dev.dbt_jaffle.customers.阿比西]/",
            id="valid_entity_link3",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::阿>",
            "rds.dev.dbt_jaffle.customers.阿",
            id="valid_entity_link4",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::14532>",
            "rds.dev.dbt_jaffle.customers.14532",
            id="valid_entity_link5",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::1>",
            "rds.dev.dbt_jaffle.customers.1",
            id="valid_entity_link6",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::абц%>",
            "rds.dev.dbt_jaffle.customers.абц%",
            id="valid_entity_link7",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::б>",
            "rds.dev.dbt_jaffle.customers.б",
            id="valid_entity_link8",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers>",
            "rds.dev.dbt_jaffle.customers",
            id="valid_entity_link9",
        ),
        pytest.param(
            "<#E::dashboard::rds.dev.dbt_jaffle>.customers>",
            "rds.dev.dbt_jaffle>.customers",
            id="valid_entity_link10",
        ),
        pytest.param(
            '<#E::dashboard::"rds.dev.dbt_jaffle.customers">',
            '"rds.dev.dbt_jaffle.customers"',
            id="valid_entity_link11",
        ),
        pytest.param(
            "<#E::table::rds.dev.:dbt_jaffle.customers::columns::阿>",
            "rds.dev.:dbt_jaffle.customers.阿",
            id="valid_entity_link12",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::grea:>hdfwsd>",
            "rds.dev.dbt_jaffle.customers.grea:>hdfwsd",
            id="valid_entity_link13",
        ),
    ],
)
def test_valid_get_table_or_column_fqn(entity_link, fqn):
    """test get_table_or_column_fqn return expected values

    Args:
        entity_link (str): pytest param input
        fqn (str): pytest param input
    """
    assert get_table_or_column_fqn(entity_link) == fqn


@pytest.mark.parametrize(
    "entity_link,error",
    [
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::foo::number_of_orders>",
            ParseCancellationException,
            id="invalid_entity_link1",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns>",
            ValueError,
            id="invalid_entity_link4",
        ),
        pytest.param(
            "<#E::table::rds.dev.dbt_jaffle.customers::columns::>",
            ParseCancellationException,
            id="invalid_entity_link5",
        ),
    ],
)
def test_invalid_get_table_or_column_fqn(entity_link, error):
    """test get_table_or_column_fqn return expected values

    Args:
        entity_link (str): pytest param input
        fqn (str): pytest param input
    """
    with pytest.raises(error):
        get_table_or_column_fqn(entity_link)


@pytest.mark.parametrize(
    "entity_link,expected",
    [
        (
            "<#E::table::red.dev.dbt_jaffle.customers::columns::a>",
            "red.dev.dbt_jaffle.customers",
        ),
    ],
)
def test_get_table_fqn(entity_link, expected):
    assert get_table_fqn(entity_link) == expected
