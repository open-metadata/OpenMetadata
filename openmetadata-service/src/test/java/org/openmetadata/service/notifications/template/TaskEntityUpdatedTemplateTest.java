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

package org.openmetadata.service.notifications.template;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsProvider;
import org.openmetadata.service.notifications.template.handlebars.helpers.BuildEntityUrlHelper;

/**
 * Renders the dedicated {@code system-notification-task-entity-updated} template through the real
 * Handlebars engine (all production helpers, {@code buildEntityUrl} base URL overridden so no DB is
 * needed) to prove the format reads well for the two incident-task scenarios:
 *
 * <ul>
 *   <li>a comment was added → "commented on …" with the latest reply (the @-mention payload),
 *   <li>an assignee changed → "updated the assignees of …" with the assignee list and no reply.
 * </ul>
 */
class TaskEntityUpdatedTemplateTest {

  private static final String BASE_URL = "http://localhost:8585";
  private static final String TEMPLATE =
      "/json/data/notifications/templates/system-notification-task-entity-updated.json";

  private Template template;

  @BeforeEach
  void setUp() throws Exception {
    Handlebars handlebars = new Handlebars().with(EscapingStrategy.HTML_ENTITY);
    for (HandlebarsHelper helper : HandlebarsProvider.getAllHelperInstances()) {
      helper.register(handlebars);
    }
    // Override buildEntityUrl so the test does not depend on EmailUtil / DB-backed settings.
    new BuildEntityUrlHelper() {
      @Override
      protected String getBaseUrl() {
        return BASE_URL;
      }
    }.register(handlebars);

    try (InputStream in = getClass().getResourceAsStream(TEMPLATE)) {
      assertNotNull(in, "dedicated task template must be on the classpath: " + TEMPLATE);
      JsonNode node = new ObjectMapper().readTree(in);
      template = handlebars.compileInline(node.get("templateBody").asText());
    }
  }

  private String unescape(String s) {
    return s.replace("&amp;", "&")
        .replace("&#x3D;", "=")
        .replace("&#x2F;", "/")
        .replace("&#x27;", "'")
        .replace("&quot;", "\"");
  }

  private Map<String, Object> incidentTask(String latestComment) {
    return Map.of(
        "updatedBy", "admin",
        "category", "Incident",
        "about",
            Map.of(
                "type", "testCase",
                "fullyQualifiedName", "svc.db.sch.tc1",
                "displayName", "tc1"),
        "comments", List.of(Map.of("author", Map.of("name", "admin"), "message", latestComment)),
        "assignees", List.of(Map.of("name", "adria", "displayName", "Adria Estivill")));
  }

  @Test
  void commentEvent_rendersReplyWithAboutLink() throws Exception {
    // A comment-add carries no changeDescription → the "commented on" branch.
    Map<String, Object> ctx =
        Map.of("event", Map.of(), "entity", incidentTask("please look at this incident"));

    String out = unescape(template.apply(ctx));

    assertTrue(out.contains("commented on"), out);
    assertTrue(out.contains("Incident"), out);
    assertTrue(out.contains("tc1"), out);
    assertTrue(out.contains("Reply:"), out);
    assertTrue(out.contains("please look at this incident"), out);
    assertTrue(out.contains("/test-case/svc.db.sch.tc1"), out);
    assertTrue(out.contains("Adria Estivill"), out);
    assertFalse(out.contains("updated the assignees"), out);
  }

  @Test
  void assigneeChange_rendersAssigneesWithoutReply() throws Exception {
    ChangeDescription cd =
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName("assignees").withNewValue("x")));
    Map<String, Object> ctx =
        Map.of(
            "event", Map.of("changeDescription", cd),
            "entity", incidentTask("an older comment"));

    String out = unescape(template.apply(ctx));

    assertTrue(out.contains("updated the assignees of"), out);
    assertTrue(out.contains("Assignees:"), out);
    assertTrue(out.contains("Adria Estivill"), out);
    assertFalse(out.contains("Reply:"), out);
    assertFalse(out.contains("an older comment"), out);
  }
}
