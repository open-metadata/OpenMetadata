package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import javax.ws.rs.core.EntityTag;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;

class EntityETagTest {

  @Test
  void testGenerateETagValue_WithValidEntity_ReturnsExpectedHash() {
    EntityInterface mockEntity = createMockEntity();
    
    String etagValue = EntityETag.generateETagValue(mockEntity);
    
    assertNotNull(etagValue);
    assertEquals(16, etagValue.length());
    assertFalse(etagValue.isEmpty());
  }

  @Test
  void testGenerateETag_WithValidEntity_ReturnsEntityTag() {
    EntityInterface mockEntity = createMockEntity();
    
    EntityTag etag = EntityETag.generateETag(mockEntity);
    
    assertNotNull(etag);
    assertFalse(etag.isWeak());
    assertEquals(16, etag.getValue().length());
  }

  @Test
  void testGenerateETag_WithWeakFlag_ReturnsWeakEntityTag() {
    EntityInterface mockEntity = createMockEntity();
    
    EntityTag etag = EntityETag.generateETag(mockEntity, true);
    
    assertNotNull(etag);
    assertTrue(etag.isWeak());
  }

  @Test
  void testGenerateETagValue_WithNullEntity_ThrowsException() {
    assertThrows(IllegalArgumentException.class, () -> {
      EntityETag.generateETagValue(null);
    });
  }

  @Test
  void testMatches_WithSameEntity_ReturnsTrue() {
    EntityInterface mockEntity = createMockEntity();
    String etagValue = EntityETag.generateETagValue(mockEntity);
    
    assertTrue(EntityETag.matches(etagValue, mockEntity));
  }

  @Test
  void testMatches_WithDifferentEntity_ReturnsFalse() {
    EntityInterface entity1 = createMockEntity();
    EntityInterface entity2 = createMockEntity();
    when(entity2.getId()).thenReturn(UUID.randomUUID());
    
    String etagValue = EntityETag.generateETagValue(entity1);
    
    assertFalse(EntityETag.matches(etagValue, entity2));
  }

  @Test
  void testMatches_WithNullValues_ReturnsFalse() {
    EntityInterface mockEntity = createMockEntity();
    String etagValue = EntityETag.generateETagValue(mockEntity);
    
    assertFalse(EntityETag.matches(null, mockEntity));
    assertFalse(EntityETag.matches(etagValue, null));
    assertFalse(EntityETag.matches(null, null));
  }

  @Test
  void testMatches_WithEntityTag_ReturnsExpectedResult() {
    EntityInterface mockEntity = createMockEntity();
    EntityTag etag = EntityETag.generateETag(mockEntity);
    
    assertTrue(EntityETag.matches(etag, mockEntity));
  }

  @Test
  void testGenerateETagValue_ConsistentResults() {
    EntityInterface mockEntity = createMockEntity();
    
    String etag1 = EntityETag.generateETagValue(mockEntity);
    String etag2 = EntityETag.generateETagValue(mockEntity);
    
    assertEquals(etag1, etag2);
  }

  @Test
  void testGenerateETagValue_ChangesWithVersion() {
    EntityInterface mockEntity = createMockEntity();
    String originalETag = EntityETag.generateETagValue(mockEntity);
    
    when(mockEntity.getVersion()).thenReturn(0.5);
    String updatedETag = EntityETag.generateETagValue(mockEntity);
    
    assertNotEquals(originalETag, updatedETag);
  }

  @Test
  void testGenerateETagValue_ChangesWithUpdatedAt() {
    EntityInterface mockEntity = createMockEntity();
    String originalETag = EntityETag.generateETagValue(mockEntity);
    
    when(mockEntity.getUpdatedAt()).thenReturn(System.currentTimeMillis() + 1000);
    String updatedETag = EntityETag.generateETagValue(mockEntity);
    
    assertNotEquals(originalETag, updatedETag);
  }

  private EntityInterface createMockEntity() {
    EntityInterface mockEntity = mock(EntityInterface.class);
    when(mockEntity.getId()).thenReturn(UUID.fromString("12345678-1234-1234-1234-123456789012"));
    when(mockEntity.getVersion()).thenReturn(0.4);
    when(mockEntity.getUpdatedAt()).thenReturn(1234567890L);
    return mockEntity;
  }
}