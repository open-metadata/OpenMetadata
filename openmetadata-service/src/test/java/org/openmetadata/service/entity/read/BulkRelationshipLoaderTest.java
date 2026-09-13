package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.EntityUtil.Fields;

class BulkRelationshipLoaderTest {
  @Test
  void projectsOnlyRequestedTypesAndKeepsIndependentReferencesInRecordOrder() {
    final Domain domain = new Domain().withId(UUID.randomUUID());
    final EntityReference owner = reference(Entity.USER, "z_owner");
    final EntityReference another = reference(Entity.USER, "a_owner");
    final EntityReference child = reference(Entity.DOMAIN, "child");
    final EntityReference unrelated = reference(Entity.DATA_PRODUCT, "unrequested");
    final EntityRelationshipDAO dao =
        relationships(
            List.of(
                edge(owner, domain.getEntityReference(), Relationship.OWNS),
                edge(another, domain.getEntityReference(), Relationship.OWNS)),
            List.of(
                edge(domain.getEntityReference(), owner, Relationship.EXPERT),
                edge(domain.getEntityReference(), child, Relationship.CONTAINS),
                edge(domain.getEntityReference(), unrelated, Relationship.CONTAINS)));
    final Set<String> fields =
        Set.of(Entity.FIELD_OWNERS, Entity.FIELD_EXPERTS, Entity.FIELD_CHILDREN);
    final BulkRelationshipLoader loader =
        loader(Entity.DOMAIN, fields, dao, List.of(owner, another, child));

    assertEquals(fields, loader.load(List.of(domain), new Fields(fields)));

    assertEquals(List.of(owner, another), domain.getOwners());
    assertEquals(List.of(owner), domain.getExperts());
    assertEquals(List.of(child), domain.getChildren());
    assertNotSame(domain.getOwners().getFirst(), domain.getExperts().getFirst());
    domain.getOwners().getFirst().setInherited(true);
    assertNull(domain.getExperts().getFirst().getInherited());
    domain.getOwners().clear();
    assertEquals(List.of(owner), domain.getExperts());
  }

  @Test
  void votesAndReferencesOmitMissingEntitiesWithoutChangingCountsOrEmptyDefaults() {
    final Table table = new Table().withId(UUID.randomUUID());
    final EntityReference up = reference(Entity.USER, "up");
    final EntityReference down = reference(Entity.USER, "down");
    final EntityReference missing = reference(Entity.USER, "deleted");
    final EntityReference domain = reference(Entity.DOMAIN, "domain");
    final EntityReference product = reference(Entity.DATA_PRODUCT, "product");
    final EntityReference contract = reference(Entity.DATA_CONTRACT, "contract");
    final EntityRelationshipDAO dao =
        relationships(
            List.of(
                vote(up, table, VoteType.VOTED_UP),
                vote(down, table, VoteType.VOTED_DOWN),
                vote(missing, table, VoteType.VOTED_UP),
                edge(up, table.getEntityReference(), Relationship.FOLLOWS),
                edge(domain, table.getEntityReference(), Relationship.HAS),
                edge(product, table.getEntityReference(), Relationship.HAS)),
            List.of(edge(table.getEntityReference(), contract, Relationship.CONTAINS)));
    final Set<String> fields =
        Set.of(
            Entity.FIELD_VOTES,
            Entity.FIELD_FOLLOWERS,
            Entity.FIELD_DOMAINS,
            Entity.FIELD_DATA_PRODUCTS,
            Entity.FIELD_DATA_CONTRACT,
            Entity.FIELD_OWNERS);
    final Map<UUID, EntityReference> stored =
        Map.of(
            up.getId(),
            up,
            down.getId(),
            down,
            domain.getId(),
            domain,
            product.getId(),
            product,
            contract.getId(),
            contract);
    final BulkRelationshipLoader loader =
        new BulkRelationshipLoader(
            Entity.TABLE,
            BulkRelationshipField.defaults(Entity.TABLE, fields),
            () -> dao,
            new BulkRelationshipLoader.ReferenceSource(
                type -> true,
                (type, ids) -> ids.stream().filter(stored::containsKey).map(stored::get).toList()));

    loader.load(List.of(table), new Fields(fields));

    assertEquals(1, table.getVotes().getUpVotes());
    assertEquals(1, table.getVotes().getDownVotes());
    assertEquals(List.of(up), table.getVotes().getUpVoters());
    assertEquals(List.of(down), table.getVotes().getDownVoters());
    assertEquals(List.of(up), table.getFollowers());
    assertEquals(List.of(domain), table.getDomains());
    assertEquals(List.of(product), table.getDataProducts());
    assertEquals(contract, table.getDataContract());
    assertEquals(List.of(), table.getOwners());
  }

  @Test
  void anEmptyProjectionLeavesUnrequestedFieldsUntouchedWithoutAcquiringADao() {
    final EntityReference owner = reference(Entity.USER, "owner");
    final Domain domain = new Domain().withId(UUID.randomUUID()).withOwners(List.of(owner));
    final BulkRelationshipLoader loader =
        new BulkRelationshipLoader(
            Entity.DOMAIN,
            BulkRelationshipField.defaults(Entity.DOMAIN, Set.of(Entity.FIELD_OWNERS)),
            () -> {
              throw new AssertionError("No relationship query expected");
            },
            new BulkRelationshipLoader.ReferenceSource(
                type -> true,
                (type, ids) -> {
                  throw new AssertionError("No reference query expected");
                }));

    assertTrue(
        loader.load(List.of(domain), new Fields(Set.of(Entity.FIELD_DESCRIPTION))).isEmpty());
    assertTrue(loader.load(List.of(), new Fields(Set.of(Entity.FIELD_OWNERS))).isEmpty());
    assertTrue(loader.load(List.of(domain), null).isEmpty());
    assertEquals(List.of(owner), domain.getOwners());
  }

  private BulkRelationshipLoader loader(
      String type,
      Set<String> fields,
      EntityRelationshipDAO dao,
      List<EntityReference> references) {
    final Map<UUID, EntityReference> stored =
        references.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));
    return new BulkRelationshipLoader(
        type,
        BulkRelationshipField.defaults(type, fields),
        () -> dao,
        new BulkRelationshipLoader.ReferenceSource(
            ignored -> true,
            (relatedType, ids) ->
                ids.stream()
                    .map(
                        id -> {
                          assertTrue(
                              stored.containsKey(id), "Unrequested reference must not be loaded");
                          return stored.get(id);
                        })
                    .toList()));
  }

  private EntityRelationshipDAO relationships(
      List<EntityRelationshipObject> incoming, List<EntityRelationshipObject> outgoing) {
    final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
    when(dao.findFromBatchWithRelations(any(), any(), any(), any())).thenReturn(incoming);
    when(dao.findToBatchWithRelations(any(), any(), any(), any())).thenReturn(outgoing);
    return dao;
  }

  private EntityReference reference(String type, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
  }

  private EntityRelationshipObject edge(
      EntityReference from, EntityReference to, Relationship relationship) {
    return EntityRelationshipObject.builder()
        .fromId(from.getId().toString())
        .fromEntity(from.getType())
        .toId(to.getId().toString())
        .toEntity(to.getType())
        .relation(relationship.ordinal())
        .build();
  }

  private EntityRelationshipObject vote(EntityReference voter, Table table, VoteType vote) {
    return EntityRelationshipObject.builder()
        .fromId(voter.getId().toString())
        .fromEntity(Entity.USER)
        .toId(table.getId().toString())
        .toEntity(Entity.TABLE)
        .relation(Relationship.VOTED.ordinal())
        .json(JsonUtils.pojoToJson(vote))
        .build();
  }
}
