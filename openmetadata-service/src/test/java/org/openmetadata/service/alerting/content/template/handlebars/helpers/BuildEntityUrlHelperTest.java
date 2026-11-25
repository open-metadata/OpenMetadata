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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.content.template.sandbox.TemplateSandbox;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Focused unit tests for {@link BuildEntityUrlHelper}. Renders the helper through the template
 * sandbox that notification templates use, and overrides {@code getBaseUrl()} so the tests do not
 * depend on {@code EmailUtil} or any DB-backed settings.
 *
 * <p>Reproduces the two notification-link regressions reported in
 * https://github.com/open-metadata/OpenMetadata/issues/27918:
 * <ul>
 *   <li>EVENT_SUBSCRIPTION links pointed at the singular {@code /settings/notifications/alert/}
 *       (404) instead of the actual UI route {@code /settings/notifications/alerts/}.
 *   <li>Query entities produced {@code <a href="">…</a>} whenever the entity payload had no
 *       {@code queryUsedIn}, which most mail clients render as plain text. The helper now
 *       always emits the standalone {@code /query-view/{queryFqn}/{queryId}} route, which the
 *       Query page resolves by id regardless of the FQN segment.
 * </ul>
 */
class BuildEntityUrlHelperTest {

  private static final String BASE_URL = "http://localhost:8585";
  private static final String TABLE_FQN = "service.db.schema.orders";
  private static final String CONTRACT_FQN = TABLE_FQN + ".dataContract_Orders Contract";
  private static final String TEMPLATE_SRC =
      "<a href=\"{{buildEntityUrl event.entityType entity}}\">link</a>";

  private TemplateSandbox sandbox;

  @BeforeEach
  void setUp() {
    sandbox =
        new TemplateSandbox(
            List.of(
                new BuildEntityUrlHelper() {
                  @Override
                  protected String getBaseUrl() {
                    return BASE_URL;
                  }
                }));
  }

  /** Renders {@code {{buildEntityUrl event.entityType fqn '<view>'}}} (the task/feed deep link). */
  private String renderFeedLink(String entityType, String fqn, String view) throws IOException {
    return sandbox.render(
        "<a href=\"{{buildEntityUrl event.entityType fqn '" + view + "'}}\">link</a>",
        Map.of("event", Map.of("entityType", entityType), "fqn", fqn));
  }

  private String render(String entityType, Map<String, Object> entity) throws IOException {
    Map<String, Object> ctx = Map.of("event", Map.of("entityType", entityType), "entity", entity);
    return sandbox.render(TEMPLATE_SRC, ctx);
  }

  private String extractHref(String rendered) {
    int start = rendered.indexOf("href=\"") + 6;
    int end = rendered.indexOf('"', start);
    String escaped = rendered.substring(start, end);
    // The HTML_ENTITY escaping strategy encodes &, = and / inside attribute values; undo that so
    // assertions can talk about the URL itself rather than its HTML-encoded form.
    return escaped.replace("&amp;", "&").replace("&#x3D;", "=").replace("&#x2F;", "/");
  }

  @Test
  void eventSubscription_usesPluralAlertsPath() throws IOException {
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", "OpenMetadata_alert_27918",
            "name", "OpenMetadata_alert_27918");

    String url = extractHref(render(Entity.EVENT_SUBSCRIPTION, entity));

    assertNotNull(url, "EVENT_SUBSCRIPTION URL must not be null");
    assertTrue(
        url.contains("/settings/notifications/alerts/"),
        () -> "Expected plural 'alerts' segment but got: " + url);
    assertFalse(
        url.matches(".*/settings/notifications/alert/.*"),
        () -> "URL still contains the broken singular 'alert' segment: " + url);
    assertTrue(url.endsWith("/configuration"), () -> "Expected /configuration suffix: " + url);
  }

  @Test
  void query_withEmptyQueryUsedIn_producesQueryViewUrl() throws IOException {
    String queryId = UUID.randomUUID().toString();
    String queryFqn = "DWH.test_query_27918";
    Map<String, Object> entity =
        Map.of(
            "id",
            queryId,
            "fullyQualifiedName",
            queryFqn,
            "name",
            "test_query_27918",
            "queryUsedIn",
            List.of());

    String url = extractHref(render(Entity.QUERY, entity));

    assertFalse(
        url.isEmpty(),
        "Query must produce a non-empty href (otherwise renders <a href=\"\">, which mail"
            + " clients display as plain text)");
    assertEquals(BASE_URL + "/query-view/" + queryFqn + "/" + queryId, url);
  }

  @Test
  void query_withoutQueryUsedInField_producesQueryViewUrl() throws IOException {
    String queryId = UUID.randomUUID().toString();
    String queryFqn = "DWH.test_query_no_field";
    Map<String, Object> entity =
        Map.of(
            "id", queryId,
            "fullyQualifiedName", queryFqn,
            "name", "test_query_no_field");

    String url = extractHref(render(Entity.QUERY, entity));

    assertEquals(BASE_URL + "/query-view/" + queryFqn + "/" + queryId, url);
  }

  @Test
  void query_withQueryUsedIn_stillProducesQueryViewUrl() throws IOException {
    // Even when the query has an attached table, the helper now emits the standalone
    // /query-view URL (the Query page resolves its own table context from queryUsedIn).
    String queryId = UUID.randomUUID().toString();
    String queryFqn = "DWH.attached_query";
    String tableFqn = "sample_data.ecommerce_db.shopify.raw_product_catalog";

    Map<String, Object> entity =
        Map.of(
            "id",
            queryId,
            "fullyQualifiedName",
            queryFqn,
            "name",
            "attached_query",
            "queryUsedIn",
            List.of(
                Map.of(
                    "id",
                    UUID.randomUUID().toString(),
                    "type",
                    "table",
                    "fullyQualifiedName",
                    tableFqn,
                    "name",
                    "raw_product_catalog")));

    String url = extractHref(render(Entity.QUERY, entity));

    assertEquals(BASE_URL + "/query-view/" + queryFqn + "/" + queryId, url);
  }

  @Test
  void glossaryTerm_usesGlossaryPath() throws IOException {
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", "MyGlossary.MyTerm",
            "name", "MyTerm");

    String url = extractHref(render(Entity.GLOSSARY_TERM, entity));

    assertEquals(BASE_URL + "/glossary/MyGlossary.MyTerm", url);
  }

  @Test
  void defaultEntity_buildsByEntityTypeAndFqn() throws IOException {
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", "service.db.schema.users",
            "name", "users");

    String url = extractHref(render("table", entity));

    assertEquals(BASE_URL + "/table/service.db.schema.users", url);
  }

  @Test
  void metadataExample_rendersEntityLink() throws IOException {
    String example = new BuildEntityUrlHelper().getMetadata().getUsages().get(0).getExample();
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", "service.db.schema.users",
            "name", "users");

    String url =
        extractHref(
            sandbox.render(
                "<a href=\"" + example + "\">link</a>",
                Map.of("event", Map.of("entityType", "table"), "entity", entity)));

    assertEquals(BASE_URL + "/table/service.db.schema.users", url);
  }

  @Test
  void testCaseTaskLink_pointsToIssuesTab() throws IOException {
    String url = extractHref(renderFeedLink(Entity.TEST_CASE, "service.db.schema.tc1", "tasks"));

    assertEquals(BASE_URL + "/test-case/service.db.schema.tc1/issues", url);
    assertFalse(
        url.contains("activity_feed"), () -> "test case has no activity_feed route: " + url);
    assertFalse(
        url.contains("test-case-results"),
        () -> "incident link must target the issues tab, not results: " + url);
  }

  @Test
  void testCaseConversationLink_pointsToIssuesTab() throws IOException {
    String url = extractHref(renderFeedLink(Entity.TEST_CASE, "service.db.schema.tc1", "all"));

    assertEquals(BASE_URL + "/test-case/service.db.schema.tc1/issues", url);
  }

  @Test
  void regularEntityTaskLink_appendsActivityFeedTasks() throws IOException {
    String url = extractHref(renderFeedLink("table", "service.db.schema.users", "tasks"));

    assertEquals(BASE_URL + "/table/service.db.schema.users/activity_feed/tasks", url);
  }

  @Test
  void task_linksToTaskPage() throws IOException {
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", "TASK-00761",
            "name", "Approval required for ClaimEventFeature");

    String url = extractHref(render(Entity.TASK, entity));

    assertEquals(BASE_URL + "/tasks/TASK-00761", url);
  }

  @Test
  void taskLink_withView_staysOnTaskPage() throws IOException {
    String url = extractHref(renderFeedLink(Entity.TASK, "TASK-00761", "tasks"));

    assertEquals(BASE_URL + "/tasks/TASK-00761", url);
  }

  @Test
  void testCaseResultLink_keepsResultsTabWithoutView() throws IOException {
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", "service.db.schema.tc1",
            "name", "tc1");

    String url = extractHref(render(Entity.TEST_CASE, entity));

    assertEquals(BASE_URL + "/test-case/service.db.schema.tc1/test-case-results", url);
  }

  @Test
  void nullableEntityUrl_withView_doesNotEmitLiteralNull() throws IOException {
    // A query without an id makes buildEntityUrl return null; the view suffix must not turn that
    // into the literal "null/activity_feed/...".
    Map<String, Object> entity = Map.of("fullyQualifiedName", "DWH.q", "name", "q");
    String href =
        extractHref(
            sandbox.render(
                "<a href=\"{{buildEntityUrl event.entityType entity 'tasks'}}\">link</a>",
                Map.of("event", Map.of("entityType", Entity.QUERY), "entity", entity)));

    assertFalse(href.contains("null"), () -> "URL must not contain literal 'null': " + href);
    assertFalse(href.contains("/activity_feed/"), () -> "no feed suffix on a null URL: " + href);
  }

  @Test
  void dataContract_withAsset_linksToAssetContractTab() throws IOException {
    Map<String, Object> entity =
        Map.of(
            "id", UUID.randomUUID().toString(),
            "fullyQualifiedName", CONTRACT_FQN,
            "entity", Map.of("type", Entity.TABLE, "fullyQualifiedName", TABLE_FQN));

    String url = extractHref(render(Entity.DATA_CONTRACT, entity));

    assertEquals(BASE_URL + "/table/" + TABLE_FQN + "/contract", url);
  }

  @Test
  void dataContractReference_loadsContractToLinkItsAsset() throws IOException {
    Map<String, Object> about =
        Map.of(
            "id",
            UUID.randomUUID().toString(),
            "type",
            Entity.DATA_CONTRACT,
            "fullyQualifiedName",
            CONTRACT_FQN);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubContractLookup(entity);
      String url = extractHref(render(Entity.DATA_CONTRACT, about));

      assertEquals(BASE_URL + "/table/" + TABLE_FQN + "/contract", url);
    }
  }

  @Test
  void dataContractFqn_loadsContractToLinkItsAsset() throws IOException {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubContractLookup(entity);
      String url =
          extractHref(
              sandbox.render(
                  "<a href=\"{{buildEntityUrl 'dataContract' fqn}}\">link</a>",
                  Map.of("fqn", CONTRACT_FQN)));

      assertEquals(BASE_URL + "/table/" + TABLE_FQN + "/contract", url);
    }
  }

  @Test
  void dataContractTaskLink_pointsToAssetTasksTab() throws IOException {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubContractLookup(entity);
      String url = extractHref(renderFeedLink(Entity.DATA_CONTRACT, CONTRACT_FQN, "tasks"));

      assertEquals(BASE_URL + "/table/" + TABLE_FQN + "/activity_feed/tasks", url);
    }
  }

  @Test
  void deletedDataContract_rendersEmptyLink() throws IOException {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityByName(Entity.DATA_CONTRACT, CONTRACT_FQN, "", Include.ALL))
          .thenThrow(EntityNotFoundException.byName(CONTRACT_FQN));
      String url =
          extractHref(
              sandbox.render(
                  "<a href=\"{{buildEntityUrl 'dataContract' fqn}}\">link</a>",
                  Map.of("fqn", CONTRACT_FQN)));

      assertEquals("", url);
    }
  }

  /** The stored contract keeps only the table's id and type; resolving it adds the FQN. */
  private void stubContractLookup(MockedStatic<Entity> entity) {
    EntityReference storedRef = new EntityReference().withId(UUID.randomUUID()).withType("table");
    DataContract contract =
        new DataContract().withFullyQualifiedName(CONTRACT_FQN).withEntity(storedRef);
    entity
        .when(() -> Entity.getEntityByName(Entity.DATA_CONTRACT, CONTRACT_FQN, "", Include.ALL))
        .thenReturn(contract);
    entity
        .when(() -> Entity.getEntityReference(storedRef, Include.ALL))
        .thenReturn(
            new EntityReference()
                .withId(storedRef.getId())
                .withType("table")
                .withFullyQualifiedName(TABLE_FQN));
  }
}
