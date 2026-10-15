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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.context.ContextMemoryService;

/**
 * A memory cites the saved Queries that support it in {@code relatedEntities}, and retiring one of
 * them holds the memory for review
 * (ADR:2026-10-15-a-memory-cites-its-supporting-queries-and-their-retirement-holds-it-for-review).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryQueryEvidenceIT {

  private static final String RELATED = "relatedEntities";
  private static final String QUESTION = "Which revenue figure does the orders table hold?";

  @Test
  void supersedingTheQueryHoldsTheMemoryInReviewWithoutOpeningAConflictTask(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT SUM(amount_cents) / 100.0 FROM orders");
    ContextMemory memory = evidence.memory("superseded", ContextMemoryStatus.APPROVED, query);

    delete(query);

    ContextMemory held = read(memory);
    assertEquals(ContextMemoryStatus.DRAFT, held.getEntityStatus());
    assertTrue(held.getStatusReason().contains(query.getId().toString()), held.getStatusReason());
    assertFalse(
        held.getStatusReason().contains(query.getFullyQualifiedName()),
        "the reason names the query by id only");
    assertNull(held.getDisputes());
    assertTrue(openConflictReviews(held).isEmpty(), "an evidence hold opens no conflict review");
    assertTrue(relatedIds(held).isEmpty(), "a Query has no soft delete: its link rows are gone");
  }

  @Test
  void aHeldMemoryIsListedAmongTheDraftsAReviewerWorksThrough(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT region, SUM(amount_cents) FROM orders GROUP BY 1");
    String word = "evidencehold" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory memory =
        admin()
            .create(
                evidence
                    .request("draft-listing", ContextMemoryStatus.APPROVED, query)
                    .withTitle(word));

    delete(query);

    ListParams drafts =
        new ListParams().setLimit(20).addFilter("q", word).addFilter("statuses", "Draft");
    Awaitility.await("the held memory is searchable as a Draft")
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertTrue(
                    admin().list(drafts).getData().stream()
                        .anyMatch(listed -> listed.getId().equals(memory.getId()))));
  }

  @Test
  void anExplicitHardDeleteHoldsTheMemoryTheSameWay(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT COUNT(*) FROM orders WHERE status = 'paid'");
    ContextMemory memory = evidence.memory("hard", ContextMemoryStatus.APPROVED, query);

    hardDelete(query);

    ContextMemory held = read(memory);
    assertEquals(ContextMemoryStatus.DRAFT, held.getEntityStatus());
    assertTrue(held.getStatusReason().contains(query.getId().toString()));
  }

  @Test
  void anUnprocessedCaptureIsHeldBeforeReconciliationCanApproveIt(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT AVG(amount_cents) FROM orders");
    ContextMemory memory = evidence.memory("unprocessed", ContextMemoryStatus.UNPROCESSED, query);

    delete(query);

    assertEquals(ContextMemoryStatus.DRAFT, read(memory).getEntityStatus());
  }

  @Test
  void aReviewerWhoApprovesAHeldMemoryIsNotOverruledByLaterDeletes(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT MAX(amount_cents) FROM orders");
    ContextMemory memory = evidence.memory("reapproved", ContextMemoryStatus.APPROVED, query);
    delete(query);
    admin().patch(memory.getId().toString(), status(ContextMemoryStatus.APPROVED));

    delete(evidence.query("SELECT MIN(amount_cents) FROM orders"));

    assertEquals(ContextMemoryStatus.APPROVED, read(memory).getEntityStatus());
  }

  @Test
  void deletingTheServiceHoldsTheMemoriesItsQueriesSupport(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT SUM(amount_cents) FROM orders WHERE refunded");
    ContextMemory memory = evidence.memory("cascade", ContextMemoryStatus.APPROVED, query);

    SdkClients.adminClient()
        .databaseServices()
        .delete(evidence.service().getId().toString(), Map.of("recursive", "true"));

    assertEquals(ContextMemoryStatus.DRAFT, read(memory).getEntityStatus());
  }

  @Test
  void memoriesInReviewRetiredOrCitingOtherQueriesKeepTheirStage(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT SUM(amount_cents) FROM orders WHERE region = 'EU'");
    Query other = evidence.query("SELECT SUM(amount_cents) FROM orders WHERE region = 'US'");
    ContextMemory draft = evidence.memory("draft", ContextMemoryStatus.APPROVED, query);
    admin()
        .patch(
            draft.getId().toString(),
            JsonUtils.readTree(
                """
                [{"op":"replace","path":"/entityStatus","value":"Draft"},
                 {"op":"add","path":"/statusReason","value":"Waiting for the finance team"}]"""));
    ContextMemory rejected = evidence.memory("rejected", ContextMemoryStatus.REJECTED, query);
    ContextMemory unrelated = evidence.memory("unrelated", ContextMemoryStatus.APPROVED, other);
    ContextMemory twice = evidence.memory("twice", ContextMemoryStatus.APPROVED, query, other);

    delete(query);
    delete(other);

    assertEquals("Waiting for the finance team", read(draft).getStatusReason());
    assertEquals(ContextMemoryStatus.REJECTED, read(rejected).getEntityStatus());
    assertTrue(read(unrelated).getStatusReason().contains(other.getId().toString()));
    assertTrue(
        read(twice).getStatusReason().contains(query.getId().toString()),
        "the first retirement holds it; the second finds it already in review");
  }

  @Test
  void savingByteIdenticalSqlAgainLeavesItsMemoriesAlone(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    String sql = "SELECT SUM(amount_cents) FROM orders WHERE created_at >= '2026-01-01'";
    Query query = evidence.query(sql);
    ContextMemory memory = evidence.memory("reuse", ContextMemoryStatus.APPROVED, query);

    Query again =
        SdkClients.adminClient().queries().update(query.getId(), evidence.createQuery(sql));

    assertEquals(query.getId(), again.getId());
    assertEquals(ContextMemoryStatus.APPROVED, read(memory).getEntityStatus());
  }

  @Test
  void aCaptureThatRacedTheSupersessionOfItsQueryStartsInReview(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT COUNT(DISTINCT customer_id) FROM orders");
    delete(query);

    ContextMemory memory = evidence.memory("late", ContextMemoryStatus.UNPROCESSED, query);

    assertEquals(ContextMemoryStatus.DRAFT, memory.getEntityStatus());
    assertTrue(memory.getStatusReason().contains(query.getId().toString()));
  }

  @Test
  void aReaderWhoMayNotViewTheQuerySeesOnlyItsId(TestNamespace ns) {
    Evidence evidence = evidence(ns);
    Query query = evidence.query("SELECT SUM(salary) FROM payroll");
    ContextMemory memory =
        admin()
            .create(
                evidence
                    .request("public", ContextMemoryStatus.APPROVED, query)
                    .withPrimaryEntity(null)
                    .withMemoryScope(ContextMemoryScope.USER_GLOBAL)
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.PUBLIC)));
    ContextMemoryService reader = new ContextMemoryService(queryBlindUser(ns).getHttpClient());

    EntityReference seen =
        reader.get(memory.getId().toString(), RELATED).getRelatedEntities().getFirst();
    EntityReference full = read(memory).getRelatedEntities().getFirst();

    assertEquals(query.getId(), seen.getId());
    assertEquals("query", seen.getType());
    assertNull(seen.getFullyQualifiedName());
    assertNull(seen.getDisplayName());
    assertNull(seen.getDescription());
    assertEquals(query.getFullyQualifiedName(), full.getFullyQualifiedName(), "admins see it");
    String versions = JsonUtils.pojoToJson(reader.getVersionList(memory.getId()));
    assertFalse(versions.contains(query.getFullyQualifiedName()), versions);

    delete(query);
    ContextMemory held = read(memory);
    assertTrue(
        JsonUtils.pojoToJson(held.getChangeDescription()).contains(query.getFullyQualifiedName()),
        "the hold records which evidence it removed");
    String asReader = JsonUtils.pojoToJson(reader.get(memory.getId().toString(), RELATED));
    assertFalse(asReader.contains(query.getFullyQualifiedName()), asReader);
    assertTrue(asReader.contains(query.getId().toString()), asReader);
  }

  private record Evidence(TestNamespace ns, DatabaseService service, Table table) {

    CreateQuery createQuery(String sql) {
      return new CreateQuery()
          .withQuery(sql)
          .withDescription(QUESTION)
          .withDisplayName("Revenue in orders")
          .withService(service.getFullyQualifiedName())
          .withQueryUsedIn(List.of(table.getEntityReference()))
          .withQueryDate(System.currentTimeMillis());
    }

    Query query(String sql) {
      return SdkClients.adminClient().queries().create(createQuery(sql));
    }

    CreateContextMemory request(String name, ContextMemoryStatus status, Query... cited) {
      return new CreateContextMemory()
          .withName(ns.prefix(name))
          .withTitle(ns.prefix(name))
          .withQuestion(QUESTION)
          .withAnswer("amount_cents stores cents; divide by 100 for currency.")
          .withMemoryType(ContextMemoryType.LEARNING)
          .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
          .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
          .withEntityStatus(status)
          .withSourceType(ContextMemorySourceType.CONVERSATION_EXTRACTION)
          .withPrimaryEntity(table.getEntityReference())
          .withRelatedEntities(
              List.of(cited).stream()
                  .map(query -> new EntityReference().withId(query.getId()).withType("query"))
                  .toList());
    }

    ContextMemory memory(String name, ContextMemoryStatus status, Query... cited) {
      return admin().create(request(name, status, cited));
    }
  }

  private static Evidence evidence(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    return new Evidence(ns, service, table);
  }

  /** What supersession sends: {@code hardDelete=false}, which a Query cannot honour. */
  private static void delete(Query query) {
    SdkClients.adminClient().queries().delete(query.getId().toString(), Map.of());
  }

  private static void hardDelete(Query query) {
    SdkClients.adminClient()
        .queries()
        .delete(query.getId().toString(), Map.of("hardDelete", "true"));
  }

  private static ContextMemory read(ContextMemory memory) {
    return admin().get(memory.getId().toString(), RELATED);
  }

  private static List<UUID> relatedIds(ContextMemory memory) {
    return listOrEmpty(memory.getRelatedEntities()).stream().map(EntityReference::getId).toList();
  }

  private static com.fasterxml.jackson.databind.JsonNode status(ContextMemoryStatus status) {
    return JsonUtils.readTree(
        """
        [{"op":"replace","path":"/entityStatus","value":"%s"}]"""
            .formatted(status.value()));
  }

  private static List<?> openConflictReviews(ContextMemory memory) {
    return SdkClients.adminClient()
        .tasks()
        .listWithFilters(
            Map.of(
                "aboutEntity", memory.getFullyQualifiedName(),
                "type", TaskEntityType.MemoryConflictReview.value(),
                "status", TaskEntityStatus.Open.value()))
        .getData();
  }

  /** A user every policy lets read memories, and one deny rule keeps from reading any Query. */
  private static OpenMetadataClient queryBlindUser(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Rule denyQueries =
        new Rule()
            .withName("DenyQueries")
            .withResources(List.of("query"))
            .withOperations(List.of(MetadataOperation.VIEW_ALL, MetadataOperation.VIEW_BASIC))
            .withEffect(Rule.Effect.DENY);
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("query-blind"))
                    .withRules(List.of(denyQueries)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.prefix("query-blind"))
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    Team team =
        admin
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("query-blind"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withDefaultRoles(List.of(role.getId())));
    String name = "qblind_" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@test.openmetadata.org";
    admin
        .users()
        .create(new CreateUser().withName(name).withEmail(email).withTeams(List.of(team.getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static ContextMemoryService admin() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }
}
