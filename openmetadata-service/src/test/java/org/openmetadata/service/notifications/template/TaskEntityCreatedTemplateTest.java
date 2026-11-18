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
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsProvider;
import org.openmetadata.service.notifications.template.handlebars.helpers.BuildEntityUrlHelper;

/**
 * Renders {@code system-notification-task-entity-created} through the production helpers. Without
 * it a new task fell back to the generic entity-created template, which linked to {@code
 * /task/TASK-xxxxx}, a page the UI does not have, and said nothing about the asset or the change.
 * 2.0 has no task page at all, so the task link opens the Tasks tab of the asset.
 */
class TaskEntityCreatedTemplateTest {

  private static final String BASE_URL = "http://localhost:8585";
  private static final String TEMPLATE =
      "/json/data/notifications/templates/system-notification-task-entity-created.json";
  private static final String ASSET_TASKS_TAB =
      BASE_URL + "/table/svc.db.sch.ClaimEventFeature/activity_feed/tasks";

  private Template body;
  private Template subject;

  @BeforeEach
  void setUp() throws Exception {
    Handlebars handlebars = new Handlebars().with(EscapingStrategy.HTML_ENTITY);
    for (HandlebarsHelper helper : HandlebarsProvider.getAllHelperInstances()) {
      helper.register(handlebars);
    }
    new BuildEntityUrlHelper() {
      @Override
      protected String getBaseUrl() {
        return BASE_URL;
      }
    }.register(handlebars);

    try (InputStream in = getClass().getResourceAsStream(TEMPLATE)) {
      assertNotNull(in, "task created template must be on the classpath: " + TEMPLATE);
      JsonNode node = new ObjectMapper().readTree(in);
      body = handlebars.compileInline(node.get("templateBody").asText());
      subject = handlebars.compileInline(node.get("templateSubject").asText());
    }
  }

  private String unescape(String s) {
    return s.replace("&amp;", "&")
        .replace("&#x3D;", "=")
        .replace("&#x2F;", "/")
        .replace("&#x27;", "'")
        .replace("&quot;", "\"");
  }

  private Map<String, Object> approvalTask() {
    return Map.of(
        "taskId", "TASK-00761",
        "fullyQualifiedName", "TASK-00761",
        "name", "Approval required for ClaimEventFeature",
        "description", "Approval required for ClaimEventFeature",
        "category", "Approval",
        "type", "RequestApproval",
        "createdBy", Map.of("name", "jeff", "displayName", "Jeff R"),
        "about",
            Map.of(
                "type", "table",
                "name", "ClaimEventFeature",
                "fullyQualifiedName", "svc.db.sch.ClaimEventFeature"),
        "payload",
            Map.of(
                "proposedChanges",
                Map.of(
                    "tags",
                    Map.of(
                        "added", List.of("ifbi_sensitivity.Internal Use Only"),
                        "removed", List.of("ifbi_sensitivity.Confidential Critical")))),
        "assignees", List.of(Map.of("name", "steward", "displayName", "Data Steward")));
  }

  private String render(Template template, Map<String, Object> task) throws Exception {
    Map<String, Object> ctx =
        Map.of(
            "event",
            Map.of("entityType", Entity.TASK, "userName", "ingestion-bot"),
            "entity",
            task,
            "publisherName",
            "Workflow Approval");
    return unescape(template.apply(ctx));
  }

  @Test
  void approvalTask_linksTheTaskAndTheAssetAndListsTheChange() throws Exception {
    String out = render(body, approvalTask());

    assertTrue(out.contains("@Jeff R</strong> created the"), out);
    assertTrue(out.contains("Request Approval"), out);
    assertTrue(out.contains("href=\"" + ASSET_TASKS_TAB + "\">TASK-00761</a>"), out);
    assertTrue(
        out.contains("href=\"" + BASE_URL + "/table/svc.db.sch.ClaimEventFeature\""),
        () -> "the asset link must open the table: " + out);
    assertTrue(out.contains("added ifbi_sensitivity.Internal Use Only"), out);
    assertTrue(out.contains("removed ifbi_sensitivity.Confidential Critical"), out);
    assertTrue(out.contains("@Data Steward"), out);
    assertFalse(out.contains("/task/TASK-00761"), () -> "the broken singular route: " + out);
    assertFalse(out.contains("/tasks/TASK-00761"), () -> "2.0 has no task page: " + out);
  }

  @Test
  void subject_namesTheCategoryAndTheAsset() throws Exception {
    String out = render(subject, approvalTask());

    assertTrue(out.contains("[Workflow Approval] - New Approval task for"), out);
    assertTrue(out.contains("ClaimEventFeature"), out);
  }

  @Test
  void bareTask_fallsBackToTheEventUserAndSkipsEmptySections() throws Exception {
    Map<String, Object> task =
        Map.of("taskId", "TASK-00042", "fullyQualifiedName", "TASK-00042", "name", "t");

    String out = render(body, task);

    assertTrue(out.contains("@ingestion-bot</strong> created the"), out);
    assertTrue(out.contains("task <strong>TASK-00042</strong>."), out);
    assertFalse(out.contains("href=\"\""), () -> "no asset means no link: " + out);
    assertFalse(out.contains("Proposed changes"), out);
    assertFalse(out.contains("Assignees"), out);
    assertFalse(out.contains(" for <strong>"), out);
    assertFalse(out.contains("Approving moves"), out);
  }

  @Test
  void lifecycleApproval_namesTheStageMoveInsteadOfChanges() throws Exception {
    Map<String, Object> task =
        Map.of(
            "taskId", "TASK-00900",
            "fullyQualifiedName", "TASK-00900",
            "type", "RequestApproval",
            "payload",
                Map.of("lifecycleMove", Map.of("stage", "In Review", "targetStage", "Approved")));

    String out = render(body, task);

    assertTrue(
        out.contains("Approving moves this asset from <strong>In Review</strong> to "),
        () -> "the stage move the approval gates: " + out);
    assertTrue(out.contains("<strong>Approved</strong>."), out);
    assertFalse(out.contains("Proposed changes"), out);
  }

  @Test
  void proposedChanges_skipsAFieldWithNothingAddedOrRemoved() throws Exception {
    Map<String, Object> task =
        Map.of(
            "taskId", "TASK-00901",
            "fullyQualifiedName", "TASK-00901",
            "payload",
                Map.of(
                    "proposedChanges",
                    Map.of(
                        "description", Map.of("added", List.of(), "removed", List.of()),
                        "tags", Map.of("added", List.of("PII.Sensitive"), "removed", List.of()))));

    String out = render(body, task);

    assertTrue(out.contains("<strong>Tags</strong>: added PII.Sensitive"), out);
    assertFalse(out.contains("<strong>Description</strong>"), out);
  }
}
