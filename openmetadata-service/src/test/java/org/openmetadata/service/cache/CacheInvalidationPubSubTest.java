package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class CacheInvalidationPubSubTest {

  @Test
  void outOfBandSignalsAreNotEntityTypes() {
    assertFalse(CacheInvalidationPubSub.isEntityType(CacheInvalidationPubSub.TYPE_BOT_TOKEN));
    assertFalse(CacheInvalidationPubSub.isEntityType(CacheInvalidationPubSub.TYPE_USER_TOKEN));
    assertFalse(CacheInvalidationPubSub.isEntityType(CacheInvalidationPubSub.TYPE_PERSONA_CONTEXT));
  }

  @Test
  void entityTypesAreEntityTypes() {
    assertTrue(CacheInvalidationPubSub.isEntityType(Entity.USER));
    assertTrue(CacheInvalidationPubSub.isEntityType(Entity.TABLE));
  }

  @Test
  void aTypelessMessageIsNotAnEntityTypeAndDoesNotThrow() {
    // Runs in the pub/sub handler ahead of the Invalidatable fan-out: throwing here would abort
    // the handler and silently skip every cache eviction the message carried.
    assertFalse(CacheInvalidationPubSub.isEntityType(null));
  }
}
