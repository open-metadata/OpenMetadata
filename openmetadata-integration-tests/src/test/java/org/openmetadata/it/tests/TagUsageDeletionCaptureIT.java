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

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.projection.TagUsageSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
class TagUsageDeletionCaptureIT {
  private static final Map<RdfTestDatabase.Backend, TagUsageCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static final String ROOT = "service.db.schema.table";
  private static final String OTHER = "service.db.schema.other";
  private static final String TERM = "Glossary.Customer";
  private static final List<Usage> ROWS =
      List.of(
          new Usage(1, TERM, ROOT), new Usage(1, TERM, ROOT + ".column"),
          new Usage(0, TERM, ROOT), new Usage(0, "Certification.Gold", ROOT),
          new Usage(0, "PII.Sensitive", OTHER), new Usage(1, "Glossary.Other", OTHER));

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

  static Stream<Arguments> deletions() {
    final List<Selection> selections =
        List.of(
            new Selection("target", dao -> dao.deleteTagsByTarget(ROOT), Set.of(0, 2, 3)),
            new Selection(
                "prefix and target",
                dao -> dao.deleteTagsByPrefixAndTarget(0, "Certification.%", ROOT),
                Set.of(3)),
            new Selection(
                "target preserving certification",
                dao -> dao.deleteTagsByTargetExcludingPrefix(0, "Certification.%", ROOT),
                Set.of(0, 2)),
            new Selection(
                "targets",
                dao -> dao.deleteTagsByTargets(List.of(ROOT, OTHER)),
                Set.of(0, 2, 3, 4, 5)),
            new Selection(
                "prefix and targets",
                dao -> dao.deleteTagsByPrefixAndTargets(1, "Glossary.%", List.of(ROOT, OTHER)),
                Set.of(0, 5)),
            new Selection(
                "tag and owning entity",
                dao -> dao.deleteTagsByTagAndTargetEntity(TERM, ROOT),
                Set.of(0, 1, 2)),
            new Selection("source and tag", dao -> dao.deleteTagLabels(1, TERM), Set.of(0, 1)),
            new Selection(
                "tag without source", dao -> dao.deleteTagLabelsByFqn(TERM), Set.of(0, 1, 2)),
            new Selection(
                "target prefix",
                dao -> dao.deleteTagLabelsByTargetPrefix(ROOT),
                Set.of(0, 1, 2, 3)),
            new Selection(
                "exact raw hashes",
                dao -> assertEquals(1, dao.deleteTagUsage(1, hash(TERM), hash(ROOT))),
                Set.of(0)),
            new Selection(
                "null-safe existing key",
                dao -> assertEquals(1, dao.deleteTagUsageNullSafe(1, hash(TERM), hash(ROOT))),
                Set.of(0)));
    return RdfTestDatabase.backends()
        .flatMap(backend -> selections.stream().map(selection -> Arguments.of(backend, selection)));
  }

  @ParameterizedTest(name = "{0}: {1}")
  @MethodSource("deletions")
  void selectorsRetainExactlyTheirAffectedMembership(
      final RdfTestDatabase.Backend backend, final Selection selection) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    ROWS.forEach(row -> fixture.seed(row.source(), row.tag(), row.target()));
    selection.delete().accept(fixture.dao());
    final Set<Identity> expected =
        selection.deleted().stream()
            .map(ROWS::get)
            .map(Usage::identity)
            .collect(Collectors.toSet());
    assertEquals(
        expected,
        fixture.retained().stream()
            .map(TagUsageDeletionCaptureIT::identity)
            .collect(Collectors.toSet()));
    final Set<Identity> survivors =
        IntStream.range(0, ROWS.size())
            .filter(i -> !selection.deleted().contains(i))
            .mapToObj(i -> ROWS.get(i).identity())
            .collect(Collectors.toSet());
    assertEquals(
        survivors,
        Set.copyOf(
            fixture
                .jdbi()
                .withHandle(
                    handle ->
                        handle
                            .createQuery("SELECT source, tagFQNHash, targetFQNHash FROM tag_usage")
                            .map(
                                (row, context) ->
                                    new Identity(
                                        row.getInt("source"),
                                        row.getString("tagFQNHash"),
                                        row.getString("targetFQNHash")))
                            .list())));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void malformedNullableLegacyRowsRemainRepresentedDuringCleanup(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture
        .jdbi()
        .useHandle(
            handle -> {
              handle.execute(
                  "INSERT INTO tag_usage (labelType, state, source, tagFQN, tagFQNHash, targetFQNHash) VALUES (0, 1, 1, ?, NULL, ?)",
                  TERM,
                  hash(ROOT));
              handle.execute(
                  "INSERT INTO tag_usage (labelType, state, source, tagFQN, tagFQNHash, targetFQNHash) VALUES (0, 1, 1, ?, ?, NULL)",
                  TERM,
                  hash(TERM));
              handle.execute(
                  "INSERT INTO tag_usage (labelType, state, source, tagFQN, tagFQNHash, targetFQNHash) VALUES (0, 1, 1, ?, NULL, NULL)",
                  TERM);
            });
    assertEquals(1, fixture.dao().deleteTagUsageNullSafe(1, null, hash(ROOT)));
    assertEquals(1, fixture.dao().deleteTagUsageNullSafe(1, hash(TERM), null));
    assertEquals(1, fixture.dao().deleteTagUsageNullSafe(1, null, null));
    assertEquals(0, fixture.count("tag_usage"));
    assertEquals(
        Set.of(
            new Identity(1, null, hash(ROOT)),
            new Identity(1, hash(TERM), null),
            new Identity(1, null, null)),
        fixture.retained().stream()
            .map(TagUsageDeletionCaptureIT::identity)
            .collect(Collectors.toSet()));
  }

  private static Identity identity(final TagUsageSnapshot row) {
    return new Identity(row.source(), row.tagFqnHash(), row.targetFqnHash());
  }

  private static String hash(final String fqn) {
    return FullyQualifiedName.buildHash(fqn);
  }

  private record Identity(int source, String tagHash, String targetHash) {}

  private record Usage(int source, String tag, String target) {
    Identity identity() {
      return new Identity(source, hash(tag), hash(target));
    }
  }

  private record Selection(String name, Consumer<TagUsageDAO> delete, Set<Integer> deleted) {
    @Override
    public String toString() {
      return name;
    }
  }
}
