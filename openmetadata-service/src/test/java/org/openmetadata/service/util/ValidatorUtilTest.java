package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;

class ValidatorUtilTest {
  @Test
  void testValidator() {
    // Required parameters name, description, and id missing
    Glossary glossary = new Glossary().withName("name").withDescription("description");
    assertEquals("[id must not be null]", ValidatorUtil.validate(glossary));

    glossary.withId(UUID.randomUUID()).withName(null);
    assertEquals("[name must not be null]", ValidatorUtil.validate(glossary));

    glossary.withName("name").withDescription(null);
    assertEquals("[description must not be null]", ValidatorUtil.validate(glossary));

    // Invalid name
    glossary.withName("invalid::Name").withDescription("description");
    assertEquals("[name must match \"^(?U)[\\w'\\- .&()%]+$\"]", ValidatorUtil.validate(glossary));

    // No error
    glossary.withName("validName").withId(UUID.randomUUID()).withDescription("description");
    assertNull(ValidatorUtil.validate(glossary));
  }
}
