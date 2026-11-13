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

package org.openmetadata.service.alerting.content.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.alerting.content.template.sandbox.TemplateRefusedException;

/** User templates read the data they are given, through the listed helpers, and nothing else. */
class NotificationTemplateSandboxTest {

  private static final AtomicBoolean METHOD_CALLED = new AtomicBoolean();

  private final HandlebarsNotificationTemplateProcessor processor =
      new HandlebarsNotificationTemplateProcessor();

  @BeforeEach
  void resetProbe() {
    METHOD_CALLED.set(false);
  }

  @Test
  void dataPathsRender() {
    String rendered =
        processor.process(
            "{{entity.name}} {{entity.tags.[1]}} {{entity.tags.length}} {{lookup entity.tags 0}} "
                + "{{event.userName}} {{event.eventType}} {{probeObject.label}} "
                + "{{#each entity.tags}}{{@index}}{{this}}{{/each}} "
                + "{{#with entity as |e|}}{{e.name}}{{@root.event.entityType}}{{/with}}",
            context());

    assertEquals("orders tier1 2 pii alice entityUpdated label 0pii1tier1 orderstable", rendered);
  }

  @Test
  void helpersReceiveAndReturnData() {
    String rendered =
        processor.process(
            "{{#with (groupEventChanges event.changeDescription) as |changes|}}"
                + "{{#each changes.updates}}{{name}}{{/each}}"
                + "{{#if (hasFieldInChanges changes \"tags\")}} changed{{/if}}{{/with}} "
                + "{{#each (split \"a,b\" \",\")}}{{this}}{{/each}} {{length entity.tags}}",
            context());

    assertEquals("tags changed ab 2", rendered);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{{probe.touch}}",
        "{{probe.staticTouch}}",
        "{{probeObject.touch}}",
        "{{probeObject.staticTouch}}",
        "{{entity.size}}",
        "{{entity.name.length}}",
        "{{#each probe}}{{this}}{{/each}}"
      })
  void methodsOfContextValuesAreNotCalled(String template) {
    assertEquals("", processor.process(template, context()));
    assertFalse(METHOD_CALLED.get());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{{lookup probe \"touch\"}}",
        "{{lookup probeObject \"touch\"}}",
        "{{#with (lookup probe \"staticTouch\")}}{{this}}{{/with}}"
      })
  void lookupsReadDataOnly(String template) {
    String rendered = processor.process(template, context());

    assertFalse(rendered.contains("called"), rendered);
    assertFalse(METHOD_CALLED.get());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{{> templatesandbox/fragment}}",
        "{{#> templatesandbox/fragment}}fallback{{/templatesandbox/fragment}}",
        "{{#*inline \"local\"}}x{{/inline}}{{> local}}",
        "{{=<% %>=}}<% entity.name %>",
        "{{{{raw}}}}x{{{{/raw}}}}",
        "{{i18n \"greeting\" bundle=\"templatesandbox.messages\"}}",
        "{{embedded \"templatesandbox/fragment\"}}",
        "{{precompile \"templatesandbox/fragment\"}}",
        "{{#block \"name\"}}x{{/block}}",
        "{{#partial \"name\"}}x{{/partial}}",
        "{{log \"note\"}}",
        "{{#if (unknownHelper entity)}}x{{/if}}",
        "{{entity.name \"argument\"}}"
      })
  void constructsOutsideTheSandboxAreRefused(String template) {
    NotificationTemplateValidationRequest request =
        new NotificationTemplateValidationRequest()
            .withTemplateSubject("subject")
            .withTemplateBody(template);

    assertFalse(processor.validate(request).getIsValid());
    assertThrows(TemplateRefusedException.class, () -> processor.process(template, context()));
  }

  private static Map<String, Object> context() {
    Map<String, Object> context = new HashMap<>();
    context.put("entity", Map.of("name", "orders", "tags", List.of("pii", "tier1")));
    context.put("event", changeEvent());
    context.put("probe", new ProbeMap());
    context.put("probeObject", new ProbeObject());
    return context;
  }

  private static ChangeEvent changeEvent() {
    return new ChangeEvent()
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType("table")
        .withUserName("alice")
        .withChangeDescription(
            new ChangeDescription()
                .withFieldsUpdated(List.of(new FieldChange().withName("tags").withNewValue("x"))));
  }

  /** A map whose public methods are not data. */
  public static class ProbeMap extends HashMap<String, Object> {
    public String touch() {
      METHOD_CALLED.set(true);
      return "called";
    }

    public static String staticTouch() {
      METHOD_CALLED.set(true);
      return "called";
    }
  }

  /** An object with one property and public methods that are not data. */
  public static class ProbeObject {
    public String getLabel() {
      return "label";
    }

    public String touch() {
      METHOD_CALLED.set(true);
      return "called";
    }

    public static String staticTouch() {
      METHOD_CALLED.set(true);
      return "called";
    }
  }
}
