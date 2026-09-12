/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.projection;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;

/**
 * The projection parity property, from the design's §11.2:
 *
 * <pre>merge( project(before, ALL), project(after, maskFor(F)) ) == project(after, ALL)</pre>
 *
 * <p>In words: applying a <em>partial</em> write for field {@code F} on top of the previous document
 * must land on exactly the document a <em>full</em> rebuild would have produced. If it does not, the
 * declared lineage for {@code F} is narrower than reality and some path is left describing the old
 * entity — which is the class of bug that produced most of the audit's catalogue, discovered in
 * production rather than here.
 *
 * <p>Runs against the real doc builder with no cluster, so it can fail the build. It is the cheap
 * counterpart to the live-vs-reindex parity IT: this proves a partial write reproduces a full one for
 * a declared field, while the IT proves the two <em>write paths</em> agree at all.
 */
class ProjectionParityPropertyTest {

  /**
   * Fully prefetched, so the doc build performs no DB lookups. {@code DocBuildContext.empty()} means
   * "no prefetch attempted", which tells the lineage and service mixins to fall back to per-entity
   * queries — the reindex bulk sinks pass a populated context for the same reason.
   */
  private static final DocBuildContext NO_DB_LOOKUPS =
      DocBuildContext.of(
          List.of(), DocBuildContext.ServiceStylePrefetch.prefetched(Optional.empty()), 0L);

  private static final ProjectionSpec SPEC = new DefaultProjectionSpec();
  private static final DocumentProjector PROJECTOR = new DocumentProjector(SPEC);

  /**
   * {@code applyTagFields} reads tags through {@code Entity.getEntityTags}, i.e. from the repository
   * rather than from the entity object, so the builder needs a registered repository to run at all.
   * The stub returns the entity's own tags, which is what the reindex path effectively sees once
   * {@code tag_usage} has been read back — that equivalence is what makes the tags case meaningful
   * here rather than a test of the stub.
   */
  @BeforeAll
  @SuppressWarnings("unchecked")
  static void registerStubDashboardRepository() throws Exception {
    EntityRepository<Dashboard> repo = Mockito.mock(EntityRepository.class);
    Mockito.doAnswer(invocation -> ((Dashboard) invocation.getArgument(0)).getTags())
        .when(repo)
        .getAllTags(Mockito.any());
    repositoryMap().put(Entity.DASHBOARD, repo);
  }

  @AfterAll
  static void deregisterStubDashboardRepository() throws Exception {
    repositoryMap().remove(Entity.DASHBOARD);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> repositoryMap() throws Exception {
    Field field = Entity.class.getDeclaredField("ENTITY_REPOSITORY_MAP");
    field.setAccessible(true);
    return (Map<String, Object>) field.get(null);
  }

  /** One case per declared field: how to mutate the entity, and which field name changed. */
  private record Case(String field, Consumer<Dashboard> mutate) {
    @Override
    public String toString() {
      return field;
    }
  }

  static List<Case> declaredFieldMutations() {
    return List.of(
        new Case("description", d -> d.setDescription("a new description")),
        new Case("displayName", d -> d.setDisplayName("A New Display Name")),
        new Case(
            "tags",
            d ->
                d.setTags(
                    List.of(
                        new TagLabel()
                            .withTagFQN("Tier.Tier1")
                            .withSource(TagLabel.TagSource.CLASSIFICATION)
                            .withLabelType(TagLabel.LabelType.MANUAL),
                        new TagLabel()
                            .withTagFQN("PII.Sensitive")
                            .withSource(TagLabel.TagSource.CLASSIFICATION)
                            .withLabelType(TagLabel.LabelType.MANUAL)))),
        new Case("deleted", d -> d.setDeleted(true)));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("declaredFieldMutations")
  @DisplayName("a partial write for a declared field reproduces the full rebuild")
  void partialWriteReproducesFullRebuild(final Case testCase) {
    Dashboard before = baseDashboard();
    Map<String, Object> beforeDoc = PROJECTOR.projectAll(index(before), NO_DB_LOOKUPS);

    Dashboard after = baseDashboard();
    testCase.mutate().accept(after);

    FieldMask mask = FieldMask.of(SPEC.docPathsFor(testCase.field()));
    assertThat(mask)
        .as("no lineage declared for '%s' — the case would be vacuous", testCase.field())
        .isNotEqualTo(FieldMask.of(java.util.Set.of()));

    Map<String, Object> partial =
        PROJECTOR.project(index(after), NO_DB_LOOKUPS, mask, DocumentProjector.REBUILD_AUTHORITY);
    Map<String, Object> merged = new LinkedHashMap<>(beforeDoc);
    merged.putAll(partial);

    Map<String, Object> fullRebuild = PROJECTOR.projectAll(index(after), NO_DB_LOOKUPS);

    assertThat(merged)
        .as(
            "partial write for '%s' did not reproduce the full rebuild; the declared lineage %s is "
                + "narrower than what the builder actually changed",
            testCase.field(), SPEC.docPathsFor(testCase.field()))
        .containsExactlyInAnyOrderEntriesOf(fullRebuild);
  }

  /**
   * The property has to be able to fail, or it proves nothing. An empty mask writes nothing, so the
   * merge is just the previous document and must differ from a rebuild that saw the change.
   */
  @ParameterizedTest(name = "{0}")
  @MethodSource("declaredFieldMutations")
  @DisplayName("an empty mask does not reproduce the full rebuild")
  void emptyMaskFailsTheProperty(final Case testCase) {
    Dashboard before = baseDashboard();
    Map<String, Object> beforeDoc = PROJECTOR.projectAll(index(before), NO_DB_LOOKUPS);

    Dashboard after = baseDashboard();
    testCase.mutate().accept(after);

    Map<String, Object> partial =
        PROJECTOR.project(
            index(after),
            NO_DB_LOOKUPS,
            FieldMask.of(java.util.Set.of()),
            DocumentProjector.REBUILD_AUTHORITY);
    Map<String, Object> merged = new LinkedHashMap<>(beforeDoc);
    merged.putAll(partial);

    assertThat(merged)
        .as("writing nothing must not look like a correct rebuild for '%s'", testCase.field())
        .isNotEqualTo(PROJECTOR.projectAll(index(after), NO_DB_LOOKUPS));
  }

  private static SearchIndex index(Dashboard dashboard) {
    return new DashboardIndex(dashboard);
  }

  /** Fixed id/name so two builds differ only by the field under test. */
  private static Dashboard baseDashboard() {
    return new Dashboard()
        .withId(UUID.fromString("00000000-0000-0000-0000-0000000000d1"))
        .withName("orders-dashboard")
        .withFullyQualifiedName("svc.orders-dashboard")
        .withDescription("the original description")
        .withDisplayName("Orders Dashboard")
        .withDeleted(false);
  }
}
