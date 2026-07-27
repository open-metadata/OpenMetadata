package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.exception.PreconditionFailedException;

class EntityETagTest {

  @Test
  void generateETagReturnsQuotedHashAndWeakVariant() {
    EntityInterface entity = entity(1.2, 123456L);

    String strong = EntityETag.generateETag(entity);
    String weak = EntityETag.generateWeakETag(entity);

    assertNotNull(strong);
    assertTrue(strong.startsWith("\""));
    assertTrue(strong.endsWith("\""));
    assertEquals("W/\"1.2\"", weak);
    assertNull(EntityETag.generateETag(null));
    assertNull(EntityETag.generateWeakETag(null));
  }

  @Test
  void etagIsStableForUnchangedEntity() {
    EntityInterface entity = entity(1.2, 123456L);

    assertEquals(EntityETag.generateETag(entity), EntityETag.generateETag(entity));
  }

  @Test
  void etagChangesWhenVotesChangeWithoutVersionBump() {
    // The P0 regression: an upvote writes a VOTED relationship and repopulates the entity's
    // votes block but does NOT bump version/updatedAt. A version-only ETag stayed constant, so
    // the post-vote conditional GET was answered 304 and the header rendered stale counts.
    // The ETag must move when the votes block moves, even though version/updatedAt are identical.
    UUID id = UUID.randomUUID();
    EntityInterface before = table(id, 1.2, 123456L, 0);
    EntityInterface after = table(id, 1.2, 123456L, 1);

    assertEquals(before.getVersion(), after.getVersion());
    assertEquals(before.getUpdatedAt(), after.getUpdatedAt());
    assertNotEquals(EntityETag.generateETag(before), EntityETag.generateETag(after));
  }

  @Test
  void etagChangesWhenVersionChanges() {
    UUID id = UUID.randomUUID();
    EntityInterface v1 = table(id, 1.0, 100L, 0);
    EntityInterface v2 = table(id, 1.1, 200L, 0);

    assertNotEquals(EntityETag.generateETag(v1), EntityETag.generateETag(v2));
  }

  @Test
  void validateETagSupportsExactWildcardWeakAndMultipleMatches() {
    EntityInterface entity = entity(2.5, 98765L);
    String etag = EntityETag.generateETag(entity);
    String weak = EntityETag.generateWeakETag(entity);

    assertDoesNotThrow(() -> EntityETag.validateETag(null, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag(etag, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag(weak, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag("\"other\", " + etag, entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag("*", entity, true));
    assertDoesNotThrow(() -> EntityETag.validateETag("\"stale\"", entity, false));
  }

  @Test
  void validateETagRejectsMismatchedHeaders() {
    EntityInterface entity = entity(3.1, 24680L);

    assertThrows(
        PreconditionFailedException.class,
        () -> EntityETag.validateETag("\"stale-etag\"", entity, true));
  }

  @Test
  void addETagHeaderAndEnforcementFlagBehaveAsExpected() {
    EntityInterface entity = entity(4.0, 13579L);

    Response response = EntityETag.addETagHeader(Response.ok(), entity).build();

    assertEquals(EntityETag.generateETag(entity), response.getHeaderString(EntityETag.ETAG_HEADER));
    assertFalse(EntityETag.isETagEnforcementEnabled());
  }

  private static EntityInterface entity(double version, long updatedAt) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("etag_table")
        .withVersion(version)
        .withUpdatedAt(updatedAt);
  }

  private static EntityInterface table(UUID id, double version, long updatedAt, int upVotes) {
    return new Table()
        .withId(id)
        .withName("etag_table")
        .withVersion(version)
        .withUpdatedAt(updatedAt)
        .withVotes(new Votes().withUpVotes(upVotes).withDownVotes(0));
  }
}
