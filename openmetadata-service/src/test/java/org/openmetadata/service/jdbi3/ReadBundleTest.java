package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.DELETED;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;

class ReadBundleTest {

  @Test
  void relationDistinguishesNotLoadedFromLoadedEmpty() {
    ReadBundle bundle = new ReadBundle();
    UUID entityId = UUID.randomUUID();

    assertTrue(bundle.getRelations(entityId, "owners", NON_DELETED).isEmpty());

    bundle.putRelations(entityId, "owners", NON_DELETED, List.of());
    var loadedOwners = bundle.getRelations(entityId, "owners", NON_DELETED);
    assertTrue(loadedOwners.isPresent());
    assertTrue(loadedOwners.orElseThrow().isEmpty());
  }

  @Test
  void relationReturnsLoadedValues() {
    ReadBundle bundle = new ReadBundle();
    UUID entityId = UUID.randomUUID();
    EntityReference owner = new EntityReference().withId(UUID.randomUUID()).withType("user");

    bundle.putRelations(entityId, "owners", ALL, List.of(owner));
    var owners = bundle.getRelations(entityId, "owners", ALL);
    assertTrue(owners.isPresent());
    assertEquals(1, owners.orElseThrow().size());
    assertEquals(owner.getId(), owners.orElseThrow().get(0).getId());
  }

  @Test
  void extensionDistinguishesNotLoadedFromLoadedNull() {
    ReadBundle bundle = new ReadBundle();
    UUID entityId = UUID.randomUUID();

    assertFalse(bundle.hasExtension(entityId));

    bundle.putExtension(entityId, null);
    assertTrue(bundle.hasExtension(entityId));
    assertEquals(null, bundle.getExtensionOrNull(entityId));
  }

  @Test
  void votesSupportLoadedEmptyAndLoadedValues() {
    ReadBundle bundle = new ReadBundle();
    UUID entityId = UUID.randomUUID();

    assertTrue(bundle.getVotes(entityId).isEmpty());

    Votes votes = new Votes().withUpVotes(2).withDownVotes(1);
    bundle.putVotes(entityId, votes);
    var loadedVotes = bundle.getVotes(entityId);
    assertTrue(loadedVotes.isPresent());
    assertEquals(2, loadedVotes.orElseThrow().getUpVotes());
    assertEquals(1, loadedVotes.orElseThrow().getDownVotes());
  }

  @Test
  void relationTracksLoadedIncludesPerField() {
    ReadBundle bundle = new ReadBundle();
    UUID entityId = UUID.randomUUID();

    bundle.putRelations(entityId, "owners", NON_DELETED, List.of());
    bundle.putRelations(entityId, "owners", DELETED, List.of());

    assertTrue(bundle.hasLoadedRelationForField(entityId, "owners"));
    assertEquals(
        Set.of(NON_DELETED, DELETED), bundle.getLoadedIncludesForField(entityId, "owners"));
  }
}
