/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * The AI Context batch endpoint returns only the knowledge items the caller may view. A user
 * holding the seeded {@code DomainOnlyAccessRole} who can view a table must not receive the
 * articles and metrics of another domain attached to it, while the items of their own domain still
 * come back.
 */
@Slf4j
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AIContextKnowledgeAuthorizationIT {

  private record CleanupStep(String description, Runnable action) {}

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ATTACHED_KNOWLEDGE = "/v1/ai/context/attachedKnowledge";

  @Test
  void attachedKnowledge_omitsItemsFromDomainsTheCallerCannotView(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<CleanupStep> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain other = createDomain(admin, p + "_other", cleanup);
      Table table = createTable(admin, p + "_t", createSchema(ns, cleanup), own);

      String ownArticle = createArticle(admin, p + "_own_article", table, own, cleanup);
      String otherArticle = createArticle(admin, p + "_other_article", table, other, cleanup);
      Metric otherMetric = createMetric(admin, p + "_other_metric", table, other, cleanup);

      OpenMetadataClient user = createDomainOnlyUser(admin, p + "_member", own, cleanup);

      assertEquals(table.getId(), user.tables().get(table.getId().toString()).getId());
      assertThrows(
          ForbiddenException.class, () -> user.metrics().get(otherMetric.getId().toString()));

      assertEquals(
          new TreeSet<>(Set.of(ownArticle, otherArticle, otherMetric.getFullyQualifiedName())),
          attachedKnowledgeFqns(admin, table));
      assertEquals(new TreeSet<>(Set.of(ownArticle)), attachedKnowledgeFqns(user, table));
    } finally {
      drain(cleanup);
    }
  }

  private Set<String> attachedKnowledgeFqns(OpenMetadataClient client, Table table)
      throws Exception {
    String body =
        MAPPER.writeValueAsString(
            List.of(
                Map.of(
                    "fullyQualifiedName", table.getFullyQualifiedName(), "entityType", "table")));
    JsonNode response =
        MAPPER.readTree(
            client
                .getHttpClient()
                .executeForString(
                    HttpMethod.POST, ATTACHED_KNOWLEDGE, body, RequestOptions.builder().build()));
    assertEquals(1, response.size(), "the viewable table resolves to one entry");
    Set<String> fqns = new TreeSet<>();
    for (JsonNode item : response.get(0).path("items")) {
      fqns.add(item.path("fullyQualifiedName").asText());
    }
    return fqns;
  }

  private OpenMetadataClient createDomainOnlyUser(
      OpenMetadataClient admin, String name, Domain domain, Deque<CleanupStep> cleanup) {
    Role domainOnlyRole = admin.roles().getByName("DomainOnlyAccessRole");
    String email = name + "@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(email)
                    .withRoles(List.of(domainOnlyRole.getId()))
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    cleanup.push(new CleanupStep("user " + name, () -> admin.users().delete(user.getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private String createArticle(
      OpenMetadataClient admin, String name, Table table, Domain domain, Deque<CleanupStep> cleanup)
      throws Exception {
    Map<String, Object> create =
        Map.of(
            "name",
            name,
            "description",
            "Article for domain " + domain.getName(),
            "pageType",
            "Article",
            "page",
            Map.of(),
            "domains",
            List.of(domain.getFullyQualifiedName()),
            "relatedEntities",
            List.of(Map.of("id", table.getId().toString(), "type", "table")));
    JsonNode page =
        MAPPER.readTree(
            admin
                .getHttpClient()
                .executeForString(
                    HttpMethod.POST,
                    "/v1/contextCenter/pages",
                    MAPPER.writeValueAsString(create),
                    RequestOptions.builder().build()));
    String id = page.get("id").asText();
    cleanup.push(
        new CleanupStep(
            "article " + name,
            () ->
                admin
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.DELETE,
                        "/v1/contextCenter/pages/" + id + "?hardDelete=true",
                        null,
                        RequestOptions.builder().build())));
    return page.get("fullyQualifiedName").asText();
  }

  private Metric createMetric(
      OpenMetadataClient admin, String name, Table table, Domain domain, Deque<CleanupStep> cleanup)
      throws Exception {
    Metric metric =
        admin
            .metrics()
            .create(
                new CreateMetric()
                    .withName(name)
                    .withDescription("Metric for domain " + domain.getName())
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    cleanup.push(
        new CleanupStep("metric " + name, () -> admin.metrics().delete(metric.getId().toString())));
    BulkAssets assets =
        new BulkAssets()
            .withAssets(List.of(new EntityReference().withId(table.getId()).withType("table")));
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/metrics/" + metric.getName() + "/assets/add",
            MAPPER.writeValueAsString(assets),
            RequestOptions.builder().build());
    return metric;
  }

  private Domain createDomain(OpenMetadataClient admin, String name, Deque<CleanupStep> cleanup) {
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(name)
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("AI context authorization test domain"));
    cleanup.push(
        new CleanupStep("domain " + name, () -> admin.domains().delete(domain.getId().toString())));
    return domain;
  }

  private DatabaseSchema createSchema(TestNamespace ns, Deque<CleanupStep> cleanup) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    cleanup.push(
        new CleanupStep(
            "database service " + service.getName(),
            () ->
                SdkClients.adminClient()
                    .databaseServices()
                    .delete(
                        service.getId().toString(),
                        Map.of("recursive", "true", "hardDelete", "true"))));
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private Table createTable(
      OpenMetadataClient admin, String name, DatabaseSchema schema, Domain domain) {
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private void drain(Deque<CleanupStep> cleanup) {
    while (!cleanup.isEmpty()) {
      CleanupStep step = cleanup.pop();
      try {
        step.action().run();
      } catch (OpenMetadataException e) {
        log.warn("Cleanup of {} failed: {}", step.description(), e.getMessage());
      }
    }
  }
}
