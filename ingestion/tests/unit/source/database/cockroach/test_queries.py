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
"""Unit tests for the CockroachDB schema-comments query shape.

Regression tests for the bug where ``COCKROACH_SCHEMA_COMMENTS`` joined
``pg_namespace`` to ``pg_description`` on ``objoid`` alone (no ``classoid``
filter) and placed ``objsubid = 0`` in the ``WHERE`` clause. On CockroachDB's
emulated PostgreSQL catalog, ``pg_namespace.oid`` values collide with
``pg_proc.oid`` values, so the query returned unrelated built-in function
doc-comments as schema comments (and the ``WHERE`` collapsed the ``LEFT JOIN``
into an ``INNER JOIN``, fabricating comments even for uncommented schemas).

https://www.postgresql.org/docs/current/catalog-pg-description.html states
that ``(objoid, classoid, objsubid)`` *together* uniquely identify a described
object; using ``objoid`` alone is incorrect by the catalog's own contract.
"""

from metadata.ingestion.source.database.cockroach.queries import (
    COCKROACH_SCHEMA_COMMENTS,
)

# The ON clause of COCKROACH_SCHEMA_COMMENTS must restrict pg_description to
# rows that actually describe namespaces. regclass cast of the namespace
# catalog is the same approach Postgres-compatible systems use to resolve the
# class OID, and the literal must be pinned so a future "cleanup" cannot drop
# the filter that prevents OID collisions from leaking through.
EXPECTED_CLASSOID_FILTER = "d.classoid = 'pg_namespace'::regclass"


def _on_clause(query: str) -> str:
    """Return the substring of the query between the ``ON`` keyword and the
    terminating ``;`` (i.e. the join condition, with no ``WHERE`` leaking in).

    The fixture-free query templates here never nest a second ``ON`` (there is
    only one join), so slicing on the first ``ON`` is a faithful extraction.
    """
    assert "ON" in query, "query must have an ON clause"
    on_index = query.upper().index("ON")
    return query[on_index:]


def _where_clause(query: str) -> str:
    """Return the substring of the query starting at the ``WHERE`` keyword, or
    an empty string when the query has no ``WHERE`` clause."""
    upper = query.upper()
    where_index = upper.find("WHERE")
    if where_index == -1:
        return ""
    return query[where_index:]


def test_schema_comments_filters_by_namespace_classoid():
    """The join must restrict ``pg_description`` to rows whose ``classoid`` is
    ``pg_namespace`` so OID collisions with other catalogs (notably
    ``pg_proc``) cannot surface unrelated comments as schema comments."""
    assert EXPECTED_CLASSOID_FILTER in COCKROACH_SCHEMA_COMMENTS


def test_schema_comments_classoid_filter_is_in_on_clause_not_where():
    """The ``classoid`` filter must live in the ``ON`` clause. Placing it in
    ``WHERE`` would convert the ``LEFT JOIN`` into an effective ``INNER JOIN``
    and drop every schema that has no comment from the result set."""
    on_clause = _on_clause(COCKROACH_SCHEMA_COMMENTS)
    where_clause = _where_clause(COCKROACH_SCHEMA_COMMENTS)

    assert EXPECTED_CLASSOID_FILTER in on_clause
    assert "classoid" not in where_clause


def test_schema_comments_objsubid_is_in_on_clause_not_where():
    """``objsubid = 0`` must be in the ``ON`` clause, not the ``WHERE`` clause.

    A ``d.objsubid = 0`` predicate in ``WHERE`` collapses the intended
    ``LEFT JOIN`` into an ``INNER JOIN``: schemas without a namespace comment
    are no longer returned with a ``NULL`` description. On CockroachDB, where
    namespace OIDs collide with ``pg_proc`` OIDs, that fabricated a bogus
    description (e.g. the ``regr_avgy`` function doc-comment) for the default
    ``public`` schema on a fresh instance.

    This mirrors the shape of ``POSTGRES_SCHEMA_COMMENTS`` in
    ``postgres/queries.py`` which correctly keeps ``objsubid = 0`` in ``ON``.
    """
    on_clause = _on_clause(COCKROACH_SCHEMA_COMMENTS)
    where_clause = _where_clause(COCKROACH_SCHEMA_COMMENTS)

    assert "d.objsubid = 0" in on_clause
    assert "objsubid" not in where_clause


def test_schema_comments_has_no_where_clause_filtering_on_description():
    """The fixed query must not carry a ``WHERE`` that filters on the joined
    ``pg_description`` row, which would turn the ``LEFT JOIN`` into an
    ``INNER JOIN`` and silently drop un-commented schemas."""
    where_clause = _where_clause(COCKROACH_SCHEMA_COMMENTS)
    assert where_clause == "", (
        "COCKROACH_SCHEMA_COMMENTS must not have a WHERE clause; every "
        "predicate belongs in the LEFT JOIN ON so un-commented schemas are "
        f"still returned with a NULL description. Found: {where_clause!r}"
    )


def test_schema_comments_remains_a_left_join():
    """The query must stay a ``LEFT JOIN`` so schemas without a namespace
    comment are returned with a ``NULL`` description rather than dropped."""
    assert "LEFT JOIN" in COCKROACH_SCHEMA_COMMENTS
    # No INNER JOIN should have crept in as a "fix".
    assert "INNER JOIN" not in COCKROACH_SCHEMA_COMMENTS
