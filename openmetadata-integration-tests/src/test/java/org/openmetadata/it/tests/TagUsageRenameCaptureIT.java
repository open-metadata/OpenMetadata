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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.service.projection.TagUsageSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
class TagUsageRenameCaptureIT {
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
  void glossaryRenameRetainsOldAndNewRootAndChildLocators(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.table");
    fixture.seed(1, "Glossary.Customer.Child", "service.table.column");
    fixture.seed(1, "Glossary.CustomerOther", "service.other");
    fixture.seed(0, "Glossary.Customer.Child", "service.table");
    fixture.dao().rename(1, "Glossary.Customer", "Other.Client");
    assertEquals(
        Set.of(
            "Other.Client",
            "Other.Client.Child",
            "Glossary.CustomerOther",
            "Glossary.Customer.Child"),
        tags(fixture));
    final var retained = fixture.retained();
    assertEquals(
        Set.of(
            "Glossary.Customer", "Glossary.Customer.Child", "Other.Client", "Other.Client.Child"),
        retained.stream().map(TagUsageSnapshot::tagFqn).collect(Collectors.toSet()));
    assertTrue(
        retained.stream()
            .allMatch(
                row ->
                    row.source() == 1
                        && row.tagFqnHash().equals(FullyQualifiedName.buildHash(row.tagFqn()))));
    assertEquals(4, retained.size());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void onlyTheLeadingPrefixIsRenamedWhenALaterSegmentContainsIt(
      final RdfTestDatabase.Backend backend) {
    try (var uncaptured = new TagUsageCaptureFixture(backend, false)) {
      for (final TagUsageCaptureFixture fixture : List.of(DATABASES.get(backend), uncaptured)) {
        fixture.seed(1, "Sales.PreSales.Leads", "SNOWFLAKE.SNOWFLAKE.orders");
        fixture.dao().rename(1, "Sales", "Revenue");
        fixture.dao().renameByTargetFQNHash(1, "SNOWFLAKE", "WAREHOUSE");
        assertEquals(Set.of("Revenue.PreSales.Leads"), tags(fixture));
        final Map<String, Object> stored =
            fixture
                .jdbi()
                .withHandle(
                    handle ->
                        handle
                            .createQuery("SELECT tagFQNHash, targetFQNHash FROM tag_usage")
                            .mapToMap()
                            .one());
        assertEquals(
            FullyQualifiedName.buildHash("Revenue.PreSales.Leads"), stored.get("tagfqnhash"));
        assertEquals(
            FullyQualifiedName.buildHash("WAREHOUSE.SNOWFLAKE.orders"),
            stored.get("targetfqnhash"));
      }
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void quotedNamesAndApostrophesRemainBoundData(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    final String before = "\"Glossary's.Name\".Customer";
    final String after = "\"Moved's.Name\".Client";
    fixture.seed(1, before + ".Child", "service.table.\"nested.column\"");
    fixture.dao().updateTagPrefix(1, before, after);
    assertEquals(Set.of(after + ".Child"), tags(fixture));
    final var retained = fixture.retained();
    assertEquals(
        Set.of(before + ".Child", after + ".Child"),
        retained.stream().map(TagUsageSnapshot::tagFqn).collect(Collectors.toSet()));
    assertTrue(
        retained.stream()
            .allMatch(
                row ->
                    row.targetFqnHash()
                        .equals(FullyQualifiedName.buildHash("service.table.\"nested.column\""))));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void assetRenameRetainsBothHashesIncludingNestedColumns(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.table");
    fixture.seed(1, "Glossary.Customer", "service.table.address.city");
    fixture.seed(0, "PII.Sensitive", "service.table.address.city");
    fixture.dao().updateTargetFQNHash("service.table", "service.renamed");
    fixture.dao().renameByTargetFQNHash(1, "service.table", "service.renamed");
    final var retained = fixture.retained();
    assertEquals(
        Set.of(
            FullyQualifiedName.buildHash("service.table"),
            FullyQualifiedName.buildHash("service.renamed"),
            FullyQualifiedName.buildHash("service.table.address.city"),
            FullyQualifiedName.buildHash("service.renamed.address.city")),
        retained.stream().map(TagUsageSnapshot::targetFqnHash).collect(Collectors.toSet()));
    assertEquals(4, retained.size());
    assertTrue(retained.stream().allMatch(row -> row.source() == 1));
    assertEquals(
        FullyQualifiedName.buildHash("service.table.address.city"),
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT targetFQNHash FROM tag_usage WHERE source = 0")
                        .mapTo(String.class)
                        .one()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void childConflictRollsBackTheWholeRenameIncludingItsRoot(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.table");
    fixture.seed(1, "Glossary.Customer.Child", "service.table");
    fixture.seed(1, "Other.Client.Child", "service.table");
    assertThrows(
        RuntimeException.class, () -> fixture.dao().rename(1, "Glossary.Customer", "Other.Client"));
    assertEquals(
        Set.of("Glossary.Customer", "Glossary.Customer.Child", "Other.Client.Child"),
        tags(fixture));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_tag_usage"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void boundRenamePreservesResultsWithCaptureDisabled(final RdfTestDatabase.Backend backend) {
    try (TagUsageCaptureFixture baseline = new TagUsageCaptureFixture(backend, false)) {
      baseline.seed(1, "Old.Term", "service.table");
      baseline.seed(1, "Old.Term.Child", "service.table.column");
      baseline.dao().rename(1, "Old.Term", "New.Term");
      baseline.dao().updateTargetFQNHash("service.table", "service.renamed");
      baseline.dao().renameByTargetFQNHash(1, "service.table", "service.renamed");
      assertEquals(Set.of("New.Term", "New.Term.Child"), tags(baseline));
      assertEquals(
          Set.of(
              FullyQualifiedName.buildHash("service.renamed"),
              FullyQualifiedName.buildHash("service.renamed.column")),
          Set.copyOf(
              baseline
                  .jdbi()
                  .withHandle(
                      handle ->
                          handle
                              .createQuery("SELECT targetFQNHash FROM tag_usage")
                              .mapTo(String.class)
                              .list())));
      assertEquals(0, baseline.count("metadata_projection_mutation"));
    }
  }

  private static Set<String> tags(final TagUsageCaptureFixture fixture) {
    return Set.copyOf(
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle.createQuery("SELECT tagFQN FROM tag_usage").mapTo(String.class).list()));
  }
}
