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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Verifies that {@code DELETE /v1/lineage/{entityType}/{entityId}/type/{lineageSource}} evaluates
 * conditional authorization policies (domain, tag, owner) against the real target entity.
 * Regression coverage for #39150.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageDeleteByTypeAuthorizationIT {

  private static final String LINEAGE_PATH = "/v1/lineage";
  private static final String VIEW_LINEAGE = LineageDetails.Source.VIEW_LINEAGE.value();
  private static final String PIPELINE_LINEAGE = LineageDetails.Source.PIPELINE_LINEAGE.value();
  private static final String PII_SENSITIVE_TAG = "PII.Sensitive";

  private final Deque<Runnable> fixtureCleanups = new ArrayDeque<>();

  private record EdgeTables(Table from, Table to) {}

  @AfterEach
  void removeFixtures() {
    while (!fixtureCleanups.isEmpty()) {
      try {
        fixtureCleanups.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown so cleanup never hides the assertion result.
      }
    }
  }

  @Test
  void domainScopedAllowRejectsEntityInOtherDomain(TestNamespace ns) {
    Domain allowedDomain = createDomain(ns, "allowed");
    Domain otherDomain = createDomain(ns, "other");
    EdgeTables edge = createEdgeTablesWithTargetDomain(ns, otherDomain);
    putViewLineageEdge(edge);

    OpenMetadataClient caller =
        clientForPrincipal(
            ns,
            "domdeny",
            List.of(allowEditLineageWithCondition(ns, Entity.ALL_RESOURCES, "hasDomain()")),
            List.of(allowedDomain.getFullyQualifiedName()));

    assertThrows(
        ForbiddenException.class,
        () -> deleteLineageByType(caller, Entity.TABLE, edge.to().getId(), VIEW_LINEAGE));
    assertEquals(VIEW_LINEAGE, getEdge(edge).getSource().value());
  }

  @Test
  void domainScopedAllowPermitsEntityInUsersDomain(TestNamespace ns) {
    Domain userDomain = createDomain(ns, "user");
    EdgeTables edge = createEdgeTablesWithTargetDomain(ns, userDomain);
    putViewLineageEdge(edge);

    OpenMetadataClient caller =
        clientForPrincipal(
            ns,
            "domallow",
            List.of(allowEditLineageWithCondition(ns, Entity.TABLE, "hasDomain()")),
            List.of(userDomain.getFullyQualifiedName()));

    deleteLineageByType(caller, Entity.TABLE, edge.to().getId(), VIEW_LINEAGE);

    assertEdgeAbsent(edge);
  }

  @Test
  void tagDenyBlocksDeleteByTypeOnTaggedTable(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    tagTable(edge.to(), PII_SENSITIVE_TAG);
    putViewLineageEdge(edge);

    Rule allowAll =
        new Rule()
            .withName(ns.shortPrefix() + "allowEdit")
            .withResources(List.of(Entity.ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.EDIT_LINEAGE))
            .withEffect(Rule.Effect.ALLOW);
    Rule denyPii =
        new Rule()
            .withName(ns.shortPrefix() + "denyPii")
            .withResources(List.of(Entity.ALL_RESOURCES))
            .withOperations(List.of(MetadataOperation.EDIT_LINEAGE))
            .withCondition(String.format("matchAnyTag('%s')", PII_SENSITIVE_TAG))
            .withEffect(Rule.Effect.DENY);
    OpenMetadataClient caller =
        clientForPrincipal(ns, "piideny", List.of(allowAll, denyPii), List.of());

    assertThrows(
        ForbiddenException.class,
        () -> deleteLineageByType(caller, Entity.TABLE, edge.to().getId(), VIEW_LINEAGE));
    assertEquals(VIEW_LINEAGE, getEdge(edge).getSource().value());
  }

  @Test
  void noOwnerConditionRejectsOwnedTable(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    User owner = createSimpleUser(ns, "owner");
    assignOwner(edge.to(), owner);
    putViewLineageEdge(edge);

    OpenMetadataClient caller =
        clientForPrincipal(
            ns,
            "ownerdny",
            List.of(allowEditLineageWithCondition(ns, Entity.ALL_RESOURCES, "noOwner()")),
            List.of());

    assertThrows(
        ForbiddenException.class,
        () -> deleteLineageByType(caller, Entity.TABLE, edge.to().getId(), VIEW_LINEAGE));
    assertEquals(VIEW_LINEAGE, getEdge(edge).getSource().value());
  }

  @Test
  void nonExistentEntityReturnsNotFound() {
    ApiException missing =
        assertThrows(
            ApiException.class,
            () ->
                deleteLineageByType(
                    SdkClients.adminClient(), Entity.TABLE, UUID.randomUUID(), VIEW_LINEAGE));
    assertEquals(404, missing.getStatusCode());
  }

  @Test
  void mismatchedEntityTypeReturnsNotFound(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    putViewLineageEdge(edge);

    ApiException mismatch =
        assertThrows(
            ApiException.class,
            () ->
                deleteLineageByType(
                    SdkClients.adminClient(),
                    Entity.PIPELINE,
                    edge.to().getId(),
                    PIPELINE_LINEAGE));
    assertEquals(404, mismatch.getStatusCode());
    assertEquals(VIEW_LINEAGE, getEdge(edge).getSource().value());
  }

  private Domain createDomain(TestNamespace ns, String label) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(label))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Lineage authorization test domain"));
    fixtureCleanups.push(() -> admin.domains().delete(domain.getId()));
    return domain;
  }

  private static EdgeTables createEdgeTables(TestNamespace ns) {
    String schemaFqn = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    return new EdgeTables(
        TableTestFactory.createWithName(ns, schemaFqn, "src"),
        TableTestFactory.createWithName(ns, schemaFqn, "tgt"));
  }

  private static EdgeTables createEdgeTablesWithTargetDomain(TestNamespace ns, Domain domain) {
    EdgeTables edge = createEdgeTables(ns);
    Table target = SdkClients.adminClient().tables().get(edge.to().getId().toString(), "domains");
    target.setDomains(
        List.of(
            new EntityReference()
                .withId(domain.getId())
                .withType(Entity.DOMAIN)
                .withFullyQualifiedName(domain.getFullyQualifiedName())));
    SdkClients.adminClient().tables().update(target.getId().toString(), target);
    return edge;
  }

  private static void tagTable(Table table, String tagFqn) {
    Table loaded = SdkClients.adminClient().tables().get(table.getId().toString(), "tags");
    loaded.setTags(
        List.of(
            new TagLabel()
                .withTagFQN(tagFqn)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)));
    SdkClients.adminClient().tables().update(loaded.getId().toString(), loaded);
  }

  private static void assignOwner(Table table, User owner) {
    Table loaded = SdkClients.adminClient().tables().get(table.getId().toString(), "owners");
    loaded.setOwners(
        List.of(
            new EntityReference()
                .withId(owner.getId())
                .withType(Entity.USER)
                .withName(owner.getName())));
    SdkClients.adminClient().tables().update(loaded.getId().toString(), loaded);
  }

  private User createSimpleUser(TestNamespace ns, String label) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = (ns.shortPrefix() + label).toLowerCase(Locale.ROOT);
    String email = name + "_u@test.openmetadata.org";
    User user = admin.users().create(new CreateUser().withName(name + "_u").withEmail(email));
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));
    return user;
  }

  private static Rule allowEditLineageWithCondition(
      TestNamespace ns, String resource, String condition) {
    return new Rule()
        .withName(ns.shortPrefix() + "condEditLineage")
        .withResources(List.of(resource))
        .withOperations(List.of(MetadataOperation.EDIT_LINEAGE))
        .withCondition(condition)
        .withEffect(Rule.Effect.ALLOW);
  }

  private OpenMetadataClient clientForPrincipal(
      TestNamespace ns, String label, List<Rule> rules, List<String> domainFqns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = (ns.shortPrefix() + label).toLowerCase(Locale.ROOT);

    Policy policy =
        admin.policies().create(new CreatePolicy().withName(name + "_pol").withRules(rules));
    fixtureCleanups.push(() -> admin.policies().delete(policy.getId()));

    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(name + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    fixtureCleanups.push(() -> admin.roles().delete(role.getId()));

    String email = name + "_u@test.openmetadata.org";
    CreateUser createUser =
        new CreateUser().withName(name + "_u").withEmail(email).withRoles(List.of(role.getId()));
    if (!domainFqns.isEmpty()) {
      createUser.withDomains(domainFqns);
    }
    User user = admin.users().create(createUser);
    fixtureCleanups.push(() -> admin.users().delete(user.getId()));

    return SdkClients.createClient(email, email, new String[] {});
  }

  private static void putViewLineageEdge(EdgeTables edge) {
    LineageDetails details = new LineageDetails().withSource(LineageDetails.Source.VIEW_LINEAGE);
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, LINEAGE_PATH + edgePath(edge), details);
  }

  private static void deleteLineageByType(
      OpenMetadataClient client, String entityType, UUID entityId, String lineageSource) {
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            String.format("%s/%s/%s/type/%s", LINEAGE_PATH, entityType, entityId, lineageSource),
            null);
  }

  private static LineageDetails getEdge(EdgeTables edge) {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + edgePath(edge), null);
    return JsonUtils.treeToValue(JsonUtils.readTree(response).get("edge"), LineageDetails.class);
  }

  private static void assertEdgeAbsent(EdgeTables edge) {
    ApiException missing = assertThrows(ApiException.class, () -> getEdge(edge));
    assertEquals(404, missing.getStatusCode());
  }

  private static String edgePath(EdgeTables edge) {
    return "/table/name/"
        + encodePathSegment(edge.from().getFullyQualifiedName())
        + "/table/name/"
        + encodePathSegment(edge.to().getFullyQualifiedName());
  }

  private static String encodePathSegment(String segment) {
    return URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
