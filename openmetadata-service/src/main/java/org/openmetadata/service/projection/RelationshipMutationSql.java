/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.projection;

import java.util.List;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Derives membership from the DAO's declared SQL, preserving its repository-owned predicates. */
final class RelationshipMutationSql {
  private static final List<Shape> DELETIONS =
      List.of(
          shape(
              "DELETE FROM entity_relationship WHERE (.+)",
              "entity_relationship",
              match -> "FROM entity_relationship WHERE " + match.group(1)),
          shape("DELETE er (FROM entity_relationship er .+)", "er", match -> match.group(1)),
          shape(
              "DELETE FROM entity_relationship er USING (.+)",
              "er",
              match -> "FROM entity_relationship er, " + match.group(1)));
  private static final List<Shape> REPOINTS =
      List.of(
          shape(
              "UPDATE entity_relationship SET fromId = :newFromId WHERE (.+)",
              "entity_relationship",
              match -> "FROM entity_relationship WHERE " + match.group(1)),
          shape(
              "UPDATE (entity_relationship er .+) SET er.fromId = :newFromId (WHERE .+)",
              "er",
              match -> "FROM " + match.group(1) + " " + match.group(2)),
          shape(
              "UPDATE entity_relationship er SET fromId = :newFromId FROM (.+)",
              "er",
              match -> "FROM entity_relationship er, " + match.group(1)));
  private static final Pattern INSERT_SELECTION =
      Pattern.compile(
          "^INSERT(?: IGNORE)? INTO entity_relationship.+ SELECT .+ (FROM .+?)(?: ON CONFLICT DO NOTHING)?$",
          Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

  private RelationshipMutationSql() {}

  static Selection deletion(final String sql) {
    return select(sql, DELETIONS);
  }

  static Selection repoint(final String sql) {
    return select(sql, REPOINTS);
  }

  static Candidate insertion(final String sql, final boolean inherited) {
    final Matcher match = INSERT_SELECTION.matcher(sql);
    if (!match.matches()) {
      throw unsupported(sql);
    }
    return new Candidate(
        new Selection(match.group(1), inherited ? "via" : "t"),
        inherited ? ":newFromId" : ":fromId",
        inherited ? "via.toId" : "t.id",
        inherited);
  }

  private static Selection select(final String sql, final List<Shape> shapes) {
    for (final Shape shape : shapes) {
      final Matcher match = shape.pattern().matcher(sql);
      if (match.matches()) {
        return new Selection(shape.selection().apply(match), shape.alias());
      }
    }
    throw unsupported(sql);
  }

  private static Shape shape(
      final String pattern, final String alias, final Function<Matcher, String> selection) {
    return new Shape(
        Pattern.compile("^" + pattern + "$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL),
        alias,
        selection);
  }

  private static IllegalArgumentException unsupported(final String sql) {
    return new IllegalArgumentException(
        "Relationship write requires an explicit projection capture shape: " + sql);
  }

  private record Shape(Pattern pattern, String alias, Function<Matcher, String> selection) {}

  record Selection(String clause, String alias) {}

  record Candidate(
      Selection selection, String fromExpression, String toExpression, boolean inherited) {}
}
