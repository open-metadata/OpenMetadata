package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.RequestEntityCache;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Isolated("Measures policy query budgets on the calling thread")
@ExtendWith(TestNamespaceExtension.class)
class EntityPolicyReadIT {
  private static final String CLASSIFICATION_TAG = "PII.Sensitive";

  @AfterEach
  void clearRequestCache() {
    RequestEntityCache.clear();
  }

  @Test
  void repeatedReferencesUseOneReadAndMissingReferencesFailTheWholeResolution(TestNamespace ns) {
    final var user = UserTestFactory.createUser(ns, "policy_reference");
    final var repository = domains();
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from user_entity")) {
      final var resolved =
          repository.batchResolveRefs(Entity.USER, List.of(user.getId(), user.getId()));
      assertEquals(Set.of(user.getId()), resolved.keySet());
      assertEquals(
          user.getFullyQualifiedName(), resolved.get(user.getId()).getFullyQualifiedName());
      assertEquals(1, queries.count());
    }
    final UUID missing = UUID.randomUUID();
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from user_entity")) {
      final var failure =
          assertThrows(
              EntityNotFoundException.class,
              () -> repository.batchResolveRefs(Entity.USER, List.of(user.getId(), missing)));
      assertTrue(failure.getMessage().contains(missing.toString()));
      assertEquals(1, queries.count());
    }
  }

  @Test
  void childProjectionLoadsAllParentsTogetherAndKeepsLoadedEmptyDistinct(TestNamespace ns) {
    final Domain parent = domain(ns, "parent", null);
    final Domain empty = domain(ns, "empty", null);
    final Domain first = domain(ns, "first", parent.getFullyQualifiedName());
    final Domain second = domain(ns, "second", parent.getFullyQualifiedName());
    final var repository = domains();
    parent.setChildren(null);
    empty.setChildren(List.of(first.getEntityReference()));
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      repository.fetchAndSetChildren(
          List.of(parent, empty), repository.fieldPolicy().parse(Entity.FIELD_CHILDREN));
      assertEquals(1, queries.count());
    }
    assertEquals(
        Set.of(first.getId(), second.getId()),
        parent.getChildren().stream().map(EntityReference::getId).collect(Collectors.toSet()));
    assertNull(empty.getChildren());
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      repository.fetchAndSetChildren(List.of(parent), repository.fieldPolicy().parse(""));
      assertEquals(0, queries.count());
      assertEquals(2, parent.getChildren().size());
    }
  }

  @Test
  void authorizationTagHydrationIncludesDerivedLabelsWithTwoQueries(TestNamespace ns) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var first = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "first");
    final var second =
        TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "second");
    final var glossary = GlossaryTestFactory.createSimple(ns);
    final var term = GlossaryTermTestFactory.createSimple(ns, glossary);
    final var tags = Entity.getCollectionDAO().tagUsageDAO();
    tags.applyTagsBatch(
        List.of(label(CLASSIFICATION_TAG, TagLabel.TagSource.CLASSIFICATION)),
        term.getFullyQualifiedName());
    final var applied = label(term.getFullyQualifiedName(), TagLabel.TagSource.GLOSSARY);
    tags.applyTagsBatch(List.of(applied), first.getFullyQualifiedName());
    tags.applyTagsBatch(List.of(applied), second.getFullyQualifiedName());
    final var repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from tag_usage")) {
      repository.batchLoadTags(List.of(first, second));
      assertEquals(2, queries.count());
    }
    for (final var entity : List.of(first, second)) {
      assertEquals(
          Set.of(CLASSIFICATION_TAG, term.getFullyQualifiedName()),
          entity.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toSet()));
      assertEquals(
          TagLabel.LabelType.DERIVED,
          entity.getTags().stream()
              .filter(tag -> CLASSIFICATION_TAG.equals(tag.getTagFQN()))
              .findFirst()
              .orElseThrow()
              .getLabelType());
    }
  }

  @Test
  void reindexOffsetPagesKeepKnownTotalsAndResumeWithoutRecounting(TestNamespace ns)
      throws Exception {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var first = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "a");
    final var second = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "b");
    final var third = TableTestFactory.createWithName(ns, schema.getFullyQualifiedName(), "c");
    final var filter =
        new ListFilter(Include.ALL).addQueryParam("databaseSchema", schema.getFullyQualifiedName());
    final var source = new PaginatedEntitiesSource(Entity.TABLE, 2, List.of("columns"), 3, filter);
    try (var counts = new SqlQueryCounter(Entity.getJdbi(), "select count")) {
      final var page = source.readNext(Map.of());
      assertEquals(
          List.of(first.getId(), second.getId()),
          page.getData().stream().map(EntityInterface::getId).toList());
      assertEquals(3, page.getPaging().getTotal());
      assertEquals(RestUtil.encodeCursor("2"), page.getPaging().getAfter());
      assertTrue(page.getErrors().isEmpty());
      final var last = source.readNext(Map.of());
      assertEquals(
          List.of(third.getId()), last.getData().stream().map(EntityInterface::getId).toList());
      assertNull(last.getPaging().getAfter());
      assertNull(source.readNext(Map.of()));
      final var resumed = source.readWithCursor(page.getPaging().getAfter());
      assertEquals(
          last.getData().stream().map(EntityInterface::getId).toList(),
          resumed.getData().stream().map(EntityInterface::getId).toList());
      assertEquals(3, resumed.getPaging().getTotal());
      assertEquals(0, counts.count());
    }
  }

  @Test
  void emptyInheritanceAncestorsAreReadOncePerLevel(TestNamespace ns) {
    SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      final DatabaseSchema inherited =
          Entity.getEntityForInheritance(
              Entity.DATABASE_SCHEMA, schema.getId(), "owners,domains", Include.ALL);
      assertTrue(nullOrEmpty(inherited.getOwners()));
      assertTrue(nullOrEmpty(inherited.getDomains()));
      assertEquals(3, queries.count());
    }
  }

  private Domain domain(TestNamespace ns, String name, String parent) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDescription("Policy batch child fixture")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withParent(parent)));
  }

  private TagLabel label(String fqn, TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private DomainRepository domains() {
    return (DomainRepository) Entity.getEntityRepository(Entity.DOMAIN);
  }
}
