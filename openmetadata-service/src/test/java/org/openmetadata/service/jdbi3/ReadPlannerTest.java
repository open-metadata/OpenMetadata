package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.DELETED;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class ReadPlannerTest {

  private final ReadPlanner planner = new ReadPlanner();

  private record SupportFlags(
      boolean owners,
      boolean domains,
      boolean followers,
      boolean reviewers,
      boolean dataProducts,
      boolean experts,
      boolean extension,
      boolean tags,
      boolean votes) {

    static SupportFlags allEnabled() {
      return new SupportFlags(true, true, true, true, true, true, true, true, true);
    }
  }

  @Test
  void ownersFieldCreatesToRelationPlan() {
    ReadPlan plan = buildPlan(Set.of(FIELD_OWNERS), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_OWNERS));
    assertEquals(NON_DELETED, plan.getIncludeForField(FIELD_OWNERS));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_OWNERS).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.TO, spec.direction());
    assertEquals(Relationship.OWNS, spec.relationship());
    assertEquals(null, spec.relatedEntityType());
    assertEquals(
        Set.of(Relationship.OWNS.ordinal()), plan.getToRelationsByInclude().get(NON_DELETED));
  }

  @Test
  void domainsFieldCreatesToRelationPlan() {
    ReadPlan plan = buildPlan(Set.of(FIELD_DOMAINS), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_DOMAINS));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_DOMAINS).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.TO, spec.direction());
    assertEquals(Relationship.HAS, spec.relationship());
    assertEquals("domain", spec.relatedEntityType());
  }

  @Test
  void followersFieldCreatesToRelationPlan() {
    ReadPlan plan = buildPlan(Set.of(FIELD_FOLLOWERS), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_FOLLOWERS));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_FOLLOWERS).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.TO, spec.direction());
    assertEquals(Relationship.FOLLOWS, spec.relationship());
    assertEquals("user", spec.relatedEntityType());
  }

  @Test
  void reviewersFieldCreatesToRelationPlan() {
    ReadPlan plan = buildPlan(Set.of(FIELD_REVIEWERS), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_REVIEWERS));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_REVIEWERS).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.TO, spec.direction());
    assertEquals(Relationship.REVIEWS, spec.relationship());
    assertEquals(null, spec.relatedEntityType());
  }

  @Test
  void dataProductsFieldCreatesToRelationPlan() {
    ReadPlan plan =
        buildPlan(Set.of(FIELD_DATA_PRODUCTS), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_DATA_PRODUCTS));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_DATA_PRODUCTS).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.TO, spec.direction());
    assertEquals(Relationship.HAS, spec.relationship());
    assertEquals("dataProduct", spec.relatedEntityType());
  }

  @Test
  void childrenFieldCreatesFromRelationPlan() {
    ReadPlan plan = buildPlan(Set.of(FIELD_CHILDREN), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_CHILDREN));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_CHILDREN).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.FROM, spec.direction());
    assertEquals(Relationship.CONTAINS, spec.relationship());
    assertEquals("table", spec.relatedEntityType());
  }

  @Test
  void expertsFieldCreatesFromRelationPlan() {
    ReadPlan plan = buildPlan(Set.of(FIELD_EXPERTS), RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_EXPERTS));
    ReadPlan.RelationSpec spec = plan.getRelationSpec(FIELD_EXPERTS).orElseThrow();
    assertEquals(ReadPlan.RelationDirection.FROM, spec.direction());
    assertEquals(Relationship.EXPERT, spec.relationship());
    assertEquals("user", spec.relatedEntityType());
  }

  @Test
  void tagsFieldSetsTagsLoadFlag() {
    ReadPlan plan = buildPlan(Set.of(FIELD_TAGS), RelationIncludes.fromInclude(NON_DELETED));
    assertTrue(plan.shouldLoadTags());
    assertFalse(plan.shouldLoadVotes());
    assertFalse(plan.shouldLoadExtension());
  }

  @Test
  void votesFieldSetsVotesLoadFlag() {
    ReadPlan plan = buildPlan(Set.of(FIELD_VOTES), RelationIncludes.fromInclude(NON_DELETED));
    assertTrue(plan.shouldLoadVotes());
    assertFalse(plan.shouldLoadTags());
    assertFalse(plan.shouldLoadExtension());
  }

  @Test
  void extensionFieldSetsExtensionLoadFlag() {
    ReadPlan plan = buildPlan(Set.of(FIELD_EXTENSION), RelationIncludes.fromInclude(NON_DELETED));
    assertTrue(plan.shouldLoadExtension());
    assertFalse(plan.shouldLoadTags());
    assertFalse(plan.shouldLoadVotes());
  }

  @Test
  void allFieldsBuildsComprehensivePlan() {
    ReadPlan plan =
        buildPlan(
            Set.of(
                FIELD_OWNERS,
                FIELD_DOMAINS,
                FIELD_FOLLOWERS,
                FIELD_REVIEWERS,
                FIELD_DATA_PRODUCTS,
                FIELD_CHILDREN,
                FIELD_EXPERTS,
                FIELD_TAGS,
                FIELD_VOTES,
                FIELD_EXTENSION),
            RelationIncludes.fromInclude(NON_DELETED));

    assertTrue(plan.shouldLoadRelationField(FIELD_OWNERS));
    assertTrue(plan.shouldLoadRelationField(FIELD_DOMAINS));
    assertTrue(plan.shouldLoadRelationField(FIELD_FOLLOWERS));
    assertTrue(plan.shouldLoadRelationField(FIELD_REVIEWERS));
    assertTrue(plan.shouldLoadRelationField(FIELD_DATA_PRODUCTS));
    assertTrue(plan.shouldLoadRelationField(FIELD_CHILDREN));
    assertTrue(plan.shouldLoadRelationField(FIELD_EXPERTS));
    assertTrue(plan.shouldLoadTags());
    assertTrue(plan.shouldLoadVotes());
    assertTrue(plan.shouldLoadExtension());
    assertEquals(7, plan.getRelationSpecs().size());
  }

  @Test
  void multipleFieldsWithMixedIncludesAreGroupedCorrectly() {
    RelationIncludes relationIncludes =
        new RelationIncludes(
            NON_DELETED,
            Map.of(
                FIELD_OWNERS, ALL,
                FIELD_DOMAINS, DELETED,
                FIELD_CHILDREN, ALL,
                FIELD_EXPERTS, DELETED));

    ReadPlan plan =
        buildPlan(
            Set.of(FIELD_OWNERS, FIELD_DOMAINS, FIELD_FOLLOWERS, FIELD_CHILDREN, FIELD_EXPERTS),
            relationIncludes);

    assertEquals(ALL, plan.getIncludeForField(FIELD_OWNERS));
    assertEquals(DELETED, plan.getIncludeForField(FIELD_DOMAINS));
    assertEquals(NON_DELETED, plan.getIncludeForField(FIELD_FOLLOWERS));
    assertEquals(ALL, plan.getIncludeForField(FIELD_CHILDREN));
    assertEquals(DELETED, plan.getIncludeForField(FIELD_EXPERTS));

    assertEquals(Set.of(Relationship.OWNS.ordinal()), plan.getToRelationsByInclude().get(ALL));
    assertEquals(Set.of(Relationship.HAS.ordinal()), plan.getToRelationsByInclude().get(DELETED));
    assertEquals(
        Set.of(Relationship.FOLLOWS.ordinal()), plan.getToRelationsByInclude().get(NON_DELETED));
    assertEquals(
        Set.of(Relationship.CONTAINS.ordinal()), plan.getFromRelationsByInclude().get(ALL));
    assertEquals(
        Set.of(Relationship.EXPERT.ordinal()), plan.getFromRelationsByInclude().get(DELETED));
  }

  @Test
  void unsupportedFlagsDisableSpecificFieldsOnly() {
    SupportFlags supports =
        new SupportFlags(false, false, false, false, false, false, true, true, true);
    ReadPlan plan =
        buildPlan(
            Set.of(
                FIELD_OWNERS,
                FIELD_DOMAINS,
                FIELD_FOLLOWERS,
                FIELD_REVIEWERS,
                FIELD_DATA_PRODUCTS,
                FIELD_EXPERTS,
                FIELD_CHILDREN,
                FIELD_EXTENSION,
                FIELD_TAGS,
                FIELD_VOTES),
            RelationIncludes.fromInclude(NON_DELETED),
            supports);

    assertFalse(plan.shouldLoadRelationField(FIELD_OWNERS));
    assertFalse(plan.shouldLoadRelationField(FIELD_DOMAINS));
    assertFalse(plan.shouldLoadRelationField(FIELD_FOLLOWERS));
    assertFalse(plan.shouldLoadRelationField(FIELD_REVIEWERS));
    assertFalse(plan.shouldLoadRelationField(FIELD_DATA_PRODUCTS));
    assertFalse(plan.shouldLoadRelationField(FIELD_EXPERTS));
    assertTrue(plan.shouldLoadRelationField(FIELD_CHILDREN));
    assertTrue(plan.shouldLoadExtension());
    assertTrue(plan.shouldLoadTags());
    assertTrue(plan.shouldLoadVotes());
  }

  @Test
  void returnsEmptyPlanWhenEntityOrIdMissing() {
    Fields fields = new Fields(Set.of(FIELD_OWNERS, FIELD_TAGS));
    SupportFlags supports = SupportFlags.allEnabled();

    ReadPlan nullEntityPlan =
        planner.build(
            null, fields, RelationIncludes.fromInclude(NON_DELETED), toConfig("table", supports));
    assertTrue(nullEntityPlan.isEmpty());

    Table missingIdEntity = new Table();
    ReadPlan missingIdPlan =
        planner.build(
            missingIdEntity,
            fields,
            RelationIncludes.fromInclude(NON_DELETED),
            toConfig("table", supports));
    assertTrue(missingIdPlan.isEmpty());
  }

  @Test
  void builderSupportsEntitySpecificExtensions() {
    Table entity = new Table();
    entity.setId(UUID.randomUUID());
    SupportFlags supports = SupportFlags.allEnabled();

    ReadPlan plan =
        planner
            .newBuilder(
                entity,
                new Fields(Set.of(FIELD_OWNERS)),
                RelationIncludes.fromInclude(NON_DELETED),
                toConfig("table", supports))
            .addToRelationField("customAssets", ALL, Relationship.USES, "metric")
            .addEntitySpecificPrefetch("table.columns")
            .build();

    assertTrue(plan.shouldLoadRelationField("customAssets"));
    assertEquals(ALL, plan.getIncludeForField("customAssets"));
    ReadPlan.RelationSpec customSpec = plan.getRelationSpec("customAssets").orElseThrow();
    assertEquals(ReadPlan.RelationDirection.TO, customSpec.direction());
    assertEquals(Relationship.USES, customSpec.relationship());
    assertEquals("metric", customSpec.relatedEntityType());
    assertTrue(plan.getEntitySpecificPrefetchKeys().contains("table.columns"));
  }

  @Test
  void prefetchOnlyPlanIsNotEmpty() {
    Table entity = new Table();
    entity.setId(UUID.randomUUID());
    SupportFlags supports = SupportFlags.allEnabled();

    ReadPlan plan =
        planner
            .newBuilder(
                entity,
                new Fields(Set.of()),
                RelationIncludes.fromInclude(NON_DELETED),
                toConfig("table", supports))
            .addEntitySpecificPrefetch("table.columns")
            .build();

    assertFalse(plan.isEmpty());
    assertTrue(plan.getEntitySpecificPrefetchKeys().contains("table.columns"));
  }

  private ReadPlan buildPlan(Set<String> requestedFields, RelationIncludes includes) {
    return buildPlan(requestedFields, includes, SupportFlags.allEnabled());
  }

  private ReadPlan buildPlan(
      Set<String> requestedFields, RelationIncludes includes, SupportFlags supports) {
    Table entity = new Table();
    entity.setId(UUID.randomUUID());
    Fields fields = new Fields(requestedFields);
    return planner.build(entity, fields, includes, toConfig("table", supports));
  }

  private ReadPlanner.ReadPlannerConfig toConfig(String entityType, SupportFlags supports) {
    return new ReadPlanner.ReadPlannerConfig(
        entityType,
        supports.owners,
        supports.domains,
        supports.followers,
        supports.reviewers,
        supports.dataProducts,
        supports.experts,
        supports.extension,
        supports.tags,
        supports.votes);
  }
}
