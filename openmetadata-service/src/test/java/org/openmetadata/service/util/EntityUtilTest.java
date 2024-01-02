package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;

class EntityUtilTest {
  @Test
  void test_isDescriptionRequired() {
    assertFalse(
        EntityUtil.isDescriptionRequired(Table.class)); // Table entity does not require description
    assertTrue(
        EntityUtil.isDescriptionRequired(
            GlossaryTerm.class)); // GlossaryTerm entity requires description
  }
}
