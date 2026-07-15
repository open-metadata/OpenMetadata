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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for domain member (user/team) bulk add/remove endpoints:
 * PUT /v1/domains/{name}/members/add and PUT /v1/domains/{name}/members/remove.
 *
 * <p>Covers:
 * - Mixed user + team add reflected in the members' `domains` field
 * - Remove from one domain preserves the member's other domain memberships
 * - dryRun=true does not write
 * - References that are not user/team are rejected with 400
 * - Non-admin without EditAll on the domain gets 403
 * - Double-add is idempotent (domain listed once)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DomainMembersBulkIT {

  // Creating the shared data-consumer user lazily inside a concurrent test can race with
  // other suites; pin it up front so the 403 test is deterministic.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  void test_bulkAddUsersAndTeams_reflectsInMemberDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns, client, "membersDomain");
    User user1 = createUser(ns, client, "member_user1");
    User user2 = createUser(ns, client, "member_user2");
    Team team = createTeam(ns, client, "member_team");

    BulkOperationResult result =
        addMembers(
            client,
            domain,
            List.of(
                user1.getEntityReference(), user2.getEntityReference(), team.getEntityReference()));

    assertEquals(3, result.getNumberOfRowsProcessed());
    assertEquals(3, result.getNumberOfRowsPassed());
    assertTrue(memberDomains(client, "users", user1.getId(), User.class).contains(domain.getId()));
    assertTrue(memberDomains(client, "users", user2.getId(), User.class).contains(domain.getId()));
    assertTrue(memberDomains(client, "teams", team.getId(), Team.class).contains(domain.getId()));
  }

  @Test
  void test_bulkRemoveMembers_preservesOtherDomainMemberships(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domainA = createDomain(ns, client, "domainA");
    Domain domainB = createDomain(ns, client, "domainB");
    User user = createUser(ns, client, "multi_domain_user");

    addMembers(client, domainA, List.of(user.getEntityReference()));
    addMembers(client, domainB, List.of(user.getEntityReference()));
    List<UUID> domainsAfterAdd = memberDomains(client, "users", user.getId(), User.class);
    assertTrue(domainsAfterAdd.contains(domainA.getId()));
    assertTrue(domainsAfterAdd.contains(domainB.getId()));

    BulkOperationResult result =
        executeMembersOperation(
            client, domainB, "remove", List.of(user.getEntityReference()), false);

    assertEquals(1, result.getNumberOfRowsPassed());
    List<UUID> domainsAfterRemove = memberDomains(client, "users", user.getId(), User.class);
    assertTrue(
        domainsAfterRemove.contains(domainA.getId()),
        "Removing the user from domainB must not touch its domainA membership");
    assertFalse(
        domainsAfterRemove.contains(domainB.getId()),
        "User should no longer be a member of domainB");
  }

  @Test
  void test_dryRunAdd_doesNotWrite(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns, client, "dryRunDomain");
    User user = createUser(ns, client, "dry_run_user");

    BulkOperationResult result =
        executeMembersOperation(client, domain, "add", List.of(user.getEntityReference()), true);

    assertTrue(result.getDryRun(), "Result must have dryRun=true");
    assertEquals(1, result.getNumberOfRowsPassed());
    assertFalse(
        memberDomains(client, "users", user.getId(), User.class).contains(domain.getId()),
        "dryRun must not create the membership");
  }

  @Test
  void test_invalidRefType_returns400(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns, client, "invalidTypeDomain");
    EntityReference tableRef = new EntityReference().withId(UUID.randomUUID()).withType("table");

    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> executeMembersOperation(client, domain, "add", List.of(tableRef), false));

    assertTrue(
        exception.getMessage().contains("user"),
        "Error message should state the allowed types: " + exception.getMessage());
  }

  @Test
  void test_nonAdminWithoutDomainEditAll_returns403(TestNamespace ns) throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    Domain domain = createDomain(ns, adminClient, "forbiddenDomain");
    User user = createUser(ns, adminClient, "forbidden_user");

    OpenMetadataException exception =
        assertThrows(
            OpenMetadataException.class,
            () ->
                executeMembersOperation(
                    SdkClients.dataConsumerClient(),
                    domain,
                    "add",
                    List.of(user.getEntityReference()),
                    false));

    assertEquals(
        403,
        exception.getStatusCode(),
        "DataConsumer without EditAll on the domain must not manage members");
  }

  @Test
  void test_idempotentDoubleAdd_listsDomainOnce(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = createDomain(ns, client, "idempotentDomain");
    User user = createUser(ns, client, "double_add_user");

    addMembers(client, domain, List.of(user.getEntityReference()));
    BulkOperationResult second = addMembers(client, domain, List.of(user.getEntityReference()));

    assertEquals(1, second.getNumberOfRowsPassed(), "Second add should still succeed");
    List<UUID> domains = memberDomains(client, "users", user.getId(), User.class);
    assertEquals(
        1,
        domains.stream().filter(domain.getId()::equals).count(),
        "Domain must be listed exactly once after a double add");
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private Domain createDomain(TestNamespace ns, OpenMetadataClient client, String suffix) {
    return client
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(suffix))
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Domain for member bulk tests"));
  }

  private User createUser(TestNamespace ns, OpenMetadataClient client, String suffix) {
    String name = ns.shortPrefix(suffix).toLowerCase(Locale.ROOT);
    return client
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(toValidEmail(name))
                .withDescription("User for member bulk tests"));
  }

  private Team createTeam(TestNamespace ns, OpenMetadataClient client, String suffix) {
    return client
        .teams()
        .create(
            new CreateTeam()
                .withName(ns.prefix(suffix))
                .withTeamType(CreateTeam.TeamType.GROUP)
                .withDescription("Team for member bulk tests"));
  }

  private String toValidEmail(String name) {
    return name.replaceAll("[^a-zA-Z0-9._-]", "") + "@open-metadata.org";
  }

  private BulkOperationResult addMembers(
      OpenMetadataClient client, Domain domain, List<EntityReference> members) throws Exception {
    return executeMembersOperation(client, domain, "add", members, false);
  }

  private BulkOperationResult executeMembersOperation(
      OpenMetadataClient client,
      Domain domain,
      String operation,
      List<EntityReference> members,
      boolean dryRun)
      throws Exception {
    BulkAssets request = new BulkAssets().withAssets(members).withDryRun(dryRun);
    String path = "/v1/domains/" + domain.getFullyQualifiedName() + "/members/" + operation;
    return client.getHttpClient().execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
  }

  private <T extends EntityInterface> List<UUID> memberDomains(
      OpenMetadataClient client, String collection, UUID memberId, Class<T> entityClass)
      throws Exception {
    T member =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/" + collection + "/" + memberId + "?fields=domains",
                null,
                entityClass);
    return member.getDomains() == null
        ? List.of()
        : member.getDomains().stream().map(EntityReference::getId).toList();
  }
}
