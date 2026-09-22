package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class ReindexingConfigurationTest {

  @Test
  void isSmartReindexingReturnsFalseForAllEntities() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder().entities(Set.of(SearchIndexEntityTypes.ALL)).build();

    assertFalse(config.isSmartReindexing());
  }

  @Test
  void isSmartReindexingReturnsTrueForSmallEntitySubsets() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder().entities(Set.of(Entity.TABLE)).build();

    assertTrue(config.isSmartReindexing());
  }
}
