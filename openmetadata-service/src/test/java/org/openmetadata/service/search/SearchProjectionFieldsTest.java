package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

class SearchProjectionFieldsTest {
  @Test
  void declarationsAreRestrictedToFieldsSupportedByTheEntity() {
    final var fields =
        new SearchProjectionFields(
            SearchIndexFactory::new,
            (type, required) ->
                new Fields(Set.of("owners", "tags"), String.join(",", required), true));
    final var required = fields.forEntityType(Entity.TABLE);
    assertEquals(Set.of("owners", "tags"), Set.copyOf(required));
    assertThrows(UnsupportedOperationException.class, () -> required.add("*"));
  }

  @Test
  void unavailableRegistrationRetainsBoundedDeclarations() {
    final var fields =
        new SearchProjectionFields(
            SearchIndexFactory::new,
            (type, required) -> {
              throw new IllegalArgumentException("repository not registered");
            });
    final var required = fields.forEntityType(Entity.TABLE);
    assertTrue(required.contains("owners"));
    assertTrue(required.contains("tags"));
    assertFalse(required.contains("*"));
  }
}
