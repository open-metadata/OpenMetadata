package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocs;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Search RBAC for regular (non-bot) users: with {@code enableAccessControl} on, the caller's
 * policies are compiled into every search query, so an asset type a user is denied disappears from
 * search, explore and the per-type counts, while a type they are allowed stays visible.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
class SearchRbacIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DATA_ASSET_INDEX = "dataAsset";
  private static final String TABLE = "table";
  private static final String DASHBOARD = "dashboard";
  private static final String COLUMN_INDEX = "column_search_index";

  /** A searchable asset type: its policy resource, its index, and how to create one. */
  private record AssetType(
      String resource, String index, Function<TestNamespace, EntityInterface<?>> creator) {}

  private static final List<AssetType> ASSET_TYPES =
      List.of(
          asset("apiEndpoint", "api_endpoint_search_index", new APIEndpointResourceIT()),
          asset(TABLE, "table_search_index", new TableResourceIT()),
          asset(
              "storedProcedure", "stored_procedure_search_index", new StoredProcedureResourceIT()),
          asset(DASHBOARD, "dashboard_search_index", new DashboardResourceIT()),
          asset("pipeline", "pipeline_search_index", new PipelineResourceIT()),
          asset("topic", "topic_search_index", new TopicResourceIT()),
          asset("mlmodel", "mlmodel_search_index", new MlModelResourceIT()),
          asset("container", "container_search_index", new ContainerResourceIT()),
          asset("searchIndex", "search_entity_search_index", new SearchIndexResourceIT()),
          asset(
              "dashboardDataModel",
              "dashboard_data_model_search_index",
              new DashboardDataModelResourceIT()),
          asset("metric", "metric_search_index", new MetricResourceIT()));

  private static <T extends EntityInterface<?>, K> AssetType asset(
      final String resource, final String index, final BaseEntityIT<T, K> entityIt) {
    return new AssetType(
        resource, index, ns -> entityIt.createEntity(entityIt.createMinimalRequest(ns)));
  }

  @Test
  void viewAllowedUserFindsAssetAndDeniedUserDoesNot(final TestNamespace ns) throws Exception {
    final Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      final Map<AssetType, EntityInterface<?>> assets = createAllIndexed(ns);
      enableSearchAccessControl(SdkClients.adminClient(), cleanup);
      for (final AssetType type : ASSET_TYPES) {
        assertAllowedSeesAndDeniedDoesNot(ns, type, assets.get(type), cleanup);
      }
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void tableColumnSearchFollowsTheTablePolicy(final TestNamespace ns) throws Exception {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      final Table table = (Table) ASSET_TYPES.get(1).creator().apply(ns);
      final String columnFqn = table.getColumns().getFirst().getFullyQualifiedName();
      awaitVisibility(admin, COLUMN_INDEX, columnFqn, true, "admin, column");
      final OpenMetadataClient allowed =
          userWithRole(ns, "colallow", allowView(List.of(TABLE)), cleanup);
      final OpenMetadataClient denied =
          userWithRole(ns, "coldeny", denyAll(List.of(TABLE)), cleanup);
      enableSearchAccessControl(admin, cleanup);
      awaitVisibility(allowed, COLUMN_INDEX, columnFqn, true, "table-allowed, column");
      awaitVisibility(denied, COLUMN_INDEX, columnFqn, false, "table-denied, column");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Every user inherits DataConsumer (ViewAll on All) from the Organization team's default roles,
   * and allow rules are OR'd, so an allow on one type cannot hide another; scoping a user to one
   * type takes a deny on the others. (The Playwright suite this replaces strips Organization's
   * default roles in its global setup, which a shared IT server cannot do.)
   */
  @Test
  void exploreAndTypeCountsShowOnlyPermittedAssetTypes(final TestNamespace ns) throws Exception {
    final Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      final EntityInterface<?> table = createIndexed(ASSET_TYPES.get(1), ns);
      final EntityInterface<?> dashboard = createIndexed(ASSET_TYPES.get(3), ns);
      final Map<OpenMetadataClient, Map<String, Long>> expectedByUser =
          usersWithExpectedTypes(ns, cleanup);
      enableSearchAccessControl(SdkClients.adminClient(), cleanup);
      awaitExplore(expectedByUser, idsFilter(table, dashboard));
    } finally {
      drain(cleanup);
    }
  }

  private Map<AssetType, EntityInterface<?>> createAllIndexed(final TestNamespace ns) {
    final Map<AssetType, EntityInterface<?>> assets = new HashMap<>();
    for (final AssetType type : ASSET_TYPES) {
      assets.put(type, createIndexed(type, ns));
    }
    return assets;
  }

  private EntityInterface<?> createIndexed(final AssetType type, final TestNamespace ns) {
    final EntityInterface<?> entity = type.creator().apply(ns);
    SearchDocs.awaitDoc(type.index(), entity.getId(), doc -> true);
    return entity;
  }

  /** A ViewBasic-allowed user finds the asset in its index; an All-denied user does not. */
  private void assertAllowedSeesAndDeniedDoesNot(
      final TestNamespace ns,
      final AssetType type,
      final EntityInterface<?> asset,
      final Deque<Runnable> cleanup) {
    final String fqn = asset.getFullyQualifiedName();
    final String label = type.resource() + " " + fqn;
    final List<String> resources = List.of(type.resource());
    final OpenMetadataClient allowed =
        userWithRole(ns, label + "allow", allowView(resources), cleanup);
    final OpenMetadataClient denied = userWithRole(ns, label + "deny", denyAll(resources), cleanup);
    awaitVisibility(allowed, type.index(), fqn, true, "ViewBasic-allowed user, " + label);
    awaitVisibility(denied, type.index(), fqn, false, "All-denied user, " + label);
  }

  /** One user per visibility scope, mapped to the asset types (and counts) it must see. */
  private Map<OpenMetadataClient, Map<String, Long>> usersWithExpectedTypes(
      final TestNamespace ns, final Deque<Runnable> cleanup) {
    final List<String> both = List.of(TABLE, DASHBOARD);
    return Map.of(
        userWithRole(ns, "all", allowView(both), cleanup), Map.of(TABLE, 1L, DASHBOARD, 1L),
        userWithRole(ns, "tab", denyAll(List.of(DASHBOARD)), cleanup), Map.of(TABLE, 1L),
        userWithRole(ns, "dash", denyAll(List.of(TABLE)), cleanup), Map.of(DASHBOARD, 1L),
        userWithRole(ns, "none", denyAll(both), cleanup), Map.of());
  }

  private void awaitExplore(
      final Map<OpenMetadataClient, Map<String, Long>> expectedByUser, final String scope) {
    Awaitility.await("explore and counts are RBAC-filtered")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              for (final Map.Entry<OpenMetadataClient, Map<String, Long>> user :
                  expectedByUser.entrySet()) {
                assertExplore(user.getKey(), scope, user.getValue());
              }
            });
  }

  /** The dataAsset (explore) hits and the per-type counts (browse tree) both match {@code expected}. */
  private void assertExplore(
      final OpenMetadataClient client, final String scope, final Map<String, Long> expected)
      throws JsonProcessingException {
    assertEquals(expected, exploreHitsByType(client, scope), "Explore hits by entity type");
    assertEquals(expected, typeCounts(client, scope), "Browse-tree counts by entity type");
  }

  private Map<String, Long> exploreHitsByType(final OpenMetadataClient client, final String scope)
      throws JsonProcessingException {
    final JsonNode hits =
        MAPPER.readTree(
            client
                .search()
                .query("*")
                .index(DATA_ASSET_INDEX)
                .queryFilter(scope)
                .size(10)
                .execute());
    final Map<String, Long> exploreTypes = new HashMap<>();
    hits.at("/hits/hits")
        .forEach(hit -> exploreTypes.merge(hit.at("/_source/entityType").asText(), 1L, Long::sum));
    return exploreTypes;
  }

  private Map<String, Long> typeCounts(final OpenMetadataClient client, final String scope)
      throws JsonProcessingException {
    final JsonNode counts =
        MAPPER.readTree(
            client
                .search()
                .entityTypeCounts()
                .query("*")
                .index(DATA_ASSET_INDEX)
                .queryFilter(scope)
                .execute());
    final Map<String, Long> countedTypes = new HashMap<>();
    counts
        .at("/aggregations/entityType/buckets")
        .forEach(
            bucket ->
                countedTypes.put(bucket.get("key").asText(), bucket.get("doc_count").asLong()));
    return countedTypes;
  }

  private static String idsFilter(final EntityInterface<?> first, final EntityInterface<?> second) {
    return "{\"query\":{\"terms\":{\"_id\":[\"%s\",\"%s\"]}}}"
        .formatted(first.getId(), second.getId());
  }

  private void awaitVisibility(
      final OpenMetadataClient client,
      final String index,
      final String fqn,
      final boolean visible,
      final String who) {
    final String filter =
        "{\"query\":{\"term\":{\"fullyQualifiedName\":\"%s\"}}}"
            .formatted(fqn.toLowerCase(Locale.ROOT).replace("\"", "\\\""));
    Awaitility.await(who + (visible ? " sees " : " does not see ") + fqn)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              final JsonNode response =
                  MAPPER.readTree(
                      client.search().query("*").index(index).queryFilter(filter).execute());
              final long hits = response.at("/hits/total/value").asLong();
              assertEquals(visible ? 1L : 0L, hits, who + " in " + index);
            });
  }

  private static Rule allowView(final List<String> resources) {
    return new Rule()
        .withName("allowViewBasic")
        .withEffect(Rule.Effect.ALLOW)
        .withOperations(List.of(MetadataOperation.VIEW_BASIC))
        .withResources(resources);
  }

  private static Rule denyAll(final List<String> resources) {
    return new Rule()
        .withName("denyAll")
        .withEffect(Rule.Effect.DENY)
        .withOperations(List.of(MetadataOperation.ALL))
        .withResources(resources);
  }

  /** A regular user holding one role made of {@code rule}, and a client signed in as them. */
  private OpenMetadataClient userWithRole(
      final TestNamespace ns, final String label, final Rule rule, final Deque<Runnable> cleanup) {
    final String name = ns.uniqueShortId() + "_rbac";
    final Policy policy = createPolicy(name, label, rule, cleanup);
    final Role role = createRole(name, policy, cleanup);
    final String email = name + "@test.openmetadata.org";
    createUser(name, email, role, cleanup);
    return SdkClients.createClient(email, email, new String[] {});
  }

  private Policy createPolicy(
      final String name, final String label, final Rule rule, final Deque<Runnable> cleanup) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(name + "_policy")
                    .withDescription("Search RBAC policy for " + label)
                    .withRules(List.of(rule)));
    cleanup.push(() -> admin.policies().delete(policy.getId()));
    return policy;
  }

  private Role createRole(final String name, final Policy policy, final Deque<Runnable> cleanup) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(name + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    cleanup.push(() -> admin.roles().delete(role.getId()));
    return role;
  }

  private void createUser(
      final String name, final String email, final Role role, final Deque<Runnable> cleanup) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final User user =
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId())));
    cleanup.push(() -> admin.users().delete(user.getId()));
  }

  private void enableSearchAccessControl(
      final OpenMetadataClient admin, final Deque<Runnable> cleanup)
      throws JsonProcessingException {
    final SearchSettings settings = readSearchSettings(admin);
    final Boolean original = settings.getGlobalSettings().getEnableAccessControl();
    settings.getGlobalSettings().setEnableAccessControl(true);
    writeSearchSettings(admin, settings);
    cleanup.push(() -> restoreAccessControl(admin, original));
  }

  private void restoreAccessControl(final OpenMetadataClient admin, final Boolean original) {
    try {
      final SearchSettings settings = readSearchSettings(admin);
      settings.getGlobalSettings().setEnableAccessControl(original);
      writeSearchSettings(admin, settings);
    } catch (JsonProcessingException | OpenMetadataException e) {
      throw new IllegalStateException(
          "Could not restore search enableAccessControl to " + original, e);
    }
  }

  private SearchSettings readSearchSettings(final OpenMetadataClient admin)
      throws JsonProcessingException {
    final String json =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
    final Settings settings = MAPPER.readValue(json, Settings.class);
    return MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
  }

  private void writeSearchSettings(
      final OpenMetadataClient admin, final SearchSettings searchSettings)
      throws JsonProcessingException {
    final Settings settings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchSettings);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(settings),
            RequestOptions.builder().build());
  }

  /** Runs every cleanup step, so one failure cannot leave access control switched on. */
  private void drain(final Deque<Runnable> cleanup) {
    RuntimeException first = null;
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (RuntimeException e) {
        first = first == null ? e : first;
      }
    }
    if (first != null) {
      throw first;
    }
  }
}
