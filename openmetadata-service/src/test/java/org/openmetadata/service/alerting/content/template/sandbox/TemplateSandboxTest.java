/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.alerting.content.template.sandbox;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.ValueResolver;
import java.io.File;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;

class TemplateSandboxTest {

  private final TemplateConstructScanner scanner =
      new TemplateConstructScanner(Set.of("if", "each", "with", "eq"));

  @Test
  void scannerNamesTheConstructAndItsLine() {
    TemplateRefusedException refused =
        assertThrows(
            TemplateRefusedException.class,
            () -> scanner.requireSupported("line one\n{{#*inline \"x\"}}y{{/inline}}"));

    assertEquals(
        "Decorators are not supported in notification templates (line 2)", refused.getMessage());
  }

  @Test
  void scannerRefusesACallToAHelperItDoesNotKnow() {
    TemplateRefusedException refused =
        assertThrows(
            TemplateRefusedException.class,
            () -> scanner.requireSupported("{{#if (missing entity)}}x{{/if}}"));

    assertEquals(
        "Helper 'missing' is not available in notification templates (line 1)",
        refused.getMessage());
  }

  @Test
  void scannerAllowsPathsSectionsAndKnownHelpers() {
    assertDoesNotThrow(
        () ->
            scanner.requireSupported(
                "{{entity.name}} {{{entity.description}}} {{#entity.owners}}{{name}}{{/entity.owners}}"
                    + "{{^entity.tags}}none{{/entity.tags}}"
                    + "{{#if (eq a \"b\")}}x{{else if c}}y{{else}}z{{/if}}"
                    + "{{#each items as |item|}}{{item}}{{/each}}"
                    + "{{! {{> commented}} }}\\{{escaped}}"));
  }

  @Test
  void dataKeepsTextNumbersAndBooleans() {
    Handlebars.SafeString safe = new Handlebars.SafeString("<b>x</b>");

    assertSame(safe, TemplateData.of((Object) safe));
    assertEquals(7L, TemplateData.of((Object) 7L));
    assertEquals(Boolean.TRUE, TemplateData.of((Object) Boolean.TRUE));
    assertNull(TemplateData.of((Object) null));
  }

  @Test
  void dataTurnsObjectsIntoMapsAndLists() {
    Object field = TemplateData.of(new FieldChange().withName("tags").withNewValue("x"));
    Object array = TemplateData.of(new String[] {"a", "b"});
    Map<String, Object> context =
        TemplateData.of(Map.<String, Object>of("type", EventType.ENTITY_UPDATED));

    assertEquals(Map.of("name", "tags", "newValue", "x"), field);
    assertEquals(List.of("a", "b"), array);
    assertEquals("entityUpdated", context.get("type"));
  }

  @Test
  void listLengthIsTheOnlyListProperty() {
    ValueResolver resolver = ListLengthResolver.INSTANCE;

    assertEquals(2, resolver.resolve(List.of("a", "b"), "length"));
    assertSame(ValueResolver.UNRESOLVED, resolver.resolve(List.of("a"), "size"));
    assertSame(ValueResolver.UNRESOLVED, resolver.resolve("text", "length"));
    assertSame(ValueResolver.UNRESOLVED, resolver.resolve(List.of("a")));
    assertEquals(Set.of(), resolver.propertySet(List.of("a")));
  }

  @Test
  void loaderLoadsNoTemplate() {
    assertThrows(
        TemplateRefusedException.class, () -> new RefusingTemplateLoader().sourceAt("anything"));
  }

  @Test
  void registryOffersOnlyListedHelpersAndAcceptsNoneAfterSealing() {
    SandboxHelperRegistry registry = new SandboxHelperRegistry();
    registry.registerHelper("shout", (context, options) -> List.of("A"));
    registry.seal();

    assertEquals(Set.of("if", "unless", "each", "with", "lookup", "shout"), registry.helperNames());
    assertInstanceOf(UnsupportedOperationException.class, refusal(registry));
    assertThrows(
        UnsupportedOperationException.class, () -> registry.registerHelpers(new File("x.js")));
    assertThrows(UnsupportedOperationException.class, () -> registry.registerHelpers(Object.class));
    assertThrows(
        UnsupportedOperationException.class, () -> registry.registerDecorator("inline", null));
    assertNull(registry.decorator("inline"));
  }

  @Test
  void productHelpersHandBackData() throws Exception {
    SandboxHelperRegistry registry = new SandboxHelperRegistry();
    registry.registerHelper("pair", (context, options) -> new String[] {"a", "b"});

    Object result = registry.helper("pair").apply(null, null);

    assertTrue(result instanceof List<?>);
  }

  private static RuntimeException refusal(SandboxHelperRegistry registry) {
    return assertThrows(
        RuntimeException.class, () -> registry.registerHelper("late", (context, options) -> ""));
  }
}
