package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.PropagationDescriptor;

class GlossaryTagPropagationTest {
  @AfterEach
  void cleanup() {
    Entity.cleanup();
  }

  @Test
  void preferenceOnlyDisablesTagSearchPropagation() {
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    GlossaryTermRepository repository = new GlossaryTermRepository(false);
    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(true);
      List<PropagationDescriptor> enabled = repository.getSearchPropagationDescriptors();

      settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(false);
      List<PropagationDescriptor> disabled = repository.getSearchPropagationDescriptors();

      assertEquals(1, enabled.size() - disabled.size());
      assertEquals(
          enabled.stream().filter(field -> !Entity.FIELD_TAGS.equals(field.fieldName())).toList(),
          disabled);
    }
  }
}
