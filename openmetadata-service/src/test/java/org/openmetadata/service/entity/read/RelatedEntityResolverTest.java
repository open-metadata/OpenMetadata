package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

class RelatedEntityResolverTest {
  @Test
  void sharedLookupPreservesEveryFieldAndIndependentReferences() {
    var reference =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.USER)
            .withName("owner")
            .withDisplayName("Owner")
            .withFullyQualifiedName("owner")
            .withDescription("Description")
            .withHref(URI.create("http://localhost/users/owner"))
            .withDeleted(false)
            .withInherited(false);
    var resolver = new RelatedEntityResolver((records, include) -> List.of(reference));
    var request = new RelatedEntityResolver.Request(List.of(record(reference)), NON_DELETED);

    var result = resolver.resolve(Map.of("owners", request, "followers", request));

    var owner = result.get("owners").getFirst();
    var follower = result.get("followers").getFirst();
    assertEquals(reference, owner);
    assertEquals(reference, follower);
    assertNotSame(owner, follower);
    owner.setInherited(true);
    assertEquals(false, follower.getInherited());
  }

  @Test
  void includesRemainSeparateAndMissingReferencesAreOmitted() {
    var active =
        new EntityReference().withType(Entity.USER).withId(UUID.randomUUID()).withName("a");
    var deleted =
        new EntityReference()
            .withType(Entity.USER)
            .withId(UUID.randomUUID())
            .withName("b")
            .withDeleted(true);
    var resolver =
        new RelatedEntityResolver(
            (records, include) -> include == ALL ? List.of(deleted, active) : List.of(active));
    var missing =
        EntityRelationshipRecord.builder().id(UUID.randomUUID()).type(Entity.USER).build();
    var records = List.of(record(deleted), record(active), record(active), missing);

    var result =
        resolver.resolve(
            Map.of(
                "all", new RelatedEntityResolver.Request(records, null),
                "active", new RelatedEntityResolver.Request(records, NON_DELETED),
                "empty", new RelatedEntityResolver.Request(List.of(), ALL)));

    assertEquals(List.of(active, deleted), result.get("all"));
    assertEquals(List.of(active), result.get("active"));
    assertTrue(result.get("empty").isEmpty());
    assertNull(active.getDeleted());
  }

  @Test
  void anEmptyRequestDoesNotNeedAReferenceSource() {
    var resolver =
        new RelatedEntityResolver(
            (records, include) -> {
              throw new AssertionError("No references requested");
            });
    assertTrue(resolver.resolve(Map.of()).isEmpty());
    assertEquals(
        Map.of("owners", List.of()),
        resolver.resolve(Map.of("owners", new RelatedEntityResolver.Request(List.of(), ALL))));
  }

  private EntityRelationshipRecord record(EntityReference reference) {
    return EntityRelationshipRecord.builder()
        .id(reference.getId())
        .type(reference.getType())
        .build();
  }
}
