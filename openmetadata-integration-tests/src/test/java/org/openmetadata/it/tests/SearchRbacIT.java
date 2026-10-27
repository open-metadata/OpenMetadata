package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
      String resource, String index, BaseEntityIT<T, K> entityIt) {
    return new AssetType(
        resource, index, ns -> entityIt.createEntity(entityIt.createMinimalRequest(ns)));
  }

  @Test
  void viewAllowedUserFindsAssetAndDeniedUserDoesNot(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Map<AssetType, EntityInterface<?>> assets = new HashMap<>();
      for (AssetType type : ASSET_TYPES) {
        EntityInterface<?> entity = type.creator().apply(ns);
        SearchDocs.awaitDoc(type.index(), entity.getId(), doc -> true);
        assets.put(type, entity);
      }
      enableSearchAccessControl(admin, cleanup);
      for (AssetType type : ASSET_TYPES) {
        String fqn = assets.get(type).getFullyQualifiedName();
        String label = type.resource() + " " + fqn;
        OpenMetadataClient allowed =
            userWithRole(ns, label + "allow", allowView(List.of(type.resource())), cleanup);
        OpenMetadataClient denied =
            userWithRole(ns, label + "deny", denyAll(List.of(type.resource())), cleanup);
        awaitVisibility(allowed, type.index(), fqn, true, "ViewBasic-allowed user, " + label);
        awaitVisibility(denied, type.index(), fqn, false, "All-denied user, " + label);
      }
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void tableColumnSearchFollowsTheTablePolicy(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      Table table = (Table) ASSET_TYPES.get(1).creator().apply(ns);
      String columnFqn = table.getColumns().getFirst().getFullyQualifiedName();
      awaitVisibility(admin, "column_search_index", columnFqn, true, "admin, column");
      OpenMetadataClient allowed = userWithRole(ns, "colallow", allowView(List.of(TABLE)), cleanup);
      OpenMetadataClient denied = userWithRole(ns, "coldeny", denyAll(List.of(TABLE)), cleanup);
      enableSearchAccessControl(admin, cleanup);
      awaitVisibility(allowed, "column_search_index", columnFqn, true, "table-allowed, column");
      awaitVisibility(denied, "column_search_index", columnFqn, false, "table-denied, column");
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
  void exploreAndTypeCountsShowOnlyPermittedAssetTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      EntityInterface<?> table = createIndexed(ASSET_TYPES.get(1), ns);
      EntityInterface<?> dashboard = createIndexed(ASSET_TYPES.get(3), ns);
      String scope = idsFilter(table, dashboard);
      OpenMetadataClient all =
          userWithRole(ns, "all", allowView(List.of(TABLE, DASHBOARD)), cleanup);
      OpenMetadataClient tableOnly = userWithRole(ns, "tab", denyAll(List.of(DASHBOARD)), cleanup);
      OpenMetadataClient dashOnly = userWithRole(ns, "dash", denyAll(List.of(TABLE)), cleanup);
      OpenMetadataClient denied =
          userWithRole(ns, "none", denyAll(List.of(TABLE, DASHBOARD)), cleanup);
      enableSearchAccessControl(admin, cleanup);
      Awaitility.await("explore and counts are RBAC-filtered")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                assertExplore(all, scope, Map.of(TABLE, 1L, DASHBOARD, 1L));
                assertExplore(tableOnly, scope, Map.of(TABLE, 1L));
                assertExplore(dashOnly, scope, Map.of(DASHBOARD, 1L));
                assertExplore(denied, scope, Map.of());
              });
    } finally {
      drain(cleanup);
    }
  }

  private EntityInterface<?> createIndexed(AssetType type, TestNamespace ns) {
    EntityInterface<?> entity = type.creator().apply(ns);
    SearchDocs.awaitDoc(type.index(), entity.getId(), doc -> true);
    return entity;
  }

  /** The dataAsset (explore) hits and the per-type counts (browse tree) both match {@code expected}. */
  private void assertExplore(OpenMetadataClient client, String scope, Map<String, Long> expected)
      throws Exception {
    JsonNode hits =
        MAPPER.readTree(
            client
                .search()
                .query("*")
                .index(DATA_ASSET_INDEX)
                .queryFilter(scope)
                .size(10)
                .execute());
    Map<String, Long> exploreTypes = new HashMap<>();
    hits.at("/hits/hits")
        .forEach(hit -> exploreTypes.merge(hit.at("/_source/entityType").asText(), 1L, Long::sum));
    assertEquals(expected, exploreTypes, "Explore hits by entity type");
    JsonNode counts =
        MAPPER.readTree(
            client
                .search()
                .entityTypeCounts()
                .query("*")
                .index(DATA_ASSET_INDEX)
                .queryFilter(scope)
                .execute());
    Map<String, Long> countedTypes = new HashMap<>();
    counts
        .at("/aggregations/entityType/buckets")
        .forEach(
            bucket ->
                countedTypes.put(bucket.get("key").asText(), bucket.get("doc_count").asLong()));
    assertEquals(expected, countedTypes, "Browse-tree counts by entity type");
  }

  private static String idsFilter(EntityInterface<?> first, EntityInterface<?> second) {
    return "{\"query\":{\"terms\":{\"_id\":[\"%s\",\"%s\"]}}}"
        .formatted(first.getId(), second.getId());
  }

  private void awaitVisibility(
      OpenMetadataClient client, String index, String fqn, boolean visible, String who) {
    String filter =
        "{\"query\":{\"term\":{\"fullyQualifiedName\":\"%s\"}}}"
            .formatted(fqn.toLowerCase(Locale.ROOT).replace("\"", "\\\""));
    Awaitility.await(who + (visible ? " sees " : " does not see ") + fqn)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              JsonNode response =
                  MAPPER.readTree(
                      client.search().query("*").index(index).queryFilter(filter).execute());
              long hits = response.at("/hits/total/value").asLong();
              assertEquals(visible ? 1L : 0L, hits, who + " in " + index);
            });
  }

  private static Rule allowView(List<String> resources) {
    return new Rule()
        .withName("allowViewBasic")
        .withEffect(Rule.Effect.ALLOW)
        .withOperations(List.of(MetadataOperation.VIEW_BASIC))
        .withResources(resources);
  }

  private static Rule denyAll(List<String> resources) {
    return new Rule()
        .withName("denyAll")
        .withEffect(Rule.Effect.DENY)
        .withOperations(List.of(MetadataOperation.ALL))
        .withResources(resources);
  }

  /** A regular user holding one role made of {@code rule}, and a client signed in as them. */
  private OpenMetadataClient userWithRole(
      TestNamespace ns, String label, Rule rule, Deque<Runnable> cleanup) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = ns.uniqueShortId() + "_rbac";
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(name + "_policy")
                    .withDescription("Search RBAC policy for " + label)
                    .withRules(List.of(rule)));
    cleanup.push(() -> admin.policies().delete(policy.getId()));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(name + "_role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    cleanup.push(() -> admin.roles().delete(role.getId()));
    String email = name + "@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId())));
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private void enableSearchAccessControl(OpenMetadataClient admin, Deque<Runnable> cleanup)
      throws Exception {
    SearchSettings settings = readSearchSettings(admin);
    Boolean original = settings.getGlobalSettings().getEnableAccessControl();
    settings.getGlobalSettings().setEnableAccessControl(true);
    writeSearchSettings(admin, settings);
    cleanup.push(() -> restoreAccessControl(admin, original));
  }

  private void restoreAccessControl(OpenMetadataClient admin, Boolean original) {
    try {
      SearchSettings settings = readSearchSettings(admin);
      settings.getGlobalSettings().setEnableAccessControl(original);
      writeSearchSettings(admin, settings);
    } catch (Exception e) {
      throw new IllegalStateException("Could not restore search enableAccessControl", e);
    }
  }

  private SearchSettings readSearchSettings(OpenMetadataClient admin) throws Exception {
    String json =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
    Settings settings = MAPPER.readValue(json, Settings.class);
    return MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
  }

  private void writeSearchSettings(OpenMetadataClient admin, SearchSettings searchSettings)
      throws Exception {
    Settings settings =
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
  private void drain(Deque<Runnable> cleanup) {
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
