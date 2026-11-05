package org.openmetadata.service.migration.utils.v208;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.TABLE;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.migration.utils.v208.DataProductDomainContainmentRepair.DomainLinks;

class DataProductDomainContainmentRepairTest {
  private static final UUID PRODUCT = UUID.randomUUID();
  private static final UUID OLD_DOMAIN = UUID.randomUUID();
  private static final UUID NEW_DOMAIN = UUID.randomUUID();
  private static final UUID SECOND_DOMAIN = UUID.randomUUID();

  private static EntityRelationshipObject link(
      final UUID fromId, final String fromEntity, final Relationship relation) {
    return EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(PRODUCT.toString())
        .fromEntity(fromEntity)
        .toEntity(DATA_PRODUCT)
        .relation(relation.ordinal())
        .build();
  }

  private static DomainLinks only(
      final List<EntityRelationshipObject> live, final List<EntityRelationshipObject> any) {
    final List<DomainLinks> links = DomainLinks.of(live, any);
    assertEquals(1, links.size());
    return links.getFirst();
  }

  @Test
  void productMovedBeforeTheFixContainsTheOldDomain() {
    final EntityRelationshipObject staleContains = link(OLD_DOMAIN, DOMAIN, Relationship.CONTAINS);
    final DomainLinks links =
        only(
            List.of(link(NEW_DOMAIN, DOMAIN, Relationship.HAS), staleContains),
            List.of(staleContains));

    assertTrue(links.isDrifted());
    assertEquals(Set.of(NEW_DOMAIN), links.missingContainment());
    assertEquals(Set.of(OLD_DOMAIN), links.staleContainment());
  }

  @Test
  void productWhoseLinksAgreeIsLeftAlone() {
    final EntityRelationshipObject contains = link(NEW_DOMAIN, DOMAIN, Relationship.CONTAINS);
    final DomainLinks links =
        only(List.of(link(NEW_DOMAIN, DOMAIN, Relationship.HAS), contains), List.of(contains));

    assertFalse(links.isDrifted());
    assertTrue(links.missingContainment().isEmpty());
    assertTrue(links.staleContainment().isEmpty());
  }

  @Test
  void productWithoutAShownDomainIsLeftAlone() {
    final EntityRelationshipObject contains = link(OLD_DOMAIN, DOMAIN, Relationship.CONTAINS);

    assertFalse(only(List.of(contains), List.of(contains)).isDrifted());
  }

  @Test
  void softDeletedContainmentOfTheShownDomainIsRewritten() {
    final EntityRelationshipObject deletedContains =
        link(NEW_DOMAIN, DOMAIN, Relationship.CONTAINS);
    final DomainLinks links =
        only(List.of(link(NEW_DOMAIN, DOMAIN, Relationship.HAS)), List.of(deletedContains));

    assertTrue(links.isDrifted());
    assertEquals(Set.of(NEW_DOMAIN), links.missingContainment());
    assertTrue(links.staleContainment().isEmpty());
  }

  @Test
  void everyShownDomainOfAMultiDomainProductIsContained() {
    final EntityRelationshipObject staleContains = link(OLD_DOMAIN, DOMAIN, Relationship.CONTAINS);
    final DomainLinks links =
        only(
            List.of(
                link(NEW_DOMAIN, DOMAIN, Relationship.HAS),
                link(SECOND_DOMAIN, DOMAIN, Relationship.HAS),
                staleContains),
            List.of(staleContains));

    assertEquals(Set.of(NEW_DOMAIN, SECOND_DOMAIN), links.missingContainment());
    assertEquals(Set.of(OLD_DOMAIN), links.staleContainment());
  }

  @Test
  void linksFromOtherEntityTypesAreIgnored() {
    final EntityRelationshipObject contains = link(NEW_DOMAIN, DOMAIN, Relationship.CONTAINS);
    final DomainLinks links =
        only(
            List.of(
                link(NEW_DOMAIN, DOMAIN, Relationship.HAS),
                contains,
                link(UUID.randomUUID(), TABLE, Relationship.HAS)),
            List.of(contains));

    assertFalse(links.isDrifted());
  }
}
