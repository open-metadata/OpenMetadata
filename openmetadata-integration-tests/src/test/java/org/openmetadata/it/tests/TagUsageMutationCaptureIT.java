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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.TagUsageMutation;
import org.openmetadata.service.projection.TagUsageSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
class TagUsageMutationCaptureIT {
  private static final Map<RdfTestDatabase.Backend, TagUsageCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      DATABASES.put(backend, new TagUsageCaptureFixture(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(TagUsageCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES.values().forEach(TagUsageCaptureFixture::clear);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void glossaryDeletionRetainsAssetAndNestedColumnDependencies(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.db.schema.table");
    fixture.seed(1, "Glossary.Customer", "service.db.schema.table.address.city");
    fixture.seed(0, "Glossary.Customer", "service.db.schema.table");
    fixture.dao().deleteTagLabels(1, "Glossary.Customer");
    assertEquals(1, fixture.count("tag_usage"));
    final var search = fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    final var rdf = fixture.journal().claim(ProjectionTarget.RDF, 10, Duration.ofSeconds(30));
    assertEquals(1, search.size());
    assertEquals(1, rdf.size());
    assertEquals(search.getFirst().id(), rdf.getFirst().id());
    assertInstanceOf(TagUsageMutation.class, search.getFirst().mutation());
    final var retained = fixture.snapshots().page(search.getFirst().id(), 0, 10);
    assertEquals(2, retained.size());
    assertTrue(
        retained.stream()
            .allMatch(row -> row.source() == 1 && row.tagFqn().equals("Glossary.Customer")));
    assertEquals(
        Set.of(
            FullyQualifiedName.buildHash("service.db.schema.table"),
            FullyQualifiedName.buildHash("service.db.schema.table.address.city")),
        retained.stream().map(TagUsageSnapshot::targetFqnHash).collect(Collectors.toSet()));
    assertTrue(fixture.journal().advance(search.getFirst(), null, true, handle -> {}));
    assertEquals(retained, fixture.snapshots().page(rdf.getFirst().id(), 0, 10));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pointInsertAndDuplicateRetainThePersistedAssociation(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final TagUsageDAO dao = fixture.dao();
    dao.applyTag(
        1,
        "Glossary.Customer",
        "Glossary.Customer",
        "service.db.schema.table.city",
        0,
        1,
        "first",
        "admin");
    dao.applyTag(
        1,
        "Glossary.Customer",
        "Glossary.Customer",
        "service.db.schema.table.city",
        1,
        0,
        "ignored",
        "admin");
    assertEquals(1, fixture.count("tag_usage"));
    assertEquals(
        "first",
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle.createQuery("SELECT reason FROM tag_usage").mapTo(String.class).one()));
    final var retained = fixture.retained();
    assertEquals(2, retained.size());
    assertTrue(
        retained.stream()
            .allMatch(
                row ->
                    row.tagFqn().equals("Glossary.Customer")
                        && row.targetFqnHash()
                            .equals(FullyQualifiedName.buildHash("service.db.schema.table.city"))));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void batchUpsertsAndDeletesPreserveSourceAndMetadata(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final String target = "service.db.schema.table.city";
    final TagLabel glossary = TagUsageCaptureFixture.label(1, "Glossary.Customer");
    final TagLabel classification = TagUsageCaptureFixture.label(0, "PII.Sensitive");
    fixture.dao().applyTagsBatch(List.of(glossary, classification), target);
    fixture
        .dao()
        .applyTagsBatch(
            List.of(
                glossary
                    .withState(TagLabel.State.SUGGESTED)
                    .withReason("review")
                    .withMetadata(new TagLabelMetadata().withExpiryDate(2000L))),
            target);
    assertEquals(2, fixture.count("tag_usage"));
    assertEquals(
        "review",
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT reason FROM tag_usage WHERE source = 1")
                        .mapTo(String.class)
                        .one()));
    final TagLabel persisted =
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT state, metadata FROM tag_usage WHERE source = 1")
                        .map(
                            (row, context) ->
                                new TagLabel()
                                    .withState(TagLabel.State.values()[row.getInt("state")])
                                    .withMetadata(
                                        JsonUtils.readValue(
                                            row.getString("metadata"), TagLabelMetadata.class)))
                        .one());
    assertEquals(TagLabel.State.SUGGESTED, persisted.getState());
    assertEquals(2000L, persisted.getMetadata().getExpiryDate());
    fixture.dao().deleteTagsBatch(List.of(glossary), target);
    assertEquals(1, fixture.count("tag_usage"));
    final var retained = fixture.retained();
    assertEquals(4, retained.size());
    assertEquals(3, retained.stream().filter(row -> row.source() == 1).count());
    assertEquals(6, fixture.count("metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void multiTargetBatchSkipsDerivedLabelsAndCapturesNestedFields(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture
        .dao()
        .applyTagsBatchMultiTarget(
            Map.of(
                "service.db.schema.table",
                    List.of(TagUsageCaptureFixture.label(1, "Glossary.Customer")),
                "service.db.schema.table.city",
                    List.of(TagUsageCaptureFixture.label(0, "PII.Sensitive")),
                "service.db.schema.other",
                    List.of(
                        TagUsageCaptureFixture.label(0, "Derived.Tag")
                            .withLabelType(TagLabel.LabelType.DERIVED))));
    assertEquals(2, fixture.count("tag_usage"));
    assertEquals(2, fixture.retained().size());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void outerRollbackDiscardsTheMutationAndBothTargetObligations(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.db.schema.table");
    assertThrows(
        IllegalStateException.class,
        () ->
            fixture
                .jdbi()
                .useTransaction(
                    handle -> {
                      handle.attach(TagUsageDAO.class).deleteTagLabels(1, "Glossary.Customer");
                      throw new IllegalStateException("abort");
                    }));
    assertEquals(1, fixture.count("tag_usage"));
    assertEquals(0, fixture.count("metadata_projection_tag_usage"));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void emptyBatchesDoNotInventChanges(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture
        .dao()
        .applyTagsBatchInternal(
            List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
            List.of());
    fixture.dao().deleteTagsBatchInternal(List.of(), List.of(), List.of());
    assertEquals(0, fixture.count("metadata_projection_mutation"));
  }
}
