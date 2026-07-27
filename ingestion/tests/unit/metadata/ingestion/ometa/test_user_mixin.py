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
Unit tests for OMetaUserMixin.

Covers:
  - name_search_query_es URL-encodes special characters so that `&` in a
    team name does not break the query-string URL parameter.
  - get_reference_by_name prefers an exact get_by_name lookup over fuzzy ES
    search, preventing "AI Product" from being returned when "AI Products" is
    requested.
"""

import json
from unittest.mock import MagicMock
from urllib.parse import unquote

from metadata.generated.schema.entity.teams.team import Team, TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.mixins.user_mixin import OMetaUserMixin

TEAM_EXACT_ID = "00000000-0000-0000-0000-000000000001"
TEAM_FUZZY_ID = "00000000-0000-0000-0000-000000000002"
TEAM_SPECIAL_ID = "00000000-0000-0000-0000-000000000003"
TEAM_DEPT_ID = "00000000-0000-0000-0000-000000000004"
USER_EXACT_ID = "00000000-0000-0000-0000-000000000010"
USER_FUZZY_ID = "00000000-0000-0000-0000-000000000011"


def _make_team(name: str, team_id: str) -> MagicMock:
    team = MagicMock()
    team.id.root = team_id
    team.name.root = name
    team.displayName = name
    team.teamType = TeamType.Group
    return team


def _make_user(name: str, user_id: str) -> MagicMock:
    user = MagicMock()
    user.id.root = user_id
    user.name.root = name
    user.displayName = name
    return user


def _make_mixin() -> OMetaUserMixin:
    mixin = OMetaUserMixin.__new__(OMetaUserMixin)
    mixin.client = MagicMock()
    return mixin


class TestNameSearchQueryEsUrlEncoding:
    def test_special_character_ampersand_is_url_encoded(self):
        query = OMetaUserMixin.name_search_query_es(
            entity=Team,
            name="Risk & Compliance Engineering",
            from_=0,
            size=1,
        )
        assert "query_filter=" in query
        raw_filter = query.split("query_filter=")[1].split("&from=")[0]
        assert "&" not in raw_filter, "Unencoded '&' in query_filter would break URL parameter parsing"
        decoded = unquote(raw_filter)
        parsed = json.loads(decoded)
        assert "Risk & Compliance Engineering" in parsed["query"]["query_string"]["query"]

    def test_plain_name_is_still_valid(self):
        query = OMetaUserMixin.name_search_query_es(
            entity=Team,
            name="Engineering",
            from_=0,
            size=1,
        )
        raw_filter = query.split("query_filter=")[1].split("&from=")[0]
        decoded = unquote(raw_filter)
        parsed = json.loads(decoded)
        assert "Engineering" in parsed["query"]["query_string"]["query"]

    def test_other_special_characters_are_encoded(self):
        name = "R&D / Operations"
        query = OMetaUserMixin.name_search_query_es(entity=Team, name=name, from_=0, size=1)
        raw_filter = query.split("query_filter=")[1].split("&from=")[0]
        assert "&" not in raw_filter
        assert "/" not in raw_filter
        assert " " not in raw_filter
        assert "%26" in raw_filter
        assert "%2F" in raw_filter
        assert "%20" in raw_filter
        decoded = unquote(raw_filter)
        parsed = json.loads(decoded)
        assert name in parsed["query"]["query_string"]["query"]


class TestGetReferenceByNameExactMatch:
    def test_exact_team_match_preferred_over_fuzzy(self):
        mixin = _make_mixin()
        exact_team = _make_team("AI Products", TEAM_EXACT_ID)
        fuzzy_team = _make_team("AI Product", TEAM_FUZZY_ID)

        mixin.get_by_name = MagicMock(return_value=exact_team)
        mixin._search_by_name = MagicMock(return_value=fuzzy_team)

        result = mixin.get_reference_by_name(name="AI Products", is_owner=True)

        assert result is not None
        assert result.root[0].name == "AI Products"
        assert str(result.root[0].id.root) == TEAM_EXACT_ID
        mixin.get_by_name.assert_called_once_with(entity=Team, fqn="AI Products")
        mixin._search_by_name.assert_not_called()

    def test_falls_back_to_fuzzy_when_exact_not_found(self):
        mixin = _make_mixin()
        fuzzy_team = _make_team("Engineering", TEAM_FUZZY_ID)

        mixin.get_by_name = MagicMock(return_value=None)
        mixin._search_by_name = MagicMock(return_value=fuzzy_team)

        result = mixin.get_reference_by_name(name="Engineering", is_owner=True)

        assert result is not None
        assert result.root[0].name == "Engineering"
        mixin._search_by_name.assert_called_once()

    def test_team_with_special_character_found_by_exact_lookup(self):
        mixin = _make_mixin()
        special_team = _make_team("Risk & Compliance Engineering", TEAM_SPECIAL_ID)

        mixin.get_by_name = MagicMock(return_value=special_team)
        mixin._search_by_name = MagicMock(return_value=None)

        result = mixin.get_reference_by_name(name="Risk & Compliance Engineering", is_owner=True)

        assert result is not None
        assert result.root[0].name == "Risk & Compliance Engineering"
        mixin._search_by_name.assert_not_called()

    def test_none_name_returns_none(self):
        mixin = _make_mixin()
        mixin.get_by_name = MagicMock()
        mixin._search_by_name = MagicMock()

        result = mixin.get_reference_by_name(name=None)

        assert result is None
        mixin.get_by_name.assert_not_called()
        mixin._search_by_name.assert_not_called()

    def test_non_group_team_excluded_when_is_owner_true(self):
        mixin = _make_mixin()
        dept_team = _make_team("Engineering Dept", TEAM_DEPT_ID)
        dept_team.teamType = TeamType.Department

        mixin.get_by_name = MagicMock(return_value=dept_team)
        mixin._search_by_name = MagicMock(return_value=None)

        result = mixin.get_reference_by_name(name="Engineering Dept", is_owner=True)

        assert result is None

    def test_api_failure_returns_none_and_logs_warning(self, caplog):
        import logging

        mixin = _make_mixin()
        mixin.get_by_name = MagicMock(side_effect=ConnectionError("API unreachable"))
        mixin._search_by_name = MagicMock()

        with caplog.at_level(logging.WARNING):
            result = mixin.get_reference_by_name.__wrapped__(mixin, name="SomeTeam", is_owner=True)

        assert result is None
        assert any("Failed to resolve owner reference" in r.message for r in caplog.records)
        mixin._search_by_name.assert_not_called()

    def test_search_failure_returns_none_and_logs_warning(self, caplog):
        import logging

        mixin = _make_mixin()
        mixin.get_by_name = MagicMock(return_value=None)
        mixin._search_by_name = MagicMock(side_effect=RuntimeError("ES search index unavailable"))

        with caplog.at_level(logging.WARNING):
            result = mixin.get_reference_by_name.__wrapped__(mixin, name="SomeTeam", is_owner=True)

        assert result is None
        assert any("Failed to resolve owner reference" in r.message for r in caplog.records)

    def test_user_exact_match_preferred_over_fuzzy(self):
        mixin = _make_mixin()
        exact_user = _make_user("john.doe", USER_EXACT_ID)
        fuzzy_user = _make_user("john.do", USER_FUZZY_ID)

        def get_by_name_side_effect(entity, fqn):
            if entity == Team:
                return None
            if entity == User:
                return exact_user
            return None

        def search_by_name_side_effect(entity, **_kwargs):
            if entity == Team:
                return None
            if entity == User:
                return fuzzy_user
            return None

        mixin.get_by_name = MagicMock(side_effect=get_by_name_side_effect)
        mixin._search_by_name = MagicMock(side_effect=search_by_name_side_effect)

        result = mixin.get_reference_by_name(name="john.doe")

        assert result is not None
        assert result.root[0].name == "john.doe"
        assert str(result.root[0].id.root) == USER_EXACT_ID
