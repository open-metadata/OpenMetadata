package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEqual;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;

class ValidatorUtilTest {
  @Test
  void testValidator() {
    // Required parameters name, description, and id missing
    Glossary glossary = new Glossary().withName("name").withDescription("description");
    assertEqual("[id must not be null]", ValidatorUtil.validate(glossary));

    glossary.withId(UUID.randomUUID()).withName(null);
    assertEqual("[name must not be null]", ValidatorUtil.validate(glossary));

    glossary.withName("name").withDescription(null);
    assertEqual("[description must not be null]", ValidatorUtil.validate(glossary));

    // Invalid name
    glossary.withName("invalid::Name").withDescription("description");
    assertEqual("[name must match \"^((?!::).)*$\"]", ValidatorUtil.validate(glossary));

    // No error
    glossary.withName("validName").withId(UUID.randomUUID()).withDescription("description");
    assertNull(ValidatorUtil.validate(glossary));
  }
}
