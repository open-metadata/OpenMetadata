package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;

class EntityInheritanceLoaderTest {
  private static final Fields DOMAINS = new Fields(Set.of(FIELD_DOMAINS));
  private final List<List<EntityReference>> batches = new ArrayList<>();

  @Test
  void batchesUniqueParentsByTypeAndRetainsLocalValues() {
    final var firstParent = parent();
    final var secondParent = parent();
    final var firstRef = firstParent.getEntityReference().withType("database");
    final var secondRef = secondParent.getEntityReference().withType("databaseSchema");
    final var first = child(firstRef);
    final var sibling = child(firstRef);
    final var second = child(secondRef);
    final var local = child(firstRef).withDomains(List.of(domain()));
    final var localDomains = local.getDomains();
    final var loader =
        loader(
            Map.of(firstParent.getId(), firstParent, secondParent.getId(), secondParent),
            (entity, fields) -> null);
    loader.load(List.of(first, sibling, second, local), DOMAINS, Map.of());
    assertEquals(2, batches.size());
    assertTrue(batches.stream().allMatch(batch -> batch.size() == 1));
    assertEquals(
        firstParent.getDomains().getFirst().getId(), first.getDomains().getFirst().getId());
    assertEquals(
        secondParent.getDomains().getFirst().getId(), second.getDomains().getFirst().getId());
    assertSame(localDomains, local.getDomains());
    first.getDomains().getFirst().setName("changed");
    assertEquals("domain", sibling.getDomains().getFirst().getName());
    assertEquals("domain", firstParent.getDomains().getFirst().getName());
  }

  @Test
  void ancestorReferencesContinueTraversalWhenTheParentFieldWasNotHydrated() {
    final var parent = parent();
    final var child = child(null);
    final var loader = loader(Map.of(parent.getId(), parent), (entity, fields) -> null);
    loader.load(
        List.of(child),
        DOMAINS,
        Map.of(child.getId(), parent.getEntityReference().withType("database")));
    assertEquals(parent.getDomains().getFirst().getId(), child.getDomains().getFirst().getId());
    assertEquals(1, batches.size());
  }

  @Test
  void absentBatchParentsAndMissingReferencesUseTheModuleFallback() {
    final var loader = loader(Map.of(), (entity, fields) -> null);
    final var missing = child(parent().getEntityReference().withType("database"));
    loader.load(List.of(missing), DOMAINS, Map.of());
    assertEquals("fallback", missing.getDescription());
    final var withoutReference = child(null);
    loader.load(List.of(withoutReference), DOMAINS, Map.of());
    assertEquals("fallback", withoutReference.getDescription());
    loader.load(List.of(), DOMAINS, Map.of());
    assertEquals(1, batches.size());
  }

  @Test
  void singleReadsRetainParentProjectionAndApplyInheritance() {
    final var parent = parent();
    final var loader =
        loader(
            Map.of(),
            (entity, fields) -> {
              assertEquals(FIELD_DOMAINS, fields);
              return parent;
            });
    final var child = child(parent.getEntityReference());
    loader.load(child, DOMAINS);
    assertTrue(child.getDomains().getFirst().getInherited());
    final var unrequested = child(null);
    loader.load(unrequested, Fields.EMPTY_FIELDS);
    assertNull(unrequested.getDomains());
  }

  @Test
  void concurrentlyDeletedParentsAreToleratedAndOtherFailuresPropagate() {
    final var deleted =
        loader(
            Map.of(),
            (entity, fields) -> {
              throw EntityNotFoundException.byMessage("deleted parent");
            });
    final var child = child(null);
    deleted.load(child, DOMAINS);
    assertNull(child.getDomains());
    final var failing =
        loader(
            Map.of(),
            (entity, fields) -> {
              throw new IllegalStateException("database unavailable");
            });
    assertThrows(IllegalStateException.class, () -> failing.load(child, DOMAINS));
  }

  private EntityInheritanceLoader<Table> loader(
      Map<UUID, EntityInterface> parents, BiFunction<Table, String, EntityInterface> single) {
    return new EntityInheritanceLoader<>(
        new EntityInheritanceLoader.Policy<>(
            (entity, fields) -> fields.contains(FIELD_DOMAINS) && nullOrEmpty(entity.getDomains()),
            Table::getDatabase,
            type -> FIELD_DOMAINS,
            (entity, fields, parent) ->
                InheritedReferences.apply(
                    InheritedReferences.Field.DOMAINS, entity, fields, parent)),
        new EntityInheritanceLoader.Parents<>(
            single,
            (references, fields) -> {
              batches.add(List.copyOf(references));
              return references.stream()
                  .map(reference -> parents.get(reference.getId()))
                  .filter(Objects::nonNull)
                  .toList();
            }),
        (entity, fields) -> entity.setDescription("fallback"));
  }

  private static Table child(EntityReference parent) {
    return new Table().withId(UUID.randomUUID()).withDatabase(parent);
  }

  private static Table parent() {
    return new Table().withId(UUID.randomUUID()).withDomains(List.of(domain()));
  }

  private static EntityReference domain() {
    return new EntityReference().withId(UUID.randomUUID()).withType("domain").withName("domain");
  }
}
