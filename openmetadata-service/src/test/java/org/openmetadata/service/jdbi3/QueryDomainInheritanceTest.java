package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class QueryDomainInheritanceTest {

  @Test
  void resolvesUniqueInheritedDomainsFromEveryAssociatedTable() {
    EntityReference sharedDomain = reference(Entity.DOMAIN, "shared");
    EntityReference firstDomain = reference(Entity.DOMAIN, "first");
    EntityReference secondDomain = reference(Entity.DOMAIN, "second");
    Table firstTable = table("firstTable", sharedDomain, firstDomain);
    Table secondTable = table("secondTable", sharedDomain, secondDomain);
    Query query =
        new Query()
            .withQueryUsedIn(
                List.of(
                    tableReference(firstTable),
                    tableReference(secondTable),
                    reference(Entity.DASHBOARD, "ignored")));

    List<EntityReference> domains =
        QueryDomainInheritance.resolve(
            query, Map.of(firstTable.getId(), firstTable, secondTable.getId(), secondTable));

    assertEquals(
        Set.of(firstDomain.getId(), secondDomain.getId(), sharedDomain.getId()),
        domains.stream().map(EntityReference::getId).collect(Collectors.toSet()));
    assertTrue(domains.stream().allMatch(EntityReference::getInherited));
    assertFalse(sharedDomain.getInherited(), "Resolving inheritance must not mutate table domains");
  }

  @Test
  void explicitQueryDomainsOverrideInheritedTableDomains() {
    final EntityReference explicitDomain = reference(Entity.DOMAIN, "explicit");
    final EntityReference tableDomain = reference(Entity.DOMAIN, "tableDomain");
    final Table table = table("table", tableDomain);
    Query query =
        new Query()
            .withDomains(List.of(explicitDomain))
            .withQueryUsedIn(List.of(tableReference(table)));

    List<EntityReference> domains =
        QueryDomainInheritance.resolve(query, Map.of(table.getId(), table));

    assertEquals(1, domains.size());
    assertEquals(explicitDomain.getId(), domains.getFirst().getId());
    assertFalse(domains.getFirst().getInherited());
  }

  @Test
  void replacesPreviouslyInheritedDomainsWhenQueryUsageChanges() {
    final EntityReference oldDomain = reference(Entity.DOMAIN, "old").withInherited(true);
    final EntityReference newDomain = reference(Entity.DOMAIN, "new");
    final Table table = table("newTable", newDomain);
    final Query query =
        new Query().withDomains(List.of(oldDomain)).withQueryUsedIn(List.of(tableReference(table)));

    final List<EntityReference> domains =
        QueryDomainInheritance.resolve(query, Map.of(table.getId(), table));

    assertEquals(1, domains.size());
    assertEquals(newDomain.getId(), domains.getFirst().getId());
    assertTrue(domains.getFirst().getInherited());
  }

  private static Table table(String name, EntityReference... domains) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withDomains(List.of(domains));
  }

  private static EntityReference reference(String type, String name) {
    return new EntityReference()
        .withId(UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8)))
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name)
        .withInherited(false);
  }

  private static EntityReference tableReference(Table table) {
    return reference(Entity.TABLE, table.getName()).withId(table.getId());
  }
}
