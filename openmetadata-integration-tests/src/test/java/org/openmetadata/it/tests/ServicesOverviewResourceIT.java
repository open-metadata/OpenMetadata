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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.dashboard.MetabaseConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Contract tests for {@code GET /v1/services/overview}.
 *
 * <p>The endpoint has no SDK method, so these drive it over raw HTTP and assert on the JSON. That is
 * deliberate for two of the cases below: {@code connectionIsNeverReturned} has to inspect the raw
 * payload rather than a deserialized POJO (a typed view would drop an unexpected field silently),
 * and the multi-value filters have to be exercised as real repeated query params.
 *
 * <p>The estate is shared with other tests running concurrently, so assertions are written as
 * deltas or as properties of this namespace's own services rather than as absolute totals.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ServicesOverviewResourceIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String OVERVIEW_PATH = "/v1/services/overview";
  private static final String DATABASE_SERVICE = "databaseService";
  private static final String DASHBOARD_SERVICE = "dashboardService";

  private JsonNode overview(String query) throws Exception {
    return overviewAs(SdkClients.adminClient(), query);
  }

  private JsonNode overviewAs(OpenMetadataClient client, String query) throws Exception {
    String json =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                OVERVIEW_PATH + (query.isEmpty() ? "" : "?" + query),
                null,
                RequestOptions.builder().build());
    assertNotNull(json, "overview response should not be null");
    assertFalse(json.isEmpty(), "overview response should not be empty");
    return MAPPER.readTree(json);
  }

  private DatabaseService postgres(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DATABASE_SERVICE,
        DatabaseServices.builder()
            .name(ns.prefix(name))
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .create());
  }

  private DatabaseService snowflake(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DATABASE_SERVICE,
        DatabaseServices.builder()
            .name(ns.prefix(name))
            .connection(
                DatabaseServices.snowflakeConnection()
                    .account("test-account")
                    .username("test")
                    .warehouse("test-warehouse")
                    .build())
            .create());
  }

  private DashboardService metabase(TestNamespace ns, String name) {
    CreateDashboardService request =
        new CreateDashboardService()
            .withName(ns.prefix(name))
            .withServiceType(DashboardServiceType.Metabase)
            .withConnection(
                new DashboardConnection()
                    .withConfig(
                        new MetabaseConnection()
                            .withHostPort(URI.create("http://localhost:3000"))
                            .withUsername("admin")));
    return ns.trackRoot(
        Entity.DASHBOARD_SERVICE, SdkClients.adminClient().dashboardServices().create(request));
  }

  /** Names of {@code data} entries belonging to this namespace, in the order returned. */
  private List<String> namespacedNames(JsonNode response, TestNamespace ns) {
    List<String> names = new ArrayList<>();
    for (JsonNode service : response.get("data")) {
      String name = service.get("name").asText();
      if (name.contains(ns.prefix(""))) {
        names.add(name);
      }
    }
    return names;
  }

  /** The single {@code data} entry with this exact name; fails if the response does not carry it. */
  private JsonNode serviceNamed(JsonNode response, String name) {
    JsonNode match = null;
    for (JsonNode service : response.get("data")) {
      if (name.equals(service.get("name").asText())) {
        match = service;
      }
    }
    assertNotNull(match, "response must contain the service named " + name);
    return match;
  }

  private int countFor(JsonNode response, String entityType) {
    return response.get("counts").get(entityType).asInt();
  }

  private int sumOf(JsonNode counts) {
    int total = 0;
    for (JsonNode value : counts) {
      total += value.asInt();
    }
    return total;
  }

  @Test
  void countsCoverEveryServiceEntityTypeAndSumToTotal() throws Exception {
    JsonNode response = overview("limit=0");

    JsonNode counts = response.get("counts");
    assertEquals(
        Entity.getServiceEntityTypes().size(),
        counts.size(),
        "every service entity type should be present in counts");
    for (String entityType : Entity.getServiceEntityTypes()) {
      assertTrue(counts.has(entityType), entityType + " missing from counts");
      assertTrue(counts.get(entityType).asInt() >= 0, entityType + " count should be non-negative");
    }
    assertEquals(sumOf(counts), response.get("total").asInt(), "total should be the sum of counts");
  }

  @Test
  void creatingServicesIsReflectedInTheCounts(TestNamespace ns) throws Exception {
    // Scoped by q rather than asserted as a delta against the whole estate: these tests run
    // concurrently, so any absolute count moves under us while this one is executing.
    String scope = "countDelta_" + UUID.randomUUID().toString().substring(0, 8);
    assertEquals(0, overview("limit=0&q=" + scope).get("total").asInt());

    postgres(ns, scope + "_db");
    metabase(ns, scope + "_dash");

    JsonNode after = overview("limit=0&q=" + scope);
    assertEquals(1, countFor(after, DATABASE_SERVICE));
    assertEquals(1, countFor(after, DASHBOARD_SERVICE));
    assertEquals(2, after.get("total").asInt());
  }

  @Test
  void dataIsNameSortedAcrossServiceTypes(TestNamespace ns) throws Exception {
    postgres(ns, "zzz_sorted");
    metabase(ns, "aaa_sorted");
    postgres(ns, "mmm_sorted");

    List<String> names = namespacedNames(overview("limit=1000&q=_sorted"), ns);

    assertEquals(3, names.size(), "all three namespaced services should be returned");
    List<String> sorted = new ArrayList<>(names);
    sorted.sort(String::compareToIgnoreCase);
    assertEquals(sorted, names, "data should be globally name-sorted across entity types");
  }

  @Test
  void descendingSortReversesTheOrder(TestNamespace ns) throws Exception {
    postgres(ns, "zzz_desc");
    metabase(ns, "aaa_desc");

    List<String> ascending = namespacedNames(overview("limit=1000&q=_desc"), ns);
    List<String> descending = namespacedNames(overview("limit=1000&q=_desc&sortOrder=desc"), ns);

    assertEquals(2, ascending.size());
    assertEquals(ascending.reversed(), descending);
  }

  @Test
  void pagingTheMergedListIsGaplessAndDuplicateFree(TestNamespace ns) throws Exception {
    for (int i = 0; i < 3; i++) {
      postgres(ns, String.format("page_db_%d", i));
      metabase(ns, String.format("page_dash_%d", i));
    }
    List<String> singlePage = namespacedNames(overview("limit=1000&q=page_"), ns);
    assertEquals(6, singlePage.size());

    List<String> walked = new ArrayList<>();
    for (int offset = 0; offset < 6; offset += 2) {
      walked.addAll(namespacedNames(overview("limit=2&offset=" + offset + "&q=page_"), ns));
    }
    assertEquals(singlePage, walked, "walking pages should reproduce the single-page result");
  }

  @Test
  void connectionIsNeverReturned(TestNamespace ns) throws Exception {
    postgres(ns, "noConnection");

    JsonNode response = overview("limit=1000&q=noConnection");
    JsonNode data = response.get("data");
    assertTrue(data.size() >= 1, "the created service should be listed");
    for (JsonNode service : data) {
      assertFalse(service.has("connection"), "overview must never expose connection config");
      assertTrue(service.has("id"));
      assertTrue(service.has("entityType"));
      assertTrue(service.has("name"));
      assertTrue(service.has("serviceType"));
    }
  }

  @Test
  void qNarrowsBothTheCountsAndTheList(TestNamespace ns) throws Exception {
    postgres(ns, "qFilter_one");
    postgres(ns, "qFilter_two");

    JsonNode response = overview("limit=1000&q=qFilter_");

    assertEquals(2, countFor(response, DATABASE_SERVICE), "q should narrow counts, not just data");
    assertEquals(2, response.get("total").asInt());
    assertEquals(2, response.get("paging").get("total").asInt());
    assertEquals(2, namespacedNames(response, ns).size());
  }

  @Test
  void listEntityTypeNarrowsTheListButNotTheCounts(TestNamespace ns) throws Exception {
    postgres(ns, "tabFilter_db");
    metabase(ns, "tabFilter_dash");

    JsonNode unscoped = overview("limit=1000&q=tabFilter_");
    JsonNode scoped = overview("limit=1000&q=tabFilter_&listEntityType=" + DATABASE_SERVICE);

    assertEquals(unscoped.get("counts"), scoped.get("counts"), "the tab must not move the badges");
    assertEquals(unscoped.get("total").asInt(), scoped.get("total").asInt());
    assertEquals(1, scoped.get("paging").get("total").asInt());
    for (JsonNode service : scoped.get("data")) {
      assertEquals(DATABASE_SERVICE, service.get("entityType").asText());
    }
  }

  @Test
  void entityTypeNarrowsTheCountedUniverse() throws Exception {
    JsonNode response =
        overview("limit=0&entityType=" + DATABASE_SERVICE + "&entityType=" + DASHBOARD_SERVICE);

    assertEquals(2, response.get("counts").size());
    assertTrue(response.get("counts").has(DATABASE_SERVICE));
    assertTrue(response.get("counts").has(DASHBOARD_SERVICE));
  }

  @Test
  void serviceTypeCountsSumToCountsAndListOnlyConnectorsThatExist(TestNamespace ns)
      throws Exception {
    postgres(ns, "connectorBreakdown_pg");
    snowflake(ns, "connectorBreakdown_sf");

    JsonNode response = overview("limit=1000&q=connectorBreakdown_");
    JsonNode breakdown = response.get("serviceTypeCounts").get(DATABASE_SERVICE);

    assertEquals(
        countFor(response, DATABASE_SERVICE),
        sumOf(breakdown),
        "serviceTypeCounts must sum to counts for that entity type");
    assertEquals(1, breakdown.get("Postgres").asInt());
    assertEquals(1, breakdown.get("Snowflake").asInt());
  }

  @Test
  void connectorFilterNarrowsTheListWithoutEatingItsOwnMenu(TestNamespace ns) throws Exception {
    postgres(ns, "connectorFilter_pg");
    snowflake(ns, "connectorFilter_sf");

    JsonNode unfiltered = overview("limit=1000&q=connectorFilter_");
    JsonNode filtered = overview("limit=1000&q=connectorFilter_&serviceType=Postgres");

    assertEquals(
        unfiltered.get("serviceTypeCounts"),
        filtered.get("serviceTypeCounts"),
        "selecting a connector must leave the connector options intact");
    assertEquals(unfiltered.get("counts"), filtered.get("counts"));
    assertEquals(1, filtered.get("paging").get("total").asInt());
    assertEquals(1, namespacedNames(filtered, ns).size());
  }

  @Test
  void repeatedConnectorFilterReturnsTheUnion(TestNamespace ns) throws Exception {
    postgres(ns, "connectorUnion_pg");
    snowflake(ns, "connectorUnion_sf");

    JsonNode union =
        overview("limit=1000&q=connectorUnion_&serviceType=Postgres&serviceType=Snowflake");

    assertEquals(2, union.get("paging").get("total").asInt());
    assertEquals(2, namespacedNames(union, ns).size());
  }

  @Test
  void repeatingTheSameConnectorDoesNotDoubleCount(TestNamespace ns) throws Exception {
    postgres(ns, "connectorDedupe_pg");

    JsonNode response =
        overview("limit=1000&q=connectorDedupe_&serviceType=Postgres&serviceType=Postgres");

    assertEquals(1, response.get("paging").get("total").asInt());
    assertEquals(1, namespacedNames(response, ns).size());
  }

  @Test
  void emptySelectionMeansNoFilterRatherThanMatchNothing(TestNamespace ns) throws Exception {
    postgres(ns, "emptySelection");

    JsonNode omitted = overview("limit=1000&q=emptySelection");
    JsonNode empty = overview("limit=1000&q=emptySelection&serviceType=&health=");

    assertEquals(1, namespacedNames(omitted, ns).size());
    assertEquals(
        omitted.get("paging").get("total").asInt(), empty.get("paging").get("total").asInt());
  }

  @Test
  void healthIsOptInAndTalliesEveryServiceInTheUniverse(TestNamespace ns) throws Exception {
    postgres(ns, "healthOptIn");

    JsonNode without = overview("limit=1000&q=healthOptIn");
    for (JsonNode service : without.get("data")) {
      assertFalse(service.has("health"), "health should be absent unless requested");
    }

    JsonNode with = overview("limit=1000&q=healthOptIn&includeHealth=true");
    for (JsonNode service : with.get("data")) {
      assertTrue(service.has("health"), "health should be present when requested");
    }
    JsonNode healthCounts = with.get("healthCounts").get(DATABASE_SERVICE);
    assertEquals(
        countFor(with, DATABASE_SERVICE),
        sumOf(healthCounts),
        "healthCounts must account for every service in the universe");
  }

  @Test
  void aServiceWithNoPipelinesIsNotRun(TestNamespace ns) throws Exception {
    postgres(ns, "healthNotRun");

    JsonNode response = overview("limit=1000&q=healthNotRun&includeHealth=true");

    assertEquals(1, response.get("data").size());
    assertEquals("notRun", response.get("data").get(0).get("health").asText());
  }

  @Test
  void healthFilterNarrowsTheListWithoutEatingItsOwnMenu(TestNamespace ns) throws Exception {
    postgres(ns, "healthFilter_a");
    postgres(ns, "healthFilter_b");

    JsonNode unfiltered = overview("limit=1000&q=healthFilter_&includeHealth=true");
    JsonNode filtered = overview("limit=1000&q=healthFilter_&health=notRun");

    assertEquals(
        unfiltered.get("healthCounts"),
        filtered.get("healthCounts"),
        "selecting a health state must leave the health options intact");
    assertEquals(2, filtered.get("paging").get("total").asInt());

    JsonNode none = overview("limit=1000&q=healthFilter_&health=failed");
    assertEquals(0, none.get("paging").get("total").asInt());
    assertEquals(0, namespacedNames(none, ns).size());
  }

  @Test
  void combinedConnectorAndHealthFilterAgreeWithTheReturnedRows(TestNamespace ns) throws Exception {
    postgres(ns, "combined_pg");
    snowflake(ns, "combined_sf");

    JsonNode response = overview("limit=1000&q=combined_&serviceType=Postgres&health=notRun");

    assertEquals(1, response.get("paging").get("total").asInt());
    assertEquals(1, namespacedNames(response, ns).size());
  }

  @Test
  void excludeProviderHidesSystemServicesFromBothCountsAndData() throws Exception {
    JsonNode all = overview("limit=1000&entityType=metadataService");
    JsonNode userOnly = overview("limit=1000&entityType=metadataService&excludeProvider=system");

    int systemServices = all.get("total").asInt() - userOnly.get("total").asInt();
    assertTrue(systemServices >= 1, "the built-in OpenMetadata service should be excluded");
    assertEquals(
        all.get("counts").get("metadataService").asInt() - systemServices,
        userOnly.get("counts").get("metadataService").asInt(),
        "excludeProvider must move counts and total together");
  }

  @Test
  void deletedServicesFollowTheIncludeParameter(TestNamespace ns) throws Exception {
    DatabaseService service = postgres(ns, "softDeleted");
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/services/databaseServices/" + service.getId() + "?hardDelete=false&recursive=true",
            null,
            RequestOptions.builder().build());

    assertTrue(
        namespacedNames(overview("limit=1000&q=softDeleted"), ns).isEmpty(),
        "a soft-deleted service must be absent without include=all");

    JsonNode withDeleted = overview("limit=1000&q=softDeleted&include=all");
    assertEquals(
        List.of(service.getName()),
        namespacedNames(withDeleted, ns),
        "include=all must return this namespace's soft-deleted service");
    assertTrue(
        serviceNamed(withDeleted, service.getName()).get("deleted").asBoolean(),
        "the service returned under include=all must be flagged deleted");
  }

  @Test
  void healthFilterIsScopedToTheListedTypesNotTheWholeUniverse(TestNamespace ns) throws Exception {
    postgres(ns, "healthScope_db");

    // The health selector only narrows `data`, which is scoped to listEntityType. Gating it on the
    // whole universe would refuse a small, perfectly resolvable list because some unrelated service
    // type is large — and the only escape would be shrinking the universe, which changes the count
    // maps the caller drives their filter controls from.
    JsonNode response =
        overview("limit=1000&q=healthScope_&listEntityType=" + DATABASE_SERVICE + "&health=notRun");

    assertEquals(1, namespacedNames(response, ns).size());
    assertEquals(1, response.get("paging").get("total").asInt());
    // The universe still spans every service type, so the caller's badges are unchanged.
    assertEquals(Entity.getServiceEntityTypes().size(), response.get("counts").size());
  }

  @Test
  void healthFilteredPagingTotalMatchesTheRowsReturned(TestNamespace ns) throws Exception {
    postgres(ns, "healthTotal_one");
    postgres(ns, "healthTotal_two");

    JsonNode response = overview("limit=1000&q=healthTotal_&health=notRun");

    // paging.total must agree with what is actually in data. Deriving it from healthCounts would
    // report zero whenever that map is omitted, telling a client there is nothing to page through
    // while handing it rows.
    assertEquals(2, namespacedNames(response, ns).size());
    assertEquals(2, response.get("paging").get("total").asInt());
  }

  @Test
  void anUnresolvableDomainIsRejectedRatherThanIgnored(TestNamespace ns) throws Exception {
    postgres(ns, "domainGuard");

    // The failure mode this guards is not an error code but the opposite of one: dropping an
    // unmatched domain predicate would answer "show me this domain" with the entire estate.
    assertThrows(
        Exception.class, () -> overview("limit=1000&domain=" + ns.prefix("no-such-domain")));
  }

  /**
   * The endpoint evaluates VIEW_BASIC per service entity type and drops the ones the caller cannot
   * see, so a non-admin has to still get a coherent answer rather than an empty one or a 403. The
   * per-type loop is the piece that regressed once already, by consulting the policy evaluator
   * directly instead of the injected authorizer.
   */
  @Test
  void aNonAdminSeesTheServiceTypesTheyArePermitted(TestNamespace ns) throws Exception {
    postgres(ns, "authz-postgres");

    JsonNode asConsumer =
        overviewAs(SdkClients.dataConsumerClient(), "limit=500&excludeProvider=system");

    JsonNode counts = asConsumer.get("counts");
    assertTrue(counts.has(DATABASE_SERVICE), "a data consumer should still see database services");
    assertTrue(
        counts.get(DATABASE_SERVICE).asInt() > 0,
        "the service just created should be counted for a permitted caller");
    assertEquals(
        sumOf(counts),
        asConsumer.get("total").asInt(),
        "total must stay consistent with the authorized counts");
  }

  /**
   * Builds a client for a user whose team carries a DENY rule on the given service resources.
   * Nothing is torn down explicitly — the namespace prefix keeps these out of other tests' way and
   * the deny only ever narrows what this one user can see.
   */
  private OpenMetadataClient clientDeniedOn(TestNamespace ns, String... deniedResources)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = ns.shortPrefix();

    Rule deny =
        new Rule()
            .withName("DenyServiceTypes")
            .withResources(List.of(deniedResources))
            .withOperations(List.of(MetadataOperation.VIEW_ALL, MetadataOperation.VIEW_BASIC))
            .withEffect(Rule.Effect.DENY);

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(prefix + "_denySvcPol");
    createPolicy.setRules(List.of(deny));
    Policy policy = admin.policies().create(createPolicy);

    CreateRole createRole = new CreateRole();
    createRole.setName(prefix + "_denySvcRole");
    createRole.setPolicies(List.of(policy.getFullyQualifiedName()));
    Role role = admin.roles().create(createRole);

    CreateTeam createTeam = new CreateTeam();
    createTeam.setName(prefix + "_denySvcTeam");
    createTeam.setTeamType(CreateTeam.TeamType.GROUP);
    createTeam.setDefaultRoles(List.of(role.getId()));
    Team team = admin.teams().create(createTeam);

    String email = prefix + "_denysvc@test.openmetadata.org";
    CreateUser createUser = new CreateUser();
    createUser.setName(prefix + "_denysvc");
    createUser.setEmail(email);
    createUser.setTeams(List.of(team.getId()));
    User user = admin.users().create(createUser);
    assertNotNull(user, "the restricted user should be created");

    return SdkClients.createClient(email, email, new String[] {});
  }

  /**
   * The endpoint evaluates VIEW_BASIC per service entity type and drops the ones the caller cannot
   * see, rather than failing the whole request. Without this the count maps a client drives its
   * filter controls from would advertise service types the user cannot open.
   */
  @Test
  void anUnauthorizedServiceTypeIsAbsentRatherThanEmpty(TestNamespace ns) throws Exception {
    postgres(ns, "authz-visible");
    metabase(ns, "authz-hidden");

    JsonNode asAdmin = overview("limit=500");
    assertTrue(
        asAdmin.get("counts").has(DASHBOARD_SERVICE),
        "precondition: an admin sees dashboard services");

    JsonNode restricted =
        overviewAs(clientDeniedOn(ns, DASHBOARD_SERVICE), "limit=500&excludeProvider=system");
    JsonNode counts = restricted.get("counts");

    assertFalse(
        counts.has(DASHBOARD_SERVICE),
        "a denied service type must be dropped from the counted universe, not returned as zero");
    assertTrue(counts.has(DATABASE_SERVICE), "a permitted service type must still be counted");
    assertEquals(
        sumOf(counts),
        restricted.get("total").asInt(),
        "total must be consistent with the authorized counts");
    for (JsonNode row : restricted.get("data")) {
      assertNotEquals(
          DASHBOARD_SERVICE,
          row.get("entityType").asText(),
          "no row of a denied service type may be listed");
    }
  }

  /**
   * Asking explicitly for only a denied type is a different case from asking broadly: there is
   * nothing left to answer with, so it is rejected rather than answered with an empty page that
   * looks like "no such services exist".
   */
  @Test
  void requestingOnlyDeniedServiceTypesIsRejected(TestNamespace ns) throws Exception {
    OpenMetadataClient restricted = clientDeniedOn(ns, DASHBOARD_SERVICE);

    assertThrows(
        Exception.class,
        () -> overviewAs(restricted, "entityType=" + DASHBOARD_SERVICE),
        "a universe consisting only of denied types should be rejected");
  }

  @Test
  void invalidParametersAreRejected() {
    assertThrows(Exception.class, () -> overview("offset=10000&limit=500"), "deep paging");
    assertThrows(Exception.class, () -> overview("limit=5000"), "limit above the maximum");
    assertThrows(Exception.class, () -> overview("limit=-1"), "negative limit");
    assertThrows(Exception.class, () -> overview("health=bogus"), "unknown health state");
    assertThrows(
        Exception.class, () -> overview("entityType=" + UUID.randomUUID()), "unknown entity type");
  }
}
