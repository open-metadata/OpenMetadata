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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.projection.FieldRelationshipMutation;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.util.FullyQualifiedName;

class FieldRelationshipMutationCaptureIT extends FieldRelationshipCaptureTestBase {
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixDeletionRetainsIndependentSearchAndRdfObligations(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed(
        "service.db.table.address.city",
        "other.table.id",
        "table.columns.column",
        "table.columns.column",
        Relationship.JOINED_WITH.ordinal());
    fixture.dao().deleteAllByPrefix("service.db.table");
    assertEquals(0, fixture.count("field_relationship"));
    final var search = fixture.claims(ProjectionTarget.SEARCH);
    final var rdf = fixture.claims(ProjectionTarget.RDF);
    assertEquals(1, search.size());
    assertEquals(1, rdf.size());
    assertEquals(search.getFirst().id(), rdf.getFirst().id());
    assertEquals(new FieldRelationshipMutation(1), search.getFirst().mutation());
    final var retained = fixture.snapshots().page(search.getFirst().id(), 0, 10);
    assertEquals(1, retained.size());
    assertEquals("service.db.table.address.city", retained.getFirst().from().fqn());
    assertEquals("other.table.id", retained.getFirst().to().fqn());
    assertEquals(
        FullyQualifiedName.buildHash("service.db.table.address.city"),
        retained.getFirst().from().fqnHash());
    assertEquals(
        FullyQualifiedName.buildHash("other.table.id"), retained.getFirst().to().fqnHash());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void extendingAPrefixRenamesEveryOriginalTargetExactlyOnce(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed(
        "thread", "Glossary.Term", "THREAD", "glossaryTerm", Relationship.IS_ABOUT.ordinal());
    fixture.seed(
        "thread", "Glossary.Term.child", "THREAD", "glossaryTerm", Relationship.IS_ABOUT.ordinal());
    fixture.dao().renameByToFQN("Glossary.Term", "Glossary.Term.More");
    assertEquals(List.of("Glossary.Term.More", "Glossary.Term.More.child"), fixture.destinations());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixRenamePreservesRepeatedTextWithinTheSuffix(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed(
        "thread",
        "service.db.service.db.column",
        "THREAD",
        "table",
        Relationship.IS_ABOUT.ordinal());
    fixture.dao().renameByToFQNPrefix("service.db", "service.renamed");
    assertEquals(List.of("service.renamed.service.db.column"), fixture.destinations());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void duplicateInsertsRetainThePersistedEndpointTypesAndMetadata(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    final var dao = fixture.dao();
    dao.insert(
        "owner",
        "pipeline.task",
        "owner",
        "pipeline.task",
        "user",
        "task",
        Relationship.OWNS.ordinal(),
        "{\"source\":\"original\"}");
    dao.insert(
        "owner",
        "pipeline.task",
        "ignoredOwner",
        "ignoredTask",
        "team",
        "table",
        Relationship.OWNS.ordinal(),
        "{\"source\":\"ignored\"}");
    assertEquals(1, fixture.count("field_relationship"));
    final var retained = fixture.retained();
    assertEquals(2, retained.size());
    for (final var row : retained) {
      assertEquals("owner", row.from().fqn());
      assertEquals("pipeline.task", row.to().fqn());
      assertEquals("user", row.from().type());
      assertEquals("task", row.to().type());
      assertEquals(Relationship.OWNS.ordinal(), row.relation());
      assertNull(row.metadata().schema());
      assertEquals("original", JsonUtils.readTree(row.metadata().json()).get("source").asText());
    }
    assertNotNull(dao.find("owner", "pipeline.task", "user", "task", Relationship.OWNS.ordinal()));
    assertEquals(1, dao.findFrom("pipeline.task", "task", Relationship.OWNS.ordinal()).size());
    assertEquals(0, fixture.claims(ProjectionTarget.SEARCH).size());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void upsertRetainsOldAndNewJoinMetadataWithoutChangingPersistedTypes(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    final var dao = fixture.dao();
    dao.upsert(
        "table.column",
        "other.column",
        "table.column",
        "other.column",
        "column",
        "column",
        Relationship.JOINED_WITH.ordinal(),
        "dailyCount",
        "{\"count\":1}");
    fixture.claims(ProjectionTarget.SEARCH);
    dao.upsert(
        "table.column",
        "other.column",
        "ignored",
        "ignored",
        "table",
        "table",
        Relationship.JOINED_WITH.ordinal(),
        "ignoredSchema",
        "{\"count\":2}");
    final var retained = fixture.retained();
    assertEquals(2, retained.size());
    assertEquals(
        Set.of(1, 2),
        retained.stream()
            .map(row -> JsonUtils.readTree(row.metadata().json()).get("count").asInt())
            .collect(Collectors.toSet()));
    assertTrue(
        retained.stream()
            .allMatch(
                row ->
                    row.from().type().equals("column")
                        && row.to().type().equals("column")
                        && row.metadata().schema().equals("dailyCount")
                        && row.from().fqn().equals("table.column")
                        && row.to().fqn().equals("other.column")));
    assertEquals(
        2,
        JsonUtils.readTree(
                dao.find(
                    "table.column",
                    "other.column",
                    "column",
                    "column",
                    Relationship.JOINED_WITH.ordinal()))
            .get("count")
            .asInt());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void typedDeletionOnlyCapturesMatchingRelationships(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("team", "pipeline.task", "team", "task", Relationship.OWNS.ordinal());
    fixture.seed("team", "pipeline.task", "team", "task", Relationship.IS_ABOUT.ordinal());
    fixture.dao().delete("team", "pipeline.task", "user", "task", Relationship.OWNS.ordinal());
    assertEquals(2, fixture.count("field_relationship"));
    assertEquals(List.of(), fixture.retained());
    fixture.dao().delete("team", "pipeline.task", "team", "task", Relationship.OWNS.ordinal());
    assertEquals(1, fixture.count("field_relationship"));
    final var retained = fixture.retained();
    assertEquals(1, retained.size());
    assertEquals(Relationship.OWNS.ordinal(), retained.getFirst().relation());
    assertEquals("team", retained.getFirst().from().type());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void batchInsertUsesStoredKeysAndRetainsIgnoredDuplicates(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("thread", "table", "storedType", "storedTarget", Relationship.IS_ABOUT.ordinal());
    fixture.dao().insertMany(List.of());
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    fixture
        .dao()
        .insertMany(
            List.of(
                FieldRelationshipCaptureFixture.relationship(
                    "thread", "table", Relationship.IS_ABOUT.ordinal()),
                FieldRelationshipCaptureFixture.relationship(
                    "thread", "table", Relationship.IS_ABOUT.ordinal()),
                FieldRelationshipCaptureFixture.relationship(
                    "thread", "other", Relationship.IS_ABOUT.ordinal())));
    assertEquals(2, fixture.count("field_relationship"));
    final var retained = fixture.retained();
    assertEquals(2, retained.size());
    final var old =
        retained.stream().filter(row -> row.to().fqn().equals("table")).findFirst().orElseThrow();
    assertEquals("storedType", old.from().type());
    assertEquals("storedTarget", old.to().type());
    assertEquals(FullyQualifiedName.buildHash("table"), old.to().fqnHash());
    assertTrue(
        retained.stream()
            .allMatch(row -> row.metadata().json() == null && row.metadata().schema() == null));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixDeletionMatchesEitherEndpointAndPreservesRootAndSiblings(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("service.table", "root", "table", "table", Relationship.JOINED_WITH.ordinal());
    fixture.seed(
        "service.tableExtra.column",
        "sibling",
        "column",
        "column",
        Relationship.JOINED_WITH.ordinal());
    fixture.seed(
        "service.table.column", "outgoing", "column", "column", Relationship.JOINED_WITH.ordinal());
    fixture.seed(
        "incoming", "service.table.column", "column", "column", Relationship.JOINED_WITH.ordinal());
    fixture.seed("task.child", "taskTarget", "task", "table", Relationship.IS_ABOUT.ordinal());
    fixture.dao().deleteAllByPrefixes(List.of("service.table", "task"));
    assertEquals(List.of("root", "sibling"), fixture.destinations());
    assertEquals(
        Set.of("outgoing", "service.table.column", "taskTarget"),
        fixture.retained().stream().map(row -> row.to().fqn()).collect(Collectors.toSet()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void internalCleanupUsesTheSameBoundSelectorAsCapture(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("thread", "selected", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "other", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture
        .dao()
        .deleteAllByPrefixInternal(
            "WHERE toFQNHash = :target",
            Map.of("target", FullyQualifiedName.buildHash("selected")));
    assertEquals(List.of("other"), fixture.destinations());
    assertEquals(
        List.of("selected"), fixture.retained().stream().map(row -> row.to().fqn()).toList());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void callerRollbackRestoresSourceRowsAndDiscardsCapture(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("thread", "before.child", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    assertThrows(
        IllegalStateException.class,
        () ->
            fixture
                .jdbi()
                .useTransaction(
                    handle -> {
                      final var dao = handle.attach(FieldRelationshipDAO.class);
                      dao.insert(
                          "owner",
                          "pipeline.task",
                          "owner",
                          "pipeline.task",
                          "user",
                          "task",
                          Relationship.OWNS.ordinal(),
                          null);
                      dao.renameByToFQN("before", "after");
                      dao.deleteAllByPrefix("after");
                      throw new IllegalStateException("caller rollback");
                    }));
    assertEquals(List.of("before.child"), fixture.destinations());
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_consumer"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }
}
