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
Resolving SQL Server synonyms in the SQL handed to the lineage parser
"""

import pytest

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.mssql.lineage import MssqlLineageSource
from metadata.ingestion.source.database.mssql.synonyms import (
    ObjectName,
    SynonymResolver,
    parse_base_object_name,
    split_object_name,
)
from metadata.ingestion.source.models import TableView


@pytest.fixture()
def resolver() -> SynonymResolver:
    """DM_Core.dbo.vDimAccountAPL is an alias for a view in DM_Master."""
    resolver = SynonymResolver()
    resolver.add(
        database="DM_Core",
        schema="dbo",
        synonym="vDimAccountAPL",
        base_object_name="[DM_Master].[dbo].[vDimAccountAPL]",
    )
    return resolver


class TestSplitObjectName:
    @pytest.mark.parametrize(
        "raw_name,expected",
        [
            ("[DM_Master].[dbo].[vAccount]", ["DM_Master", "dbo", "vAccount"]),
            ("DM_Master.dbo.vAccount", ["DM_Master", "dbo", "vAccount"]),
            ("[dbo].[vAccount]", ["dbo", "vAccount"]),
            ("vAccount", ["vAccount"]),
            ("[SRV].[DM_Master].[dbo].[vAccount]", ["SRV", "DM_Master", "dbo", "vAccount"]),
            # a bracketed part may contain the separator itself
            ("[DM_Master].[my.schema].[vAccount]", ["DM_Master", "my.schema", "vAccount"]),
        ],
    )
    def test_splits_multipart_names(self, raw_name, expected):
        assert split_object_name(raw_name) == expected


class TestParseBaseObjectName:
    def test_omitted_parts_default_to_the_synonym_own_location(self):
        assert parse_base_object_name("[vAccount]", "DM_Core", "dbo") == ObjectName("DM_Core", "dbo", "vAccount")
        assert parse_base_object_name("[sales].[vAccount]", "DM_Core", "dbo") == ObjectName(
            "DM_Core", "sales", "vAccount"
        )

    def test_linked_server_objects_are_not_resolvable(self):
        """A four-part name points outside the server, so it has no entity in OpenMetadata."""
        assert parse_base_object_name("[SRV].[DM_Master].[dbo].[vAccount]", "DM_Core", "dbo") is None


class TestRewrite:
    def test_replaces_a_fully_qualified_synonym_reference(self, resolver):
        rewritten = resolver.rewrite(
            "CREATE VIEW [dbo].[vConsumer] AS SELECT AccountID FROM [DM_Core].[dbo].[vDimAccountAPL]",
            database="DM_Core",
            schema="dbo",
        )
        assert "DM_Master.dbo.vDimAccountAPL" in rewritten
        assert "DM_Core.dbo.vDimAccountAPL" not in rewritten
        assert "[DM_Core].[dbo].[vDimAccountAPL]" not in rewritten

    def test_replaces_a_schema_qualified_synonym_reference(self, resolver):
        """A two-part reference resolves against the database owning the view."""
        rewritten = resolver.rewrite(
            "CREATE VIEW [dbo].[vConsumer] AS SELECT AccountID FROM [dbo].[vDimAccountAPL]",
            database="DM_Core",
            schema="dbo",
        )
        assert "DM_Master.dbo.vDimAccountAPL" in rewritten

    def test_matching_ignores_case(self, resolver):
        rewritten = resolver.rewrite(
            "SELECT AccountID FROM dm_core.DBO.VDIMACCOUNTAPL",
            database="DM_Core",
            schema="dbo",
        )
        assert "DM_Master.dbo.vDimAccountAPL" in rewritten

    def test_leaves_the_consuming_view_and_other_objects_alone(self, resolver):
        rewritten = resolver.rewrite(
            "CREATE VIEW [dbo].[vDimAccountAPL_Consumer] AS "
            "SELECT a.AccountID FROM [dbo].[vDimAccountAPL] a JOIN [dbo].[DimDate] d ON d.Id = a.DateId",
            database="DM_Core",
            schema="dbo",
        )
        assert "vDimAccountAPL_Consumer" in rewritten
        assert "DimDate" in rewritten

    def test_a_cte_is_not_mistaken_for_a_synonym(self, resolver):
        """A CTE is referenced like a table; an identically named synonym must not win."""
        rewritten = resolver.rewrite(
            "WITH vDimAccountAPL AS (SELECT 1 AS AccountID) SELECT AccountID FROM vDimAccountAPL",
            database="DM_Core",
            schema="dbo",
        )
        assert "DM_Master" not in rewritten

    def test_sql_without_synonyms_is_returned_unchanged(self, resolver):
        sql = "SELECT AccountID FROM [DM_Core].[dbo].[DimAccount]"
        assert resolver.rewrite(sql, database="DM_Core", schema="dbo") == sql

    def test_unparseable_sql_is_returned_unchanged(self, resolver):
        """Rewriting fails open: the worst case is the behaviour we had before."""
        sql = "this is not valid SQL ((("
        assert resolver.rewrite(sql, database="DM_Core", schema="dbo") == sql

    def test_an_empty_resolver_does_nothing(self):
        sql = "SELECT AccountID FROM [DM_Core].[dbo].[vDimAccountAPL]"
        assert SynonymResolver().rewrite(sql, database="DM_Core", schema="dbo") == sql

    def test_unqualified_reference_without_a_database_context_is_left_alone(self, resolver):
        """Query logs may not tell us which database ran the query."""
        sql = "SELECT AccountID FROM vDimAccountAPL"
        assert resolver.rewrite(sql, database=None, schema=None) == sql

    def test_fully_qualified_reference_resolves_without_a_database_context(self, resolver):
        rewritten = resolver.rewrite(
            "SELECT AccountID FROM [DM_Core].[dbo].[vDimAccountAPL]",
            database=None,
            schema=None,
        )
        assert "DM_Master.dbo.vDimAccountAPL" in rewritten

    def test_linked_server_synonyms_are_skipped(self):
        resolver = SynonymResolver()
        resolver.add(
            database="DM_Core",
            schema="dbo",
            synonym="vRemote",
            base_object_name="[SRV].[DM_Master].[dbo].[vRemote]",
        )
        assert resolver.is_empty()
        assert resolver.skipped == 1


class TestLineageProducers:
    """The rewrite has to reach both SQL sources the lineage workflow reads."""

    @pytest.fixture()
    def source(self, resolver, monkeypatch) -> MssqlLineageSource:
        """A source with its synonyms pre-read, so no database is touched."""
        source = object.__new__(MssqlLineageSource)
        monkeypatch.setattr(source, "_synonyms", resolver, raising=False)
        return source

    def test_view_definitions_are_rewritten(self, source, monkeypatch):
        view = TableView(
            table_name="vConsumer",
            schema_name="dbo",
            db_name="DM_Core",
            view_definition="CREATE VIEW [dbo].[vConsumer] AS SELECT AccountID FROM [dbo].[vDimAccountAPL]",
        )
        monkeypatch.setattr(LineageSource, "view_lineage_producer", lambda _self: iter([view]))

        produced = list(source.view_lineage_producer())

        assert "DM_Master.dbo.vDimAccountAPL" in produced[0].view_definition
        # the view read from the source is left untouched
        assert "DM_Master" not in view.view_definition

    def test_logged_queries_are_rewritten(self, source, monkeypatch):
        table_query = TableQuery(
            query="INSERT INTO [dbo].[Report] SELECT AccountID FROM [dbo].[vDimAccountAPL]",
            databaseName="DM_Core",
            databaseSchema="dbo",
            serviceName="mssql",
        )
        monkeypatch.setattr(LineageSource, "query_lineage_producer", lambda _self: iter([table_query]))

        produced = list(source.query_lineage_producer())

        assert "DM_Master.dbo.vDimAccountAPL" in produced[0].query
        assert "DM_Master" not in table_query.query
