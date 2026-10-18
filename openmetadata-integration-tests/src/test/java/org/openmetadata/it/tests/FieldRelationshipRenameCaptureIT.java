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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.util.FullyQualifiedName;

class FieldRelationshipRenameCaptureIT extends FieldRelationshipCaptureTestBase {
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixOnlyRenamePreservesRootSiblingsAndOtherRelationshipKinds(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("thread", "before", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "beforeExtra.child", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "before.child", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "before.otherRelation", "THREAD", "table", 5);
    fixture.seed("thread", "before.otherType", "task", "table", Relationship.IS_ABOUT.ordinal());
    fixture.dao().renameByToFQNPrefix("before", "after");
    assertEquals(
        Set.of(
            "before",
            "beforeExtra.child",
            "after.child",
            "before.otherRelation",
            "before.otherType"),
        Set.copyOf(fixture.destinations()));
    final var retained = fixture.retained();
    assertEquals(
        Set.of("before.child", "after.child"),
        retained.stream().map(row -> row.to().fqn()).collect(Collectors.toSet()));
    assertTrue(
        retained.stream()
            .allMatch(
                row ->
                    row.from().fqn().equals("thread")
                        && row.from().type().equals("THREAD")
                        && row.to().type().equals("table")
                        && row.relation() == Relationship.IS_ABOUT.ordinal()));
    for (final var row : retained) {
      assertEquals(FullyQualifiedName.buildHash(row.to().fqn()), row.to().fqnHash());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void quotedUnicodePrefixesKeepLiteralSuffixesAndMetadata(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    final String before = "\"Data's._%🧭\".term";
    final String after = "\"New's._%🧭\".term";
    final String nested = before + "." + before + ".column";
    fixture
        .dao()
        .upsert(
            "thread",
            nested,
            "thread",
            nested,
            "THREAD",
            "table",
            3,
            "relationshipMetadata",
            "{\"description\":\"retained metadata\"}");
    fixture.claims(ProjectionTarget.SEARCH);
    fixture.dao().renameByToFQNPrefix(before, after);
    final String renamed = after + "." + before + ".column";
    assertEquals(List.of(renamed), fixture.destinations());
    final var retained = fixture.retained();
    assertEquals(
        Set.of(nested, renamed),
        retained.stream().map(row -> row.to().fqn()).collect(Collectors.toSet()));
    for (final var row : retained) {
      assertEquals(FullyQualifiedName.buildHash(row.to().fqn()), row.to().fqnHash());
      assertEquals("relationshipMetadata", row.metadata().schema());
      assertEquals(
          "retained metadata",
          JsonUtils.readTree(row.metadata().json()).get("description").asText());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void exactInternalRenameRetainsBothLocatorsWithoutTouchingChildren(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("thread", "before", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "before.child", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture
        .dao()
        .renameByToFQNInternal(
            "before",
            FullyQualifiedName.buildHash("before"),
            "after",
            FullyQualifiedName.buildHash("after"));
    assertEquals(List.of("after", "before.child"), fixture.destinations());
    assertEquals(
        Set.of("before", "after"),
        fixture.retained().stream().map(row -> row.to().fqn()).collect(Collectors.toSet()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pagedRenamesRetainOriginalAndFinalKeysExactlyOnce(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seedFanout(205);
    fixture.dao().renameByToFQN("service.table", "service.table.renamed");
    final var retained = fixture.retained();
    assertEquals(410, retained.size());
    assertEquals(205, fixture.count("field_relationship"));
    assertEquals(
        205,
        retained.stream().filter(row -> row.to().fqn().startsWith("service.table.column")).count());
    assertEquals(
        205,
        retained.stream()
            .filter(row -> row.to().fqn().startsWith("service.table.renamed.column"))
            .count());
    assertTrue(
        fixture.destinations().stream()
            .allMatch(fqn -> fqn.startsWith("service.table.renamed.column")));
    for (final var row : retained) {
      assertEquals(FullyQualifiedName.buildHash(row.to().fqn()), row.to().fqnHash());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void combinedRenameBeforeCaptureActivationStillUpdatesEachTargetOnce(
      final RdfTestDatabase.Backend backend) {
    try (var fixture = new FieldRelationshipCaptureFixture(backend, false)) {
      fixture.seed(
          "thread", "Glossary.Term", "THREAD", "glossaryTerm", Relationship.IS_ABOUT.ordinal());
      fixture.seed(
          "thread",
          "Glossary.Term.Glossary.Term.child",
          "THREAD",
          "glossaryTerm",
          Relationship.IS_ABOUT.ordinal());
      fixture.dao().renameByToFQN("Glossary.Term", "Glossary.Term.More");
      assertEquals(
          Set.of("Glossary.Term.More", "Glossary.Term.More.Glossary.Term.child"),
          Set.copyOf(fixture.destinations()));
      assertEquals(0, fixture.count("metadata_projection_mutation"));
    }
  }
}
