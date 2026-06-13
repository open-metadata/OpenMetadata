package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;

class ValidatorUtilTest {
  @Test
  void testValidator() {
    // Required parameters name, description, and id missing
    Glossary glossary = new Glossary().withName("name").withDescription("description");
    assertTrue(ValidatorUtil.validate(glossary).contains("id "));

    glossary.withId(UUID.randomUUID()).withName(null);
    assertTrue(ValidatorUtil.validate(glossary).contains("name "));

    glossary.withName("name").withDescription(null);
    assertTrue(ValidatorUtil.validate(glossary).contains("description "));

    // Invalid name
    glossary.withName("invalid::Name").withDescription("description");
    assertTrue(ValidatorUtil.validate(glossary).contains("name "));

    // No error
    glossary.withName("validName").withId(UUID.randomUUID()).withDescription("description");
    assertNull(ValidatorUtil.validate(glossary));
  }
}
