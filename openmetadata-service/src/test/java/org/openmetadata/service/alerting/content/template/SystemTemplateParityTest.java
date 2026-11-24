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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.content.preview.EntityFixtureLoader;
import org.openmetadata.service.alerting.content.preview.MockChangeEventFactory;
import org.openmetadata.service.alerting.content.preview.MockChangeEventRegistry;
import org.openmetadata.service.alerting.content.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.alerting.content.template.handlebars.helpers.BuildEntityUrlHelper;
import org.openmetadata.service.alerting.content.template.sandbox.TemplateSandbox;

/**
 * Every shipped template renders the same text in the sandbox as in a Handlebars engine built from
 * the library defaults, for every preview fixture and event type.
 */
class SystemTemplateParityTest {

  private static final String TEMPLATES = "/json/data/notifications/templates/";
  private static final String ENVELOPE =
      "/json/data/notifications/envelopes/system-email-change-event-notification-envelope.json";
  private static final List<String> TEMPLATE_NAMES =
      List.of(
          "system-notification-entity-created",
          "system-notification-entity-default",
          "system-notification-entity-deleted",
          "system-notification-entity-soft-deleted",
          "system-notification-entity-updated",
          "system-notification-logical-test-case-added",
          "system-notification-post-created",
          "system-notification-task-closed",
          "system-notification-task-entity-created",
          "system-notification-task-entity-updated",
          "system-notification-task-resolved",
          "system-notification-thread-created",
          "system-notification-thread-entity-deleted",
          "system-notification-thread-updated");
  private static final List<String> RESOURCES =
      List.of(
          "chart",
          "container",
          "dashboard",
          "dashboardDataModel",
          "dashboardService",
          "dataContract",
          "database",
          "databaseSchema",
          "databaseService",
          "glossary",
          "glossaryTerm",
          "ingestionPipeline",
          "location",
          "messagingService",
          "metadataService",
          "mlmodel",
          "mlmodelService",
          "pipeline",
          "pipelineService",
          "storageService",
          "table",
          "tag",
          "tagCategory",
          "testCase",
          "testSuite",
          "topic",
          "user",
          "thread",
          "task");
  private static final List<String> CHANGED_FIELDS =
      List.of(
          "description",
          "tags",
          "owners",
          "owner",
          "domain",
          "domains",
          "followers",
          "assignees",
          "comments",
          "assets",
          "certification",
          "testCaseResult",
          "testCaseResultSummary",
          "pipelineStatus",
          "dataContractResult",
          "kpiResult",
          "queryUsedIn",
          "columns.customer_id.tags",
          "columns.customer_id.description",
          "extension.region",
          "customProperties.region");
  private static final String CHANGED_VALUE =
      "[{\"name\":\"alice\",\"displayName\":\"Alice\",\"type\":\"user\","
          + "\"tagFQN\":\"PII.Sensitive\",\"fullyQualifiedName\":\"svc.db.sch.orders\","
          + "\"testCaseStatus\":\"Failed\",\"pipelineState\":\"failed\",\"result\":\"3 rows\"}]";

  private final List<HandlebarsHelper> helpers = helpersWithFixedBaseUrl();
  private final TemplateSandbox sandbox = new TemplateSandbox(helpers);
  private final Handlebars reference = referenceEngine(helpers);
  private final MockChangeEventFactory events =
      new MockChangeEventFactory(new MockChangeEventRegistry(new EntityFixtureLoader()));

  @Test
  void shippedTemplatesRenderTheSameText() throws IOException {
    List<String> differences = new ArrayList<>();
    int renders = 0;
    for (String templateName : TEMPLATE_NAMES) {
      JsonNode template = readJson(TEMPLATES + templateName + ".json");
      for (String resource : RESOURCES) {
        for (EventType eventType : EventType.values()) {
          ChangeEvent event = events.create(resource, eventType).withEventType(eventType);
          Map<String, Object> context = eventContext(event);
          renders += compare(templateName, template, context, differences);
        }
        ChangeEvent changed =
            events
                .create(resource, EventType.ENTITY_UPDATED)
                .withEventType(EventType.ENTITY_UPDATED)
                .withChangeDescription(changes());
        renders += compare(templateName, template, eventContext(changed), differences);
      }
    }

    assertTrue(renders > 0);
    assertEquals(List.of(), differences.stream().limit(5).toList());
  }

  // A system template that cannot render is reset to its packaged default, so every default
  // must pass the check that refuses templates.
  @Test
  void everyPackagedTemplatePassesTheCheck() throws IOException {
    HandlebarsNotificationTemplateProcessor processor =
        new HandlebarsNotificationTemplateProcessor();
    List<String> refused = new ArrayList<>();
    for (String templateName : TEMPLATE_NAMES) {
      JsonNode template = readJson(TEMPLATES + templateName + ".json");
      NotificationTemplateValidationResponse validation =
          processor.validate(
              new NotificationTemplateValidationRequest()
                  .withTemplateBody(template.path("templateBody").asText())
                  .withTemplateSubject(template.path("templateSubject").asText()));
      if (!Boolean.TRUE.equals(validation.getIsValid())) {
        refused.add(templateName);
      }
    }

    assertEquals(List.of(), refused);
  }

  @Test
  void emailEnvelopeRendersTheSameText() throws IOException {
    JsonNode envelope = readJson(ENVELOPE);
    Map<String, Object> context =
        Map.of("content", "<p>Body &amp; more</p>", "organizationName", "Acme");
    List<String> differences = new ArrayList<>();

    compare("envelope", envelope, context, differences);

    assertEquals(List.of(), differences);
  }

  private int compare(
      String name, JsonNode template, Map<String, Object> context, List<String> differences)
      throws IOException {
    int renders = 0;
    for (String field : List.of("templateBody", "templateSubject")) {
      String source = template.path(field).asText("");
      String expected = reference.compileInline(source).apply(context);
      String actual = sandbox.render(source, context);
      if (!expected.equals(actual)) {
        differences.add(
            String.format(
                "%s %s for %s:%nexpected: %s%nactual:   %s",
                name, field, context.get("event"), expected, actual));
      }
      renders++;
    }
    return renders;
  }

  // The context the alert delivery builds: the event, its entity as a map, and server settings.
  private static Map<String, Object> eventContext(ChangeEvent event) {
    Map<String, Object> context = new HashMap<>();
    context.put("event", event);
    context.put("entity", JsonUtils.getMapFromJson((String) event.getEntity()));
    context.put("baseUrl", "http://localhost:8585");
    context.put("emailingEntity", "OpenMetadata");
    context.put("publisherName", "Test Notification");
    return context;
  }

  private static ChangeDescription changes() {
    return new ChangeDescription()
        .withFieldsAdded(fieldChanges())
        .withFieldsUpdated(fieldChanges())
        .withFieldsDeleted(fieldChanges());
  }

  private static List<FieldChange> fieldChanges() {
    return CHANGED_FIELDS.stream()
        .map(
            field ->
                new FieldChange()
                    .withName(field)
                    .withOldValue(CHANGED_VALUE)
                    .withNewValue(CHANGED_VALUE))
        .toList();
  }

  private static List<HandlebarsHelper> helpersWithFixedBaseUrl() {
    HandlebarsHelper buildEntityUrl =
        new BuildEntityUrlHelper() {
          @Override
          protected String getBaseUrl() {
            return "http://localhost:8585";
          }
        };
    return Stream.concat(
            HandlebarsProvider.getAllHelperInstances().stream(), Stream.of(buildEntityUrl))
        .toList();
  }

  private static Handlebars referenceEngine(List<HandlebarsHelper> helpers) {
    Handlebars handlebars = new Handlebars().with(EscapingStrategy.HTML_ENTITY);
    helpers.forEach(helper -> helper.register(handlebars));
    return handlebars;
  }

  private static JsonNode readJson(String path) throws IOException {
    try (InputStream in = SystemTemplateParityTest.class.getResourceAsStream(path)) {
      return JsonUtils.readTree(new String(in.readAllBytes()));
    }
  }
}
