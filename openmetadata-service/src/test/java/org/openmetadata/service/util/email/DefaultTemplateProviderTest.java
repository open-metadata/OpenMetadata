package org.openmetadata.service.util.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import freemarker.template.TemplateException;
import java.io.IOException;
import java.io.StringWriter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.EmailTemplatePlaceholder;

class DefaultTemplateProviderTest {
  @Test
  void injectedTemplatesRenderWithoutARegisteredRepository() throws Exception {
    final var provider = provider("Hello ${name}");
    final var output = new StringWriter();
    provider.getTemplate("welcome").process(Map.of("name", "Ada"), output);
    assertEquals("Hello Ada", output.toString());
  }

  @Test
  void placeholderValidationPreservesMissingAndAdditionalFields() {
    final var provider = provider("Hello ${name}");
    final var missing = provider.validateEmailTemplate("welcome", "Hello");
    assertTrue(missing.getIsValid());
    assertEquals(Set.of("name"), missing.getMissingPlaceholder());
    final var extra = provider.validateEmailTemplate("welcome", "${name} ${unknown}");
    assertFalse(extra.getIsValid());
    assertEquals(Set.of("unknown"), extra.getAdditionalPlaceholder());
  }

  @Test
  void missingContentRemainsAnExplicitFailure() {
    assertThrows(IOException.class, () -> provider("").getTemplate("empty"));
  }

  @Test
  void injectedTemplatesRetainTheFreemarkerSandbox() throws IOException {
    final var template = provider("${value?api}").getTemplate("restricted");
    assertThrows(
        TemplateException.class,
        () -> template.process(Map.of("value", List.of("item")), new StringWriter()));
    assertFalse(template.getConfiguration().isAPIBuiltinEnabled());
  }

  private DefaultTemplateProvider provider(String content) {
    return new DefaultTemplateProvider(
        name ->
            new EmailTemplate()
                .withTemplate(content)
                .withPlaceHolders(Set.of(new EmailTemplatePlaceholder().withName("name"))));
  }
}
