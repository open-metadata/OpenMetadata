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

package org.openmetadata.service.alerting.content.template.handlebars.helpers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.alerting.content.template.HandlebarsProvider;
import org.openmetadata.service.alerting.content.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.alerting.content.template.sandbox.TemplateSandbox;

/**
 * The template editor offers each helper's example to users, so every example must produce output
 * when rendered against the data of a real event.
 */
class HandlebarsHelperExampleTest {

  private static TemplateSandbox sandbox;

  @BeforeAll
  static void createSandbox() {
    List<HandlebarsHelper> helpers = new ArrayList<>(HandlebarsProvider.getAllHelperInstances());
    helpers.removeIf(helper -> helper instanceof BuildEntityUrlHelper);
    helpers.add(
        new BuildEntityUrlHelper() {
          @Override
          protected String getBaseUrl() {
            return "http://localhost:8585";
          }
        });
    sandbox = new TemplateSandbox(helpers);
  }

  @ParameterizedTest(name = "{0}: {1}")
  @MethodSource("examples")
  void exampleRendersOutput(String helperName, String example) throws IOException {
    String rendered = sandbox.render(example, eventContext());

    assertFalse(rendered.isBlank(), () -> helperName + " example renders nothing: " + example);
  }

  /** These two examples print literal text around the helper, so non-blank proves nothing. */
  @Test
  void mathExampleNumbersTheOwners() throws IOException {
    assertEquals("1. alice 2. bob ", renderFirstExampleOf(new MathHelper()));
  }

  @Test
  void filterExampleCountsOnlyTheMatchingTags() throws IOException {
    assertEquals("1 classification tags", renderFirstExampleOf(new FilterHelper()));
  }

  private static String renderFirstExampleOf(HandlebarsHelper helper) throws IOException {
    return sandbox.render(helper.getMetadata().getUsages().get(0).getExample(), eventContext());
  }

  private static Stream<Arguments> examples() {
    return HandlebarsProvider.getAllHelperInstances().stream()
        .flatMap(
            helper ->
                helper.getMetadata().getUsages().stream()
                    .map(usage -> Arguments.of(helper.getName(), usage.getExample())));
  }

  private static Map<String, Object> eventContext() {
    ChangeEvent event =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType("table")
            .withUserName("admin")
            .withTimestamp(1793949000000L)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("description")
                                .withOldValue("old text")
                                .withNewValue("new text"))));
    Map<String, Object> entity =
        Map.ofEntries(
            Map.entry("name", "orders"),
            Map.entry("fullyQualifiedName", "svc.db.sales.orders"),
            Map.entry("description", "<p>Orders placed online</p>"),
            Map.entry("deleted", false),
            Map.entry("updatedAt", 1793949000000L),
            Map.entry("entityStatus", "In Review"),
            Map.entry("entityLink", "<#E::table::svc.db.sales.orders::columns::id>"),
            Map.entry(
                "owners", List.of(Map.of("name", "alice", "type", "user"), Map.of("name", "bob"))),
            Map.entry("domains", List.of(Map.of("name", "Sales"))),
            Map.entry(
                "tags",
                List.of(
                    Map.of("tagFQN", "PII.Sensitive", "source", "Classification"),
                    Map.of("tagFQN", "Glossary.Term", "source", "Glossary"))),
            Map.entry(
                "certification",
                Map.of("tagLabel", Map.of("name", "Gold", "tagFQN", "Certification.Gold"))),
            Map.entry(
                "failedRowsSample",
                Map.of("columns", List.of("id"), "rows", List.of(List.of("1")))));
    return Map.of("event", event, "entity", entity);
  }
}
