package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
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
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getVersion()).thenReturn(version);
    when(entity.getUpdatedAt()).thenReturn(updatedAt);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    return entity;
  }
}
